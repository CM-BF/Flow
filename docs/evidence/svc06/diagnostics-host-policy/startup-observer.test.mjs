import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod, rm, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as safety from '../../../../tools/personal-preview/startup-diagnostics.mjs';
import { observeStartup } from './startup-observer.mjs';
const nonce = '11111111-1111-4111-8111-111111111111';
const record = { nonce, pid: 300, group: 300 };
async function fixture(body) {
  const directory = await mkdtemp(join(tmpdir(), 'svc06-observer-'));
  const run = join(directory, 'run'), diagnostics = join(directory, 'startup-diagnostics');
  await mkdir(run, { mode: 0o700 }); await mkdir(diagnostics, { mode: 0o700 });
  const stem = join(diagnostics, `runner-${nonce}`);
  const put = (path, value) => writeFile(path, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 });
  await put(join(directory, 'state.json'), { processes: { runner: record }, lastStartFailure: { role: 'runner', phase: 'ready', code: 'SERVICE_START_UNCONFIRMED', at: '2026-10-07T10:00:00.000Z' } });
  for (const name of ['generation-1.json', 'generation-before-refresh.json', 'generation-2.json']) await put(join(run, name), { runner: record });
  try { await body({ directory, run, stem, put, observe: () => observeStartup({ directory, run, safety }) }); }
  finally { await rm(directory, { recursive: true }); }
}

test('keeps nonce-bound phase/exit and bounded stderr metadata without publishing content', async () => fixture(async ({ stem, put, observe }) => {
  const raw = 'private-fixture-marker';
  await put(`${stem}.stderr`, raw);
  await put(`${stem}.json`, { format: 1, role: 'runner', nonce, pid: 300, phase: 'startup-failed', at: '2026-10-07T10:00:00.000Z', errorCode: 'ENOENT', exit: { code: 1, signal: null }, stderr: { bytes: Buffer.byteLength(raw), observedBytes: Buffer.byteLength(raw) + 1, sha256: createHash('sha256').update(raw).digest('hex'), complete: true, truncated: true } });
  const value = await observe();
  assert.equal(value.state, 'observed'); assert.equal(value.primary.phase, 'ready'); assert.equal(value.roles.length, 1);
  assert.equal(value.roles[0].phase, 'startup-failed'); assert.equal(value.roles[0].errorCode, 'ENOENT'); assert.deepEqual(value.roles[0].exit, { code: 1, signal: null });
  assert.equal(value.roles[0].stderr.declaredMatchesObserved, true); assert.equal(value.roles[0].stderr.truncated, true);
  assert.equal(JSON.stringify(value).includes(raw), false);
}));

test('rejects wrong nonce, insecure permissions and symlink without changing primary', async () => fixture(async ({ stem, put, observe }) => {
  const detail = { format: 1, role: 'runner', nonce, pid: 300, phase: 'runtime', at: '2026-10-07T10:00:00.000Z' };
  await put(`${stem}.stderr`, ''); await put(`${stem}.json`, { ...detail, nonce: '22222222-2222-4222-8222-222222222222' });
  let value = await observe(); assert.equal(value.roles[0].observation.state, 'unknown'); assert.equal(value.primary.code, 'SERVICE_START_UNCONFIRMED');
  await put(`${stem}.json`, detail); await chmod(`${stem}.stderr`, 0o644);
  value = await observe(); assert.equal(value.roles[0].observation.state, 'unknown');
  await chmod(`${stem}.stderr`, 0o600); await unlink(`${stem}.stderr`); await symlink(`${stem}.json`, `${stem}.stderr`);
  value = await observe(); assert.equal(value.roles[0].observation.state, 'unknown'); assert.equal(value.primary.phase, 'ready');
}));

test('pre-spawn runtime phase and missing record remain unconfirmed rather than invented exit', async () => fixture(async ({ stem, put, observe }) => {
  await put(`${stem}.stderr`, ''); await put(`${stem}.json`, { format: 1, role: 'runner', nonce, pid: 300, phase: 'runtime', at: '2026-10-07T10:00:00.000Z' });
  let value = await observe(); assert.equal(value.roles[0].phase, 'runtime'); assert.equal(value.roles[0].exit, 'NOT_OBSERVED'); assert.equal(value.roles[0].stderr.complete, null);
  await unlink(`${stem}.json`); value = await observe(); assert.equal(value.roles[0].observation.state, 'not-observed'); assert.equal(value.roles[0].exit, 'NOT_OBSERVED');
}));
