import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueDatabaseFixture } from './pg-fixture.js';

type Receipt = { phase: string; facts: Record<string, unknown> };
const memory = vi.hoisted(() => ({
  receipts: [] as Receipt[], receiptError: undefined as Error | undefined,
  database: false, marker: '', size: '8192',
  poolClosures: [] as number[], auxCloseError: undefined as Error | undefined,
}));

// Only the external resource adapters are replaced. No filesystem or PG namespace
// is created; work admission, error listeners and finish use the real fixture.
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => undefined),
  realpath: vi.fn(async (path: string) => path),
  lstat: vi.fn(async () => ({ dev: 1, ino: 2, isDirectory: () => true, isSymbolicLink: () => false })),
  open: vi.fn(async () => ({
    writeFile: vi.fn(async (bytes: Buffer) => {
      const receipt = JSON.parse(bytes.toString()) as Receipt;
      if (receipt.phase === 'cleanup' && memory.receiptError) throw memory.receiptError;
      memory.receipts.push(receipt);
    }),
    sync: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  })),
}));
vi.mock('pg', async () => {
  const { EventEmitter } = await import('node:events');
  return { Pool: class extends EventEmitter {
    constructor(private readonly options: { max: number }) { super(); }
    query = vi.fn(async (sql: string) => {
      if (sql.startsWith('CREATE DATABASE')) memory.database = true;
      if (sql.startsWith('COMMENT ON DATABASE')) memory.marker = sql.split("'")[1] ?? '';
      if (sql.startsWith('DROP DATABASE')) memory.database = false;
      if (sql.includes('pg_database_size')) return { rows: [{ bytes: memory.size }] };
      if (sql.includes('current_user')) return { rows: [{ owner: 'test' }] };
      if (sql.includes('pg_stat_activity')) return { rows: [{ count: '0' }] };
      return { rows: sql.includes('FROM pg_database') && memory.database ? [{ oid: '1', owner: 'test', marker: memory.marker || null }] : [] };
    });
    end = vi.fn(async () => {
      memory.poolClosures.push(this.options.max);
      if (this.options.max === 10 && memory.auxCloseError) throw memory.auxCloseError;
    });
  } };
});
vi.mock('pg-boss', async () => {
  const { EventEmitter } = await import('node:events');
  return { PgBoss: class extends EventEmitter {
    start = vi.fn(async () => undefined);
    stop = vi.fn(async () => undefined);
  } };
});

function cleanupReceipt() {
  const receipt = memory.receipts.find(value => value.phase === 'cleanup');
  expect(receipt).toBeDefined();
  return receipt!.facts;
}

describe('queue fixture background failure and resource closure', () => {
  beforeEach(() => {
    memory.receipts.length = 0; memory.database = false; memory.marker = ''; memory.size = '8192';
    memory.receiptError = undefined;
    memory.poolClosures.length = 0;
    memory.auxCloseError = undefined;
    vi.stubEnv('FLOW_S01Q01_PG_OPEN', 'reviewed');
    vi.stubEnv('FLOW_S01Q01_RECORD_ROOT', '/synthetic-s01q01');
    vi.stubEnv('FLOW_S01Q01_START_MS', String(Date.now()));
    vi.stubEnv('FLOW_S01Q01_PG_HEAD', 'a'.repeat(40));
    vi.stubEnv('FLOW_S01Q01_PG_WINDOW', 'b'.repeat(32));
    vi.stubEnv('FLOW_S01Q01_TEST_ADMIN', 'postgresql://127.0.0.1/postgres');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each([
    ['admin', 'admin-idle'],
    ['pool', 'aux-idle'],
    ['boss', 'boss-background'],
  ] as const)('rejects further work and propagates %s failure after successful cleanup', async (owner, phase) => {
    const fixture = await QueueDatabaseFixture.prepare();
    const original = Object.assign(new Error('synthetic background failure'), { code: 'TEST_BACKGROUND' });
    fixture[owner].emit('error', original);
    const action = vi.fn(async () => undefined);
    await expect(fixture.work('must-not-start', action)).rejects.toBe(original);
    expect(action).not.toHaveBeenCalled();
    expect(memory.receipts.some(value => value.phase === 'must-not-start')).toBe(false);
    await expect(fixture.finish()).rejects.toBe(original);
    expect(fixture.boss.stop).toHaveBeenCalledOnce();
    expect(memory.poolClosures).toEqual([10, 1]);
    expect(fixture.admin.end).toHaveBeenCalledOnce();
    expect(fixture.admin.query).not.toHaveBeenCalled();
    expect(cleanupReceipt()).toMatchObject({
      state: 'CLOSED', cleanupConfirmed: true, verification: 'FAILED', errors: [],
      firstFailure: { phase, name: 'Error', code: 'TEST_BACKGROUND' },
    });
  });

  it('keeps the first background error when a second owner fails', async () => {
    const fixture = await QueueDatabaseFixture.prepare();
    const original = new Error('first');
    fixture.admin.emit('error', original);
    fixture.boss.emit('error', new Error('second'));
    await expect(fixture.finish()).rejects.toBe(original);
    expect(cleanupReceipt()).toMatchObject({ state: 'CLOSED', verification: 'FAILED', firstFailure: { phase: 'admin-idle' } });
  });

  it('reports cleanup unknown with the original failure as cause and still closes the admin', async () => {
    const fixture = await QueueDatabaseFixture.prepare();
    const original = new Error('background');
    fixture.boss.emit('error', original);
    memory.auxCloseError = new Error('aux close failed');
    const error = await fixture.finish().then(() => undefined, (failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: 'S01Q01_CLEANUP_UNKNOWN_KEEP', cause: original });
    expect(fixture.admin.end).toHaveBeenCalledOnce();
    expect(cleanupReceipt()).toMatchObject({
      state: 'KEEP', cleanupConfirmed: false, verification: 'FAILED', errors: ['aux-close'],
      firstFailure: { phase: 'boss-background' },
    });
  });

  it('does not hide the original error when the cleanup receipt cannot be saved', async () => {
    const fixture = await QueueDatabaseFixture.prepare();
    const original = new Error('background'), receiptError = new Error('receipt unavailable');
    fixture.admin.emit('error', original);
    memory.receiptError = receiptError;
    const error = await fixture.finish().then(() => undefined, (failure: unknown) => failure);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error).toMatchObject({ message: 'S01Q01_CLEANUP_RECEIPT_UNKNOWN_KEEP', errors: [original, receiptError] });
    expect(fixture.admin.end).toHaveBeenCalledOnce();
    expect(memory.receipts.some(value => value.phase === 'cleanup')).toBe(false);
  });

  it('samples owned database size at creation and before normal drop', async () => {
    const fixture = await QueueDatabaseFixture.prepare(); await fixture.create(); await fixture.finish();
    expect(cleanupReceipt()).toMatchObject({ state: 'CLOSED', databaseSamples: [{ phase: 'created', bytes: 8192 }, { phase: 'before-drop', bytes: 8192 }] });
  });

  it.each(['134217729', 'unknown'])('preserves failed or unknown database size %s and keeps the database', async size => {
    memory.size = size; const fixture = await QueueDatabaseFixture.prepare();
    await expect(fixture.create()).rejects.toThrow(/DATABASE_(SAMPLE_LIMIT|SIZE_UNKNOWN)/);
    await expect(fixture.finish()).rejects.toThrow('S01Q01_CLEANUP_UNKNOWN_KEEP');
    expect(cleanupReceipt()).toMatchObject({ state: 'KEEP', cleanupConfirmed: false, verification: 'FAILED' });
    expect(memory.database).toBe(true);
  });

  it('counts full bounded HTTP response bytes and preserves the public response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('中', { status: 201 })));
    const fixture = await QueueDatabaseFixture.prepare(); const response = await fixture.fetch('http://synthetic');
    expect(response.status).toBe(201); expect(await response.text()).toBe('中'); await fixture.finish();
    expect(cleanupReceipt()).toMatchObject({ httpCount: 1, httpBytes: 3, state: 'CLOSED' });
  });

  it.each([262145, 262144])('rejects per-response or aggregate HTTP budget at chunk size %s', async size => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(size))));
    const fixture = await QueueDatabaseFixture.prepare();
    if (size === 262144) for (let i = 0; i < 8; i++) await fixture.fetch('http://synthetic');
    await expect(fixture.fetch('http://synthetic')).rejects.toThrow('HTTP_BYTES_LIMIT');
    await expect(fixture.work('after-http-failure', async () => undefined)).rejects.toThrow('HTTP_BYTES_LIMIT');
    await expect(fixture.finish()).rejects.toThrow('HTTP_BYTES_LIMIT');
    expect(cleanupReceipt()).toMatchObject({ state: 'CLOSED', verification: 'FAILED' });
  });

  it('resolves clean shutdown when no failure was recorded', async () => {
    const fixture = await QueueDatabaseFixture.prepare();
    await expect(fixture.finish()).resolves.toBeUndefined();
    expect(cleanupReceipt()).toMatchObject({ state: 'CLOSED', cleanupConfirmed: true, verification: 'NO_FAILURE_RECORDED', errors: [] });
  });
});
