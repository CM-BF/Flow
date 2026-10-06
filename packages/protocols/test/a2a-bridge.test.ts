import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { SendMessageRequest, ListTasksRequest, TaskState, type Task } from '@a2a-js/sdk';
import { ClientFactory, JsonRpcTransportFactory, DefaultAgentCardResolver } from '@a2a-js/sdk/client';
import { FlowClient } from '@flow/client';
import type { ClaimedTask } from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';
import { createA2ABridge, connectA2A } from '../src/index.js';

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_p01';
const token = 'p01-test-owner';
let center: Awaited<ReturnType<typeof createServer>>;
let bridge: ReturnType<typeof createA2ABridge>;
let flow: FlowClient;
let url: string;
async function start() {
  center = await createServer({ databaseUrl, ownerToken: token });
  flow = new FlowClient({ baseUrl: await center.listen({ host: '127.0.0.1', port: 0 }), token });
  bridge = createA2ABridge({ flow, token, submission: { harness: 'fixture' }, pollMs: 10 });
  await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
}
async function stop() { bridge?.closeAllConnections(); await new Promise<void>(resolve => bridge ? bridge.close(() => resolve()) : resolve()); await center?.close(); }
async function official() {
  const fetchImpl: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), Authorization: `Bearer ${token}` } });
  return new ClientFactory({ transports: [new JsonRpcTransportFactory({ fetchImpl })], cardResolver: new DefaultAgentCardResolver({ fetchImpl }), clientConfig: { polling: true } }).createFromUrl(url);
}
const message = (id = 'same-message') => SendMessageRequest.fromJSON({ message: { messageId: id, role: 'ROLE_USER', parts: [{ text: 'Produce a checked artifact.' }] }, configuration: { returnImmediately: true } });
const command = (key: string) => ({ serviceParameters: { 'Idempotency-Key': key } });
async function claim() {
  const registration = await flow.registerRunner({ name: 'protocol fixture', harnesses: ['fixture'] });
  const runner = new FlowClient({ baseUrl: center.listeningOrigin, token: registration.token });
  let assignment: ClaimedTask | null = null;
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment; }).toBeTruthy();
  return { runner, assignment: assignment!, ownership: { attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion } };
}
beforeEach(async () => { const pool = new Pool({ connectionString: databaseUrl }); await pool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE;'); await pool.end(); await start(); });
afterEach(stop);

test('independent official SDK: durable acceptance survives center + bridge restart; messageId alone is not dedup', async () => {
  const sdk = await official();
  expect((await sdk.getAgentCard()).securityRequirements).toEqual([{ schemes: { owner: { list: [] } } }]);
  const first = await sdk.sendMessage(message(), command('accepted')) as Task;
  expect(first.contextId).toBe(first.id);
  expect(first.status?.state).toBe(TaskState.TASK_STATE_SUBMITTED);
  await stop(); await start();
  const fresh = await official();
  const replay = await fresh.sendMessage(message(), command('accepted')) as Task;
  expect(replay.id).toBe(first.id);
  expect((await fresh.getTask({ id: first.id, tenant: '', historyLength: 0 })).history).toEqual([]);
  const second = await fresh.sendMessage(message()) as Task;
  expect(second.id).not.toBe(first.id);
  expect((await flow.list()).tasks).toHaveLength(2);
  await expect(fresh.sendMessage(SendMessageRequest.fromJSON({ configuration: { returnImmediately: true }, message: { messageId: 'changed', role: 'ROLE_USER', parts: [{text:'Different'}] } }), command('accepted'))).rejects.toBeTruthy();
});

test('official SDK input/stream/artifact mapping keeps verification separate and cancel pending honest', async () => {
  const sdk = await official();
  const task = await sdk.sendMessage(message('decision')) as Task;
  const { runner, ownership } = await claim();
  await runner.report({ ...ownership, events: [{ id: 'decision-event', sequence: 1, type: 'decision', decisionId: 'd1', prompt: 'Allow output?' }] });
  let current = await sdk.getTask({ id: task.id, tenant: '' });
  expect(current.status?.state).toBe(TaskState.TASK_STATE_INPUT_REQUIRED);
  expect(current.status?.message?.parts[1]?.content).toMatchObject({ $case: 'data', value: { flowDecisionId: 'd1' } });
  await sdk.sendMessage(SendMessageRequest.fromJSON({ message: { messageId: 'answer', role: 'ROLE_USER', taskId: task.id, contextId: task.id, parts: [{ data: { decisionId: 'd1', answer: 'approve' } }] }, configuration: { returnImmediately: true } }), command('approve'));
  expect((await runner.heartbeat(ownership)).decision).toEqual({ decisionId: 'd1', answer: 'approve' });
  const abort = new AbortController();
  const stream = sdk.resubscribeTask({ id: task.id, tenant: '' }, { signal: abort.signal });
  expect((await stream.next()).value?.payload?.$case).toBe('task');
  abort.abort(); await stream.return(undefined);
  expect((await flow.show(task.id)).status).toBe('running');
  current = await sdk.cancelTask({ id: task.id, tenant: '', metadata: undefined });
  expect(current.status?.state).toBe(TaskState.TASK_STATE_WORKING);
  expect(current.metadata?.flow.cancellationPending).toBe(true);
  await runner.report({ ...ownership, events: [{ id: 'stopped', sequence: 2, type: 'completed', outcome: 'cancelled' }] });
  expect((await sdk.getTask({ id: task.id, tenant: '' })).status?.state).toBe(TaskState.TASK_STATE_CANCELED);
  await expect(sdk.cancelTask({ id: task.id, tenant: '', metadata: undefined })).rejects.toBeTruthy();
});

test('verified content, versions and bounded history survive mapping and reconnect', async () => {
  const peer = await connectA2A({ url, token, allowLoopbackHttp: true });
  const task = await peer.send(message('artifact')) as Task;
  const { runner, ownership } = await claim();
  const content = 'An independently checked artifact.';
  const version = createHash('sha256').update(content).digest('hex');
  await runner.report({ ...ownership, events: [
    { id: 'out', sequence: 1, type: 'artifact', artifactId: 'out', title: 'Result', content, version, mediaType: 'text/plain' },
    { id: 'verify', sequence: 2, type: 'verification', artifactId: 'out', artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest: createHash('sha256').update(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })).digest('hex'), result: 'passed', evidence: 'Verified nonempty.' },
    { id: 'done', sequence: 3, type: 'completed', outcome: 'succeeded' },
  ] });
  const result = await peer.snapshot(task.id);
  expect(result.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
  expect(result.artifacts[0]?.parts[0]?.content).toEqual({ $case: 'text', value: content });
  expect(result.artifacts[0]?.metadata?.version).toBe(version);
  expect(result.metadata?.flow.verificationStatus).toBe('passed');
  await expect(fetch(`${url}/a2a`, { method: 'POST', body: '{}' })).resolves.toMatchObject({ status: 401 });
  const officialSdk = await official();
  await expect(officialSdk.sendMessage(SendMessageRequest.fromJSON({ message: { messageId: 'file', role: 'ROLE_USER', parts: [{ url: 'https://example.com/private' }] } }))).rejects.toBeTruthy();
});

test('ListTasks uses authorized updated-order cursor, exact total and inclusive timestamp filter', async () => {
  const sdk = await official();
  const first = await sdk.sendMessage(message('older')) as Task;
  const second = await sdk.sendMessage(message('newer')) as Task;
  await sdk.cancelTask({ id: first.id, tenant: '', metadata: undefined });
  const page = await sdk.listTasks(ListTasksRequest.fromJSON({ pageSize: 1 }));
  expect(page.tasks[0]?.id).toBe(first.id); expect(page.totalSize).toBe(2); expect(page.nextPageToken).toBeTruthy();
  const last = await sdk.listTasks(ListTasksRequest.fromJSON({ pageSize: 1, pageToken: page.nextPageToken }));
  expect(last.tasks[0]?.id).toBe(second.id); expect(last.nextPageToken).toBe(''); expect(last.totalSize).toBe(2);
  const filtered = await sdk.listTasks(ListTasksRequest.fromJSON({ contextId: first.id, status: 'TASK_STATE_CANCELED', statusTimestampAfter: page.tasks[0]?.status?.timestamp }));
  expect(filtered.tasks.map(task => task.id)).toEqual([first.id]); expect(filtered.totalSize).toBe(1);
  await expect(sdk.listTasks(ListTasksRequest.fromJSON({ pageToken: page.nextPageToken, status: 'TASK_STATE_CANCELED' }))).rejects.toBeTruthy();
  const response = await fetch(`${url}/a2a`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'A2A-Version': '1.0' }, body: JSON.stringify({ jsonrpc: '2.0', id: 19, method: 'ListTasks', params: { pageSize: 1 } }) });
  expect((await response.json()).result.tasks[0]).not.toHaveProperty('artifacts');
});

test('bridge shutdown ends observation without cancelling durable work; failed verification remains separate', async () => {
  const sdk = await official();
  const task = await sdk.sendMessage(message('verify-fails')) as Task;
  const stream = sdk.resubscribeTask({ id: task.id, tenant: '' });
  expect((await stream.next()).value?.payload?.$case).toBe('task');
  await bridge.shutdown();
  expect((await flow.show(task.id)).status).toBe('queued');
  await stream.return(undefined);
  bridge = createA2ABridge({ flow, token, submission: { harness: 'fixture' } });
  await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(bridge.address() as { port: number }).port}`;
  const fresh = await official();
  const { runner, ownership } = await claim();
  const version = createHash('sha256').update('').digest('hex');
  const inputDigest = createHash('sha256').update(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })).digest('hex');
  await runner.report({ ...ownership, events: [
    { id: 'out', sequence: 1, type: 'artifact', artifactId: 'out', title: 'Empty', content: '', version, mediaType: 'text/plain' },
    { id: 'verify', sequence: 2, type: 'verification', artifactId: 'out', artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest, result: 'failed', evidence: 'Artifact is empty.' },
    { id: 'done', sequence: 3, type: 'completed', outcome: 'succeeded' },
  ] });
  const result = await fresh.getTask({ id: task.id, tenant: '' });
  expect(result.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
  expect(result.metadata?.flow.verificationStatus).toBe('failed');
});

test('invalid history length is rejected before durable acceptance', async () => {
  const sdk = await official();
  const request = message('invalid-history');
  request.configuration!.historyLength = -1;
  await expect(sdk.sendMessage(request)).rejects.toBeTruthy();
  expect((await flow.list()).tasks).toEqual([]);
  request.configuration!.historyLength = 0;
  const abort = new AbortController();
  const stream = sdk.sendMessageStream(request, { signal: abort.signal });
  const first = (await stream.next()).value;
  expect(first?.payload?.$case).toBe('task');
  if (first?.payload?.$case === 'task') expect(first.payload.value.history).toEqual([]);
  abort.abort(); await stream.return(undefined);
});
