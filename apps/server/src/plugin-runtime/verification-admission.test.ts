import { beforeEach, expect, test, vi } from 'vitest';
import type { PoolClient } from 'pg';
const state = vi.hoisted(() => ({ current: { id: 'project', workspace_id: 'personal', revision: 3 }, lock: vi.fn(), recheck: vi.fn(), command: vi.fn(), accept: vi.fn(), graph: vi.fn(), runtime: vi.fn(), snapshot: vi.fn(), installation: vi.fn(), material: vi.fn(), binding: vi.fn() }));
vi.mock('../projects/storage.js', () => ({ loadProject: state.lock }));
vi.mock('./verification.js', () => ({ assertSourceProject: state.recheck }));
vi.mock('../tasks.js', () => ({ command: state.command, acceptTask: state.accept }));
vi.mock('../projects/commands.js', () => ({ applyProjectCommand: state.graph }));
vi.mock('../plugins/storage.js', () => ({ readSnapshot: state.snapshot, loadInstallation: state.installation }));
vi.mock('./store.js', () => ({ latestRuntimeRevision: state.runtime, installedMaterial: state.material, recordBinding: state.binding, assertPluginHost: vi.fn(), assertTrustedPluginHost: vi.fn() }));
import { sha256 } from '../database.js';
import { admitPluginVerification, lockSourceProject } from './verification-admission.js';
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

test('VAR admission creates exactly one task and project binding on the receipt transaction', async () => {
  const content = '{"a":1}';
  const client = { query: vi.fn(async (sql: string) => ({ rows: sql.includes('FROM flow.artifacts') ? [{ content }] : sql.includes('UNION ALL') ? [{ project_id: 'project' }] : [] })) } as unknown as PoolClient;
  const request = { expectedRevision: 2, expectedSourceProjectRevision: 3, title: 'Verify', source: { taskId: 'source', attemptId: 'attempt', artifactId: 'artifact', version: sha256(content) },
    rule: { schemaVersion: 1 as const, algorithmId: 'flow.json-object.required-keys' as const, algorithmVersion: 1 as const, requiredKeys: ['a'] } };
  state.command.mockImplementation(async (_pool, _namespace, _key, _input, apply) => ({ value: await apply(client), replayed: false }));
  state.runtime.mockResolvedValue({ desired_enabled: true, target_runner_id: 'runner', store_id: 'store', material_install_operation_id: 'install', revision: 2 });
  state.installation.mockResolvedValue({ revision: 2 });
  state.snapshot.mockResolvedValue({ revision: 2, grants: ['verifier'], configurationStatus: 'ready', configuration: {}, version: { id: 'version' }, installation: { scope: { workspaceId: 'personal', projectId: null } } });
  state.material.mockResolvedValue({ installationId: 'material', treeDigest: 'b'.repeat(64), artifact: { sha256: 'c'.repeat(64) } });
  state.accept.mockResolvedValue({ id: 'new-task' });
  state.graph.mockResolvedValue({ changedNodeId: 'node', snapshot: { project: { revision: 4 }, graph: { nodes: [{ id: 'node', taskId: 'new-task' }] }, tasks: [{ id: 'new-task' }] } });
  state.binding.mockImplementation(async (_client, binding) => binding);
  const result = await admitPluginVerification({} as never, {} as never, 'registration', request, 'stable-key', () => true, () => true);
  expect(result.task.id).toBe('new-task'); expect(result.project).toEqual({ id: 'project', revision: 4, nodeId: 'node' });
  expect(state.accept).toHaveBeenCalledTimes(1); expect(state.accept.mock.calls[0]![0]).toBe(client);
  expect(state.graph.mock.calls[0]![0]).toBe(client); expect(state.graph.mock.calls[0]![2].change.taskId).toBe('new-task');
  expect(state.binding.mock.calls[0]![0]).toBe(client);
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO flow.plugin_verification_references'), expect.arrayContaining(['source', 'attempt', 'artifact', 'project']));
});
