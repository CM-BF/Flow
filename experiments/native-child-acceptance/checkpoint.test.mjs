import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, access, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Pool } from 'pg';
import { run } from './driver.mjs';
const evidence = process.env.FLOW_O10_EVIDENCE_ROOT ? resolve(process.env.FLOW_O10_EVIDENCE_ROOT) : await mkdtemp(join(tmpdir(), 'flow-o10-checkpoint-'));

test('checkpoint write failure stops owned processes but preserves the private database and worker evidence', async () => {
  const output = join(evidence, 'checkpoint-write-failure'); await mkdir(join(output, 'checkpoint.json'), { recursive: true });
  const report = await run('rehearsal', output);
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const database = report.ids.database;
  try {
    assert.equal(report.outcome, 'failed-or-unknown'); assert.equal(report.failurePhase, 'evidence-checkpoint');
    assert.equal(report.evidenceCheckpoint.saved, false); assert.equal(report.nativeQueryCalls, 0);
    assert.equal(report.workerProcessGroup.state, 'stopped'); assert.equal(report.cleanup.runnerStopped, true); assert.equal(report.cleanup.centerClosed, true);
    assert.equal(report.cleanup.databaseRemoved, false); assert.equal(report.cleanup.privateTemporaryDirectoryRemoved, false);
    assert.deepEqual((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows, [{ datname: database }]);
    const worker = JSON.parse(await readFile(join(report.privateResources.directory, 'worker-report.json'), 'utf8'));
    assert.equal(worker.queryClosed, true); assert.equal(worker.nativeQueryCalls, 0);
    assert.equal(report.task.status, 'succeeded'); assert.equal(report.goal.nodes[0].accepted, null);
    const saved = JSON.parse(await readFile(join(output, 'result.json'), 'utf8')); assert.equal(saved.evidenceCheckpoint.saved, false); assert(saved.final);
  } finally {
    // Only the test operator removes its retained rehearsal resources, after the failed run has been preserved.
    assert.match(database, /^flow_o10_[a-f0-9]{32}$/);
    const facts = { database, workerGroup: report.workerProcessGroup, testOperatorCleanup: true };
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    if (report.privateResources?.directory) { assert.match(report.privateResources.directory, /\/flow-o10-[^/]+$/); await rm(report.privateResources.directory, { recursive: true, force: true }); }
    facts.remainingDatabases = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
    await admin.end(); await writeFile(join(output, 'test-operator-cleanup.json'), JSON.stringify(facts, null, 2) + '\n');
  }
});

test('successful zero-query journey saves complete facts before removing its private resources', async () => {
  const output = join(evidence, 'checkpoint-success'); const report = await run('rehearsal', output);
  assert.equal(report.outcome, 'rehearsal-passed'); assert.equal(report.nativeQueryCalls, 0); assert.equal(report.evidenceCheckpoint.saved, true);
  const checkpoint = JSON.parse(await readFile(join(output, 'checkpoint.json'), 'utf8'));
  assert.equal(checkpoint.checkpointPhase, 'before-resource-removal'); assert.equal(checkpoint.worker.nativeQueryCalls, 0);
  assert.equal(checkpoint.cleanup.runnerStopped, true); assert.equal(checkpoint.cleanup.centerClosed, true);
  assert.equal(checkpoint.cleanup.databaseRemoved, undefined); assert.equal(checkpoint.cleanup.privateTemporaryDirectoryRemoved, undefined);
  assert.equal(checkpoint.task.status, 'succeeded'); assert.equal(checkpoint.task.verificationStatus, 'passed'); assert.equal(checkpoint.goal.nodes[0].accepted, null);
  assert(checkpoint.final); assert.equal(checkpoint.ids.taskId, report.ids.taskId); assert(checkpoint.worker.readObservations.length > 0);
  assert(Object.values(report.cleanup).every(value => value === true)); assert.deepEqual(report.remainingDatabases, []);
  await assert.rejects(access(report.privateResources.directory), { code: 'ENOENT' });
});
