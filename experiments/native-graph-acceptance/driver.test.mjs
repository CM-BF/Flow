import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { preflight, run } from './driver.mjs';

test('default preflight reports exact real SDK tool names and zero query/authentication calls', async () => {
  const result = await preflight();
  assert.equal(result.nativeQueryCalls, 0); assert.equal(result.providerAuthenticationCalls, 0);
  assert.equal(result.dependencies.claudeSdk, '0.3.290');
  assert.deepEqual(result.tools.map(tool => tool.name).sort(), ['graph_command', 'graph_read']);
  assert.equal(result.tools.find(tool => tool.name === 'graph_read').annotations.readOnlyHint, true);
  assert.equal(result.tools.find(tool => tool.name === 'graph_command').annotations.readOnlyHint, false);
});
test('native entry without new authorization refuses before creating an output or private resources', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'flow-o08-refusal-')); const output = join(temporary, 'must-not-exist');
  try {
    await assert.rejects(run('native', output), /fresh explicit permit/);
    await assert.rejects(access(output), { code: 'ENOENT' });
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
