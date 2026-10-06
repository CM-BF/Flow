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
