import { expect, it } from 'vitest';
import crypto, { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { installObserver } from './observer.js';

it('records promise, synchronous, and COMMIT failures without replacing result/error identity', async () => {
  const result = { rows: [{ content: '中🙂' }] }; const failure = new Error('synthetic query failure');
  const target = { query(text: string): any { if (text === 'COMMIT') return Promise.reject(failure); if (text === 'ROLLBACK') throw failure; return Promise.resolve(result); } };
  const original = target.query; const observer = installObserver(target); const work = observer.begin('中🙂');
  try {
    await observer.within(work, async () => {
      expect(await target.query("SELECT COALESCE(string_agg(data->>'text','' ORDER BY revision),'') AS content FROM flow.assistant_stream_patches WHERE stream_id=$1")).toBe(result);
      await expect(target.query('COMMIT')).rejects.toBe(failure);
      expect(() => target.query('ROLLBACK')).toThrow(failure);
    });
    observer.end(work);
    expect(work.sql.map((row: any) => [row.kind, row.succeeded])).toEqual([['prefix-read', true], ['commit', false], ['rollback', false]]);
    expect(work.sql[0]!.prefixContentUtf8Bytes).toBe(7);
    expect(work.sql[0]!.decodedRowsJsonUtf8Bytes).toBe(Buffer.byteLength(JSON.stringify(result.rows)));
    expect(work.sql.every((row: any) => row.elapsedMs >= 0)).toBe(true);
  } finally { observer.restore(); }
  expect(target.query).toBe(original);
});

it('preserves both pg callback forms, receiver, return value and error/result identities', async () => {
  const result = { rows: [{ value: 1 }] }; const failure = Object.assign(new Error('callback failure'), { code: 'XX001' });
  const sentinel = {}; const receiver = {};
  const target = { query(...args: any[]) { const callback = typeof args.at(-1) === 'function' ? args.at(-1) : args[0].callback; queueMicrotask(() => callback.call(receiver, args[0].text === 'bad' ? failure : null, result)); return sentinel; } };
  const observer = installObserver(target); const work = observer.begin('');
  try {
    await observer.within(work, async () => {
      await new Promise<void>(resolve => { expect(target.query('SELECT 1', [], function (this: unknown, error: unknown, value: unknown) { expect(this).toBe(receiver); expect(error).toBeNull(); expect(value).toBe(result); resolve(); })).toBe(sentinel); });
      await new Promise<void>(resolve => { expect(target.query({ text: 'bad', callback: function (this: unknown, error: unknown, value: unknown) { expect(this).toBe(receiver); expect(error).toBe(failure); expect(value).toBe(result); resolve(); } })).toBe(sentinel); });
    });
    expect(work.sql.map(row => [row.succeeded, row.errorCode])).toEqual([[true, null], [false, 'XX001']]);
    expect(work.instrumentationErrors).toEqual([]);
  } finally { observer.restore(); }
});

it('captures query ownership when issued, including completion after a different window starts', async () => {
  let complete!: (result: unknown) => void;
  const target = { query: () => new Promise(resolve => { complete = resolve; }) };
  const observer = installObserver(target); const first = observer.begin('first');
  try {
    const pending = observer.within(first, () => target.query());
    observer.end(first); const second = observer.begin('second'); complete({ rows: [] }); await pending;
    expect(first.sql).toHaveLength(1); expect(second.sql).toEqual([]);
    const background = target.query(); complete({ rows: [] }); await background;
    expect(second.backgroundSql).toHaveLength(1); expect(second.sql).toEqual([]);
    observer.end(second); expect(() => observer.end(second)).toThrow('identity');
  } finally { observer.restore(); }
});

it('observes named SHA256 imports, exact Unicode content and split updates, then restores globals', () => {
  const query = () => Promise.resolve({ rows: [] }); const target = { query };
  const originalHash = crypto.createHash; const observer = installObserver(target); const work = observer.begin('中🙂');
  try {
    observer.within(work, () => {
      createHash('sha256').update('中🙂').digest('hex');
      createHash('sha256').update('中').update(Buffer.from('🙂')).digest();
      createHash('sha256').update('abc1234').digest(); // Same byte length is insufficient evidence.
      createHash('sha512').update('中🙂').digest();
    });
    createHash('sha256').update('中🙂').digest(); // No request context: excluded.
    expect(work.hashes.map(hash => [hash.kind, hash.inputUtf8Bytes])).toEqual([['expected-prefix', 7], ['expected-prefix', 7], ['other', 7]]);
    expect(() => observer.begin('other')).toThrow('Only one');
  } finally { observer.restore(); }
  expect(target.query).toBe(query); expect(crypto.createHash).toBe(originalHash); expect(createHash).toBe(originalHash);
});

it('restores after caller failure and leaves unmeasured query behavior unchanged', async () => {
  const failure = new Error('outer failure'); const promise = Promise.resolve({ rows: [] });
  const original = () => promise; const target = { query: original }; const originalHash = crypto.createHash;
  const observer = installObserver(target);
  try { expect(target.query()).toBe(promise); observer.begin(''); throw failure; }
  catch (error) { expect(error).toBe(failure); }
  finally { observer.restore(); }
  expect(target.query).toBe(original); expect(crypto.createHash).toBe(originalHash);
});

// Fastify inject exercises the real request lifecycle without listen/PG/provider work.
it('propagates request ownership through a real Fastify onRequest callback', async () => {
  const require = createRequire(new URL('../../../../Flow/apps/server/package.json', import.meta.url));
  const fastify = require('fastify'); const app = fastify();
  const target = { query: async () => ({ rows: [{ value: 1 }] }) }; const observer = installObserver(target);
  const work = observer.begin('known');
  app.addHook('onRequest', (_request: unknown, _reply: unknown, done: () => void) => observer.within(work, done));
  app.get('/probe', async () => { await target.query(); createHash('sha256').update('known').digest(); return { ok: true }; });
  try { const response = await app.inject({ method: 'GET', url: '/probe' }); expect(response.statusCode).toBe(200); expect(work.sql).toHaveLength(1); expect(work.hashes[0]?.kind).toBe('expected-prefix'); expect(work.backgroundSql).toEqual([]); }
  finally { await app.close(); observer.restore(); }
});

it('accounts for multiple result sets and rejects unsupported custom query observation explicitly', async () => {
  const target = { query: (input: any): any => input?.submit ? input : Promise.resolve([{ rows: [{ a: '中' }] }, { rows: [{ b: '🙂' }] }]) };
  const observer = installObserver(target); const work = observer.begin('');
  try {
    await observer.within(work, async () => { await target.query('SELECT 1; SELECT 2'); const custom = { submit() {} }; expect(target.query(custom)).toBe(custom); });
    expect(work.sql[0]!.returnedRows).toBe(2);
    expect(work.sql[0]!.decodedRowsJsonUtf8Bytes).toBe(Buffer.byteLength(JSON.stringify([{ a: '中' }, { b: '🙂' }])));
    expect(work.instrumentationErrors).toEqual(['unsupported-custom-query-object']);
  } finally { observer.restore(); }
});
