/** One read-only preparation snapshot. Never authorizes a service action. */
import assert from 'node:assert/strict';
import { lstat, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { bounded, durable, sha } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';
import { verifyBackendArtifact } from '../../../../tools/personal-preview/backend-release/index.mjs';

const directory = '/Users/citrine/.flow-personal';
const expected = { policy: 'flow.backend-artifact.v1', artifactId: '7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920',
  manifestDigest: '7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920', sourceHead: '6c0fdcda8858aac33489c48c1948e902dd6a3d7e' };
const files = ['config.json', 'claude.json', 'browser-session.json', 'maintenance.json', 'state.json', 'web-release.json'];
async function privateFile(name) {
  const path = join(directory, name), value = await bounded(path, 65536), after = await lstat(path);
  assert.ok(after.isFile() && !after.isSymbolicLink() && after.nlink === 1 && after.uid === process.getuid() && (after.mode & 0o777) === 0o600);
  assert.equal(await realpath(path), path);
  for (const key of ['dev', 'ino', 'size', 'mtimeMs']) assert.equal(after[key], value.stat[key]);
  return { value: JSON.parse(value.bytes), pin: { dev: String(after.dev), ino: String(after.ino), bytes: value.bytes.length, sha256: sha(value.bytes) } };
}
export async function observe(output) {
  assert.ok(output.startsWith('/private/tmp/flow-svc06b-readonly-') && output.endsWith('/parameters.json'));
  const parent = await lstat(dirname(output)); assert.ok(parent.isDirectory() && !parent.isSymbolicLink() && parent.uid === process.getuid() && (parent.mode & 0o777) === 0o700);
  assert.equal(await realpath(dirname(output)), dirname(output));
  const started = performance.now(), deadline = started + 27000;
  const remaining = () => { const ms = Math.floor(deadline - performance.now()); assert.ok(ms > 0, 'READ_DEADLINE'); return ms; };
  const result = { ready: false, at: new Date().toISOString(), kind: 'READONLY_PARAMETERS_NOT_EXECUTION_INSTANCE', files: {}, processes: {}, requests: [],
    modelQueries: 0, mutations: 0, bodyRecorded: false, databaseReadOnlyTransactions: 0, databasePoolClosed: null };
  try {
    const info = await lstat(directory); assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o777) === 0o700);
    assert.equal(await realpath(directory), directory); result.installationIdentity = { dev: String(info.dev), ino: String(info.ino) };
    const values = {};
    for (const name of files) { remaining(); const file = await privateFile(name); values[name] = file.value; result.files[name] = file.pin; }
    const config = values['config.json'], state = values['state.json'], release = values['web-release.json'];
    assert.equal(config.directory, directory); assert.equal(config.repository, '/Users/citrine/Projects/AgentHarness/Flow');
    assert.equal(config.centerPort, 61227); assert.equal(config.webPort, 61228);
    assert.deepEqual(state.backendArtifact, expected); assert.deepEqual(state.webHost.artifact, expected);
    assert.deepEqual(state.source, { head: expected.sourceHead, dirty: false }); assert.equal(state.pendingWebHost ?? null, null);
    assert.equal(release.version, 3); assert.equal(release.current, 'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88');
    const verified = await verifyBackendArtifact({ directory, artifact: expected }); remaining();
    assert.equal(verified.manifest.sourceRepository, config.repository);
    const processModule = await import(pathToFileURL(join(verified.root, 'tools/personal-preview/process.mjs')).href);
    for (const role of ['center', 'runner', 'web']) {
      remaining(); const record = state.processes[role], identity = await processModule.inspectOwnedProcess(record);
      result.processes[role] = { pid: record.pid, group: record.group, digest: sha(JSON.stringify(record)), identity }; assert.equal(identity, 'running');
    }
    result.listeners = { center: await processModule.ownsListener(state.processes.center, 61227), web: await processModule.ownsListener(state.processes.web, 61228) };
    assert.ok(result.listeners.center && result.listeners.web); remaining();
    const { Pool } = createRequire(join(verified.root, 'package.json'))('pg');
    const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 2500, application_name: 'flow-svc06b-readonly-parameters' });
    try {
      await pool.query('BEGIN READ ONLY'); result.databaseReadOnlyTransactions++;
      const marker = (await pool.query('SELECT installation_id,directory FROM public.flow_preview_owner')).rows;
      assert.equal(marker.length, 1); assert.equal(marker[0].installation_id, config.installationId); assert.equal(marker[0].directory, directory);
      result.markerMatched = true;
      const rows = (await pool.query('SELECT id,maintenance_state,maintenance_version,maintenance_operation_id,maintenance_updated_at FROM flow.runners WHERE id=$1', [config.runner.runnerId])).rows;
      assert.equal(rows.length, 1); result.runner = rows[0];
      await pool.query('ROLLBACK');
    } finally { await pool.end(); result.databasePoolClosed = true; }
    const url = '/api/task-index?limit=20'; remaining();
    const response = await fetch('http://127.0.0.1:61227' + url, { method: 'GET', redirect: 'error', headers: { Authorization: 'Bearer ' + config.ownerToken }, signal: AbortSignal.timeout(Math.min(3500, remaining())) });
    result.requests.push({ path: url, status: response.status }); assert.equal(response.status, 200);
    const reader = response.body.getReader(); const chunks = []; let length = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; length += part.value.length; assert.ok(length <= 65536); chunks.push(part.value); } }
    finally { reader.releaseLock(); }
    const tasks = JSON.parse(Buffer.concat(chunks)); assert.ok(Array.isArray(tasks.tasks) && tasks.tasks.length <= 20);
    result.tasks = { totalSize: tasks.totalSize, hasMore: tasks.nextCursor !== null, rows: tasks.tasks.map(t => ({ idHash: sha(t.id), status: t.status, updatedAt: t.updatedAt })) };
    result.source = state.source; result.backendArtifact = state.backendArtifact; result.webHostArtifact = state.webHost.artifact; result.release = release;
    result.maintenance = { phase: values['maintenance.json'].phase, operationId: values['maintenance.json'].operationId, backendArtifact: values['maintenance.json'].backendArtifact };
    result.identity = { installationId: config.installationId, databaseName: config.databaseName, runnerId: config.runner.runnerId, profileSha256: sha(JSON.stringify(config.runner)) };
    for (const name of files) { remaining(); assert.deepEqual((await privateFile(name)).pin, result.files[name], 'PRIVATE_CHANGED_DURING_OBSERVATION'); }
    result.outcome = 'OBSERVED_READONLY_NOT_READY';
  } catch (error) {
    result.outcome = 'STOPPED_READONLY'; result.failure = { name: ['AssertionError','Error','TypeError'].includes(error.name) ? error.name : 'UnknownError', code: ['ERR_ASSERTION','ENOENT','EACCES','ABORT_ERR'].includes(error.code) ? error.code : 'UNKNOWN' };
  }
  result.finishedAt = new Date().toISOString(); result.elapsedMs = Math.round(performance.now() - started);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 65536); await durable(output, result);
  console.log(JSON.stringify({ outcome: result.outcome, at: result.at, finishedAt: result.finishedAt, elapsedMs: result.elapsedMs, marker: result.markerMatched ?? null, runnerState: result.runner?.maintenance_state ?? null, runnerVersion: result.runner?.maintenance_version ?? null, requests: result.requests.length, failure: result.failure ?? null }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--read-only-parameters'); await observe(process.argv[3]);
}
