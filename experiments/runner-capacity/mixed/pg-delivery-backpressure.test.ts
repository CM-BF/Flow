import { test, expect, vi } from 'vitest';
import { childReporter, type RecordValue } from './channel.js';
import { centerDelivery, deliveryReceipt, DELIVERY_ENVELOPE_BYTES } from './pg-delivery-bridge.js';
import { CONTRACT } from './contract.js';
import type { PgObservation } from './observe-pg.js';
const input = { mode: 'buffered' as const, epoch: 'callback_test' };
const event: PgObservation = {kind:'pool-acquisition',poolId:1,poolRole:'center',backendPid:123,startedMs:10,elapsedMs:2,total:8,idle:0,waiting:3,outcome:'ok'};
function populate(center: ReturnType<typeof centerDelivery>) {
  for (let i=0;i<8000;i++) center.record({...event,startedMs:i});
}
test('reproduces synchronous flush crossing pending cap with delayed callbacks', async () => {
  const previous=process.send; const failed=vi.fn(); const callbacks: (()=>void)[]=[];
  const reporter=childReporter(failed,()=>CONTRACT,()=>DELIVERY_ENVELOPE_BYTES);
  process.send=((_value:RecordValue,callback:(error:Error|null)=>void)=>{callbacks.push(()=>callback(null));return false;}) as typeof process.send;
  try {
    const center=centerDelivery(input,reporter.send,failed);populate(center);
    expect(center.finish()).toMatchObject({known:false,failure:'sink_unknown'});
    expect(reporter.total).toBeGreaterThan(CONTRACT.ipcPendingBytes);
    expect(reporter.pending).toBeLessThanOrEqual(CONTRACT.ipcPendingBytes);
    expect(reporter.dropped).toBe(1);
    await new Promise<void>(resolve=>setImmediate(()=>{callbacks.forEach(callback=>callback());resolve();}));
    expect(reporter.pending).toBe(0);
  } finally {reporter.close();process.send=previous;}
});

test('callback backpressure drains over 1MiB with identical chunks and one final receipt', async () => {
  const previous=process.send; const failed=vi.fn(); const messages:RecordValue[]=[];
  const expected:RecordValue[]=[]; const baseline=centerDelivery(input,message=>{expected.push(message);return true;},failed);
  populate(baseline); baseline.finish();
  const receipt=deliveryReceipt(input,failed); const reporter=childReporter(failed,()=>CONTRACT,()=>DELIVERY_ENVELOPE_BYTES);
  let peak=0;
  process.send=((value:RecordValue,callback:(error:Error|null)=>void)=>{
    messages.push(value);peak=Math.max(peak,reporter.pending);
    setImmediate(()=>{receipt.accept(value);callback(null);});return false;
  }) as typeof process.send;
  try {
    const center=centerDelivery(input,reporter.send,failed);populate(center);
    const control=new AbortController();const options={deadlineMs:performance.now()+2000,signal:control.signal};
    const first=center.finishAsync(message=>reporter.sendAsync(message,options));
    expect(center.finishAsync(message=>reporter.sendAsync(message,options))).toBe(first);
    const summary=await first;
    expect(summary).toMatchObject({known:true,observed:8000});expect(receipt.complete()).toBe(true);
    expect(reporter.total).toBeGreaterThan(1024*1024);expect(peak).toBeLessThanOrEqual(65536);
    expect(reporter.pending).toBe(0);expect(reporter.dropped).toBe(0);expect(reporter.firstFailure).toBe(null);
    expect(messages.map(({childMs,pid,...message})=>message)).toEqual(expected);
    expect(messages.every(message=>Buffer.byteLength(JSON.stringify(message))<=65536)).toBe(true);
    const count=messages.length;await center.finishAsync(message=>reporter.sendAsync(message,options));expect(messages).toHaveLength(count);
    expect(failed).not.toHaveBeenCalled();
  } finally {reporter.close();process.send=previous;}
});

test.each(['callback','throw','disconnect','cancel','deadline','summary'] as const)('callback backpressure preserves %s failure without successful completion', async mode=>{
  const previous=process.send;const failed=vi.fn();const messages:RecordValue[]=[];const callbacks:((error:Error|null)=>void)[]=[];
  const reporter=childReporter(failed,()=>CONTRACT,()=>DELIVERY_ENVELOPE_BYTES);const control=new AbortController();
  process.send=((value:RecordValue,callback:(error:Error|null)=>void)=>{
    messages.push(value);
    if(mode==='throw')throw new Error('private-detail-not-recorded');
    if(mode==='cancel'||mode==='deadline'){callbacks.push(callback);if(mode==='cancel')setImmediate(()=>control.abort());}
    else setImmediate(()=>callback(mode==='callback'||mode==='summary'&&value.kind==='pg-delivery-summary'?new Error('private-detail-not-recorded'):null));
    return false;
  }) as typeof process.send;
  if(mode==='disconnect')process.send=undefined;
  try {
    const center=centerDelivery(input,reporter.send,failed);populate(center);
    const summary=await center.finishAsync(message=>reporter.sendAsync(message,{deadlineMs:performance.now()+(mode==='deadline'?15:2000),signal:control.signal}));
    expect(summary.known).toBe(false);expect(failed).toHaveBeenCalled();
    const code={callback:'send_callback',throw:'send_throw',disconnect:'disconnected',cancel:'cancelled',deadline:'deadline',summary:'send_callback'}[mode];
    expect(reporter.firstFailure).toBe(code);
    const count=messages.length;callbacks.forEach(callback=>callback(null));await new Promise<void>(resolve=>setImmediate(resolve));
    expect(messages).toHaveLength(count);expect(reporter.firstFailure).toBe(code);expect(reporter.pending).toBe(0);
    expect(messages.filter(message=>message.kind==='pg-delivery-summary')).toHaveLength(mode==='summary'?1:0);
  } finally {reporter.close();process.send=previous;}
});

test('callback backpressure stops before first send for an aborted or expired drain', async()=>{
  const previous=process.send;const send=vi.fn();process.send=send as typeof process.send;
  try {
    for(const mode of ['abort','deadline']){
      const failed=vi.fn();const reporter=childReporter(failed);const control=new AbortController();if(mode==='abort')control.abort();
      const center=centerDelivery(input,reporter.send,failed);center.record(event);
      expect((await center.finishAsync(message=>reporter.sendAsync(message,{deadlineMs:performance.now()+(mode==='abort'?1000:-1),signal:control.signal}))).known).toBe(false);
      expect(reporter.pending).toBe(0);reporter.close();
    }
    expect(send).not.toHaveBeenCalled();
  } finally {process.send=previous;}
});
