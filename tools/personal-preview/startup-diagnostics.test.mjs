import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, stat, chmod, symlink, link, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { openStartupDiagnostics, observeStartupChild, preserveStartupFailure, publicStartupFailure, startupFailure, STARTUP_STDERR_BYTES } from './startup-diagnostics.mjs';

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
