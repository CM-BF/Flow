import { randomUUID } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { PluginRunnerClient, type PluginJsonRequest } from './plugin-runner.js';
import type { PluginRunnerClaimRequest } from '../../contracts/src/plugin-runner-claim.js';
const request = (): PluginRunnerClaimRequest => ({ protocol: 'flow.runner-claim.v3', runnerId: randomUUID(), requestId: randomUUID(),
  pluginToolExecution: { bindingProtocol: 'flow.plugin-runtime.v1', storeId: 'owned', hostApiMajor: 1 } });
test('claim snapshots the complete request before awaiting the shared transport', async () => {
  const input = request(), original = structuredClone(input); let release!: (value: unknown) => void;
  const transport = vi.fn<PluginJsonRequest>(() => new Promise(resolve => { release = resolve; }));
  const pending = new PluginRunnerClient(transport).claim(input); input.pluginToolExecution.storeId = 'changed';
  release({ ...original, state: 'empty' }); expect(await pending).toEqual({ ...original, state: 'empty' });
  expect(JSON.parse(transport.mock.calls[0]![1].body as string)).toEqual(original);
  expect(transport.mock.calls[0]![2]).toBe(131072);
});
test('status rejects a claim-only ACK and changed qualification without retry', async () => {
  const input = request(); const transport = vi.fn<PluginJsonRequest>(async () => ({ ...input, state: 'empty' }));
  await expect(new PluginRunnerClient(transport).status(input)).rejects.toThrow(); expect(transport).toHaveBeenCalledTimes(1);
  transport.mockResolvedValue({ ...input, pluginToolExecution: { ...input.pluginToolExecution, storeId: 'wrong' }, state: 'empty' });
  await expect(new PluginRunnerClient(transport).claim(input)).rejects.toThrow(); expect(transport).toHaveBeenCalledTimes(2);
});
test('publication requires the exact explicit ACK', async () => {
  const transport = vi.fn<PluginJsonRequest>(async (): Promise<unknown> => ({ published: true, extra: true }));
  const client = new PluginRunnerClient(transport), input = { protocol: 'flow.plugin-runtime.v1' as const, storeId: 'owned', hostApiMajor: 1 as const };
  await expect(client.publishHost(input)).rejects.toThrow(); transport.mockResolvedValue({ published: true });
  await expect(client.publishHost(input)).resolves.toBeUndefined(); expect(transport.mock.calls[0]![2]).toBe(1024);
});
test('phase request preserves stable key and rejects a changed ownership ACK', async () => {
  const input = { attemptId: randomUUID(), ownerVersion: 1, bindingId: randomUUID(), invocationId: randomUUID(), phase: 'load' as const };
  const transport = vi.fn<PluginJsonRequest>(async () => ({ ...input, protocol: 'flow.plugin-runtime.v1', taskId: randomUUID(), runnerId: randomUUID(), authorizedRevision: 1, replayed: false, ownerVersion: 2 }));
  await expect(new PluginRunnerClient(transport).authorize(input, 'a'.repeat(64))).rejects.toThrow();
  expect(transport.mock.calls[0]![1].headers).toEqual({ 'Idempotency-Key': 'a'.repeat(64) }); expect(transport).toHaveBeenCalledTimes(1);
});
