import { beforeEach, expect, test, vi } from 'vitest';
import type { PoolClient } from 'pg';
const state = vi.hoisted(() => ({ current: { id: 'project', workspace_id: 'personal', revision: 3 }, lock: vi.fn(), recheck: vi.fn() }));
vi.mock('../projects/storage.js', () => ({ loadProject: state.lock }));
vi.mock('./verification.js', () => ({ assertSourceProject: state.recheck }));
import { lockSourceProject } from './verification-admission.js';
beforeEach(() => { vi.clearAllMocks(); state.lock.mockResolvedValue(state.current); });
test('VAR source project locks before authority recheck and uses the same transaction client', async () => {
  const client = { query: vi.fn().mockResolvedValue({ rows: [{ project_id: 'project' }] }) } as unknown as PoolClient;
  expect(await lockSourceProject(client, 'source', 'personal', null, 3)).toEqual(state.current);
  expect(state.lock).toHaveBeenCalledWith(client, 'project', true);
  expect(state.recheck).toHaveBeenCalledWith(client, 'source', 'project', 'personal');
  expect(state.lock.mock.invocationCallOrder[0]!).toBeLessThan(state.recheck.mock.invocationCallOrder[0]!);
});
test('VAR missing/conflicting/foreign authority and stale project CAS fail before creating work', async () => {
  for (const rows of [[], [{ project_id: null }], [{ project_id: 'project' }, { project_id: 'other' }]]) {
    const client = { query: vi.fn().mockResolvedValue({ rows }) } as unknown as PoolClient;
    await expect(lockSourceProject(client, 'source', 'personal', null, 3)).rejects.toThrow();
  }
  const client = { query: vi.fn().mockResolvedValue({ rows: [{ project_id: 'project' }] }) } as unknown as PoolClient;
  await expect(lockSourceProject(client, 'source', 'personal', 'other', 3)).rejects.toThrow();
  await expect(lockSourceProject(client, 'source', 'personal', null, 2)).rejects.toThrow();
});
