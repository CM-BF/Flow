import { test, expect } from 'vitest';
import { runStages, type Clock, type Ports, type CloseFacts } from './sequence.js';
function fixture() {
  let now = 0; const events: string[] = [], live: AbortSignal[] = [];
  const clock: Clock = { now: () => now, alarm: () => () => {} };
  const good: CloseFacts = { exited: true, eof: true, hostWriteSettled: true, membersClosed: true };
  const ports: Ports = {
    allocate(n) { events.push(`allocate:${n}`); return Array.from({ length: n }, (_, i) => ({
      async start(signal) { live.push(signal); events.push(`ready:${n}:${i}`); },
      async close() { events.push(`close:${n}:${i}`); return good; },
    })); },
    async observe(n, duration) { expect(live.slice(-n).every(s => !s.aborted)).toBe(true); events.push(`observe:${n}`); now += duration; return { known: true }; },
    bytes: n => ({ total: n * 100, instances: Array(n).fill(100) }),
    async cleanup(n) { events.push(`cleanup:${n}`); return true; },
  };
  return { clock, ports, events, advance: (n: number) => { now += n; } };
}
test('all seven handles keep lifecycle signals alive until observation, close before 1→2→4 upgrade', async () => {
  const f = fixture(); const result = await runStages(f.ports, 0, new AbortController().signal, f.clock);
  expect(result.known).toBe(true); expect(result.stages.map(x => x.level)).toEqual([1,2,4]);
  expect(f.events.filter(x => x.startsWith('ready:'))).toHaveLength(7);
  expect(f.events.indexOf('cleanup:1')).toBeLessThan(f.events.indexOf('allocate:2'));
  expect(result.deadlineMs).toBe(70000);
});
test.each(['ready', 'observation', 'bytes', 'close', 'cleanup'] as const)('%s failure stops later levels and preserves resource facts', async kind => {
  const f = fixture();
  if (kind === 'ready') f.ports.allocate = () => [{ start: async () => { throw Error('secret'); }, close: async () => ({ exited: true, eof: true, hostWriteSettled: true, membersClosed: true }) }];
  if (kind === 'observation') f.ports.observe = async () => ({ known: false });
  if (kind === 'bytes') f.ports.bytes = () => ({ total: 1, instances: [8 * 1024 * 1024 + 1] });
  if (kind === 'close') f.ports.allocate = () => [{ start: async () => {}, close: async () => ({ exited: true, eof: false, hostWriteSettled: true, membersClosed: true }) }];
  if (kind === 'cleanup') f.ports.cleanup = async () => false;
  const result = await runStages(f.ports, 0, new AbortController().signal, f.clock);
  expect(result.known).toBe(false); expect(result.stages).toHaveLength(1); expect(JSON.stringify(result)).not.toContain('secret');
  if (['bytes','close','cleanup'].includes(kind)) expect(result.stages[0]?.cleanup).toBe('keep');
});
test('late readiness cannot reset the common deadline or leave a noncooperative start waiting forever', async () => {
  const f = fixture(); let cancel = () => {};
  f.clock.alarm = (_deadline, expire) => { queueMicrotask(expire); cancel = expire; return () => { cancel = () => {}; }; };
  f.ports.allocate = () => [{ start: async () => new Promise<void>(() => {}), close: async () => ({ exited: false, eof: false, hostWriteSettled: false, membersClosed: false }) }];
  const result = await runStages(f.ports, 0, new AbortController().signal, f.clock);
  expect(result.known).toBe(false); expect(result.stages[0]?.failure).toBe('DEADLINE'); expect(result.stages[0]?.cleanup).toBe('keep'); cancel();
});
test('cancelled observation still attempts close and never admits another level', async () => {
  const f = fixture(), controller = new AbortController();
  f.ports.observe = async () => { controller.abort(); return { known: true }; };
  const result = await runStages(f.ports, 0, controller.signal, f.clock);
  expect(result.stages[0]?.failure).toBe('CANCELLED'); expect(f.events).toContain('close:1:0'); expect(result.stages).toHaveLength(1);
});
test('cleanup has no fresh timeout after a slow prepare and first failure is preserved', async () => {
  const f = fixture(); f.ports.observe = async () => { f.advance(18001); throw Error('work'); };
  const result = await runStages(f.ports, 0, new AbortController().signal, f.clock);
  expect(result.stages[0]).toMatchObject({ failure: 'WORK_UNKNOWN', secondary: ['DEADLINE'], cleanup: 'keep' });
});
