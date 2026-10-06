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

test('offline missing package saves installer failure before cleaning stage and publishes nothing', async () => {
 const {mkdir,readFile}=await import('node:fs/promises');const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const directory=await mkdtemp(join(tmpdir(),'svc06-offline-')), seed=await mkdtemp(join(tmpdir(),'svc06-empty-seed-'));
 try{
  await mkdir(join(seed,'files'));
  const target=(await promisify(execFile)('git',['rev-parse','280289008a5a3779e4e5e6453181b96062ed9514'])).stdout.trim();
  await assert.rejects(prepareBackendArtifact({repository:process.cwd(),target,directory,offlineStore:seed,pnpmCli:'/opt/homebrew/lib/node_modules/pnpm/bin/pnpm.cjs'}));
  const files=await readdir(join(directory,'backend-artifacts'));assert.equal(files.length,1);assert.match(files[0],/^stage-.*\.json$/);
  const receipt=JSON.parse(await readFile(join(directory,'backend-artifacts',files[0]),'utf8'));
  assert.equal(receipt.phase,'failed-or-unknown');assert.notEqual(receipt.buildOutput.exit,0);assert.match(receipt.buildOutput.stdout,/ERR_PNPM_NO_OFFLINE_TARBALL/);assert.equal(receipt.artifact,null);
 }finally{await rm(directory,{recursive:true,force:true});await rm(seed,{recursive:true,force:true});}
});
