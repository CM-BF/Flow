import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { startPreview, statusPreview, stopPreview } from './preview.mjs';
const execute = promisify(execFile);
const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
async function command(directory, action, target) {
  const { stdout } = await execute(process.execPath, [cli, 'maintenance', action, '--directory', directory, ...(target ? ['--target', target] : [])], { timeout: 100_000, env: { ...process.env, FLOW_SYNTHETIC_SECRET: 'never-print-this-sentinel' } });
  assert.ok(!stdout.includes('never-print-this-sentinel')); return JSON.parse(stdout);
}
async function fixture(callback) {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc02-host-')); const directory = join(parent, 'preview'); let config;
  try {
    await startPreview({ directory, adminUrl }); config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    await callback(directory, config);
  } finally {
    const stopped = config ? await stopPreview({ directory }) : null;
    if (stopped) {
      assert.ok(!Object.values(stopped.processes).includes('unknown'));
      const owned = new Pool({ connectionString: config.databaseUrl });
      try { assert.equal((await owned.query('SELECT installation_id FROM public.flow_preview_owner')).rows[0].installation_id, config.installationId); } finally { await owned.end(); }
      const admin = new Pool({ connectionString: adminUrl });
      try { await admin.query(`DROP DATABASE "${config.databaseName}"`); } finally { await admin.end(); }
    }
    await rm(parent, { recursive: true, force: true });
  }
}
test('bootstrap enables only the DB guard, refresh preserves identity and queue, then explicit resume is replayable', async () => {
  const target = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
  await fixture(async (directory, config) => {
    const before = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'));
    const drain = await command(directory, 'bootstrap');
    assert.equal(drain.state, 'draining'); assert.equal(drain.activeAttempts, 0);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')).processes, before.processes);
    const task = await fetch(`http://127.0.0.1:${config.centerPort}/api/tasks`, { method: 'POST', headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify({ title: 'Retained fixture', harness: 'fixture', prompt: 'not a provider call' }), signal: AbortSignal.timeout(3000) });
    assert.equal(task.status, 202);
    const refreshed = await command(directory, 'refresh', target);
    assert.equal(refreshed.state, 'maintenance'); assert.equal(refreshed.update, 'ready-paused');
    const status = await statusPreview({ directory });
    assert.equal(status.center.url, `http://127.0.0.1:${config.centerPort}`); assert.equal(status.webUrl, `http://127.0.0.1:${config.webPort}`);
    assert.equal(status.work.pending, 1); assert.equal(status.work.total, 1); assert.equal(status.provider, 'not-probed');
    assert.equal(status.sourceAtStart.head, target);
    assert.equal(status.webArtifact.sourceHead, target);
    assert.equal(status.webArtifact.state, 'verified');
    assert.equal(status.webArtifact.serving, 'confirmed');
    const after = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'));
    assert.notEqual(after.processes.runner.pid, before.processes.runner.pid);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'config.json'), 'utf8')), config);
    assert.equal((await command(directory, 'refresh', target)).state, 'maintenance');
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')).processes, after.processes);
    assert.equal((await command(directory, 'resume')).state, 'accepting');
    assert.equal((await command(directory, 'resume')).state, 'accepting');
    const pool = new Pool({ connectionString: config.databaseUrl });
    try {
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM flow.attempts')).rows[0].n, 0);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM flow.runner_maintenance_audit')).rows[0].n, 3);
    } finally { await pool.end(); }
  });
});
test('identity failure after durable drain keeps admission closed and never signals an unowned PID', async () => {
  const target = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
  await fixture(async (directory) => {
    await command(directory, 'bootstrap');
    const path = join(directory, 'state.json'); const saved = await readFile(path, 'utf8'); const changed = JSON.parse(saved);
    changed.processes.runner.startedAt = 'incorrect-start-identity';
    await writeFile(path, JSON.stringify(changed));
    try {
      await assert.rejects(command(directory, 'refresh', target), error => error.stderr.includes('EXISTING_PROCESSES_UNCONFIRMED'));
      assert.equal((await command(directory, 'status')).state, 'maintenance');
      await assert.rejects(command(directory, 'resume'), error => error.stderr.includes('UPDATED_PROCESSES_NOT_CONFIRMED'));
    } finally { await writeFile(path, saved); }
    assert.equal((await statusPreview({ directory })).processes.runner, 'running');
  });
});

import { createServer as createSocket } from 'node:net';
import { spawnOwnedProcess, inspectOwnedProcess, stopOwnedProcess } from './process.mjs';
import { setTimeout as sleep } from 'node:timers/promises';
test('a failed new Web start retains the maintenance gate and does not kill an unrelated listener', async () => {
  const target = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
  await fixture(async (directory, config) => {
    await command(directory, 'bootstrap');
    const state = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'));
    assert.equal(await stopOwnedProcess(state.processes.web), 'stopped');
    const listener = createSocket();
    await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(config.webPort, '127.0.0.1', resolve); });
    try {
      await assert.rejects(command(directory, 'refresh', target), error => error.stderr.includes('START_UNCONFIRMED_CHECK_STATUS'));
      assert.equal(listener.listening, true);
      assert.equal((await command(directory, 'status')).state, 'maintenance');
      await assert.rejects(command(directory, 'resume'), error => error.stderr.includes('UPDATED_PROCESSES_NOT_CONFIRMED'));
    } finally { await new Promise(resolve => listener.close(resolve)); }
  });
});
test('TERM timeout retains maintenance and reports unknown without progressing to the next service', async () => {
  const target = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
  await fixture(async (directory) => {
    await command(directory, 'bootstrap');
    const path = join(directory, 'state.json'); const state = JSON.parse(await readFile(path, 'utf8')); const originalRunner = state.processes.runner;
    assert.equal(await stopOwnedProcess(originalRunner), 'stopped');
    const marker = join(directory, 'test-term-ready');
    const program = `require('node:fs').writeFileSync(${JSON.stringify(marker)},'ready');process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`;
    const owned = await spawnOwnedProcess({ args: ['-e', program, '--'], cwd: directory, env: { PATH: process.env.PATH } });
    for (let i = 0; i < 50; i++) { try { await readFile(marker); break; } catch { await sleep(10); } }
    assert.equal(await readFile(marker, 'utf8'), 'ready');
    state.processes.runner = owned; await writeFile(path, JSON.stringify(state));
    try {
      await assert.rejects(command(directory, 'refresh', target), error => error.stderr.includes('STOP_UNCONFIRMED'));
      assert.equal((await command(directory, 'status')).state, 'maintenance');
      assert.equal(await inspectOwnedProcess(state.processes.center), 'running');
      assert.equal(await inspectOwnedProcess(owned), 'running');
    } finally {
      // Only this test-created, freshly verified stubborn process may be forcibly cleaned up.
      if (await inspectOwnedProcess(owned) === 'running') process.kill(-owned.group, 'SIGKILL');
      for (let i = 0; i < 100 && await inspectOwnedProcess(owned) !== 'stopped'; i++) await sleep(10);
      state.processes.runner = originalRunner; await writeFile(path, JSON.stringify(state));
    }
  });
});

test('artifact verification failure during refresh retains the old processes and maintenance hold', async () => {
  const target = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
  await fixture(async (directory) => {
    await command(directory, 'bootstrap');
    const before = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'));
    const manifest = join(directory, 'web-artifacts', before.webArtifact.artifactId, 'manifest.json');
    const original = await readFile(manifest, 'utf8');
    await writeFile(manifest, original + ' '); // Same parsed identity, wrong committed manifest bytes.
    try {
      await assert.rejects(command(directory, 'refresh', target), error => error.stderr.includes('WEB_ARTIFACT_INTEGRITY_MISMATCH'));
      assert.equal((await command(directory, 'status')).state, 'maintenance');
      const after = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'));
      assert.deepEqual(after.processes, before.processes);
      for (const process of Object.values(before.processes)) assert.equal(await inspectOwnedProcess(process), 'running');
      assert.equal((await statusPreview({ directory })).webArtifact.state, 'unknown');
    } finally { await writeFile(manifest, original); }
  });
});
