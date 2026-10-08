import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareBackendArtifact, verifyBackendArtifact, assertBackendRetention, BACKEND_POLICY } from './index.mjs';
import { LIMITS, digest } from './files.mjs';
test('rejects unknown source and descriptors before publishing or adopting a path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'svc06-reject-'));
  try {
    await assert.rejects(prepareBackendArtifact({ repository: process.cwd(), target: 'HEAD', directory }), { code: 'BACKEND_TARGET_REQUIRED' });
    await assert.rejects(verifyBackendArtifact({ directory, artifact: { artifactId: '../escape' } }), { code: 'BACKEND_DESCRIPTOR_INVALID' });
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('APFS clone is a separate file: subsequent seed edits do not alter published bytes', async () => {
  const { writeFile, readFile, stat } = await import('node:fs/promises');
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

test('clone refuses existing destination and symbolic source without normal copy fallback', async () => {
 const {writeFile,readFile,symlink}=await import('node:fs/promises');const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const {fileURLToPath}=await import('node:url');
 const directory=await mkdtemp(join(tmpdir(),'svc06-clone-deny-'));
 const command=(source,target)=>promisify(execFile)('/usr/bin/python3',[fileURLToPath(new URL('./clone-store.py',import.meta.url)),source,target],{env:{PATH:'/usr/bin:/bin'}});
 try{const a=join(directory,'a'),b=join(directory,'b');await writeFile(a,'source');await writeFile(b,'existing');await assert.rejects(command(a,b));assert.equal(await readFile(b,'utf8'),'existing');await symlink(a,join(directory,'link'));await assert.rejects(command(join(directory,'link'),join(directory,'new')));assert.deepEqual((await readdir(directory)).sort(),['a','b','link']);}finally{await rm(directory,{recursive:true,force:true});}
});

test('offline missing selected cache records pre-install failure before cleaning stage and publishes nothing', async () => {
 const {mkdir,readFile}=await import('node:fs/promises');const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const directory=await mkdtemp(join(tmpdir(),'svc06-offline-')), seed=await mkdtemp(join(tmpdir(),'svc06-empty-seed-'));
 try{
  await mkdir(join(seed,'files'));
  const target=(await promisify(execFile)('git',['rev-parse','280289008a5a3779e4e5e6453181b96062ed9514'])).stdout.trim();
  await assert.rejects(prepareBackendArtifact({repository:process.cwd(),target,directory,offlineStore:seed,pnpmCli:'/opt/homebrew/lib/node_modules/pnpm/bin/pnpm.cjs'}));
  const files=await readdir(join(directory,'backend-artifacts'));assert.equal(files.length,1);assert.match(files[0],/^stage-.*\.json$/);
  const receipt=JSON.parse(await readFile(join(directory,'backend-artifacts',files[0]),'utf8'));
  assert.equal(receipt.phase,'failed-or-unknown');assert.equal(receipt.code,'ENOENT');assert.equal(receipt.buildOutput,null);assert.equal(receipt.artifact,null);
 }finally{await rm(directory,{recursive:true,force:true});await rm(seed,{recursive:true,force:true});}
});

test('retention keeps four fixed artifacts and admits a bounded fifth, never a sixth', () => {
  const four = { count: 4, bytes: 1467477371 }, nextBytes = 367000000;
  assert.doesNotThrow(() => assertBackendRetention(four, { kind: 'import', bytes: nextBytes }));
  assert.equal(LIMITS.artifacts, 5);
  assert.equal(LIMITS.bytes, 1024 ** 3);
  assert.equal(LIMITS.retainedBytes, 2 * 1024 ** 3);
  const five = { count: 5, bytes: four.bytes + nextBytes };
  assert.doesNotThrow(() => assertBackendRetention(five));
  assert.throws(() => assertBackendRetention(five, { kind: 'import', bytes: 1 }), { code: 'BACKEND_RETENTION_FULL' });
  assert.deepEqual(four, { count: 4, bytes: 1467477371 });
});

test('retention reserves the maximum for build while verified imports use actual bytes', () => {
  const four = { count: 4, bytes: 1467477371 };
  assert.throws(() => assertBackendRetention(four, { kind: 'build' }), { code: 'BACKEND_RETENTION_FULL' });
  assert.doesNotThrow(() => assertBackendRetention(four, { kind: 'import', bytes: 367000000 }));
  assert.doesNotThrow(() => assertBackendRetention({ count: 0, bytes: 0 }, { kind: 'build' }));
  assert.throws(() => assertBackendRetention(four, { kind: 'build', bytes: 1 }), { code: 'BACKEND_RETENTION_INVALID' });
});

test('retention retains exact aggregate and single-artifact byte limits', () => {
  const gib = 1024 ** 3;
  assert.doesNotThrow(() => assertBackendRetention({ count: 4, bytes: gib }, { kind: 'import', bytes: gib }));
  assert.throws(() => assertBackendRetention({ count: 4, bytes: gib + 1 }, { kind: 'import', bytes: gib }), { code: 'BACKEND_RETENTION_FULL' });
  assert.throws(() => assertBackendRetention({ count: 1, bytes: 1 }, { kind: 'import', bytes: gib + 1 }), { code: 'BACKEND_RETENTION_INVALID' });
  assert.throws(() => assertBackendRetention({ count: 5, bytes: 2 * gib + 1 }), { code: 'BACKEND_RETENTION_FULL' });
  assert.throws(() => assertBackendRetention({ count: 6, bytes: 1 }), { code: 'BACKEND_RETENTION_FULL' });
});

test('retention rejects unknown quantities and unrecognized admission modes', () => {
  for (const value of [undefined, null, NaN, Infinity, -1, 0.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => assertBackendRetention({ count: value, bytes: 0 }), { code: 'BACKEND_RETENTION_INVALID' });
    assert.throws(() => assertBackendRetention({ count: 0, bytes: value }), { code: 'BACKEND_RETENTION_INVALID' });
    assert.throws(() => assertBackendRetention({ count: 0, bytes: 0 }, { kind: 'import', bytes: value }), { code: 'BACKEND_RETENTION_INVALID' });
  }
  for (const addition of [{}, { kind: 'unknown' }, { kind: 'import', bytes: 0 }, { kind: 'import', bytes: 1, verified: true }]) {
    assert.throws(() => assertBackendRetention({ count: 0, bytes: 0 }, addition), { code: 'BACKEND_RETENTION_INVALID' });
  }
});

test('retention public prepare reads five unchanged legacy manifests and rejects a sixth before build', async () => {
  const { mkdir, writeFile, readFile, realpath } = await import('node:fs/promises');
  const { nodeIdentity } = await import('./node-identity.mjs');
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'svc06-retention-')));
  try {
    const store = join(directory, 'backend-artifacts');
    await mkdir(store, { mode: 0o700 });
    const node = await nodeIdentity(), originals = [];
    for (const digit of ['1', '2', '3', '4', '5']) {
      const sourceHead = digit.repeat(40);
      const encoded = JSON.stringify({ policy: BACKEND_POLICY, sourceHead, node, inventory: { entries: [], bytes: 0 } }) + '\n';
      const artifactId = digest(encoded), path = join(store, artifactId);
      await mkdir(path, { mode: 0o700 }); await mkdir(join(path, 'root'), { mode: 0o700 });
      await writeFile(join(path, 'manifest.json'), encoded, { mode: 0o600 });
      originals.push({ path, encoded, artifact: { policy: BACKEND_POLICY, artifactId, manifestDigest: artifactId, sourceHead } });
    }
    const first = originals[0].artifact;
    assert.deepEqual(await prepareBackendArtifact({ directory, repository: process.cwd(), target: first.sourceHead }), first);
    await assert.rejects(prepareBackendArtifact({ directory, repository: process.cwd(), target: '6'.repeat(40) }), { code: 'BACKEND_RETENTION_FULL' });
    assert.deepEqual((await readdir(store)).sort(), originals.map(item => item.artifact.artifactId).sort());
    for (const item of originals) assert.equal(await readFile(join(item.path, 'manifest.json'), 'utf8'), item.encoded);
    await writeFile(join(store, 'unknown'), 'unconfirmed');
    await assert.rejects(prepareBackendArtifact({ directory, repository: process.cwd(), target: first.sourceHead }), { code: 'BACKEND_STORE_UNCONFIRMED' });
    assert.equal(await readFile(join(store, 'unknown'), 'utf8'), 'unconfirmed');
    assert.ok(!(await readdir(store)).includes('prepare.lock'));
  } finally { await rm(directory, { recursive: true }); }
});
