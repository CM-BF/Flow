import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import * as vm from 'node:vm';
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

test('an unverified backend descriptor fails before drain and preserves all old owned processes', async () => {
  await fixture(async (directory, config) => {
    const before = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'));
    await assert.rejects(execute(process.execPath, [cli, 'maintenance', 'bootstrap', '--directory', directory, '--backend-artifact', 'a'.repeat(64)], { timeout: 100_000 }));
    const after = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'));
    assert.deepEqual(after.processes, before.processes);
    for (const record of Object.values(before.processes)) assert.equal(await inspectOwnedProcess(record), 'running');
    await assert.rejects(readFile(join(directory, 'maintenance.json')), { code: 'ENOENT' });
    const pool = new Pool({ connectionString: config.databaseUrl });
    try { assert.equal((await pool.query('SELECT maintenance_state FROM flow.runners WHERE id=$1', [config.runner.runnerId])).rows[0].maintenance_state, 'accepting'); }
    finally { await pool.end(); }
  });
});

// Link the complete, unchanged maintenance module to explicit in-memory ports. No PG
// module, migration, CLI, signal or service is executed by these order/argument checks.
async function maintenancePorts({ configured = true, prepareFailure = false, selected = null, action = 'bootstrap', settings = false, secondState, active = 0, unknownRecord = null, failCommand = null, targetSelection = false, targetSelectionFailure = false, legacy = false } = {}) {
  const calls = [];
  const config = { directory: '/synthetic-preview', runner: { runnerId: 'runner', token: 'fixture-only' } };
  const state = { backendArtifact: { artifactId: 'old' }, webHost: { artifact: { artifactId: 'independent-old-web' } }, processes: { center: 'center', runner: 'runner', web: 'web' } };
  const operation = { operationId: 'operation', phase: action === 'resume' ? 'ready-paused' : 'drain-requested', initialVersion: 7, drainKey: 'legacy-drain', holdKey: 'legacy-hold', resumeKey: 'legacy-resume', backendArtifact: selected };
  if (targetSelection) operation.webHostTarget = { status: 'pending', artifact: selected };
  const slots = [{ id: 'legacy', key: 'runner', runner: config.runner }];
  if (settings) {
    slots.push({ id: 'settings', key: 'runner-settings', runner: { runnerId: 'settings-runner', token: 'settings-fixture' }, configDigest: 'digest' });
    state.processes['runner-settings'] = 'settings';
    operation.slots = slots.map(slot => ({ runnerId: slot.runner.runnerId, configDigest: slot.configDigest ?? null, initialVersion: 7, drainKey: slot.id + '-drain', holdKey: slot.id + '-hold', resumeKey: slot.id + '-resume' }));
  }
  const view = { state: action === 'bootstrap' ? 'accepting' : 'maintenance', version: 7, activeAttempts: 0, uncertainAttempts: 0, operationId: operation.operationId };
  const views = new Map(slots.map(slot => [slot.runner.runnerId, { ...view, ...(slot.id === 'settings' ? { state: secondState ?? view.state, activeAttempts: active } : {}) }]));
  const commandReceipts = new Set();
  const ports = {
    './maintenance-target.mjs': { selectHeldPreviewWebHost: async (_config, _pool, selectedState, selectedOperation) => {
      calls.push(['select-target']);
      if (targetSelectionFailure) throw Object.assign(new Error('MAINTENANCE_TARGET_CHANGED'), { code: 'MAINTENANCE_TARGET_CHANGED' });
      selectedState.webHost = { artifact: selected, selection: 'selected-stopped' }; selectedOperation.webHostTarget.status = 'selected-stopped';
    } },
    './runner-slots.mjs': { readRunnerSlots: async () => slots, slotServiceKeys: value => ['center', ...value.map(slot => slot.key), 'web'] },
    pg: { Pool: class { async query() { calls.push(['identity']); return { rowCount: 1 }; } async end() { calls.push(['end']); } } },
    './preview.mjs': {
      loadPreviewConfiguration: async () => config,
      readPreviewJson: async path => path.endsWith('/state.json') ? state : operation,
      savePreviewJson: async (path, value) => { calls.push(['save', path, structuredClone(value)]); },
      withPreviewLock: async (_config, callback) => callback(),
      assertPreviewMarker: async () => { calls.push(['marker']); },
      preparePreviewWeb: async (...args) => { calls.push(['prepare', ...args]); if (prepareFailure) throw Object.assign(new Error('WEB_HOST_POLICY_UNSUPPORTED'), { code: 'WEB_HOST_POLICY_UNSUPPORTED' }); return 'prepared-web'; },
      startPreviewServices: async (...args) => { calls.push(['start', ...args]); if (targetSelection) args[1].processes.web = { pid: 12345, nonce: 'synthetic-new-launch', role: 'web' }; },
    },
    './process.mjs': {
      inspectOwnedProcess: async record => { calls.push(['inspect', record]); return record === unknownRecord ? 'unknown' : 'running'; },
      stopOwnedProcess: async record => { calls.push(['stop', record]); return 'stopped'; },
    },
    '../../apps/server/src/runner-maintenance/index.ts': {
      migrateRunnerMaintenance: async () => { calls.push(['migrate']); },
      readRunnerMaintenance: async (_pool, runnerId) => ({ ...views.get(runnerId) }),
      commandRunnerMaintenance: async (...args) => {
        calls.push(['command', ...args]);
        const [, runnerId, action, request, key] = args;
        if (failCommand?.(runnerId, action, request)) throw new Error('synthetic-lost-ACK');
        if (!commandReceipts.has(key)) {
          commandReceipts.add(key); const value = views.get(runnerId); value.version++; value.state = { drain: 'draining', hold: 'maintenance', resume: 'accepting' }[action]; value.operationId = request.operationId;
        }
      },
    },
    './web-release.mjs': { readWebRelease: async () => ({}) },
    './backend-release/host.mjs': { backendById: async () => selected, backendRuntime: async (...args) => { calls.push(['runtime', ...args]); } },
    './browser-session-configuration.mjs': { pinnedBrowserSessionConfiguration: async () => ({ context: configured ? {} : null }) },
  };
  const context = vm.createContext({ process: { argv: ['node', '/not-the-module'] } });
  const url = new URL('./maintenance-host.mjs', import.meta.url);
  let source = await readFile(url, 'utf8');
  if (legacy) {
    const pin = JSON.parse(await readFile(new URL('../../docs/evidence/svc09/message-settings-activation/host-integration/maintenance-target-04da-input.json', import.meta.url), 'utf8'));
    source = (await execute('/usr/bin/git', ['show', `${pin.source}:${pin.path}`], { cwd: repository, timeout: 1500 })).stdout;
    assert.equal(createHash('sha256').update(source).digest('hex'), pin.baseSha256);
    for (const change of pin.changes) { assert.equal(source.split(change.before).length, 2); source = source.replace(change.before, change.after); }
    assert.equal(createHash('sha256').update(source).digest('hex'), pin.candidateSha256);
  }
  const module = new vm.SourceTextModule(source, { context, identifier: url.href, initializeImportMeta: meta => { meta.url = url.href; } });
  await module.link(async specifier => {
    const values = specifier.startsWith('node:') ? await import(specifier) : ports[specifier];
    assert.ok(values, `undeclared maintenance dependency ${specifier}`);
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [name, value] of Object.entries(values)) this.setExport(name, value); }, { context });
  });
  await module.evaluate();
  return { calls, state, config, slots, views, operation, run: () => module.namespace.maintainPreview({ directory: config.directory, action, target: selected?.sourceHead ?? '', backendId: action === 'bootstrap' && selected ? selected.artifactId : undefined }) };
}

test('SVC09 maintenance bootstrap qualifies the selected backend and independent Web before drain', async () => {
  const selected = { artifactId: 'new', sourceHead: 'e'.repeat(40) };
  for (const configured of [false, true]) {
    const f = await maintenancePorts({ selected, configured, prepareFailure: true });
    await assert.rejects(f.run(), { code: 'WEB_HOST_POLICY_UNSUPPORTED' });
    const prepare = f.calls.find(call => call[0] === 'prepare');
    assert.equal(prepare[2], selected.sourceHead); assert.equal(prepare[3], selected);
    assert.equal(f.state.webHost.artifact.artifactId, 'independent-old-web');
    assert.ok(!f.calls.some(call => ['inspect', 'migrate', 'save', 'command', 'stop', 'start'].includes(call[0])));
    assert.equal(f.calls.at(-1)[0], 'end');
  }
  const legacy = await maintenancePorts({ prepareFailure: true }); legacy.state.backendArtifact = null;
  await assert.rejects(legacy.run(), { code: 'WEB_HOST_POLICY_UNSUPPORTED' });
  assert.equal(legacy.calls.find(call => call[0] === 'prepare')[2], undefined);
  assert.equal(legacy.calls.find(call => call[0] === 'prepare')[3], null);
  assert.ok(!legacy.calls.some(call => ['migrate', 'command', 'stop', 'start'].includes(call[0])));
  const success = await maintenancePorts({ selected }); await success.run();
  assert.ok(success.calls.findIndex(call => call[0] === 'prepare') < success.calls.findIndex(call => call[0] === 'migrate'));
  assert.equal(success.calls.filter(call => call[0] === 'command').length, 1);
  assert.equal(success.calls.find(call => call[0] === 'command')[3], 'drain');
});

test('SVC09 maintenance refresh passes the same descriptor through prepare and startup before stopping', async () => {
  const selected = { artifactId: 'new', sourceHead: 'e'.repeat(40) };
  const failed = await maintenancePorts({ action: 'refresh', selected, prepareFailure: true });
  await assert.rejects(failed.run(), { code: 'WEB_HOST_POLICY_UNSUPPORTED' });
  assert.equal(failed.calls.find(call => call[0] === 'prepare')[3], selected);
  assert.ok(!failed.calls.some(call => ['save', 'stop', 'start'].includes(call[0])));
  const success = await maintenancePorts({ action: 'refresh', selected }); await success.run();
  assert.deepEqual(success.calls.filter(call => call[0] === 'stop').map(call => call[1]), ['web', 'runner', 'center']);
  assert.equal(success.calls.find(call => call[0] === 'start')[4], selected);
  assert.ok(success.calls.findIndex(call => call[0] === 'prepare') < success.calls.findIndex(call => call[0] === 'stop'));
});

test('SVC09 CLI qualifies the actual selected maintenance runtime before any child spawn', async () => {
  const preview = await import('./preview.mjs');
  const { EventEmitter } = await import('node:events');
  for (const rejected of [true, false]) {
    const calls = []; let stderr = '';
    const runtime = { root: '/selected-artifact', entry: '/selected-artifact/tools/personal-preview/cli.mjs' };
    const state = { argv: ['node', cli, 'maintenance', 'bootstrap', '--directory', '/synthetic'], execPath: process.execPath, stderr: { write: value => { stderr += value; } }, stdout: { write: () => {} } };
    const ports = {
      './preview.mjs': { ...preview, loadPreviewConfiguration: async () => ({ directory: '/synthetic' }), assertPreviewMaintenanceRuntime: async (_config, selected) => {
        calls.push('qualify'); assert.equal(selected, runtime);
        if (rejected) throw Object.assign(new Error('MAINTENANCE_HOST_POLICY_UNSUPPORTED'), { code: 'MAINTENANCE_HOST_POLICY_UNSUPPORTED' });
      } },
      './backend-release/host.mjs': { maintenanceRuntime: async () => runtime },
      './environment.mjs': { baseServiceEnvironment: () => ({}) },
      'node:child_process': { spawn: (_program, args, options) => { calls.push('spawn'); assert.equal(args[2], '/selected-artifact/tools/personal-preview/maintenance-host.mjs'); assert.equal(options.cwd, runtime.root); const child = new EventEmitter(); queueMicrotask(() => child.emit('exit', 0)); return child; } },
    };
    const context = vm.createContext({ process: state });
    const module = new vm.SourceTextModule(await readFile(cli, 'utf8'), { context, identifier: cli });
    await module.link(async specifier => {
      const values = ports[specifier] ?? (specifier.startsWith('node:') ? await import(specifier) : null);
      assert.ok(values, `undeclared CLI dependency ${specifier}`);
      return new vm.SyntheticModule(Object.keys(values), function () { for (const [name, value] of Object.entries(values)) this.setExport(name, value); }, { context });
    });
    await module.evaluate();
    assert.deepEqual(calls, rejected ? ['qualify'] : ['qualify', 'spawn']);
    assert.equal(state.exitCode, rejected ? 1 : 0);
    assert.equal(stderr ? JSON.parse(stderr).error : null, rejected ? 'MAINTENANCE_HOST_POLICY_UNSUPPORTED' : null);
  }
});

test('SVC09A maintenance drains both immutable slot identities with one operation and distinct keys', async () => {
  const f = await maintenancePorts({ settings: true, selected: { artifactId: 'old', sourceHead: 'e'.repeat(40) } }); const result = await f.run();
  const commands = f.calls.filter(call => call[0] === 'command');
  assert.deepEqual(commands.map(call => call[2]), ['runner', 'settings-runner']);
  assert.deepEqual(commands.map(call => call[3]), ['drain', 'drain']);
  assert.equal(new Set(commands.map(call => call[4].operationId)).size, 1);
  assert.equal(new Set(commands.map(call => call[5])).size, 2);
  assert.equal(result.slots.length, 2); assert.equal(result.state, 'draining'); assert.equal(result.actualClaim, 'unknown');
});
test('SVC09A any busy slot prevents all stops and any hold until its work settles', async () => {
  const f = await maintenancePorts({ settings: true, action: 'refresh', selected: { sourceHead: 'e'.repeat(40) }, secondState: 'draining', active: 1 });
  assert.equal((await f.run()).update, 'waiting-for-current-work');
  assert.equal(f.calls.some(call => ['stop', 'start', 'command'].includes(call[0])), false);
});
test('SVC09A aggregate maintenance preserves uncertainty from either slot', async () => {
  const f = await maintenancePorts({ settings: true, action: 'status' });
  f.views.get('runner').activeAttempts = 1;
  f.views.get('settings-runner').activeAttempts = 2;
  f.views.get('settings-runner').uncertainAttempts = 2;
  const result = await f.run();
  assert.equal(result.activeAttempts, 3); assert.equal(result.uncertainAttempts, 2);
  assert.equal(result.slots[1].uncertainAttempts, 2); assert.equal(result.actualClaim, 'unknown');
  assert.equal(f.calls.some(call => ['command', 'stop', 'start'].includes(call[0])), false);
});
test('SVC09A holds every drained slot before stopping all four services and starting once', async () => {
  const f = await maintenancePorts({ settings: true, action: 'refresh', selected: { sourceHead: 'e'.repeat(40) }, secondState: 'draining' });
  const result = await f.run(); assert.equal(result.update, 'ready-paused');
  assert.deepEqual(f.calls.filter(call => call[0] === 'stop').map(call => call[1]), ['web', 'settings', 'runner', 'center']);
  assert.equal(f.calls.filter(call => call[0] === 'start').length, 1);
  assert.ok(f.calls.findIndex(call => call[0] === 'command') < f.calls.findIndex(call => call[0] === 'stop'));
});
test('SVC09A unknown settings process or extra owned record blocks refresh without any stop', async () => {
  for (const extra of [false, true]) {
    const f = await maintenancePorts({ settings: true, action: 'refresh', selected: { sourceHead: 'e'.repeat(40) }, unknownRecord: extra ? null : 'settings' });
    if (extra) f.state.processes.unexpected = 'foreign-record';
    await assert.rejects(f.run(), { code: 'EXISTING_PROCESSES_UNCONFIRMED' });
    assert.equal(f.calls.some(call => ['stop', 'start'].includes(call[0])), false);
  }
});
test('SVC09A partial resume retains fixed CAS and keys and cannot report all slots accepting', async () => {
  let fail = true;
  const f = await maintenancePorts({ settings: true, action: 'resume', selected: { sourceHead: 'e'.repeat(40) }, failCommand: id => id === 'settings-runner' && fail });
  await assert.rejects(f.run(), /synthetic-lost-ACK/); assert.equal(f.operation.phase, 'resume-requested');
  assert.equal(f.views.get('runner').state, 'accepting'); assert.equal(f.views.get('settings-runner').state, 'maintenance');
  const first = f.calls.filter(call => call[0] === 'command').map(call => [call[2], call[4].version, call[5]]);
  fail = false; const result = await f.run(); assert.equal(result.state, 'accepting'); assert.equal(result.actualClaim, 'unknown');
  assert.deepEqual(f.calls.filter(call => call[0] === 'command').slice(2).map(call => [call[2], call[4].version, call[5]]), first);
});
test('SVC09A a changed slot set cannot reuse the old single-runner maintenance operation', async () => {
  const f = await maintenancePorts({ settings: true, action: 'refresh', selected: { sourceHead: 'e'.repeat(40) } }); delete f.operation.slots;
  await assert.rejects(f.run(), { code: 'MAINTENANCE_SLOT_SET_CHANGED' });
  assert.equal(f.calls.some(call => ['command', 'stop', 'start'].includes(call[0])), false);
});

test('SVC09A selected runtime qualification failure precedes drain, hold and every service stop', async () => {
  for (const action of ['bootstrap', 'refresh']) {
    const f = await maintenancePorts({ settings: true, action, selected: { artifactId: 'old', sourceHead: 'e'.repeat(40) }, prepareFailure: true });
    await assert.rejects(f.run(), { code: 'WEB_HOST_POLICY_UNSUPPORTED' });
    assert.equal(f.calls.some(call => ['stop','start'].includes(call[0])), false);
    if (action === 'bootstrap') assert.equal(f.calls.some(call => call[0] === 'command'), false);
  }
});

test('SVC09A a later accepting version cannot be mistaken for this operation resume receipt', async () => {
  const f = await maintenancePorts({ settings: true, action: 'resume', selected: { sourceHead: 'e'.repeat(40) } });
  f.operation.phase = 'resume-requested'; for (const value of f.operation.slots) value.resumeVersion = 7;
  f.views.get('runner').state = 'accepting'; f.views.get('runner').version = 10;
  await assert.rejects(f.run(), { code: 'MAINTENANCE_OPERATION_UNCONFIRMED' });
  assert.equal(f.calls.some(call => call[0] === 'command'), false);
});


test('held Web target refresh consumes selection before prepare and starts matching backend and Web', async () => {
  const selected = { artifactId: 'new', sourceHead: 'e'.repeat(40) };
  const f = await maintenancePorts({ action: 'refresh', selected, targetSelection: true }); await f.run();
  assert.ok(f.calls.findIndex(call => call[0] === 'select-target') < f.calls.findIndex(call => call[0] === 'prepare'));
  assert.equal(f.calls.find(call => call[0] === 'start')[4], selected);
  assert.equal(f.state.webHost.artifact, selected); assert.equal(f.state.webHost.selection, 'ready');
  assert.equal(f.state.webHost.recordSha256, createHash('sha256').update(JSON.stringify(f.state.processes.web)).digest('hex'));
  const savedStates = f.calls.filter(call => call[0] === 'save' && call[1].endsWith('/state.json'));
  assert.deepEqual(savedStates.map(call => call[2].webHost.selection), ['starting', 'ready']);
  assert.equal(f.operation.phase, 'ready-paused');
});
test('held Web target selection failure preserves pause and prevents prepare, stop and start', async () => {
  const f = await maintenancePorts({ action: 'refresh', selected: { artifactId: 'new', sourceHead: 'e'.repeat(40) }, targetSelection: true, targetSelectionFailure: true });
  await assert.rejects(f.run(), { code: 'MAINTENANCE_TARGET_CHANGED' });
  assert.ok(!f.calls.some(call => ['prepare', 'save', 'stop', 'start', 'command'].includes(call[0])));
  assert.equal(f.state.webHost.artifact.artifactId, 'independent-old-web');
});

test('held Web target fixed04da refresh consumes the exact minimal delta without slots or new DDL', async () => {
  const selected = { artifactId: 'new', sourceHead: 'e'.repeat(40) };
  const f = await maintenancePorts({ action: 'refresh', selected, targetSelection: true, legacy: true }); await f.run();
  assert.ok(f.calls.findIndex(call => call[0] === 'select-target') < f.calls.findIndex(call => call[0] === 'prepare'));
  assert.equal(f.calls.find(call => call[0] === 'start')[4], selected); assert.equal(f.state.webHost.artifact, selected);
  assert.deepEqual(f.calls.filter(call => call[0] === 'stop').map(call => call[1]), ['web', 'runner', 'center']);
  assert.ok(!f.calls.some(call => ['command', 'migrate'].includes(call[0])));
});
test('held Web target fixed04da failure keeps old selection and prevents lifecycle calls', async () => {
  const f = await maintenancePorts({ action: 'refresh', selected: { artifactId: 'new', sourceHead: 'e'.repeat(40) }, targetSelection: true, targetSelectionFailure: true, legacy: true });
  await assert.rejects(f.run(), { code: 'MAINTENANCE_TARGET_CHANGED' });
  assert.ok(!f.calls.some(call => ['prepare', 'save', 'stop', 'start', 'command'].includes(call[0])));
});
