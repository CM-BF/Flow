import { beforeEach, expect, test, vi } from 'vitest';
import type { PoolClient } from 'pg';
const state = vi.hoisted(() => ({ current: { id: 'project', workspace_id: 'personal', revision: 3 }, lock: vi.fn(), recheck: vi.fn(), command: vi.fn(), accept: vi.fn(), graph: vi.fn(), runtime: vi.fn(), snapshot: vi.fn(), installation: vi.fn(), material: vi.fn(), binding: vi.fn(), owned: vi.fn(), readBinding: vi.fn(), executionKind: vi.fn() }));
vi.mock('../projects/storage.js', () => ({ loadProject: state.lock }));
vi.mock('./verification.js', () => ({ assertSourceProject: state.recheck, bindingExecutionKind: state.executionKind, claimVerificationReference: vi.fn() }));
vi.mock('../tasks.js', () => ({ command: state.command, acceptTask: state.accept }));
vi.mock('../projects/commands.js', () => ({ applyProjectCommand: state.graph }));
vi.mock('../plugins/storage.js', () => ({ readSnapshot: state.snapshot, loadInstallation: state.installation }));
vi.mock('./store.js', () => ({ latestRuntimeRevision: state.runtime, installedMaterial: state.material, recordBinding: state.binding, readBinding: state.readBinding, assertPluginHost: vi.fn(), assertTrustedPluginHost: vi.fn() }));
vi.mock('../runners.js', () => ({ ownedAttempt: state.owned }));
import { authorizePluginPhase, changePluginRuntime } from './commands.js';
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

test.each(['tool', 'verifier'] as const)('VAR repair %s phase preserves its public permission error without writing a receipt', async kind => {
  const client = { query: vi.fn(async (_sql: string) => ({ rows: [{ live: true }] })), release: vi.fn() };
  const pool = { connect: async () => client };
  state.owned.mockResolvedValue({ task: { id: 'task', status: 'running', submission: { prompt: '{}' } }, attempt: { id: 'attempt', owner_version: 1, completed_at: null, lease_expires_at: '2099-01-01' } });
  state.readBinding.mockResolvedValue({ bindingId: 'binding', invocationId: 'invocation', targetRunnerId: 'runner', inputDigest: sha256('{}'), registrationId: 'registration' });
  state.executionKind.mockResolvedValue(kind); state.snapshot.mockResolvedValue({ grants: [] });
  const args = [pool as never, 'runner', { attemptId: 'attempt', ownerVersion: 1, bindingId: 'binding', invocationId: 'invocation', phase: 'load' as const }, 'stable-key'] as const;
  const request = kind === 'tool' ? authorizePluginPhase(...args) : authorizePluginPhase(...args, 'verifier');
  await expect(request).rejects.toMatchObject({ status: 403, code: kind === 'tool' ? 'plugin_tool_grant_required' : 'plugin_verifier_grant_required' });
  expect(client.query).toHaveBeenCalledWith('ROLLBACK'); expect(client.release).toHaveBeenCalledTimes(1);
  expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
});
test('VAR repair tool enable retains its existing permission error before revision or binding writes', async () => {
  const client = { query: vi.fn() };
  state.command.mockImplementation(async (_pool, _namespace, _key, _input, apply) => ({ value: await apply(client), replayed: false }));
  state.installation.mockResolvedValue({ revision: 2 }); state.snapshot.mockResolvedValue({ grants: [], configurationStatus: 'ready' });
  state.material.mockResolvedValue({ manifest: { kind: 'tool' } });
  await expect(changePluginRuntime({} as never, 'registration', { expectedRevision: 2, reason: 'Enable', change: { kind: 'enable', materialInstallOperationId: 'install', targetRunnerId: 'runner', storeId: 'store' } }, 'stable-key', () => true))
    .rejects.toMatchObject({ status: 403, code: 'plugin_tool_grant_required' });
  expect(client.query).not.toHaveBeenCalled();
});
