import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat, writeFile, chmod } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { startPreview, statusPreview, stopPreview } from './preview.mjs';

const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const execute = promisify(execFile);
async function removeOwnedFixture(directory) {
  let config;
  try { config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const stopped = await stopPreview({ directory });
  assert.ok(!Object.values(stopped.processes).includes('unknown'), `Retain private state for inspection at ${directory}`);
  const owned = new Pool({ connectionString: config.databaseUrl });
  try {
    const marker = (await owned.query('SELECT installation_id FROM public.flow_preview_owner')).rows;
    assert.deepEqual(marker, [{ installation_id: config.installationId }]);
  } finally { await owned.end(); }
  assert.match(config.databaseName, /^flow_preview_[a-f0-9]{24}$/);
  const admin = new Pool({ connectionString: adminUrl });
  try { await admin.query(`DROP DATABASE "${config.databaseName}"`); } finally { await admin.end(); }
}
test('starts an owned empty preview without a model request, persists identity, and stops only its services', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-test-'));
  const directory = join(parent, 'personal');
  let config;
  try {
    const boot = await execute(process.execPath, [cli, 'start', '--directory', directory], { env: { ...process.env, FLOW_PREVIEW_ADMIN_URL: adminUrl }, timeout: 20_000 });
    const started = JSON.parse(boot.stdout); // The launching CLI has exited; detached services remain owned and running.
    assert.equal(started.center.reachable, true);
    assert.equal(started.processes.runner, 'running');
    assert.equal(started.provider, 'not-probed');
    assert.deepEqual({ source: started.profile.source, model: started.profile.model }, { source: 'runner-configured', model: 'claude-sonnet-5-5' });
    assert.equal(started.work.total, 0);
    config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    assert.equal((await stat(join(directory, 'config.json'))).mode & 0o777, 0o600);
    const reported = JSON.stringify(await statusPreview({ directory }));
    for (const secret of [config.ownerToken, config.runner.token, config.adminUrl, config.databaseUrl]) assert.ok(!reported.includes(secret));
    const { stdout } = await execute(process.execPath, [cli, 'status', '--directory', directory], { timeout: 5000 });
    assert.equal(JSON.parse(stdout).installationId, config.installationId);
    assert.ok(!stdout.includes(config.ownerToken));
    const manifest = JSON.parse(await readFile(join(directory, 'claude.json'), 'utf8'));
    assert.deepEqual(manifest, { model: 'claude-sonnet-5-5', materialFiles: [], allowRead: false, requireReadApproval: false, maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60000 });
    assert.equal((await startPreview({ directory })).installationId, started.installationId);
    const stopped = JSON.parse((await execute(process.execPath, [cli, 'stop', '--directory', directory], { timeout: 20_000 })).stdout);
    assert.ok(Object.values(stopped.processes).every(value => value === 'stopped'));
    assert.equal((await statusPreview({ directory })).center.reachable, false);
  } finally {
    await removeOwnedFixture(directory);
    await rm(parent, { recursive: true, force: true });
  }
});

test('refuses expanded native settings, insecure config permissions, or a changed database address', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-policy-')); const directory = join(parent, 'personal');
  try {
    await startPreview({ directory, adminUrl }); await stopPreview({ directory });
    const configPath = join(directory, 'config.json'); const manifestPath = join(directory, 'claude.json');
    const original = await readFile(configPath, 'utf8'); const manifest = await readFile(manifestPath, 'utf8');
    try {
      await chmod(configPath, 0o644);
      await assert.rejects(startPreview({ directory }), { code: 'PRIVATE_FILE_REQUIRED' });
      await chmod(configPath, 0o600);
      const changed = JSON.parse(original); const address = new URL(changed.databaseUrl); address.port = '1'; changed.databaseUrl = address.href;
      await writeFile(configPath, JSON.stringify(changed));
      await assert.rejects(startPreview({ directory }), { code: 'DATABASE_IDENTITY_MISMATCH' });
      await writeFile(configPath, original);
      await writeFile(manifestPath, JSON.stringify({ ...JSON.parse(manifest), allowRead: true }));
      await assert.rejects(startPreview({ directory }), { code: 'NATIVE_CONFIGURATION_CHANGED' });
    } finally { await chmod(configPath, 0o600); await writeFile(configPath, original); await writeFile(manifestPath, manifest); }
  } finally { await removeOwnedFixture(directory); await rm(parent, { recursive: true, force: true }); }
});

test('retains queued work and requires explicit confirmation before a restart may poll it', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-restart-')); const directory = join(parent, 'personal');
  try {
    const first = await startPreview({ directory, adminUrl });
    const config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    const response = await fetch(`${first.center.url}/api/tasks`, { method: 'POST', headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json', 'idempotency-key': 'svc01-pending-fixture' }, body: JSON.stringify({ title: 'Unexecuted fixture', prompt: 'Retain this task', harness: 'fixture' }), signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 202); await response.json();
    await stopPreview({ directory });
    await assert.rejects(startPreview({ directory }), { code: 'PENDING_WORK_REQUIRES_CONFIRMATION' });
    const stopped = await statusPreview({ directory });
    assert.ok(Object.values(stopped.processes).every(value => value === 'stopped'));
    assert.equal(stopped.work.pending, 1);
    const second = await startPreview({ directory, confirmPending: true });
    assert.equal(second.installationId, first.installationId);
    assert.equal(second.work.pending, 1); // The Claude-only runner cannot execute this fixture task.
    assert.equal(second.work.total, 1);
  } finally { await removeOwnedFixture(directory); await rm(parent, { recursive: true, force: true }); }
});

test('refuses a changed database ownership marker and never adopts an existing unowned directory', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-marker-')); const directory = join(parent, 'personal');
  try {
    await assert.rejects(startPreview({ directory: parent, adminUrl }));
    await startPreview({ directory, adminUrl }); await stopPreview({ directory });
    const config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    const pool = new Pool({ connectionString: config.databaseUrl });
    try {
      await pool.query("UPDATE public.flow_preview_owner SET directory='/unowned/location'");
      await assert.rejects(startPreview({ directory }), { code: 'DATABASE_NOT_OWNED' });
      assert.equal((await statusPreview({ directory })).database, 'unknown');
    } finally { await pool.query('UPDATE public.flow_preview_owner SET directory=$1', [config.directory]); await pool.end(); }
  } finally { await removeOwnedFixture(directory); await rm(parent, { recursive: true, force: true }); }
});

test('does not authenticate to or stop an unrelated listener occupying the recorded port', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-port-')); const directory = join(parent, 'personal');
  let authentications = 0;
  const foreign = createServer((request, response) => { if (request.headers.authorization) authentications++; response.end('unrelated'); });
  await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
  try {
    await startPreview({ directory, adminUrl }); await stopPreview({ directory });
    const config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    config.centerPort = foreign.address().port;
    await writeFile(join(directory, 'config.json'), JSON.stringify(config), { mode: 0o600 });
    await assert.rejects(startPreview({ directory }), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
    assert.equal((await statusPreview({ directory })).center.reachable, false);
    assert.equal(authentications, 0);
    assert.equal(await (await fetch(`http://127.0.0.1:${foreign.address().port}`, { signal: AbortSignal.timeout(1000) })).text(), 'unrelated');
  } finally {
    foreign.closeAllConnections(); await new Promise(resolve => foreign.close(resolve));
    await removeOwnedFixture(directory); await rm(parent, { recursive: true, force: true });
  }
});
