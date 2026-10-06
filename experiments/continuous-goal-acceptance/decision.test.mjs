import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acceptObservedArtifact } from './decision.mjs';
import { readRecord, writeRecord } from './records.mjs';
import { settleDecision } from './resources.mjs';

test('acceptance uses observed accepted CAS and preserves a rejection before independent cleanup failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-o16-decision-'));
  const artifact = { binding: { nodeId: 'node', executionId: 'candidate', artifactId: 'artifact', artifactVersion: 'fixed-digest' }, executionId: 'candidate' };
  try {
    for (const accepted of [null, { executionId: 'previously-accepted' }]) {
      const file = join(directory, accepted ? 'replacement.json' : 'first.json'); let calls = 0;
      const controller = { async command(command) {
        calls++; assert.equal(command.input.executionId, 'candidate');
        assert.equal(command.input.expectedCurrentExecutionId, accepted?.executionId ?? null);
        return { state: 'acknowledged', key: 'stable-' + calls, receipt: { delivery: { executionId: 'candidate' } } };
      } };
      await acceptObservedArtifact({ controller, artifact, observed: { nodeId: 'node', accepted, execution: { id: 'candidate', artifact: artifact.binding } },
        reason: 'Explicit independent acceptance.', checkpoint: value => writeRecord(file, value) });
      const saved = await readRecord(file); assert.equal(saved.command.input.expectedCurrentExecutionId, accepted?.executionId ?? null);
      assert.equal(saved.outcome.state, 'acknowledged'); assert.equal(calls, 1);
    }
    const report = { outcome: 'unknown', acceptanceCommands: [] }, file = join(directory, 'rejected.json'); let calls = 0;
    const rejection = { state: 'rejected', key: 'unchanged-original-key', code: 'delivery_version' };
    await assert.rejects(acceptObservedArtifact({ controller: { async command() { calls++; return rejection; } }, artifact,
        observed: { nodeId: 'node', accepted: null, execution: { id: 'candidate', artifact: artifact.binding } }, reason: 'Explicit independent acceptance.',
        checkpoint: async value => { report.acceptanceCommands.push(value); await writeRecord(file, report); } }), error => {
      assert.equal(error.code, 'ERR_ASSERTION'); report.decisionFailure = { state: 'unconfirmed', name: error.name, code: error.code }; return true;
    });
    assert.deepEqual((await readRecord(file)).acceptanceCommands[0].outcome, rejection); assert.equal(calls, 1);
    await assert.rejects(settleDecision({ async finish(options) {
      assert.equal(options.destroy, false); throw new Error('Injected cleanup failure.');
    } }, report, value => writeRecord(file, value), false), /Injected cleanup failure/);
    const final = await readRecord(file);
    assert.deepEqual(final.acceptanceCommands[0].outcome, rejection); assert.equal(final.decisionFailure.state, 'unconfirmed');
    assert.equal(final.cleanupFailure.state, 'unconfirmed'); assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true }); }
});
