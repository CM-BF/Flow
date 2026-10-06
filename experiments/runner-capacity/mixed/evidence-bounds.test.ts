import { expect, test } from 'vitest';
import { LARGE_CONTRACT, Budget } from './contract.js';
import { ObservationArchive } from './observation-archive.js';
import { requestErrorClass } from './request-error.js';

test('observation reservation is exactly compact UTF8 JSON including array delimiters', () => {
  let charged=0; const archive=new ObservationArchive(LARGE_CONTRACT,n=>{charged+=n;});
  archive.append({kind:'sample',pid:1,receivedMs:0,text:'中文'});
  archive.append({kind:'sample',pid:1,receivedMs:1,rows:[{x:1}]});
  expect(charged).toBe(Buffer.byteLength(JSON.stringify(archive.records)));
  expect(archive.prepaidBytes).toBe(charged);
});
test('oversized, over-count and unreserved records never enter the retained array', () => {
  const archive=new ObservationArchive({...LARGE_CONTRACT,maxRecords:1,responseBytes:100},()=>{});
  expect(()=>archive.append({kind:'x',pid:1,receivedMs:0,text:'x'.repeat(101)})).toThrow('observation_record_too_large');
  expect(archive.records).toHaveLength(0);
  archive.append({kind:'x',pid:1,receivedMs:0});
  expect(()=>archive.append({kind:'y',pid:1,receivedMs:0})).toThrow('observation_count_exceeded');
  expect(archive.records).toHaveLength(1);
  const blocked=new ObservationArchive(LARGE_CONTRACT,n=>{if(n>2)throw new Error('budget');});
  expect(()=>blocked.append({kind:'x',pid:1,receivedMs:0})).toThrow('budget');
  expect(blocked.records).toHaveLength(0);
});
test('192MiB admission stop leaves64MiB for already reserved evidence and cleanup', () => {
  const budget=new Budget(0,()=>0,LARGE_CONTRACT);budget.charge('work',LARGE_CONTRACT.softBytes);
  expect(()=>budget.work()).toThrow('mixed_work_budget_exhausted');
  budget.charge('cleanup',64*1024*1024);expect(budget.usedBytes).toBe(256*1024*1024);
  expect(()=>budget.charge('over',1)).toThrow('mixed_total_byte_budget_exhausted');
});
test('safe error classes contain neither error messages nor arbitrary cause codes and leave errors intact', () => {
  const error=new TypeError('secret body',{cause:{code:'ECONNRESET',token:'private'}});
  expect(requestErrorClass(error)).toBe('ECONNRESET');expect(error.message).toBe('secret body');
  expect(requestErrorClass(new TypeError('secret',{cause:{code:'secret-url'}}))).toBe('transport-or-type');
  expect(requestErrorClass(new DOMException('secret','AbortError'))).toBe('abort');
  expect(requestErrorClass(new DOMException('secret','TimeoutError'))).toBe('timeout');
  expect(requestErrorClass(new SyntaxError('private response'))).toBe('decode');
  expect(requestErrorClass({message:'private'})).toBe('non-error');
});
