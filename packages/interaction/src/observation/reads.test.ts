import {expect,test} from 'vitest';
import {ObservationReads} from './reads.js';
test('read admission stays at two actual requests and rejects overflow without dispatch',async()=>{
  const reads=new ObservationReads();const signal=new AbortController().signal;let active=0,max=0;const release:(()=>void)[]=[];
  const work=()=>reads.run(signal,async()=>{active++;max=Math.max(active,max);await new Promise<void>(done=>release.push(done));active--;});
  const pending=Array.from({length:6},work);await expect(work()).rejects.toThrow('budget');expect(active).toBe(2);
  while(release.length){release.shift()!();await new Promise(done=>setTimeout(done,0));}await Promise.all(pending);expect(max).toBe(2);
});
test('a cancelled queued read never dispatches and frees its queue slot',async()=>{
  const reads=new ObservationReads(),stop=new AbortController();let release!:()=>void;let dispatched=0;
  const held=new Promise<void>(done=>{release=done;});const first=reads.run(stop.signal,()=>held),second=reads.run(stop.signal,()=>held);
  const queued=reads.run(stop.signal,async()=>{dispatched++;});stop.abort();await expect(queued).rejects.toBeDefined();release();await Promise.all([first,second]);expect(dispatched).toBe(0);
  await reads.run(new AbortController().signal,async()=>{dispatched++;});expect(dispatched).toBe(1);
});
