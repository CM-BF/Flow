import { afterEach, expect, it, vi } from 'vitest';
import { FlowClient } from './index.js';
import { accepted, binding, changed, command, id, input, response, runtimeView, taskId, uuid } from '../../../docs/evidence/x01-cli-commands/fixtures.js';
const client = () => new FlowClient({ baseUrl: 'http://127.0.0.1:1', token: 'fixture-owner' });
afterEach(() => vi.restoreAllMocks());
it('connects four owner methods to the original authenticated bounded transport', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(runtimeView())).mockResolvedValueOnce(response(changed())).mockResolvedValueOnce(response(accepted(),201)).mockResolvedValueOnce(response(binding()));
  expect(await client().pluginRuntime(id)).toEqual(runtimeView());
  expect(await client().commandPluginRuntime(id, command, 'enable-key')).toEqual(changed());
  expect(await client().admitPluginToolTask(id, input, 'admit-key')).toEqual(accepted());
  expect(await client().pluginToolBinding(taskId)).toEqual(binding());
  expect(fetch.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([`/api/plugins/${id}/runtime`,`/api/plugins/${id}/runtime/commands`,`/api/plugins/${id}/tool-tasks`,`/api/tasks/${taskId}/plugin-binding`]);
  for (const [,init] of fetch.mock.calls) expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-owner');
  expect(new Headers(fetch.mock.calls[1]![1]?.headers).get('idempotency-key')).toBe('enable-key');
});
it('freezes input before await and accepts the historical ACK even after current state changes', async () => {
  const request=structuredClone(input);let resolve!: (r:Response)=>void;
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const pending=client().admitPluginToolTask(id,request,'same-key');request.input='changed';request.title='changed';
  await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());resolve(response({...accepted(),replayed:true}));
  expect((await pending).replayed).toBe(true);expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual(input);
});
it.each(['task','digest','registration','revision','title','harness'] as const)('rejects mismatched admission %s as UNKNOWN, never input validation', async field => {
  const value=accepted(); if(field==='task') value.task.id=uuid(20);if(field==='digest') value.binding.inputDigest='f'.repeat(64);if(field==='registration') value.binding.registrationId=uuid(20);if(field==='revision') value.binding.registrationRevision=4;if(field==='title') value.task.title='other';if(field==='harness') value.task.harness='claude';
  vi.spyOn(globalThis,'fetch').mockResolvedValue(response(value,201));
  await expect(client().admitPluginToolTask(id,input,'key')).rejects.toMatchObject({code:'plugin_ack_unknown'});
});
it('rejects wrong runtime/operation/enable identities and malformed read ACKs', async () => {
  for(const mutate of [(x:ReturnType<typeof changed>)=>{x.runtime.storeId='other';},(x:ReturnType<typeof changed>)=>{x.operation.installationId=uuid(20);},(x:ReturnType<typeof changed>)=>{x.operation.afterRevision=4;}]) {
    const value=changed();mutate(value);vi.spyOn(globalThis,'fetch').mockResolvedValue(response(value));
    await expect(client().commandPluginRuntime(id,command,'key')).rejects.toMatchObject({code:'plugin_ack_unknown'});vi.restoreAllMocks();
  }
  vi.spyOn(globalThis,'fetch').mockResolvedValue(response({}));await expect(client().pluginRuntime(id)).rejects.toMatchObject({code:'plugin_ack_unknown'});
});
it('retains route/key/body on ambiguous transmission and never retries; typed409 stays a rejection', async () => {
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValueOnce(new Error('connection closed')).mockResolvedValueOnce(response({error:{code:'plugin_revision_conflict',message:'changed'}},409));
  await expect(client().commandPluginRuntime(id,command,'same-key')).rejects.toMatchObject({code:'plugin_ack_unknown',request:{path:`/api/plugins/${id}/runtime/commands`,key:'same-key',body:JSON.stringify(command)}});
  expect(fetch).toHaveBeenCalledOnce();await expect(client().commandPluginRuntime(id,command,'same-key')).rejects.toMatchObject({status:409,code:'plugin_revision_conflict'});
});
it('validates disable receipts and preserves cookie/CSRF transport', async () => {
  const disable = { expectedRevision: 2, reason: 'Stop new bindings', change: { kind: 'disable' as const } };
  const value = changed();
  Object.assign(value.runtime, { desiredEnabled: false, bindingAllowed: false, reason: 'not-enabled', enabledRevision: null, targetRunnerId: null, storeId: null, materialInstallOperationId: null });
  value.operation.kind = 'disable';
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(value));
  const cookieClient = new FlowClient({ baseUrl: 'http://127.0.0.1:1', browserSession: { csrfToken: () => 'a'.repeat(64) } });
  expect((await cookieClient.commandPluginRuntime(id, disable, 'disable-key')).runtime.desiredEnabled).toBe(false);
  expect(fetch.mock.calls[0]![1]?.credentials).toBe('include');
  expect(new Headers(fetch.mock.calls[0]![1]?.headers).get('x-flow-csrf')).toBe('a'.repeat(64));
});
it('freezes enable identity while a response is pending', async () => {
  const request = structuredClone(command); let resolve!: (r: Response) => void;
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = client().commandPluginRuntime(id, request, 'same-key');
  request.change.storeId = 'mutated'; request.expectedRevision = 99;
  resolve(response(changed())); expect((await pending).runtime.storeId).toBe('store-1');
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual(command);
});
it('rejects binding and runtime reads for a different identity', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ ...binding(), taskId: uuid(20) })).mockResolvedValueOnce(response({ ...runtimeView(), registrationId: uuid(20) }));
  await expect(client().pluginToolBinding(taskId)).rejects.toMatchObject({ code: 'plugin_ack_unknown' });
  await expect(client().pluginRuntime(id)).rejects.toMatchObject({ code: 'plugin_ack_unknown' });
});
it('bounds malformed, oversized success and proxy errors without claiming rejection', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{', { status: 201 }))
    .mockResolvedValueOnce(new Response(' '.repeat(65537), { status: 201 }))
    .mockResolvedValueOnce(new Response('x'.repeat(4097), { status: 409 }));
  for (let index = 0; index < 3; index++) await expect(client().admitPluginToolTask(id, input, 'same-key')).rejects.toMatchObject({ code: 'plugin_ack_unknown' });
  expect(fetch).toHaveBeenCalledTimes(3);
});
it('records cancellation after transmission as UNKNOWN without replay', async () => {
  const controller = new AbortController();
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    controller.abort(new Error('caller stopped')); init?.signal?.throwIfAborted(); return response(accepted());
  });
  await expect(client().admitPluginToolTask(id, input, 'same-key', controller.signal)).rejects.toMatchObject({ code: 'plugin_ack_unknown', request: { key: 'same-key', body: JSON.stringify(input) } });
  expect(fetch).toHaveBeenCalledOnce();
});
