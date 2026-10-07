import { afterEach, expect, it, vi } from 'vitest';
import { FlowClient } from '@flow/client';
import type { PluginRuntimeCommand } from '@flow/contracts';
import { createRuntimeCommandController } from '../src/plugin-management/runtime-command';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const id = uuid(1), now = '2026-10-07T10:00:00.000Z';
const command = (): PluginRuntimeCommand => ({ expectedRevision: 1, reason: 'Enable exact installed material', change: { kind: 'enable', materialInstallOperationId: uuid(3), targetRunnerId: uuid(4), storeId: 'store-1' } });
function acknowledgement(input: PluginRuntimeCommand, replayed = false) {
  const revision = input.expectedRevision + 1, enabled = input.change.kind === 'enable';
  return {
    replayed,
    runtime: { protocol: 'flow.plugin-runtime.v1', registrationId: id, currentRevision: revision, enabledRevision: enabled ? revision : null,
      desiredEnabled: enabled, bindingAllowed: enabled, reason: enabled ? 'ready' : 'not-enabled', loaded: 'unknown', callable: 'unknown',
      materialInstallOperationId: input.change.kind === 'enable' ? input.change.materialInstallOperationId : null,
      targetRunnerId: input.change.kind === 'enable' ? input.change.targetRunnerId : null, storeId: input.change.kind === 'enable' ? input.change.storeId : null },
    operation: { id: uuid(9), installationId: id, kind: input.change.kind, status: 'succeeded', actor: 'owner', inputDigest: 'd'.repeat(64), beforeRevision: input.expectedRevision, afterRevision: revision, createdAt: now },
    snapshot: { revision, installation: { id, scope: { workspaceId: 'personal', projectId: null }, packageName: 'test-tool', revision, registrationStatus: 'registered', runtimeStatus: 'unavailable', runtimeReason: 'package_not_verified_or_loaded', createdAt: now, updatedAt: now },
      version: { id: uuid(7), createdAt: now, packageName: 'test-tool', packageVersion: '1.0.0', source: 'npm', declaredSha256: 'c'.repeat(64), license: 'MIT', hostApiMajor: 1, capabilities: ['tool'], publicConfiguration: [] }, configuration: {}, configurationStatus: 'ready', grants: ['tool'] },
  };
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function setup() {
  const client = new FlowClient({ baseUrl: 'http://127.0.0.1:1', token: 'fixture-only' });
  let live = true, keys = 0;
  const controller = createRuntimeCommandController(client, { sessionId: 'session-A', isCurrent: () => live }, () => `key-${++keys}`);
  return { client, controller, invalidate() { live = false; controller.revoke(); } };
}
afterEach(() => vi.restoreAllMocks());

it('validates before HTTP and does not create an unknown command for invalid input', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch'); const { controller } = setup();
  await controller.submit(id, { ...command(), reason: '' });
  expect(controller.getSnapshot()).toEqual({ phase: 'idle', notice: 'invalid-input' }); expect(fetch).not.toHaveBeenCalled();
});
it('accepts real public enable and disable ACK codecs without claiming loaded or callable', async () => {
  const enable = command(), disable: PluginRuntimeCommand = { expectedRevision: 2, reason: 'Stop new bindings', change: { kind: 'disable' } };
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(acknowledgement(enable))).mockResolvedValueOnce(response(acknowledgement(disable)));
  const { controller } = setup(); await controller.submit(id, enable); await controller.submit(id, disable);
  expect(controller.getSnapshot()).toMatchObject({ phase: 'accepted', acknowledgement: { runtime: { desiredEnabled: false, loaded: 'unknown', callable: 'unknown' } } });
  expect(fetch.mock.calls.map(([, init]) => new Headers(init?.headers).get('idempotency-key'))).toEqual(['key-1', 'key-2']);
});
it('freezes one command before await and blocks duplicate submission', async () => {
  let resolve!: (r: Response) => void;
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(r => { resolve = r; }));
  const { controller } = setup(); const input = command(); const original = structuredClone(input);
  const pending = controller.submit(id, input); input.reason = 'edited'; input.expectedRevision = 99;
  await controller.submit(id, command()); expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual(original);
  resolve(response(acknowledgement(original))); await pending; expect(controller.getSnapshot().phase).toBe('accepted');
});
it('keeps a first typed409 as a rejection with the exact submitted draft', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ error: { code: 'plugin_revision_conflict', message: 'fixture conflict' } }, 409));
  const { controller } = setup(); await controller.submit(id, command());
  expect(controller.getSnapshot()).toMatchObject({ phase: 'rejected', rejectionStatus: 409, command: { input: command(), key: 'key-1' } });
});
it.each([403, 404, 409])('keeps prior UNKNOWN after retry status %i and a successful GET until exact original ACK', async status => {
  const input = command(); const fetch = vi.spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new Error('fixture connection closed'))
    .mockResolvedValueOnce(response({ error: { code: 'fixture_rejection', message: 'fixture rejection' } }, status))
    .mockResolvedValueOnce(response(acknowledgement(input).runtime))
    .mockResolvedValueOnce(response(acknowledgement(input, true)));
  const { client, controller } = setup(); await controller.submit(id, input);
  const original = controller.getSnapshot().command!;
  const unsubscribe = controller.subscribe(() => {}); unsubscribe(); // Lazy view unmounts, session survives.
  await controller.retryOriginal(original);
  expect(controller.getSnapshot()).toMatchObject({ phase: 'unknown', command: original, retryRejectionStatus: status });
  await client.pluginRuntime(id); expect(controller.getSnapshot().phase).toBe('unknown');
  await controller.submit(id, command()); expect(fetch).toHaveBeenCalledTimes(3);
  await controller.retryOriginal(original); expect(controller.getSnapshot()).toMatchObject({ phase: 'accepted', acknowledgement: { replayed: true } });
  const writes = fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(writes.map(([, init]) => init?.body)).toEqual([original.body, original.body, original.body]);
  expect(writes.map(([, init]) => new Headers(init?.headers).get('idempotency-key'))).toEqual(['key-1', 'key-1', 'key-1']);
});
it('does not turn a malformed read ACK into a pending mutation or write retry', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({})); const { client, controller } = setup();
  await expect(client.pluginRuntime(id)).rejects.toMatchObject({ code: 'plugin_ack_unknown', request: { path: `/api/plugins/${id}/runtime` } });
  expect(controller.getSnapshot()).toEqual({ phase: 'idle' }); expect(fetch.mock.calls[0]![1]?.method).not.toBe('POST');
});
it('ignores an old accepted response after live authority changes even when transport ignores abort', async () => {
  let resolve!: (r: Response) => void; const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(r => { resolve = r; }));
  const { controller, invalidate } = setup(); const pending = controller.submit(id, command());
  invalidate(); resolve(response(acknowledgement(command()))); await pending;
  expect(controller.getSnapshot()).toMatchObject({ phase: 'revoked', command: { key: 'key-1' } });
  await controller.submit(id, command()); expect(fetch).toHaveBeenCalledOnce();
});
it('rejects a retained retry callback for a different unresolved command', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce(response(acknowledgement(command(), true))).mockRejectedValueOnce(new Error('lost again'));
  const { controller } = setup(); await controller.submit(id, command()); const old = controller.getSnapshot().command!;
  await controller.retryOriginal(old); await controller.submit(id, command());
  await controller.retryOriginal(old); expect(fetch).toHaveBeenCalledTimes(3); expect(controller.getSnapshot().command?.key).toBe('key-2');
});
it('observer failure cannot swallow transmission or turn accepted ACK into UNKNOWN', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(acknowledgement(command()))); const { controller } = setup();
  controller.subscribe(() => { throw new Error('view failed'); }); await controller.submit(id, command());
  expect(fetch).toHaveBeenCalledOnce(); expect(controller.getSnapshot().phase).toBe('accepted');
});
