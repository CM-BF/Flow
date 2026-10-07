import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const mock = vi.hoisted(() => ({ counts: [0], reads: 0, countReads: 0, driftAt: 0, dropped: false, calls: [] as string[], end: vi.fn() }));
const identity = { oid: '123', owner: 'fixture-owner', marker: 'exact-marker' };
vi.mock('pg', () => ({ Pool: class {
  on() { return this; }
  async query(sql: string) {
    mock.calls.push(sql);
    if (sql.includes('FROM pg_database')) { mock.reads++; return { rows: mock.dropped ? [] : [{ oid: mock.driftAt && mock.reads >= mock.driftAt ? 'foreign' : '123', owner: 'fixture-owner', marker: 'exact-marker' }] }; }
    if (sql.includes('pg_stat_activity')) { const n=mock.countReads++; return { rows: [{ count: String(mock.counts[Math.min(n,mock.counts.length-1)]) }] }; }
    if (sql.startsWith('DROP DATABASE ')) { mock.dropped=true; return { rows: [] }; }
    throw Error('Unexpected query');
  }
  async end() { mock.end(); }
} }));
import { PluginDatabaseFixture } from './enable-binding-pg-fixture.js';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T12:05:00Z')); Object.assign(mock,{counts:[0],reads:0,countReads:0,driftAt:0,dropped:false,calls:[]}); mock.end.mockClear(); });
afterEach(() => vi.useRealTimers());
function fixture(remaining=60000) {
  const f=new PluginDatabaseFixture('runtime',4);
  Object.assign(f,{window:'fixed',sourceHead:'fixed',createRequested:true,createAcknowledged:true,creationReceiptSaved:true,identity,cleanupUntil:Date.now()+remaining});
  return f;
}
async function finish(remaining=60000, owners=true) { const result=fixture(remaining).finish({startup:owners,server:owners,boss:owners},[]); await vi.runAllTimersAsync(); return result; }
test('one connection then zero preserves observations and drops only after identity recheck',async()=>{
  mock.counts=[1,0]; const result=await finish(); expect(result.cleanupConfirmed).toBe(true); expect(result.cleanup.connectionObservations.map(x=>x.connections)).toEqual([1,0]); expect(mock.reads).toBe(4); expect(mock.calls.filter(x=>x.startsWith('DROP DATABASE '))).toHaveLength(1); expect(mock.end).toHaveBeenCalledTimes(2);
});
test('persistent connection is capped at twenty observations and remains KEEP',async()=>{
  mock.counts=[1]; const result=await finish(); expect(result.cleanupConfirmed).toBe(false); expect(result.cleanup.connections).toBe(1); expect(mock.countReads).toBe(20); expect(mock.dropped).toBe(false); expect(result.retainedDatabase).not.toBeNull();
});
test('shared deadline reserves five seconds and does not reset a waiting budget',async()=>{
  mock.counts=[1,0]; const start=Date.now(); const result=await finish(5050); expect(mock.countReads).toBe(1); expect(Date.now()-start).toBe(50); expect(result.cleanupConfirmed).toBe(false); expect(mock.dropped).toBe(false);
});
test('identity drift during waiting keeps the database without another count or DROP',async()=>{
  mock.counts=[1,0]; mock.driftAt=2; const result=await finish(); expect(result.cleanup.identityConfirmed).toBe(false); expect(mock.countReads).toBe(1); expect(mock.dropped).toBe(false);
});
test('unclosed owner does not initiate connection polling or DROP',async()=>{
  mock.counts=[1,0]; const result=await finish(60000,false); expect(result.cleanup.ownersClosed).toBe(false); expect(mock.countReads).toBe(1); expect(mock.dropped).toBe(false);
});
test('identity changes after zero observation still bar ordinary DROP',async()=>{
  mock.driftAt=2; const result=await finish(); expect(result.cleanup.identityConfirmed).toBe(false); expect(result.errorCount).toBe(1); expect(mock.dropped).toBe(false); expect(result.cleanup.adminClosed).toBe(true);
});
