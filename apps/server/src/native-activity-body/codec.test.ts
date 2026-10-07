import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { nativeActivityBodyEventSchema } from '../../../../packages/contracts/src/native-activity-body.js';
import { decodeBodyChunk, assertMaterialCapacity, assertStoredChunk } from './store.js';
const raw=Buffer.from('中文🌱');
const chunk={type:'native-activity-body' as const,protocol:'native-activity-body-v1' as const,activityId:'a'.repeat(64),nativeSessionId:'session',action:'chunk' as const,index:0,offset:0,bytes:raw.length,base64:raw.toString('base64'),sha256:createHash('sha256').update(raw).digest('hex')};
it('validates declared public bytes and refuses a changed length or digest',()=>{
  expect(nativeActivityBodyEventSchema.safeParse(chunk).success).toBe(true);expect(decodeBodyChunk(chunk)).toEqual(raw);
  expect(()=>decodeBodyChunk({...chunk,bytes:chunk.bytes-1})).toThrow();expect(()=>decodeBodyChunk({...chunk,sha256:'b'.repeat(64)})).toThrow();
});
it('rejects noncanonical base64 and rejects a wire chunk above 64KiB before ingestion',()=>{
  const one=Buffer.from('a');expect(()=>decodeBodyChunk({...chunk,bytes:1,sha256:createHash('sha256').update(one).digest('hex'),base64:'YR=='})).toThrow();
  expect(nativeActivityBodyEventSchema.safeParse({...chunk,bytes:65_537}).success).toBe(false);
});

it('enforces body/attempt/count and one active material budgets with unknown counters denied',()=>{
  expect(()=>assertMaterialCapacity({bodies:1,bytes:80_000,pending:0},2_100_000)).not.toThrow();
  for (const [current,bytes] of [
    [{bodies:0,bytes:0,pending:0},8*1024*1024+1],
    [{bodies:2,bytes:16*1024*1024,pending:0},1],
    [{bodies:256,bytes:0,pending:0},0],
    [{bodies:1,bytes:0,pending:1},0],
    [{bodies:NaN,bytes:0,pending:0},0],
  ] as const) expect(()=>assertMaterialCapacity(current,bytes)).toThrow();
});
it('refuses a corrupted stored page before returning bytes to readers',()=>{
  const row={chunk_index:0,byte_offset:0,bytes:raw.length,sha256:chunk.sha256,content:raw};
  expect(()=>assertStoredChunk(row,0,raw.length)).not.toThrow();
  expect(()=>assertStoredChunk({...row,content:Buffer.from('tampered')},0,raw.length)).toThrow();
  expect(()=>assertStoredChunk(row,1,raw.length)).toThrow();
});
