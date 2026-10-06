import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from './driver.mjs';
const output = process.env.FLOW_O10_EVIDENCE_ROOT ? resolve(process.env.FLOW_O10_EVIDENCE_ROOT) : await mkdtemp(join(tmpdir(), 'flow-o10-results-'));
for (const scenario of ['init-difference', 'denied-tool', 'allow-without-read', 'error-result']) {
  test(`real center and child runner preserve rejection facts for ${scenario}`, async () => {
    const report = await run('rehearsal', join(output, scenario), undefined, scenario);
    assert.equal(report.outcome, 'failed-or-unknown'); assert.equal(report.nativeQueryCalls, 0);
    assert.equal(report.worker.queryAdapterCalls, 1); assert.equal(report.worker.queryClosed, true);
    assert.equal(report.workerProcessGroup.state, 'stopped'); assert(Object.values(report.cleanup).every(v => v === true));
    assert.deepEqual(report.remainingDatabases, []); assert.equal(report.goal.nodes[0].accepted, null);
    if (scenario === 'allow-without-read') {
      assert.equal(report.task.status, 'succeeded'); assert.equal(report.task.verificationStatus, 'passed'); assert(report.final);
      assert(report.worker.hostToolDecisions.every(row => row.decision === 'allowed')); assert.deepEqual(report.worker.readObservations, []);
    }
    if (scenario === 'denied-tool') { assert.equal(report.worker.hostToolDecisions[0].decision, 'denied'); assert.equal(report.worker.permissionDenials.total, 1); }
    if (scenario === 'error-result' || scenario === 'init-difference') {
      assert.equal(report.task.status, 'failed'); assert.equal(report.final, null); assert(!report.details.some(d => d.kind === 'artifact'));
    }
  });
}
