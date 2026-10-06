import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { nativeActivityBodyEventSchema } from '../../../../packages/contracts/src/native-activity-body.js';
import { decodeBodyChunk } from './store.js';
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
