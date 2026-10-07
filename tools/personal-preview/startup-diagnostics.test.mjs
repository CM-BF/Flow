import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, stat, chmod, symlink, link, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { readRunnerInitialization, openStartupDiagnostics, observeStartupChild, preserveStartupFailure, publicStartupFailure, startupFailure, STARTUP_STDERR_BYTES } from './startup-diagnostics.mjs';

async function installation(t) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-startup-diagnostic-'));
  t.after(() => rm(directory, { recursive: true }));
  const role = 'runner', nonce = randomUUID(), pid = process.pid;
  const state = { processes: { [role]: { pid, nonce } } };
  const statePath = join(directory, 'state.json');
  await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
  const stem = join(directory, 'startup-diagnostics', `${role}-${nonce}`);
  return { directory, role, nonce, pid, state, statePath, stem };
}
function ownChild(t, source) {
  const child = spawn(process.execPath, ['-e', source], { stdio: ['ignore', 'ignore', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
    }
  });
  return child;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('public startup failure exposes only controlled fields, never arbitrary codes or error text', () => {
  const error = Object.assign(new Error('token=private'), { code: 'SECRET_TOKEN_VALUE', stack: 'private' });
  const value = publicStartupFailure({ ...startupFailure(error, 'runner', 'ready'), argv: ['private'], env: 'private' });
  assert.deepEqual(Object.keys(value), ['role', 'phase', 'code', 'at']);
  assert.equal(value.code, 'STARTUP_UNCONFIRMED'); assert.equal(value.role, 'runner'); assert.equal(value.phase, 'ready');
  assert.equal(JSON.stringify(value).includes('private'), false);
  assert.equal(publicStartupFailure({ role: 'private', phase: 'private', code: 'ENOENT', at: 'private' }).at, null);
});

test('readiness primary is persisted before cleanup and survives cleanup plus persistence failure', async () => {
  const state = { processes: { center: 'center', runner: 'runner' } }, order = [], snapshots = [];
  const primary = await preserveStartupFailure({ state, role: 'runner', phase: 'ready', error: { code: 'SERVICE_START_UNCONFIRMED' },
    save: async value => { order.push('save'); snapshots.push(structuredClone(value)); if (snapshots.length === 2) throw { code: 'ENOSPC' }; },
    stop: async record => { order.push(record); if (record === 'runner') throw { code: 'EPERM', message: 'private' }; return 'stopped'; } });
  assert.deepEqual(order, ['save', 'runner', 'center', 'save']);
  assert.equal(snapshots[0].lastStartFailure.code, 'SERVICE_START_UNCONFIRMED');
  assert.deepEqual(state.startCleanup, [{ role: 'runner', state: 'unknown', code: 'EPERM' }, { role: 'center', state: 'stopped' }]);
  assert.deepEqual(state.startEvidenceErrors, ['ENOSPC']); assert.equal(state.lastStartFailure, primary);
});

test('pre-spawn phases and safe failure remain bound to the owned nonce with private file permissions', async t => {
  const input = await installation(t), diagnostic = await openStartupDiagnostics(input);
  await diagnostic.stage('runtime');
  assert.equal(JSON.parse(await readFile(`${input.stem}.json`)).phase, 'runtime');
  const summary = await diagnostic.finish(null, { code: 'BACKEND_MANIFEST_INVALID', message: 'secret' });
  const record = JSON.parse(await readFile(`${input.stem}.json`));
  assert.equal(record.errorCode, 'BACKEND_MANIFEST_INVALID'); assert.equal(record.phase, 'startup-failed'); assert.equal(record.nonce, input.nonce);
  assert.equal(record.exit, null); assert.equal(summary.bytes, 0); assert.equal(JSON.stringify(record).includes('secret'), false);
  for (const path of [`${input.stem}.json`, `${input.stem}.stderr`]) { const info = await stat(path); assert.equal(info.mode & 0o777, 0o600); assert.equal(info.nlink, 1); }
  assert.deepEqual((await readdir(join(input.directory, 'startup-diagnostics'))).sort(), [`runner-${input.nonce}.json`, `runner-${input.nonce}.stderr`].sort());
});

test('insecure root permissions and symlink roots are rejected', async t => {
  const input = await installation(t);
  await chmod(input.directory, 0o755); await assert.rejects(openStartupDiagnostics(input), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' });
  await chmod(input.directory, 0o700);
  const alias = `${input.directory}-alias`; await symlink(input.directory, alias); t.after(() => rm(alias));
  await assert.rejects(openStartupDiagnostics({ ...input, directory: alias }), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' });
});

test('state hardlinks, symlinks and insecure modes cannot establish a diagnostic owner', async t => {
  for (const kind of ['hardlink', 'symlink', 'mode']) {
    const input = await installation(t);
    if (kind === 'hardlink') await link(input.statePath, join(input.directory, 'extra'));
    if (kind === 'symlink') { await writeFile(join(input.directory, 'actual'), JSON.stringify(input.state), { mode: 0o600 }); await rm(input.statePath); await symlink(join(input.directory, 'actual'), input.statePath); }
    if (kind === 'mode') await chmod(input.statePath, 0o644);
    await assert.rejects(openStartupDiagnostics(input));
  }
});

test('diagnostic output is exclusive and an existing symlink cannot redirect writes', async t => {
  const input = await installation(t);
  const parent = join(input.directory, 'startup-diagnostics'); await mkdir(parent, { mode: 0o700 });
  const target = join(input.directory, 'untouched'); await writeFile(target, 'unchanged', { mode: 0o600 }); await symlink(target, `${input.stem}.stderr`);
  await assert.rejects(openStartupDiagnostics(input)); assert.equal(await readFile(target, 'utf8'), 'unchanged');
});

test('actual child nonzero exit preserves private stderr bytes and emits only bounded metadata', async t => {
  const input = await installation(t), diagnostic = await openStartupDiagnostics(input);
  const result = await observeStartupChild(ownChild(t, "process.stderr.write('private fixture error\\n',()=>process.exit(7))"), diagnostic);
  assert.equal(result.code, 7); assert.equal(result.stderr.complete, true); assert.equal(result.stderr.truncated, false);
  const bytes = await readFile(`${input.stem}.stderr`); assert.equal(bytes.toString(), 'private fixture error\n'); assert.equal(result.stderr.sha256, sha(bytes));
  assert.equal(JSON.stringify(result).includes('private fixture'), false);
});

test('overflow is drained without killing the child and retains exactly the first 64KiB', async t => {
  const input = await installation(t), diagnostic = await openStartupDiagnostics(input);
  const result = await observeStartupChild(ownChild(t, "process.stderr.write(Buffer.alloc(524288,97),()=>process.exit(0))"), diagnostic);
  assert.equal(result.code, 0); assert.equal(result.stderr.bytes, STARTUP_STDERR_BYTES); assert.equal(result.stderr.observedBytes, 524288);
  assert.equal(result.stderr.truncated, true); assert.equal(result.stderr.complete, true);
  const bytes = await readFile(`${input.stem}.stderr`); assert.equal(bytes.length, STARTUP_STDERR_BYTES); assert.ok(bytes.equals(Buffer.alloc(STARTUP_STDERR_BYTES, 97))); assert.equal(result.stderr.sha256, sha(bytes));
});

test('diagnostic errors still await the actual child exit and preserve its numeric status', async t => {
  const child = ownChild(t, 'setTimeout(()=>process.exit(9),60)');
  const result = await observeStartupChild(child, { capture() { throw { code: 'EIO' }; }, async stage() { throw { code: 'ENOSPC' }; }, async finish() { throw { code: 'EPERM' }; } });
  assert.equal(child.exitCode, 9); assert.equal(result.code, 9); assert.equal(result.diagnosticError, 'EIO');
});

test('missing stderr EOF is bounded and remains explicitly incomplete', async t => {
  const input = await installation(t), diagnostic = await openStartupDiagnostics(input), pipe = new PassThrough();
  diagnostic.capture(pipe); pipe.write('partial');
  const result = await diagnostic.finish({ code: 0, signal: null });
  assert.equal(result.complete, false); assert.equal(result.bytes, 7); assert.equal(pipe.destroyed, true);
});

test('ownership replacement prevents new phase publication while retaining the original private stderr', async t => {
  const input = await installation(t), diagnostic = await openStartupDiagnostics(input);
  input.state.processes.runner.nonce = randomUUID(); await writeFile(input.statePath, JSON.stringify(input.state));
  await assert.rejects(diagnostic.stage('runtime'), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' });
  await assert.rejects(diagnostic.finish(null, { code: 'EIO' }), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' });
  assert.equal(JSON.parse(await readFile(`${input.stem}.json`)).phase, 'configuration-ready');
  assert.equal((await stat(`${input.stem}.stderr`)).size, 0);
});


test('output permission changes stop retaining bytes but still drain and preserve child exit', async t => {
  const input = await installation(t), diagnostic = await openStartupDiagnostics(input);
  await chmod(`${input.stem}.stderr`, 0o644);
  const result = await observeStartupChild(ownChild(t, "process.stderr.write('private',()=>process.exit(0))"), diagnostic);
  assert.equal(result.code, 0); assert.equal(result.stderr.bytes, 0); assert.equal(result.stderr.observedBytes, 7);
  assert.equal(result.stderr.errorCode, 'STARTUP_DIAGNOSTICS_UNAVAILABLE'); assert.equal(result.stderr.complete, true);
  assert.equal((await readFile(`${input.stem}.stderr`)).length, 0);
});


test('actual child spawn failure retains a controlled system code without exposing the program path', async t => {
  const input = await installation(t), diagnostic = await openStartupDiagnostics(input);
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { cwd: join(input.directory, 'missing-private-cwd'), stdio: ['ignore', 'ignore', 'pipe'] });
  const result = await observeStartupChild(child, diagnostic);
  assert.equal(child.pid, undefined); assert.equal(result.code, null); assert.equal(result.signal, 'start-error'); assert.equal(result.startupError, 'ENOENT');
  assert.equal(JSON.stringify(result).includes(input.directory), false);
  const record = JSON.parse(await readFile(`${input.stem}.json`));
  assert.equal(record.phase, 'startup-failed'); assert.equal(record.errorCode, 'ENOENT');
});

test('SVC09A diagnostics refuse arbitrary or undeclared slot keys before output', async t => {
  const input = await installation(t);
  await assert.rejects(openStartupDiagnostics({ ...input, recordKey: 'another-runner' }), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' });
  await writeFile(join(input.directory, 'config.json'), JSON.stringify({ directory: input.directory }), { mode: 0o600 });
  await assert.rejects(openStartupDiagnostics({ ...input, recordKey: 'runner-settings' }), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' });
});
test('SVC09A settings diagnostics bind its declared slot nonce and cannot use the legacy runner identity', async t => {
  const input = await installation(t);
  // /tmp can be a platform alias; the installation contract uses the canonical root.
  const { realpath } = await import('node:fs/promises'); input.directory = await realpath(input.directory);
  const { registerSettingsSlot } = await import('./runner-slots.mjs');
  const config = { directory: input.directory, installationId: randomUUID(), runner: { runnerId: randomUUID(), token: 'old' } };
  await writeFile(join(input.directory, 'config.json'), JSON.stringify(config), { mode: 0o600 });
  await registerSettingsSlot(config, { format: 1, choices: [{ model: 'claude-sonnet-5-5', thinking: 'disabled', effort: { kind: 'not-requested' }, speed: 'standard' }] }, async () => ({ runnerId: randomUUID(), token: 'new' }));
  const newNonce = randomUUID(); input.state.processes['runner-settings'] = { pid: input.pid, nonce: newNonce };
  await writeFile(input.statePath, JSON.stringify(input.state), { mode: 0o600 });
  await assert.rejects(openStartupDiagnostics({ ...input, recordKey: 'runner-settings' }), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' });
  const diagnostic = await openStartupDiagnostics({ ...input, recordKey: 'runner-settings', nonce: newNonce }); await diagnostic.finish(null);
  const raw = JSON.parse(await readFile(join(input.directory, 'startup-diagnostics', `runner-settings-${newNonce}.json`)));
  assert.equal(raw.role, 'runner'); assert.equal(raw.recordKey, 'runner-settings'); assert.equal(raw.nonce, newNonce);
});

test('SVC09A controlled startup failure identifies settings without weakening legacy public fields', () => {
  const value = publicStartupFailure(startupFailure({ code: 'RUNNER_SLOT_PROFILE_MISMATCH' }, 'runner-settings', 'ready'));
  assert.equal(value.role, 'runner'); assert.equal(value.recordKey, 'runner-settings'); assert.equal(value.code, 'RUNNER_SLOT_PROFILE_MISMATCH');
  const legacy = publicStartupFailure(startupFailure({ code: 'EIO' }, 'runner', 'ready'));
  assert.deepEqual(Object.keys(legacy), ['role','phase','code','at']);
  assert.equal(publicStartupFailure({ ...legacy, recordKey: 'arbitrary' }).recordKey, undefined);
});


const initializedFrame = runnerId => ({ protocol: 'flow.runner-startup.v1', type: 'runtime-initialized', runnerId });
async function initializationFixture(t) {
  const input = await installation(t), { realpath } = await import('node:fs/promises');
  input.directory = await realpath(input.directory); input.stem = join(input.directory, 'startup-diagnostics', `runner-${input.nonce}`);
  const diagnostic = await openStartupDiagnostics(input);
  const ready = overrides => readRunnerInitialization({ directory: input.directory, recordKey: 'runner', record: { pid: input.pid, nonce: input.nonce }, runnerId: 'synthetic', ...overrides });
  return { input, diagnostic, ready };
}

test('SVC06B initialization actual IPC persists this child identity and exit removes readiness', async t => {
  const { input, diagnostic, ready } = await initializationFixture(t);
  const child = spawn(process.execPath, ['-e', `process.send(${JSON.stringify(initializedFrame('synthetic'))}); setTimeout(()=>process.exit(0),2000);`], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); });
  let persisted;
  const written = new Promise(resolve => { persisted = resolve; });
  const observed = observeStartupChild(child, { ...diagnostic, async initialized(...args) { await diagnostic.initialized(...args); persisted(); } }, { runnerId: 'synthetic' });
  await written;
  assert.equal(await ready(), true);
  const receipt = JSON.parse(await readFile(`${input.stem}.json`));
  assert.deepEqual(receipt.runtimeInitialized, { protocol: 'flow.runner-startup.v1', childPid: child.pid, runnerId: 'synthetic' });
  assert.equal((await stat(`${input.stem}.json`)).mode & 0o777, 0o600);
  child.kill('SIGTERM'); await observed; assert.equal(await ready(), false);
});

test('SVC06B initialization missing IPC and stale launch receipts cannot prove readiness', async t => {
  const { input, diagnostic, ready } = await initializationFixture(t);
  assert.equal(await ready(), false);
  await diagnostic.initialized(99999, 'synthetic'); assert.equal(await ready(), true);
  assert.equal(await ready({ record: { pid: input.pid + 1, nonce: input.nonce } }), false);
  assert.equal(await ready({ record: { pid: input.pid, nonce: randomUUID() } }), false);
  assert.equal(await ready({ runnerId: 'other' }), false);
  await chmod(`${input.stem}.json`, 0o644);
  await assert.rejects(ready(), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' });
  await chmod(`${input.stem}.json`, 0o600); await diagnostic.finish({ code: 0 });
});

test('SVC06B initialization malformed first IPC rejects all later messages', async () => {
  const { EventEmitter } = await import('node:events');
  for (const first of [null, {}, initializedFrame('wrong'), { ...initializedFrame('synthetic'), extra: true }]) {
    const child = new EventEmitter(); child.pid = 88888; child.connected = true; child.stderr = new PassThrough();
    child.disconnect = () => { child.connected = false; };
    let positives = 0;
    const observed = observeStartupChild(child, { capture() {}, async stage() {}, async initialized() { positives++; }, async finish() {} }, { runnerId: 'synthetic' });
    child.emit('message', first); child.emit('message', initializedFrame('synthetic')); child.emit('exit', 0, null);
    await observed; assert.equal(positives, 0); assert.equal(child.connected, false);
  }
});

test('SVC06B initialization persistence failure keeps child exit and no positive receipt', async t => {
  const { input, diagnostic, ready } = await initializationFixture(t), { EventEmitter } = await import('node:events');
  const child = new EventEmitter(); child.pid = 88888; child.connected = true; child.stderr = new PassThrough();
  child.disconnect = () => { child.connected = false; };
  input.state.processes.runner.nonce = randomUUID(); await writeFile(input.statePath, JSON.stringify(input.state));
  const observed = observeStartupChild(child, diagnostic, { runnerId: 'synthetic' });
  child.emit('message', initializedFrame('synthetic')); child.stderr.end(); child.emit('exit', 9, null);
  const result = await observed;
  assert.equal(result.code, 9); assert.equal(result.diagnosticError, 'STARTUP_DIAGNOSTICS_UNAVAILABLE'); assert.equal(await ready(), false);
});


test('SVC06B initialization a renamed receipt with unfinished durability cannot become ready', async t => {
  const { input, diagnostic, ready } = await initializationFixture(t);
  await diagnostic.initialized(88888, 'synthetic'); assert.equal(await ready(), true);
  await writeFile(`${input.stem}.initializing`, '', { mode: 0o600, flag: 'wx' });
  assert.equal(await ready(), false); await diagnostic.finish({ code: 0 });
});
