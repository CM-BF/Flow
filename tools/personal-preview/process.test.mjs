import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnOwnedProcess, inspectOwnedProcess, stopOwnedProcess } from './process.mjs';

test('stops only the recorded process identity and leaves a mismatched identity untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-preview-process-'));
  const fixture = join(directory, 'idle.mjs');
  await writeFile(fixture, 'setInterval(() => {}, 1000);');
  let owned;
  try {
    owned = await spawnOwnedProcess({ args: [fixture], cwd: directory, env: process.env });
    assert.equal(await inspectOwnedProcess(owned), 'running');
    assert.equal(await stopOwnedProcess({ ...owned, startedAt: 'not-the-recorded-start' }, 100), 'unknown');
    assert.equal(await inspectOwnedProcess(owned), 'running');
    assert.equal(await stopOwnedProcess(owned, 2000), 'stopped');
    assert.equal(await inspectOwnedProcess(owned), 'stopped');
  } finally {
    if (owned) await stopOwnedProcess(owned, 2000);
    await rm(directory, { recursive: true, force: true });
  }
});

test('a process ignoring TERM stays unknown at the deadline instead of being force-killed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-preview-timeout-'));
  const fixture = join(directory, 'delayed.mjs'); const ready = join(directory, 'ready');
  await writeFile(fixture, "import {writeFileSync} from 'node:fs'; process.on('SIGTERM',()=>{}); writeFileSync(process.argv[2],'ready'); setTimeout(()=>process.exit(0),600);");
  const owned = await spawnOwnedProcess({ args: [fixture, ready], cwd: directory, env: process.env });
  try {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) { try { await access(ready); break; } catch { await sleep(10); } }
    await access(ready);
    assert.equal(await stopOwnedProcess(owned, 20), 'unknown');
    assert.equal(await inspectOwnedProcess(owned), 'running');
    await sleep(650);
    assert.equal(await inspectOwnedProcess(owned), 'stopped');
  } finally { await stopOwnedProcess(owned, 2000); await rm(directory, { recursive: true, force: true }); }
});

async function listenerFixture({ owner = true, pids = '90002\n', listenerGroup = 90001, queryError } = {}) {
  const vm = await import('node:vm'); const { readFile } = await import('node:fs/promises'); const { promisify } = await import('node:util');
  const record = { pid: 90001, group: 90001, nonce: 'controlled-nonce', startedAt: 'Wed Oct  7 10:00:00 2026', command: 'node fixture --flow-preview=controlled-nonce' };
  const calls = [];
  const execFile = () => { throw new Error('callback path not expected'); };
  execFile[promisify.custom] = async (command, args, options) => {
    calls.push({ command, args, timeout: options.timeout });
    if (command === 'lsof') { if (queryError) throw queryError; return { stdout: pids }; }
    assert.equal(command, 'ps');
    const group = args[1] === String(record.pid) ? (owner ? record.group : 80000) : listenerGroup;
    return { stdout: `${group} ${record.startedAt} ${record.command}\n` };
  };
  const context = vm.createContext({ process: { ...process, kill: () => { throw new Error('signal must not be used'); } } });
  const url = new URL('./process.mjs', import.meta.url);
  const module = new vm.SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href });
  await module.link(async specifier => {
    const values = specifier === 'node:child_process' ? { execFile, spawn: () => { throw new Error('spawn must not be used'); } } : await import(specifier);
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [name, value] of Object.entries(values)) this.setExport(name, value); }, { context });
  }); await module.evaluate(); return { functions: module.namespace, record, calls };
}

test('SVC09A readiness listener structured and boolean interfaces each reuse one real predicate probe', async () => {
  const f = await listenerFixture();
  const value = await f.functions.observeOwnedListener(f.record, 12345);
  assert.equal(value.owned, true); assert.equal(value.phase, 'confirmed'); assert.equal(value.listenerCount, 1);
  assert.equal(f.calls.filter(call => call.command === 'lsof').length, 1);
  assert.equal(await f.functions.ownsListener(f.record, 12345), true);
  assert.equal(f.calls.filter(call => call.command === 'lsof').length, 2);
  assert.ok(f.calls.every(call => call.timeout === 1000));
});

test('SVC09A readiness listener owner mismatch and malformed or foreign listener stay false', async () => {
  for (const options of [{ owner: false }, { pids: 'unknown' }, { listenerGroup: 80000 }]) {
    const f = await listenerFixture(options); const value = await f.functions.observeOwnedListener(f.record, 12345);
    assert.equal(value.owned, false);
    assert.equal(value.phase, options.owner === false ? 'owner' : options.pids ? 'listener-pids' : 'listener-owner');
    assert.equal(f.calls.filter(call => call.command === 'lsof').length, options.owner === false ? 0 : 1);
  }
});

test('SVC09A readiness listener separates executable errors and numeric exits without retaining output', async () => {
  for (const code of ['ENOENT', 1, 'unsafe-string']) {
    const f = await listenerFixture({ queryError: Object.assign(new Error('private-message'), { code, stderr: 'private-stderr' }) });
    const value = await f.functions.observeOwnedListener(f.record, 12345);
    assert.equal(value.owned, false); assert.equal(value.phase, 'listener-query');
    assert.equal(value.code, code === 'ENOENT' ? code : null); assert.equal(value.exitCode, code === 1 ? 1 : null);
    assert.equal(JSON.stringify(value).includes('private'), false); assert.equal(JSON.stringify(value).includes('unsafe-string'), false);
  }
});
