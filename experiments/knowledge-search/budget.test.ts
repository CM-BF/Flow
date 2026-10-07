import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { assertAggregate, LOCAL_LIMIT, RAW_LIMIT, WORK_RESERVE, PARENT_RESERVE, StorageBudget, localAdminUrl } from './budget.js';
test('aggregate includes pending result and preserves cleanup plus parent receipt reserves', () => {
  expect(() => assertAggregate(100, RAW_LIMIT - WORK_RESERVE - 50, 50, WORK_RESERVE)).not.toThrow();
  expect(() => assertAggregate(100, RAW_LIMIT - WORK_RESERVE - 50, 51, WORK_RESERVE)).toThrow('RAW_STORAGE_LIMIT');
  expect(() => assertAggregate(LOCAL_LIMIT - 100, 101, 0, 0)).toThrow('LOCAL_STORAGE_LIMIT');
  expect(() => assertAggregate(0, RAW_LIMIT - WORK_RESERVE, WORK_RESERVE - PARENT_RESERVE, PARENT_RESERVE)).not.toThrow();
  expect(() => assertAggregate(-1, 0, 0, 0)).toThrow('BUDGET_INPUT');
});
test('counts result, identity, record and retained scratch together without touching outside', () => {
  const root = mkdtempSync(join(process.env.TMPDIR!, 'budget-'));
  try {
    const own = join(root, 'own'), record = join(root, 'record'); mkdirSync(own); mkdirSync(record);
    writeFileSync(join(own, 'result.json'), '12345'); writeFileSync(join(own, 'identity.json'), '12');
    writeFileSync(join(record, 'iterations.jsonl'), '123'); writeFileSync(join(record, 'output.raw'), '1234');
    const budget = new StorageBudget(own, record, 100, () => 10);
    expect(budget.snapshot()).toEqual({ baseBytes: 100, retainedBytes: 14, localBytes: 114 }); budget.work(); budget.write(10);
    symlinkSync(record, join(own, 'foreign')); expect(() => budget.snapshot()).toThrow('BUDGET_IDENTITY');
  } finally { rmSync(root, { recursive: true }); }
});
test('storage exhaustion halts work while reserved small cleanup receipt remains writable', () => {
  const root = mkdtempSync(join(process.env.TMPDIR!, 'budget-'));
  try { const own = join(root, 'own'), record = join(root, 'record'); mkdirSync(own); mkdirSync(record);
    writeFileSync(join(own, 'synthetic.raw'), Buffer.alloc(RAW_LIMIT - WORK_RESERVE));
    const budget = new StorageBudget(own, record, 0, () => 1);
    expect(() => budget.work()).toThrow('RAW_STORAGE_LIMIT'); expect(() => budget.write(1024)).not.toThrow();
  } finally { rmSync(root, { recursive: true }); }
});
test('canonical local admin accepts exact loopback postgres and rejects override or fragment', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) expect(localAdminUrl(`postgresql://example@${host}:5432/postgres`).pathname).toBe('/postgres');
  for (const tail of ['?host=remote','?hostaddr=remote','?service=x','?options=x','#x','#','?application_name=x']) expect(() => localAdminUrl('postgresql://localhost/postgres'+tail)).toThrow('LOCAL_ADMIN_REQUIRED');
  try { localAdminUrl('private-not-a-url'); throw new Error('expected validation error'); } catch (error) {
    expect((error as Error).message).toBe('LOCAL_ADMIN_REQUIRED'); expect(JSON.stringify(error)).not.toContain('private-not-a-url'); expect('input' in (error as object)).toBe(false);
  }
  for (const value of ['postgresql://example.com/postgres','postgresql://localhost/other','https://localhost/postgres']) expect(() => localAdminUrl(value)).toThrow('LOCAL_ADMIN_REQUIRED');
});
