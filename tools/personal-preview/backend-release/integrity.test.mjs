import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename, rm, symlink, link, truncate } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { nodeIdentity } from './node-identity.mjs';
import { verifyBackendArtifact, BACKEND_POLICY } from './index.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
async function fixture(callback, changeNode = false) {
 const directory=await mkdtemp(join(tmpdir(),'svc06-integrity-'));
 try{
  const store=join(directory,'backend-artifacts');await mkdir(store,{mode:0o700});const stage=join(store,'staging');await mkdir(stage,{mode:0o700});await mkdir(join(stage,'root'));
  await writeFile(join(stage,'root','entry.txt'),'fixed bytes');const node=await nodeIdentity();if(changeNode)node.version='v24.0.0';
  const manifest={policy:BACKEND_POLICY,sourceHead:'a'.repeat(40),node,inventory:{entries:[{path:'entry.txt',kind:'file',bytes:11,executable:false,sha256:sha('fixed bytes')}],bytes:11}};
  const bytes=JSON.stringify(manifest)+'\n',id=sha(bytes);await writeFile(join(stage,'manifest.json'),bytes);await rename(stage,join(store,id));
  const artifact={policy:BACKEND_POLICY,artifactId:id,manifestDigest:id,sourceHead:manifest.sourceHead};
  await callback({directory,artifact,root:join(store,id,'root')});
 }finally{await rm(directory,{recursive:true,force:true});}
}
test('public verifier rejects modified bytes, external links and shared inode independently', async()=>{
 await fixture(async({directory,artifact,root})=>{
  await verifyBackendArtifact({directory,artifact});const path=join(root,'entry.txt');
  await writeFile(path,'wrong bytes');await assert.rejects(verifyBackendArtifact({directory,artifact}),{code:'BACKEND_CONTENT_MISMATCH'});
  await rm(path);await symlink('/etc/hosts',path);await assert.rejects(verifyBackendArtifact({directory,artifact}),{code:'BACKEND_EXTERNAL_LINK'});
  await rm(path);await writeFile(path,'fixed bytes');await link(path,join(directory,'outside-hardlink'));await assert.rejects(verifyBackendArtifact({directory,artifact}),{code:'BACKEND_SHARED_FILE'});
 });
});
test('public verifier refuses changed Node identity and oversize sparse file before hashing',async()=>{
 await fixture(async({directory,artifact})=>{await assert.rejects(verifyBackendArtifact({directory,artifact}),{code:'BACKEND_NODE_IDENTITY_CHANGED'});},true);
 await fixture(async({directory,artifact,root})=>{await truncate(join(root,'entry.txt'),1024**3+1);await assert.rejects(verifyBackendArtifact({directory,artifact}),{code:'BACKEND_BYTE_BUDGET'});});
});
