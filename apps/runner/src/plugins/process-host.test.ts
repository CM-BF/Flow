import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, expect } from 'vitest';
import { FrameReader, PROCESS_PROTOCOL } from './process-protocol.js';
import { ProcessResources } from './process-resources.js';
const identity = () => ({ nonce:'a'.repeat(32),bindingId:randomUUID(),invocationId:randomUUID(),taskId:randomUUID(),attemptId:randomUUID(),ownerVersion:1 });
const framed = (value: unknown) => { const b=Buffer.from(JSON.stringify(value));const h=Buffer.alloc(4);h.writeUInt32BE(b.length);return Buffer.concat([h,b]); };
test('trusted framing rejects length before body, truncation, bad UTF8 and wrong sequence',()=>{
 const tooBig=Buffer.alloc(4);tooBig.writeUInt32BE(4097);expect(()=>new FrameReader(4096,()=>{}).push(tooBig)).toThrow();
 const partial=new FrameReader(4096,()=>{});partial.push(Buffer.from([0,0]));expect(()=>partial.end()).toThrow();
 expect(()=>new FrameReader(4096,()=>{}).push(Buffer.from([0,0,0,1,255]))).toThrow();
 expect(()=>new FrameReader(4096,()=>{}).push(framed({protocol:PROCESS_PROTOCOL,identity:identity(),sequence:2,kind:'check'}))).toThrow();
});
test('trusted resource count is reusable and full capacity never prevents owned cleanup',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'flow-process-resources-'));const info=await fs.lstat(root);
 try { const resources=await ProcessResources.open(join(root,'owned'));const items=[];
  for(let n=0;n<32;n++)items.push(await resources.reserve(identity()));
  await expect(resources.reserve(identity())).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
  for(const item of items)await resources.finish(item);
  const next=await resources.reserve(identity());await resources.finish(next);await resources.close();
  expect(await fs.readdir(join(root,'owned/receipts'))).toEqual([]);
 }finally{const current=await fs.lstat(root);expect(current.ino).toBe(info.ino);expect(current.dev).toBe(info.dev);await fs.rm(root,{recursive:true});}
});
test('trusted resources reject linked receipts and unknown remainder without probing old PIDs',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'flow-process-links-'));const info=await fs.lstat(root);
 try {const resources=await ProcessResources.open(join(root,'owned'));const item=await resources.reserve(identity());
  await fs.link(join(root,'owned/receipts/slot-00.json'),join(root,'alias'));
  await expect(resources.update(item,{state:'spawned'})).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
  await expect(resources.reserve(identity())).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
  await expect(resources.close()).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
  await expect(ProcessResources.open(join(root,'owned'))).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
 }finally{const current=await fs.lstat(root);expect(current.ino).toBe(info.ino);expect(current.dev).toBe(info.dev);await fs.rm(root,{recursive:true});}
});
