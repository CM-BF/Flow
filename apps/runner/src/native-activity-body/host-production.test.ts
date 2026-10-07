import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { eventBatchSchema, runnerClaimRequestSchema, RUNNER_CLAIM_PROTOCOL, type ClaimedTask, type EventBatch, type HarnessContext } from '@flow/contracts';
import { NATIVE_ACTIVITY_BODY_LIMITS, type NativeActivityBodyInput } from '../../../../packages/contracts/src/native-activity-body.js';
import { runRunner, type RunnerOptions } from '../runtime.js';
import { textDigest } from '../verifier.js';

// Actual runRunner/FlowClient/outbox with a synthetic HTTP response port; no PG or provider.
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { try { for (const stop of cleanup.splice(0).reverse()) await stop(); } finally { vi.unstubAllGlobals(); } });
const assignment: ClaimedTask = { task: { id: 'body-task', title: 'Public material', prompt: 'No provider', harness: 'fixture' },
  attempt: { id: 'body-attempt', runnerId: 'body-runner', ownerVersion: 1, leaseExpiresAt: '2099-01-01T00:00:00Z' } };
const support = () => ({ protocol: 'native-activity-body-v1', representation: 'sdk-public-material-utf8-v1', runnerId: 'body-runner', limits: { ...NATIVE_ACTIVITY_BODY_LIMITS } });

async function peer() {
  const directory = await mkdtemp(join(tmpdir(), 'chat05p02-host-')), identity = await lstat(directory);
  const baseUrl = 'http://body-center.invalid', state = join(directory, textDigest(baseUrl));
  const paths: string[] = [], batches: EventBatch[] = [], executions: { stop: AbortController; promise: Promise<void> }[] = [];
  let supportReply: () => unknown = support, claims = 0, loseBodyAck = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    init.signal?.throwIfAborted(); const path = new URL(url).pathname; paths.push(path);
    if (path === '/api/runner/identity') return Response.json({ protocol: RUNNER_CLAIM_PROTOCOL, runnerId: 'body-runner' });
    if (path === '/api/runner/native-activity-body-support') {
      const value = supportReply(); return value instanceof Response ? value : Response.json(value);
    }
    if (path === '/api/runner/claim-opportunity/status' || path === '/api/runner/claim-opportunity') {
      const input = runnerClaimRequestSchema.parse(JSON.parse(String(init.body)));
      if (path.endsWith('/status')) return Response.json({ ...input, state: 'missing' });
      claims++;
      return Response.json(claims === 1 ? { ...input, state: 'assigned', identity: { taskId: assignment.task.id, attemptId: assignment.attempt.id, runnerId: assignment.attempt.runnerId, ownerVersion: assignment.attempt.ownerVersion }, assignment, remainingLeaseMs: 10000 } : { ...input, state: 'empty' });
    }
    if (path === '/api/runner/heartbeat') return Response.json({ action: 'continue', remainingLeaseMs: 10000 });
    if (path === '/api/runner/events') {
      const batch = eventBatchSchema.parse(JSON.parse(String(init.body))); batches.push(batch);
      if (loseBodyAck && batch.events.some(event => event.type === 'native-activity-body')) { loseBodyAck = false; throw new TypeError('Synthetic accepted reply lost'); }
      return Response.json({ accepted: batch.events.length, lastSequence: batch.events.at(-1)!.sequence });
    }
    return Response.json({}, { status: 404 });
  }));
  cleanup.push(async () => {
    executions.forEach(item => item.stop.abort()); await Promise.allSettled(executions.map(item => item.promise));
    const current = await lstat(directory); expect([current.dev, current.ino, current.isDirectory()]).toEqual([identity.dev, identity.ino, true]);
    await rm(directory, { recursive: true });
  });
  return { paths, batches, state, claims: () => claims, support(value: () => unknown) { supportReply = value; }, loseAck() { loseBodyAck = true; },
    async journal() { return JSON.parse(await readFile(join(state, 'admission.json'), 'utf8')); },
    start(run: (context: HarnessContext) => Promise<void>, enabled?: boolean, stopNotice?: string) {
      const stop = new AbortController();
      const options: RunnerOptions = { baseUrl, token: 'synthetic', workingDirectory: directory, signal: stop.signal, pollIntervalMs: 5,
        requestTimeoutMs: 1000, adapters: [{ name: 'fixture', version: 'public-material-test', run }],
        nativeActivityBodies: enabled, onNotice(notice) { if (notice.type === stopNotice) stop.abort(); } };
      const promise = runRunner(options); void promise.catch(() => undefined); executions.push({ stop, promise }); return { stop, promise };
    } };
}

it.each([undefined, true])('keeps actual runtime legacy when opt-in is %s and the old center is explicit', async enabled => {
  const api = await peer(); api.support(() => Response.json({}, { status: 404 }));
  let called = 0;
  const running = api.start(async context => { called++; expect(context.activityBodies).toBeUndefined(); running.stop.abort(); }, enabled);
  await running.promise; expect(called).toBe(1); expect(api.claims()).toBe(1);
  expect(api.paths.filter(path => path.includes('body-support'))).toHaveLength(enabled ? 1 : 0);
  expect(api.batches.flatMap(batch => batch.events).some(event => event.type === 'native-activity-body')).toBe(false);
});

it('blocks new claims before a model can start when current support is unknown', async () => {
  const api = await peer(); api.support(() => { throw new TypeError('Offline'); }); const model = vi.fn();
  await api.start(model, true, 'connection-lost').promise;
  expect(model).not.toHaveBeenCalled(); expect(api.claims()).toBe(0); expect(api.batches).toEqual([]);
  expect((await api.journal()).assignments).toEqual([]);
});

it('rejects unqualified multi-attempt material publishing before any transport or filesystem work',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch');
  try {await expect(runRunner({baseUrl:'http://unused.invalid',token:'synthetic',workingDirectory:'/unused',signal:new AbortController().signal,nativeActivityBodies:true,maxConcurrentAttempts:2})).rejects.toThrow('single-attempt');expect(fetcher).not.toHaveBeenCalled();}
  finally{fetcher.mockRestore();}
});

it('keeps an admitted attempt unresolved when the strong pre-model confirmation fails', async () => {
  const api = await peer(); let reads = 0; api.support(() => ++reads === 1 ? support() : {}); const model = vi.fn();
  await api.start(model, true, 'ownership-lost').promise;
  expect(model).not.toHaveBeenCalled(); expect(api.claims()).toBe(1); expect(api.batches).toEqual([]);
  expect((await api.journal()).assignments).toHaveLength(1);
});

it('retains body envelopes after a lost ACK and only replays original bytes, even with new publishing disabled', async () => {
  const api = await peer(); api.loseAck(); let calls = 0;
  const content = Buffer.from('x'.repeat(90_000)), sha256 = createHash('sha256').update(content).digest('hex');
  const material: NativeActivityBodyInput = { content, activity: { type: 'native-activity', activityId: 'a'.repeat(64), nativeSessionId: 'session', source: 'claude.sdk.message', sourceMessageId: 'message', nativeMessageId: null, blockIndex: 0, parentToolUseId: null, kind: 'tool', phase: 'input-ready', toolUseId: 'tool', toolName: 'Read',
    body: { content: content.subarray(0, 65536).toString(), originalBytes: content.length, sha256, truncated: true, mediaType: 'text/plain' } } };
  await api.start(async context => { calls++; await context.emit({ type: 'session', nativeSessionId: 'session', adapterVersion: 'fixture' }); await context.activityBodies!.publish(material); }, true, 'ownership-lost').promise;
  const file = join(api.state, textDigest(assignment.attempt.id), 'pending-events.json'), original = await readFile(file);
  api.support(() => Response.json({}, { status: 404 })); const before = api.batches.length;
  await api.start(async () => { calls++; }, false, 'connection-lost').promise;
  expect(await readFile(file)).toEqual(original); expect(api.batches).toHaveLength(before);
  api.support(support);
  await api.start(async () => { calls++; }, false, 'admission-blocked').promise;
  expect(calls).toBe(1); expect(api.claims()).toBe(1);
  expect(api.batches[before]).toEqual(JSON.parse(original.toString()));
  expect(api.batches.flatMap(batch => batch.events).some(event => event.type === 'completed')).toBe(false);
  expect((await api.journal()).assignments).toHaveLength(1);
});
