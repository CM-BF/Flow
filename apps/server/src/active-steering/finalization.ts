import type { Pool, PoolClient } from 'pg';
import type { Ownership } from '@flow/contracts';
import type { SteeringFinalizationInput, SteeringFinalizationResult, SteeringMailbox, SteeringProposalLookup, SteeringProposalStatus } from '../../../../packages/contracts/src/active-steering.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { applyEvent, persistEventState } from '../events.js';
import { ownedAttempt } from '../runners.js';
import { sealForFinal } from './commands.js';
import { resultHistory } from './results.js';
import { commandColumns, commandReference, conflict, liveAttempt, type CommandRow, type ControlRow } from './storage.js';

type Committed = Extract<SteeringFinalizationResult, { state: 'committed' }>;
const operation = (attemptId: string) => `steering.finalize:${attemptId}`;
async function savedProposal(client: PoolClient, input: SteeringProposalLookup) {
  return (await client.query<{ digest: string; response: Committed }>('SELECT digest,response FROM flow.commands WHERE operation=$1 AND key=$2', [operation(input.attemptId), input.proposalId])).rows[0];
}
export async function steeringProposalStatus(pool: Pool, runnerId: string, input: SteeringProposalLookup): Promise<SteeringProposalStatus> {
  return transaction(pool, async client => {
    await ownedAttempt(client, runnerId, input);
    const saved = await savedProposal(client, input);
    return saved ? { ...saved.response, replayed: true } : { state: 'absent', proposalId: input.proposalId };
  });
}
export async function steeringMailbox(pool: Pool, runnerId: string, ownership: Ownership): Promise<SteeringMailbox> {
  return transaction(pool, async client => {
    const { attempt } = await liveAttempt(client, runnerId, ownership);
    const state = (await client.query<ControlRow>('SELECT revision,seal FROM flow.steering_attempts WHERE attempt_id=$1', [attempt.id])).rows[0];
    const rows = (await client.query<CommandRow>(`SELECT ${commandColumns} FROM flow.steering_commands WHERE attempt_id=$1 ORDER BY revision LIMIT 64`, [attempt.id])).rows;
    const accepted = rows.find(row => row.status === 'accepted');
    const delivery = accepted ? (await client.query<{ text: string }>('SELECT text FROM flow.steering_commands WHERE id=$1', [accepted.id])).rows[0] : undefined;
    if (accepted && (!delivery || sha256(delivery.text) !== accepted.input_digest)) conflict('steering_content', 'Steering input digest does not match.');
    return { revision: state?.revision ?? 0, sealed: Boolean(state?.seal), commands: rows.map(commandReference), delivery: accepted && delivery ? { commandId: accepted.id, text: delivery.text } : null };
  });
}
/** Not-committed is a definitive response for this call. A transport timeout is never converted to it. */
export async function finalizeSteering(pool: Pool, runnerId: string, input: SteeringFinalizationInput): Promise<SteeringFinalizationResult> {
  return transaction(pool, async client => {
    await ownedAttempt(client, runnerId, input); // Current credential/fence even before receipt replay.
    const saved = await savedProposal(client, input);
    if (saved) {
      if (saved.digest !== sha256(canonical(input))) conflict('idempotency_conflict', 'Proposal ID was used for different content.');
      return { ...saved.response, replayed: true };
    }
    const { task, attempt } = await liveAttempt(client, runnerId, input);
    const state = (await client.query<ControlRow>('SELECT revision,seal FROM flow.steering_attempts WHERE attempt_id=$1', [attempt.id])).rows[0];
    const revision = state?.revision ?? 0;
    const blocked = (reason: Extract<SteeringFinalizationResult, { state: 'not-committed' }>['reason']): SteeringFinalizationResult => ({ state: 'not-committed', proposalId: input.proposalId, lastSequence: attempt.last_sequence, controlRevision: revision, reason });
    if (state?.seal) conflict('steering_sealed', 'Another proposal already sealed this attempt.');
    if (input.afterSequence !== attempt.last_sequence) return blocked('sequence-changed');
    if (input.expectedRevision !== revision) return blocked('control-changed');
    const commands = (await client.query<CommandRow>(`SELECT ${commandColumns} FROM flow.steering_commands WHERE attempt_id=$1 ORDER BY revision`, [attempt.id])).rows;
    if (commands.some(row => ['accepted', 'received', 'unknown'].includes(row.status))) return blocked('pending-command');
    const history = await resultHistory(client, attempt.id), latest = history.at(-1);
    if (!latest || latest.sourceMessageId !== input.resultId || latest.outcome !== 'success') return blocked('result-not-current');
    if (latest.queuedTurnCount !== 0) return blocked('sdk-pending');
    const covered = new Set(history.filter(result => result.outcome === 'success').flatMap(result => result.consumedUserMessageUuids));
    if (commands.some(row => row.status !== 'rejected' && !covered.has(row.user_message_uuid))) return blocked('uncovered-command');
    const [artifact, verification, final] = input.events;
    if (input.events.length !== 3 || artifact?.type !== 'artifact' || verification?.type !== 'verification' || final?.type !== 'assistant-final'
      || input.events.some((event, index) => event.sequence !== input.afterSequence + index + 1)
      || new Set(input.events.map(event => event.id)).size !== 3) throw new HttpError(400, 'steering_final_batch', 'Final proposal requires contiguous artifact, verification and assistant-final events.');
    if (input.nativeSessionId !== attempt.native_session_id || latest.nativeSessionId !== input.nativeSessionId
      || final.nativeSessionId !== input.nativeSessionId || final.sourceMessageId !== input.resultId
      || latest.contentDigest !== sha256(final.content) || artifact.content !== final.content
      || verification.artifactId !== artifact.artifactId || verification.artifactVersion !== artifact.version) conflict('steering_final_identity', 'Final proposal does not match its successful result and exact artifact.');
    await sealForFinal(client, runnerId, { attemptId: input.attemptId, ownerVersion: input.ownerVersion, expectedRevision: input.expectedRevision, final: { nativeSessionId: input.nativeSessionId, sourceMessageId: input.resultId, contentDigest: latest.contentDigest } });
    for (const event of input.events) {
      await applyEvent(client, task, attempt, event);
      await client.query('INSERT INTO flow.runner_events(attempt_id,sequence,event_id,digest) VALUES($1,$2,$3,$4)', [attempt.id, event.sequence, event.id, sha256(canonical(event))]);
      attempt.last_sequence = event.sequence;
    }
    await persistEventState(client, task, attempt);
    const response: Committed = { state: 'committed', proposalId: input.proposalId, lastSequence: attempt.last_sequence, replayed: false };
    await client.query('INSERT INTO flow.commands(operation,key,digest,response) VALUES($1,$2,$3,$4)', [operation(attempt.id), input.proposalId, sha256(canonical(input)), JSON.stringify(response)]);
    return response;
  });
}
