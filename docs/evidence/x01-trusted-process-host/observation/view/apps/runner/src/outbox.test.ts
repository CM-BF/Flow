import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { EventOutbox } from './outbox.js';
import { FinalizationUnknown, FinalProposalJournal } from './active-steering/proposal.js';
import { textDigest, verifyText } from './verifier.js';
import type { EventBatch, RunnerEventData } from '@flow/contracts';
import type { SteeringFinalizationInput } from '../../../packages/contracts/src/active-steering.js';
const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function setup(report: (batch: EventBatch) => Promise<void> = async () => {}) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat08-outbox-')); directories.push(directory);
  return { directory, outbox: new EventOutbox(directory, { attemptId: 'attempt', ownerVersion: 1 }, report) };
}
function candidate() {
  const artifactId = randomUUID(), text = 'Final';
  const events: RunnerEventData[] = [{ type: 'artifact', artifactId, title: 'Final', content: text, version: textDigest(text), mediaType: 'text/plain' }, verifyText(artifactId, text),
    { type: 'assistant-final', messageId: textDigest(JSON.stringify(['session', 'result'])), nativeSessionId: 'session', sourceMessageId: 'result', source: 'claude.sdk.result', content: text, settings: { requested: { model: 'test', thinking: 'disabled', permissionMode: 'dontAsk' }, effective: { model: null, thinking: 'unknown', permissionMode: null, tools: null } } }];
  return { expectedRevision: 0, nativeSessionId: 'session', resultId: 'result', events };
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
it('flushes the durable prefix, freezes concurrent allocation, then continues after a committed final', async () => {
  const batches: EventBatch[] = [], entered = deferred(), release = deferred();
  const { outbox, directory } = await setup(async batch => { batches.push(batch); });
  await outbox.emit({ type: 'message', text: 'Prefix' });
  let sent!: SteeringFinalizationInput;
  const final = outbox.finalize(candidate(), { async submit(input) {
    sent = input; expect(JSON.parse(await readFile(join(directory, 'pending-final-proposal.json'), 'utf8'))).toEqual(input);
    entered.resolve(); await release.promise; return { state: 'committed', proposalId: input.proposalId, lastSequence: 4, replayed: false };
  }, async status() { throw new Error('Not used'); } });
  await entered.promise;
  const completed = outbox.emit({ type: 'completed', outcome: 'succeeded' });
  expect(batches.flatMap(batch => batch.events).map(event => event.sequence)).toEqual([1]);
  release.resolve(); await final; await completed;
  expect(sent.events.map(event => event.sequence)).toEqual([2, 3, 4]);
  expect(batches.at(-1)!.events[0]!.sequence).toBe(5);
});
it('a definitive conflict consumes no sequence and can continue the same attempt', async () => {
  const sequences: number[] = []; const { outbox } = await setup(async batch => { sequences.push(...batch.events.map(event => event.sequence)); });
  expect(await outbox.finalize(candidate(), { async submit(input) { return { state: 'not-committed', proposalId: input.proposalId, lastSequence: 0, controlRevision: 1, reason: 'control-changed' }; }, async status() { throw new Error('Not used'); } })).toMatchObject({ state: 'not-committed' });
  await outbox.emit({ type: 'message', text: 'Continue' }); expect(sequences).toEqual([1]);
});
it('a lost response confirms the original receipt without another submission', async () => {
  const { outbox } = await setup(); let calls = 0;
  expect(await outbox.finalize(candidate(), { async submit() { calls++; throw new Error('ACK lost'); }, async status(input) { return { state: 'committed', proposalId: input.proposalId, lastSequence: 3, replayed: true }; } })).toMatchObject({ state: 'committed' });
  expect(calls).toBe(1);
});
it('absence after timeout retains exact bytes, freezes all output and recovers only a committed receipt after restart', async () => {
  const { outbox, directory } = await setup(); let original!: SteeringFinalizationInput;
  await expect(outbox.finalize(candidate(), { async submit(input) { original = input; throw new Error('Timeout'); }, async status(input) { return { state: 'absent', proposalId: input.proposalId }; } })).rejects.toBeInstanceOf(FinalizationUnknown);
  expect(JSON.parse(await readFile(join(directory, 'pending-final-proposal.json'), 'utf8'))).toEqual(original);
  await expect(outbox.emit({ type: 'completed', outcome: 'failed' })).rejects.toBeInstanceOf(FinalizationUnknown);
  const restarted = new FinalProposalJournal(directory);
  await expect(restarted.recover(async input => ({ state: 'absent', proposalId: input.proposalId }))).rejects.toBeInstanceOf(FinalizationUnknown);
  expect(await restarted.recover(async input => ({ state: 'committed', proposalId: input.proposalId, lastSequence: 3, replayed: true }))).toEqual({ attemptId: 'attempt' });
  expect(JSON.parse(await readFile(join(directory, 'confirmed-final-proposal.json'), 'utf8'))).toEqual(original);
});
