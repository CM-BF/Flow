import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preflight, run } from './driver.mjs';

test('preflight is zero-query and unauthorized native execution creates no resources', async () => {
  const pre = await preflight(); assert.equal(pre.nativeQueryCalls, 0); assert.equal(pre.profile.access, 'configured-readonly');
  const root = await mkdtemp(join(tmpdir(), 'flow-o10-test-')); const output = join(root, 'uncreated');
  try { await assert.rejects(run('native', output), /fresh explicit permit/); await assert.rejects(access(output), { code: 'ENOENT' }); }
  finally { await rm(root, { recursive: true, force: true }); }
});
