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

test('APFS clone is a separate file: subsequent seed edits do not alter published bytes', async () => {
  const { copyFile, writeFile, readFile, stat } = await import('node:fs/promises');
  const { constants } = await import('node:fs');
  const directory = await mkdtemp(join(tmpdir(), 'svc06-clone-'));
  try {
    const seed = join(directory,'seed'), artifact = join(directory,'artifact');
    await writeFile(seed, Buffer.alloc(1024 * 1024, 65));
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const { fileURLToPath } = await import('node:url');
    await promisify(execFile)('/usr/bin/python3',[fileURLToPath(new URL('./clone-store.py', import.meta.url)),seed,artifact],{env:{PATH:'/usr/bin:/bin'}});
    assert.equal((await stat(artifact)).nlink, 1); assert.notEqual((await stat(seed)).ino,(await stat(artifact)).ino);
    await writeFile(seed, 'changed source');
    assert.deepEqual(await readFile(artifact), Buffer.alloc(1024 * 1024, 65));
  } finally { await rm(directory, {recursive:true,force:true}); }
});
