import { expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inputPath, materializeInput, productionModule, verifyPair, type InputFile } from './ab-input.js';
const file = (path: string, oid='same'): InputFile => ({path,oid,bytes:Buffer.from('')});
test('fixed input comparison rejects any second production difference',()=>{
 const a=[file('apps/server/src/events.ts','old'),file('apps/runner/src/runtime.ts')];
 const b=[file('apps/server/src/events.ts','new'),file('apps/server/src/event-state.test.ts','test'),file('apps/runner/src/runtime.ts')];
 expect(()=>verifyPair(a,b)).not.toThrow(); b[2]!.oid='drift'; expect(()=>verifyPair(a,b)).toThrow('unexpected_production_difference');
});
test('input paths cannot replace Git orinstalled dependencies',()=>{
 for(const path of ['../apps/server/x','/apps/server/x','apps/server/node_modules/a','apps/server/.git/x','apps//server/x'])expect(()=>inputPath(path)).toThrow();
 expect(inputPath('packages/contracts/src/index.ts')).toBe('packages/contracts/src/index.ts');
});
test('the actual child import selector uses the frozen root and leaves legacy resolution unchanged',()=>{
 expect(productionModule('/tmp/owned A','apps/runner/src/runtime.js')).toBe('file:///tmp/owned%20A/apps/runner/src/runtime.js');
 expect(productionModule(undefined,'apps/server/src/index.js')).toBe(new URL('../../../apps/server/src/index.js',import.meta.url).href);
});
test('declared workspace dependencies resolve within their own export while external pg retains its prototype',async()=>{
 const root=await mkdtemp(join(tmpdir(),'flow-ab-input-test-')); const repo=join(root,'repo'), target=join(root,'A'); let bytes=0;
 try {
  for(const name of ['pg','pg-boss']){const dir=join(repo,'node_modules',name);await mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name,version:'1.0.0'}));}
  await mkdir(join(repo,'apps/server/node_modules'),{recursive:true});
  for(const name of ['pg','pg-boss'])await symlink(join(repo,'node_modules',name),join(repo,'apps/server/node_modules',name));
  const input=[{path:'apps/server/package.json',oid:'test',bytes:Buffer.from(JSON.stringify({name:'@flow/server',dependencies:{'@flow/contracts':'workspace:*',pg:'1.0.0','pg-boss':'1.0.0'}}))},
   {path:'packages/contracts/package.json',oid:'test',bytes:Buffer.from(JSON.stringify({name:'@flow/contracts'}))}];
  await materializeInput(repo,target,input,{remainingMs:10000,work(){},chargeCommon(_kind,n){bytes+=n;}});
  expect(await realpath(join(target,'apps/server/node_modules/@flow/contracts'))).toBe(await realpath(join(target,'packages/contracts')));
  expect(JSON.parse(await readFile(join(target,'apps/server/node_modules/pg/package.json'),'utf8')).name).toBe('pg'); expect(bytes).toBeGreaterThan(0);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('an undeclared workspace name fails without falling back to another checkout', async()=>{
 const root=await mkdtemp(join(tmpdir(),'flow-ab-missing-test-'));
 try {
  const input=[{path:'apps/server/package.json',oid:'test',bytes:Buffer.from(JSON.stringify({name:'@flow/server',dependencies:{'@flow/missing':'workspace:*'}}))}];
  await expect(materializeInput(root,join(root,'A'),input,{remainingMs:1000,work(){},chargeCommon(){}})).rejects.toThrow('workspace_dependency_missing');
 }finally{await rm(root,{recursive:true,force:true});}
});
