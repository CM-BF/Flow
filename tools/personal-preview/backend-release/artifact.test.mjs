import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareBackendArtifact, verifyBackendArtifact } from './index.mjs';
test('rejects unknown source and descriptors before publishing or adopting a path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'svc06-reject-'));
  try {
    await assert.rejects(prepareBackendArtifact({ repository: process.cwd(), target: 'HEAD', directory }), { code: 'BACKEND_TARGET_REQUIRED' });
    await assert.rejects(verifyBackendArtifact({ directory, artifact: { artifactId: '../escape' } }), { code: 'BACKEND_DESCRIPTOR_INVALID' });
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
