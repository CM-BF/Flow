import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueDatabaseFixture } from './pg-fixture.js';

type Receipt = { phase: string; facts: Record<string, unknown> };
const memory = vi.hoisted(() => ({
  receipts: [] as Receipt[], receiptError: undefined as Error | undefined,
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
    query = vi.fn(async () => ({ rows: [] }));
    end = vi.fn(async () => {
      memory.poolClosures.push(this.options.max);
      if (this.options.max === 10 && memory.auxCloseError) throw memory.auxCloseError;
    });
  } };
});
vi.mock('pg-boss', async () => {
  const { EventEmitter } = await import('node:events');
  return { PgBoss: class extends EventEmitter {
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
    memory.receipts.length = 0;
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
  afterEach(() => { vi.unstubAllEnvs(); });

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

  it('resolves clean shutdown when no failure was recorded', async () => {
    const fixture = await QueueDatabaseFixture.prepare();
    await expect(fixture.finish()).resolves.toBeUndefined();
    expect(cleanupReceipt()).toMatchObject({ state: 'CLOSED', cleanupConfirmed: true, verification: 'NO_FAILURE_RECORDED', errors: [] });
  });
});
