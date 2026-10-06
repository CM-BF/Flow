import { assertSteeringExecutionProfile } from '../execution-profiles/store.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { steeringSealSchema, type SteeringCommandInput, type SteeringCommandResult, type SteeringReceiptInput, type SteeringSeal, type SteeringSealInput } from '../../../../packages/contracts/src/active-steering.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { commandInTransaction } from '../tasks.js';
import { appendAudit, assertNoPending, commandColumns, commandReference, conflict, control, liveAttempt, ownerAttempt, type CommandRow } from './storage.js';
import { commandAdmissionBlock, readCommandAdmission, type CommandAdmissionBlock } from './admission-policy.js';

const admissionErrors: Record<CommandAdmissionBlock, [string, string]> = {
  'final-exists': ['steering_final_exists', 'This attempt already has a canonical final.'],
  'limit-reached': ['steering_limit', 'This attempt reached its bounded command limit.'],
  sealed: ['steering_sealed', 'This attempt is sealed for its final result.'],
  'stale-revision': ['steering_revision', 'Refresh the steering revision before submitting.'],
  pending: ['steering_pending', 'An unresolved steering command already exists.'],
  'unknown-pending': ['steering_pending', 'An unresolved steering command already exists.'],
};

export async function acceptSteering(pool: Pool, taskId: string, input: SteeringCommandInput, key: string): Promise<SteeringCommandResult> {
  return transaction(pool, async client => {
    const { task, attempt } = await ownerAttempt(client, taskId, input);
    await assertSteeringExecutionProfile(client, task.submission, attempt.runner_id);
    const result = await commandInTransaction(client, `steering.accept:${taskId}`, key, input, async () => {
      const state = await readCommandAdmission(client, attempt.id);
      const blocked = commandAdmissionBlock(state, input.expectedRevision);
      if (blocked) conflict(...admissionErrors[blocked]);
      await control(client, taskId, attempt.id);
      const row = (await client.query<CommandRow>(`INSERT INTO flow.steering_commands(id,task_id,attempt_id,owner_version,native_session_id,revision,user_message_uuid,text,input_digest,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'accepted') RETURNING ${commandColumns}`,
      [randomUUID(), taskId, attempt.id, input.ownerVersion, attempt.native_session_id, state.revision + 1, randomUUID(), input.text, sha256(input.text)])).rows[0]!;
      await client.query('UPDATE flow.steering_attempts SET revision=$2 WHERE attempt_id=$1', [attempt.id, row.revision]);
      const reference = commandReference(row);
      await appendAudit(client, taskId, attempt.id, row.id, 'accepted', 'owner', { revision: row.revision, input: reference.input, userMessageUuid: row.user_message_uuid });
      return reference;
    });
    return { command: result.value, replayed: result.replayed };
  });
}
export async function recordReceipt(pool: Pool, runnerId: string, input: SteeringReceiptInput): Promise<SteeringCommandResult> {
  return transaction(pool, client => recordReceiptInTransaction(client, runnerId, input));
}
export async function recordReceiptInTransaction(client: PoolClient, runnerId: string, input: SteeringReceiptInput): Promise<SteeringCommandResult> {
  const { task, attempt } = await liveAttempt(client, runnerId, input);
  const row = (await client.query<CommandRow>(`SELECT ${commandColumns} FROM flow.steering_commands WHERE id=$1 AND task_id=$2 AND attempt_id=$3`, [input.commandId, task.id, attempt.id])).rows[0];
  if (!row) throw new HttpError(404, 'steering_command', 'Command not found for this attempt.');
  if (row.native_session_id !== input.nativeSessionId || attempt.native_session_id !== input.nativeSessionId || row.user_message_uuid !== input.userMessageUuid) conflict('steering_identity', 'Receipt native identity does not match the command.');
  const result = await commandInTransaction(client, `steering.receipt:${attempt.id}`, input.receiptId, input, async () => {
    if (row.receipt_revision !== input.expectedReceiptRevision) conflict('steering_receipt_revision', 'Receipt version changed.');
    const allowed = row.status === 'accepted' ? ['received', 'rejected', 'unknown'] : row.status === 'received' ? ['observed-consumed', 'rejected', 'unknown'] : [];
    if (!allowed.includes(input.phase)) conflict('steering_transition', 'The receipt phase cannot follow the current command state.');
    const changed = (await client.query<CommandRow>(`UPDATE flow.steering_commands SET status=$2,receipt_revision=receipt_revision+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING ${commandColumns}`, [row.id, input.phase])).rows[0]!;
    const evidence = input.phase === 'observed-consumed'
      ? { sourceMessageId: input.sourceMessageId, sourceType: input.sourceType, parentToolUseId: input.parentToolUseId, consumedUserMessageUuids: input.consumedUserMessageUuids }
      : 'reason' in input ? { reason: input.reason } : {};
    await appendAudit(client, task.id, attempt.id, row.id, input.phase, 'runner', { receiptId: input.receiptId, receiptRevision: changed.receipt_revision, ...evidence });
    return commandReference(changed);
  });
  return { command: result.value, replayed: result.replayed };
}
/** The caller must persist the final in this same transaction. The conditional CHAT08 route calls this seam with its artifact/verifier/final batch. */
export async function sealForFinal(client: PoolClient, runnerId: string, raw: SteeringSealInput): Promise<SteeringSeal> {
  const parsed = steeringSealSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, 'steering_input', 'Invalid final seal.');
  const input = parsed.data;
  const { task, attempt } = await liveAttempt(client, runnerId, input);
  if (attempt.native_session_id !== input.final.nativeSessionId) conflict('steering_identity', 'Final native session does not match this attempt.');
  const state = await control(client, task.id, attempt.id);
  if (state.seal) {
    if (canonical(state.seal.final) !== canonical(input.final) || state.seal.revision !== input.expectedRevision) conflict('steering_seal_conflict', 'Another final seal already exists.');
    return state.seal;
  }
  if (state.revision !== input.expectedRevision) conflict('steering_revision', 'Steering revision changed before final sealing.');
  await assertNoPending(client, attempt.id);
  const sealedAt = (await client.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]!.now.toISOString();
  const seal: SteeringSeal = { taskId: task.id, attemptId: attempt.id, revision: state.revision, final: input.final, sealedAt };
  await client.query('UPDATE flow.steering_attempts SET seal=$2 WHERE attempt_id=$1', [attempt.id, JSON.stringify(seal)]);
  await appendAudit(client, task.id, attempt.id, null, 'sealed', 'runner', { final: input.final, revision: state.revision });
  return seal;
}
