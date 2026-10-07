/** One bounded metadata observation; no detail, model, command, database or service mutation. */
import assert from 'node:assert/strict';
import { lstat, realpath, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bounded, durable, sha } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';

const directory = '/Users/citrine/.flow-personal';
const artifactId = '7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920';
const sourceHead = '6c0fdcda8858aac33489c48c1948e902dd6a3d7e';
const artifactRoot = join(directory, 'backend-artifacts', artifactId, 'root');
const started = performance.now(), deadline = started + 27000;
const record = { kind: 'SVC06B_BOUNDED_PERSONAL_METADATA_OBSERVATION', startedAt: new Date().toISOString(),
  sourceHead, artifactId, requests: [], providerCalls: 0, mutations: 0, directDatabaseConnections: 0,
  limits: { totalSeconds: 30, maximumGETs: 4, responseBytes: 65536, savedBytes: 16384 },
  boundary: 'Point observation only. updatedAt is stored metadata, not a model heartbeat. No browser session, task detail, turn, event, logs, claim receipt, or user text was requested.' };
const remaining = () => { const ms = Math.floor(deadline - performance.now()); assert.ok(ms > 0, 'READ_DEADLINE'); return ms; };
const iso = value => { assert.ok(value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value))), 'INVALID_TIME'); return value; };
const idHash = value => { assert.ok(typeof value === 'string' && value.length <= 200, 'INVALID_IDENTIFIER'); return sha(value); };
const taskStatuses = new Set(['queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'uncertain']);
async function privateValue(name) {
  remaining(); const path = join(directory, name), value = await bounded(path, 65536), after = await lstat(path);
  assert.ok(!after.isSymbolicLink() && after.nlink === 1 && (after.mode & 0o777) === 0o600, 'PRIVATE_IDENTITY');
  for (const key of ['dev', 'ino', 'size', 'mtimeMs']) assert.equal(after[key], value.stat[key], 'PRIVATE_CHANGED');
  return { value: JSON.parse(value.bytes), pin: { bytes: value.bytes.length, sha256: sha(value.bytes), dev: String(after.dev), ino: String(after.ino) } };
}
async function get(path, token, project) {
  assert.ok(record.requests.length < 4); const row = { path, at: new Date().toISOString() }; record.requests.push(row);
  const response = await fetch('http://127.0.0.1:61227' + path, { method: 'GET', redirect: 'error',
    headers: { Authorization: 'Bearer ' + token, 'X-Flow-Conversation': 'native-v1' },
    signal: AbortSignal.timeout(Math.min(3500, remaining())) });
  row.httpStatus = response.status;
  if (!response.ok) { await response.body?.cancel(); row.errorClass = 'HTTP_' + response.status; return null; }
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    assert.ok(size <= 65536, 'RESPONSE_BOUND'); chunks.push(value); } }
  finally { reader.releaseLock(); }
  row.responseBytes = size;
  // Only the fixed metadata projections below leave this scope. Raw JSON and titles are never persisted.
  return project(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}

try {
  assert.equal(process.argv.length, 3, 'OUTPUT_REQUIRED');
  const output = process.argv[2]; assert.ok(output.startsWith('/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-browser-recovery/docs/evidence/svc06/browser-recovery/') && output.endsWith('.json'));
  assert.equal(await lstat(output).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; }), false, 'OUTPUT_EXISTS');
  const root = await lstat(directory); assert.ok(root.isDirectory() && !root.isSymbolicLink() && root.uid === process.getuid() && (root.mode & 0o777) === 0o700);
  assert.equal(await realpath(directory), directory);
  const config = await privateValue('config.json'), state = await privateValue('state.json');
  assert.equal(config.value.directory, directory); assert.equal(config.value.repository, '/Users/citrine/Projects/AgentHarness/Flow');
  assert.equal(config.value.centerPort, 61227); assert.equal(config.value.webPort, 61228);
  assert.equal(state.value.backendArtifact.artifactId, artifactId); assert.equal(state.value.backendArtifact.sourceHead, sourceHead);
  assert.equal(state.value.source.head, sourceHead); assert.equal(state.value.source.dirty, false);
  assert.ok(typeof config.value.ownerToken === 'string' && config.value.ownerToken.length > 20);
  assert.ok(/^[a-f0-9-]{36}$/.test(config.value.runner.runnerId));
  const pins = JSON.parse(await readFile(new URL('./personal-health-source-pins.json', import.meta.url), 'utf8'));
  for (const pin of pins.files) { remaining(); const path = join(artifactRoot, pin.path), st = await lstat(path);
    assert.ok(st.isFile() && !st.isSymbolicLink()); assert.equal(await realpath(path), path);
    const bytes = await readFile(path); assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256); }
  record.sourcePinsVerified = pins.files.length;
  const { inspectOwnedProcess, ownsListener } = await import(pathToFileURL(join(artifactRoot, 'tools/personal-preview/process.mjs')).href);
  record.processes = {};
  for (const role of ['center', 'runner', 'web']) { remaining(); const p = state.value.processes[role];
    record.processes[role] = { pid: p.pid, group: p.group, recordSha256: sha(JSON.stringify(p)), identity: await inspectOwnedProcess(p) }; }
  remaining(); record.listeners = { center: await ownsListener(state.value.processes.center, 61227), web: await ownsListener(state.value.processes.web, 61228) };
  record.center = await get('/api/health', config.value.ownerToken, value => ({ ok: value.ok === true }));
  record.maintenance = await get('/api/runners/' + config.value.runner.runnerId + '/maintenance', config.value.ownerToken, value => {
    assert.equal(value.runnerId, config.value.runner.runnerId); assert.ok(['accepting', 'draining', 'maintenance'].includes(value.state));
    return { runnerHash: idHash(value.runnerId), state: value.state, version: value.version, activeAttempts: value.activeAttempts,
      uncertainAttempts: value.uncertainAttempts, updatedAt: iso(value.updatedAt), hasOperation: value.operationId !== null }; });
  record.tasks = await get('/api/task-index?limit=20', config.value.ownerToken, value => {
    assert.ok(Array.isArray(value.tasks) && value.tasks.length <= 20);
    return { totalSize: value.totalSize, hasMore: value.nextCursor !== null, rows: value.tasks.map(task => {
      assert.ok(taskStatuses.has(task.status), 'UNKNOWN_TASK_STATUS');
      return { idHash: idHash(task.id), historicalQueuedC8a0: task.id.startsWith('c8a0'), status: task.status,
        updatedAt: iso(task.updatedAt), createdAt: iso(task.createdAt), errorClass: 'UNKNOWN_NOT_EXPOSED_BY_SUMMARY' }; }) }; });
  record.conversations = await get('/api/conversations?limit=20', config.value.ownerToken, value => {
    assert.ok(Array.isArray(value.conversations) && value.conversations.length <= 20);
    return { hasMore: value.nextCursor !== null, rows: value.conversations.map(item => ({ idHash: idHash(item.id), revision: item.revision,
      updatedAt: iso(item.updatedAt), status: 'UNKNOWN_LIST_HAS_NO_EXECUTION_STATUS' })) }; });
  const afterConfig = await privateValue('config.json'), afterState = await privateValue('state.json');
  record.privateMetadata = { config: config.pin, state: state.pin, configUnchanged: afterConfig.pin.sha256 === config.pin.sha256,
    stateUnchanged: afterState.pin.sha256 === state.pin.sha256 };
  record.outcome = 'OBSERVED_METADATA_ONLY';
} catch (error) {
  record.outcome = 'STOPPED'; record.failure = { name: ['AssertionError', 'TimeoutError', 'TypeError', 'Error'].includes(error.name) ? error.name : 'UnknownError',
    code: ['ENOENT', 'EACCES', 'ERR_ASSERTION', 'ABORT_ERR'].includes(error.code) ? error.code : 'UNKNOWN' };
}
record.finishedAt = new Date().toISOString(); record.elapsedMs = Math.round(performance.now() - started);
record.actualClaimRecovery = 'UNKNOWN_NOT_OBSERVED';
assert.ok(Buffer.byteLength(JSON.stringify(record, null, 2) + '\n') <= 16384, 'SAVED_BOUND');
await durable(process.argv[2], record);
console.log(JSON.stringify({ outcome: record.outcome, startedAt: record.startedAt, finishedAt: record.finishedAt, elapsedMs: record.elapsedMs,
  requests: record.requests.length, failure: record.failure ?? null }));
