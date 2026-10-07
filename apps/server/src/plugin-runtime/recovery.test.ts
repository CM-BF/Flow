import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ReconciliationRetry } from '@flow/contracts';
import { retryReconciled } from '../reconciliation.js';
const fixture = vi.hoisted(() => ({ bound: true, queries: [] as string[], taskId: '', attemptId: '', runnerId: '', wakes: 0 }));
vi.mock('../tasks.js', () => ({
  command: async (_pool: unknown, _operation: string, _key: string, _input: unknown, run: (client: PoolClient) => Promise<unknown>) => {
    const client = { query: async (sql: string) => {
      fixture.queries.push(sql);
      if (sql.includes('FROM flow.attempts')) return { rowCount: 1, rows: [{ id: fixture.attemptId, task_id: fixture.taskId, runner_id: fixture.runnerId, owner_version: 1, completed_at: new Date() }] };
      if (sql.includes('FROM flow.runners')) return { rowCount: 1, rows: [{ id: fixture.runnerId }] };
      if (sql.includes('FROM flow.plugin_tool_bindings')) return { rowCount: fixture.bound ? 1 : 0, rows: fixture.bound ? [{}] : [] };
      if (sql.includes('FROM flow.reconciliation_audit')) return { rowCount: 0, rows: [] };
      throw new Error('Unexpected query: '+sql);
    } } as unknown as PoolClient;
    try { return { value: await run(client), replayed: false }; }
    catch (error) { fixture.queries.push('ROLLBACK'); throw error; }
  },
  loadTask: async () => ({ id: fixture.taskId, current_attempt_id: fixture.attemptId, owner_version: 1, status: 'failed', submission: { title: 'Tool', prompt: 'same frozen input', harness: 'fixture' } }),
  summary: vi.fn(), wake: () => { fixture.wakes++; },
}));
beforeEach(() => { fixture.bound = true; fixture.queries = []; fixture.wakes = 0; fixture.taskId = randomUUID(); fixture.attemptId = randomUUID(); fixture.runnerId = randomUUID(); });
function retry() {
  const input: ReconciliationRetry = { attemptId: fixture.attemptId, ownerVersion: 1, resolutionId: randomUUID(),
    safety: { strategy: 'no-side-effects', evidence: 'Operator confirmed no side effects' } };
  return retryReconciled({} as Pool, {} as PgBoss, fixture.taskId, input, 'owned-key');
}
test('generic retry cannot discard a frozen plugin binding or create a fixture replacement', async () => {
  await expect(retry()).rejects.toMatchObject({ status: 409, code: 'plugin_recovery_requires_binding' });
  const sql = fixture.queries; expect(sql.findIndex(value => value.includes('plugin_tool_bindings'))).toBeGreaterThan(sql.findIndex(value => value.includes('flow.attempts') && value.includes('FOR UPDATE')));
  expect(sql.some(value => value.startsWith('INSERT') || value.startsWith('UPDATE'))).toBe(false); expect(fixture.wakes).toBe(0); expect(sql.at(-1)).toBe('ROLLBACK');
});
test('unbound legacy retry still reaches the existing audited resolution fence', async () => {
  fixture.bound = false; await expect(retry()).rejects.toMatchObject({ status: 409, code: 'resolution_required' });
  expect(fixture.queries.some(sql => sql.includes('reconciliation_audit'))).toBe(true); expect(fixture.wakes).toBe(0);
});
