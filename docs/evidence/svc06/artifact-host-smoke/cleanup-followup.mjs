// One fixed residual cleanup. The trusted observer is outside the rejected work profile.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, lstat, realpath, mkdir, readFile, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(await readFile(join(here, 'cleanup-followup-inputs.json'), 'utf8'));
const artifactRoot = join(input.directory, 'backend-artifacts', input.artifact.artifactId, 'root');
const destination = join(input.run, input.privateDestination);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);
const fact = error => ({ name: error?.name ?? 'Unknown', code: /^[A-Z0-9_]{1,64}$/.test(error?.code ?? '') ? error.code : 'UNCONFIRMED' });
let persistedBytes = 0;
async function syncDir(path) { const file = await open(path, 'r'); try { await file.sync(); } finally { await file.close(); } }
async function durable(name, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert.ok(persistedBytes + bytes.length <= 96 * 1024, 'PRIVATE_EVIDENCE_LIMIT');
  const file = await open(join(destination, name), 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  await syncDir(destination); persistedBytes += bytes.length;
}
async function directory(path, identity) {
  const info = await lstat(path);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o777) === 0o700);
  assert.equal(info.dev, identity.dev); assert.equal(info.ino, identity.ino); assert.equal(await realpath(path), path);
}
async function fixedFile(path, expected, privateFile = false) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const st = await file.stat(); assert.ok(st.isFile() && st.uid === process.getuid());
    assert.equal(st.size, expected.bytes);
    if (privateFile) { assert.equal(st.mode & 0o777, 0o600); assert.equal(st.dev, expected.dev); assert.equal(st.ino, expected.ino); }
    const bytes = Buffer.alloc(expected.bytes + 1); let count = 0;
    while (count < bytes.length) { const part = await file.read(bytes, count, bytes.length - count, null); if (!part.bytesRead) break; count += part.bytesRead; }
    assert.equal(count, expected.bytes); assert.equal(hash(bytes.subarray(0, count)), expected.sha256);
    return bytes.subarray(0, count);
  } finally { await file.close(); }
}
async function originals() {
  await directory(input.directory, input.directoryIdentity); await directory(input.run, input.runIdentity);
  const values = {};
  for (const item of input.originalFiles) values[item.relative] = JSON.parse((await fixedFile(join(input.directory, item.relative), item, true)).toString());
  return values;
}
async function identity(pid) {
  const { stdout, stderr } = await execute('/bin/ps', ['-p', String(pid), '-o', 'pgid=', '-o', 'lstart=', '-o', 'command='], { env: { ...process.env, LC_ALL: 'C' }, timeout: 1000, maxBuffer: 8192 });
  assert.equal(stderr, ''); const match = /^\s*(\d+)\s+(.{24})\s+(.+?)\s*$/.exec(stdout); assert.ok(match, 'IDENTITY_UNKNOWN');
  return { pid, group: Number(match[1]), startedAt: match[2], command: match[3] };
}
async function observeGroup() {
  const { stdout, stderr } = await execute('/usr/bin/pgrep', ['-g', String(input.group)], { timeout: 1000, maxBuffer: 4096 });
  assert.equal(stderr, ''); const pids = [...new Set(stdout.trim().split(/\s+/).map(Number))].sort((a, b) => a - b);
  assert.ok(pids.length > 0 && pids.length <= 8 && pids.includes(input.pid));
  const records = [];
  for (const pid of pids) { assert.ok(Number.isSafeInteger(pid) && pid > 1); const record = await identity(pid); assert.equal(record.group, input.group); records.push(record); }
  const leader = records.find(record => record.pid === input.pid);
  assert.equal(leader.command, `${input.node} ${join(artifactRoot, 'tools/personal-preview/cli.mjs')} internal-service ${input.directory} center --flow-preview=${input.nonce}`);
  assert.equal(hash(Buffer.from(leader.command)), input.commandSha256); assert.equal(leader.startedAt, input.startedAt);
  return { records, leader: { ...leader, nonce: input.nonce } };
}
const result = { startedAt: new Date().toISOString(), originalResultUnchanged: true, center: 'unknown', database: 'unknown', stopCalls: 0, dropCalls: 0, failures: [], artifactRetained: true, privateRunRetained: true };
let admin, privateReady = false;
try {
  assert.equal(await realpath(process.execPath), input.node);
  assert.ok(/^flow_preview_[a-f0-9]{24}$/.test(input.databaseName));
  const saved = await originals(), config = saved['config.json'];
  const pending = saved['host-smoke-first/spawn-center-pending.json'];
  assert.deepEqual(pending, { pid: input.pid, group: input.group, nonce: input.nonce, startedAt: null, command: null });
  assert.deepEqual(saved['state.json'].processes, { center: pending });
  assert.deepEqual(saved['state.json'].backendArtifact, input.artifact);
  assert.equal(config.databaseName, input.databaseName); assert.equal(config.installationId, input.installationId); assert.equal(config.directory, input.directory);
  assert.equal(config.centerPort, input.centerPort); assert.equal(config.runner, null);
  const checkpoint = saved['host-smoke-first/work-checkpoint.json'];
  assert.equal(checkpoint.phase, 'starting-center'); assert.equal(checkpoint.databaseName, input.databaseName); assert.equal(checkpoint.installationId, input.installationId);
  for (const item of input.runtime) await fixedFile(join(artifactRoot, item.relative), item);
  const free = await statfs(input.directory); result.freeBefore = Number(free.bavail) * Number(free.bsize); assert.ok(result.freeBefore >= input.freshBytes);
  await mkdir(destination, { mode: 0o700 }); await syncDir(input.run); privateReady = true;
  await durable('reservation.json', { startedAt: result.startedAt, inputSha256: hash(await readFile(join(here, 'cleanup-followup-inputs.json'))), pid: input.pid, nonce: input.nonce, databaseName: input.databaseName, databaseOid: input.databaseOid });
  const first = await observeGroup(); await new Promise(resolve => setTimeout(resolve, 75)); const second = await observeGroup();
  assert.deepEqual(first, second, 'IDENTITY_CHANGED');
  const processes = await import(pathToFileURL(join(artifactRoot, 'tools/personal-preview/process.mjs')).href);
  assert.equal(await processes.inspectOwnedProcess(second.leader), 'running'); assert.equal(await processes.ownsListener(second.leader, input.centerPort), true);
  await durable('identity-confirmation.json', { first, second, originalPendingPreserved: true });
  const { assertPreviewMarker } = await import(pathToFileURL(join(artifactRoot, 'tools/personal-preview/preview.mjs')).href);
  const { Pool } = createRequire(join(artifactRoot, 'package.json'))('pg');
  admin = new Pool({ connectionString: config.adminUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 2000, statement_timeout: 1500 });
  async function databaseIdentity() {
    const rows = (await admin.query('SELECT oid,datname FROM pg_database WHERE datname=$1', [input.databaseName])).rows;
    assert.deepEqual(rows, [{ oid: input.databaseOid, datname: input.databaseName }]); return rows;
  }
  result.databaseBefore = await databaseIdentity(); await assertPreviewMarker(config); result.markerBefore = true;
  await originals(); // No re-baselining: a changed private record prevents the one TERM.
  await durable('cleanup-intent.json', { identity: second.leader, database: result.databaseBefore, markerConfirmed: true, method: 'artifact.stopOwnedProcess once, then marker/OID/empty and normal DROP', noForce: true });
  result.stopCalls = 1; result.center = await processes.stopOwnedProcess(second.leader);
  assert.equal(result.center, 'stopped', 'CENTER_STOP_UNKNOWN');
  assert.equal(await processes.inspectOwnedProcess(second.leader), 'stopped', 'CENTER_GROUP_UNKNOWN');
  await durable('center-stopped.json', { pid: input.pid, group: input.group, nonce: input.nonce, state: result.center });
  await assertPreviewMarker(config); result.markerAfter = true; result.databaseAfterStop = await databaseIdentity();
  const { observeConnections } = await import(pathToFileURL(join(artifactRoot, 'apps/tui/src/task-controls/fixture-cleanup.ts')).href);
  const connectionDeadline = performance.now() + 3000;
  result.connections = await observeConnections(async () => {
    const remaining = Math.floor(connectionDeadline - performance.now()); assert.ok(remaining > 0, 'CONNECTION_DEADLINE');
    return (await admin.query({ text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 LIMIT 33', values: [input.databaseName], query_timeout: Math.min(1500, remaining) })).rows;
  });
  assert.equal(result.connections.state, 'empty', 'CONNECTIONS_UNKNOWN');
  await databaseIdentity(); assert.equal(await processes.inspectOwnedProcess(second.leader), 'stopped');
  await directory(input.directory, input.directoryIdentity); await directory(input.run, input.runIdentity);
  result.database = 'owned-and-empty'; await durable('cleanup-checkpoint.json', result);
  result.dropCalls = 1; await admin.query(`DROP DATABASE "${input.databaseName}"`);
  result.remaining = (await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [input.databaseName])).rows;
  assert.equal(result.remaining.length, 0); result.database = 'removed';
} catch (error) { result.failures.push(fact(error)); process.exitCode = 1; }
finally {
  if (admin) { try { await admin.end(); } catch (error) { result.failures.push({ poolClose: fact(error) }); process.exitCode = 1; } }
  result.finishedAt = new Date().toISOString(); result.privateBytesBeforeResult = persistedBytes;
  if (privateReady) { try { await durable('result.json', result); } catch (error) { result.failures.push({ persistence: fact(error) }); process.exitCode = 1; } }
  console.log(JSON.stringify(result));
}
