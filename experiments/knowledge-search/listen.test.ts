import { expect, test } from 'vitest';
import { ListenLifecycle } from './owned-database.js';
test('cancelling an unsettled listen never declares it settled', async () => {
  const owner = new ListenLifecycle();
  let finish!: (value: string) => void;
  const pending = owner.start(() => new Promise<string>(resolve => { finish = resolve; }));
  await Promise.resolve(); owner.cancel();
  expect(owner.controller.signal.aborted).toBe(true); expect(owner.settled).toBe(false);
  finish('synthetic-address'); expect(await pending).toBe('synthetic-address'); expect(owner.settled).toBe(true);
});
test('abort before delayed listen is observable and does not fabricate a binding', async () => {
  const owner = new ListenLifecycle(); let bound = false;
  const pending = owner.start(async signal => { if (signal.aborted) throw new Error('ABORTED_BEFORE_BIND'); bound = true; return 'synthetic'; });
  owner.cancel(); await expect(pending).rejects.toThrow('ABORTED_BEFORE_BIND');
  expect(bound).toBe(false); expect(owner.settled).toBe(true);
});
test('listen rejection settles explicitly and a second listen is rejected', async () => {
  const owner = new ListenLifecycle();
  await expect(owner.start(async () => { throw new Error('SYNTHETIC_LISTEN_FAILURE'); })).rejects.toThrow('SYNTHETIC_LISTEN_FAILURE');
  expect(owner.settled).toBe(true); expect(() => owner.start(async () => 'second')).toThrow('LISTEN_ALREADY_ATTEMPTED');
});
