import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import type { ClaimedTask, RunnerEventData } from '../../../../packages/contracts/src/runner.js';
import type { TaskUsageReadout } from '../../../../packages/contracts/src/usage-readout.js';
import { createServer } from '../index.js';
import { registerUsageReadoutRoutes } from './index.js';

const name = `flow_cost01a_${randomUUID().replaceAll('-', '')}`;
const url = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const owner = 'cost01a-isolated-owner';
let app: Awaited<ReturnType<typeof createServer>>;
let pool: Pool;
let address: string;
let created = false;
async function save(file: string, value: unknown) {
  if (!process.env.FLOW_COST01A_EVIDENCE_DIR) return;
  await mkdir(process.env.FLOW_COST01A_EVIDENCE_DIR, { recursive: true });
  await writeFile(join(process.env.FLOW_COST01A_EVIDENCE_DIR, `${file}.json`), JSON.stringify(value, null, 2) + '\n');
}
async function start() {
  app = await createServer({ databaseUrl: url, ownerToken: owner, leaseMs: 300_000, automaticQueueScan: false });
  if (!app.hasRoute({ method: 'GET', url: '/api/tasks/:id/usage-readout' })) registerUsageReadoutRoutes(app, pool);
  address = await app.listen({ host: '127.0.0.1', port: 0 });
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  pool = new Pool({ connectionString: url, max: 2, statement_timeout: 5000 });
  await start();
});
afterAll(async () => {
  try { await app?.close(); } finally {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
    await admin.end(); await save('cleanup', { database: name, remaining, serverClosed: true });
  }
});
async function http(path: string, body?: unknown, token: string | null = owner) {
  const response = await fetch(address + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  const raw = await response.text();
  return { status: response.status, data: JSON.parse(raw), bytes: Buffer.byteLength(raw), raw, cache: response.headers.get('cache-control') };
}
async function task(resumeSessionId?: string, harness: 'claude' | 'fixture' = 'claude') {
  const response = await http('/api/tasks', { title: 'Usage only', prompt: 'PRIVATE_PROMPT_BODY', harness, ...(resumeSessionId ? { resumeSessionId } : {}) });
  expect(response.status).toBe(202); return response.data.task.id as string;
}
async function runner(harness: 'claude' | 'fixture' = 'claude') {
  const response = await http('/api/runners', { name: 'Usage fixture peer', harnesses: [harness], capacity: 16 });
  expect(response.status).toBe(200); return response.data.token as string;
}
async function claim(token: string, taskId: string) {
  let assignment: ClaimedTask | null = null;
  await expect.poll(async () => { assignment = (await http('/api/runner/claim', {}, token)).data.assignment; return assignment?.task.id; }).toBe(taskId);
  let sequence = 0;
  return {
    token, taskId, attempt: assignment!.attempt,
    async emit(...values: RunnerEventData[]) {
      const events = values.map(value => ({ ...value, id: randomUUID(), sequence: ++sequence }));
      const response = await http('/api/runner/events', { attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion, events }, token);
      expect(response.status, response.raw).toBe(200); return events;
    },
  };
}
function usage(session: string, sampleId: string, overrides: Partial<Extract<RunnerEventData, { type: 'usage' }>> = {}): Extract<RunnerEventData, { type: 'usage' }> {
  return { type: 'usage', source: 'claude.modelUsage', scope: 'session', scopeId: session, model: 'model-a', sampleId,
    cumulative: true, baseline: { kind: 'new-session' }, accounting: 'authoritative', costKind: 'sdk_estimate',
    inputTokens: 10, outputTokens: 4, cacheReadTokens: 100, cacheWriteTokens: 30, costUsd: 0.02, ...overrides };
}
const sessionEvent = (id: string): RunnerEventData => ({ type: 'session', nativeSessionId: id, adapterVersion: 'claude-sdk-0.3.290-v2', resources: ['sdk:0.3.290'] });
async function read(id: string) { const response = await http(`/api/tasks/${id}/usage-readout`); expect(response.status, response.raw).toBe(200); return { ...response, data: response.data as TaskUsageReadout }; }

it('explains cache separately while stable replay preserves existing totals and excludes bodies', async () => {
  const id = await task(); const peer = await claim(await runner(), id); const session = randomUUID();
  await peer.emit(sessionEvent(session), { type: 'detail', title: 'Payload', content: 'PRIVATE_TOOL_BODY'.repeat(10000), mediaType: 'text/plain' }, usage(session, 's1'));
  const before = (await http(`/api/tasks/${id}`)).data.usage;
  const first = await read(id);
  expect(first.data.legacy).toEqual(before);
  expect(before).toEqual({ inputTokens: 10, outputTokens: 4, costUsd: 0.02, costKind: 'sdk_estimate', incomplete: false });
  expect(first.data.breakdown).toMatchObject({ uncachedInputTokens: { value: 10 }, cacheReadTokens: { value: 100 }, cacheWriteTokens: { value: 30 }, outputTokens: { value: 4 }, sdkEstimateUsd: { value: 0.02 } });
  await peer.emit(usage(session, 's1'));
  expect((await read(id)).data).toEqual(first.data);
  expect(first.raw).not.toMatch(/PRIVATE_PROMPT_BODY|PRIVATE_TOOL_BODY|sdk:0.3.290/);
  expect(first.data.sources[0]).toMatchObject({ producerVersion: null, coverage: 'unverified', phaseAttribution: 'unavailable' });
  expect(first.cache).toBe('no-store'); expect(first.bytes).toBeLessThan(5000);
  await save('first-readout', { bytes: first.bytes, readout: first.data, replayUnchanged: true, legacyUnchanged: true });
});

it('requires owner access and rejects query knobs without reading a task body', async () => {
  const id = await task();
  expect((await http(`/api/tasks/${id}/usage-readout`, undefined, null)).status).toBe(401);
  expect((await http(`/api/tasks/${id}/usage-readout`, undefined, await runner())).status).toBe(403);
  expect((await http(`/api/tasks/${id}/usage-readout?limit=100000`)).status).toBe(400);
  expect((await http('/api/tasks/not-found/usage-readout')).status).toBe(404);
  const result = await read(id);
  expect(result.data.breakdown.cacheReadTokens).toEqual({ value: null, knownSubtotal: 0, knownSamples: 0, unknownSamples: 0 });
  expect(result.data.caveats).toContain('no-authoritative-samples');
  await http(`/api/tasks/${id}/cancel`, {});
});

it('uses only the strict previous stream sample, and never adds cumulative snapshots or negative deltas', async () => {
  const id = await task(); const peer = await claim(await runner(), id); const session = randomUUID();
  await peer.emit(sessionEvent(session), usage(session, 'first'), usage(session, 'second', {
    baseline: { kind: 'sample', sampleId: 'first' }, inputTokens: 15, outputTokens: 7, cacheReadTokens: 160, cacheWriteTokens: 50, costUsd: 0.03,
  }));
  const stable = await read(id);
  expect(stable.data.breakdown).toMatchObject({ uncachedInputTokens: { value: 15 }, cacheReadTokens: { value: 160 }, cacheWriteTokens: { value: 50 }, sdkEstimateUsd: { value: 0.03 } });
  await peer.emit(usage(session, 'wrong-old', { baseline: { kind: 'sample', sampleId: 'first' }, inputTokens: 20, cacheReadTokens: 180 }));
  const old = (await read(id)).data;
  expect(old.legacy.inputTokens).toBeNull();
  expect(old.breakdown.cacheReadTokens).toEqual({ value: null, knownSubtotal: 160, knownSamples: 2, unknownSamples: 1 });
  await peer.emit(usage(session, 'decreased', { baseline: { kind: 'sample', sampleId: 'wrong-old' }, inputTokens: 2, cacheReadTokens: 1, cacheWriteTokens: 1 }));
  const reset = (await read(id)).data;
  expect(reset.breakdown.cacheReadTokens).toEqual({ value: null, knownSubtotal: 160, knownSamples: 2, unknownSamples: 2 });
  expect(reset.legacy).toEqual((await http(`/api/tasks/${id}`)).data.usage);
  await save('strict-baseline', { complete: stable.data, wrongBaseline: old, decreased: reset });
});

it('finds a resume baseline across tasks, keeps unknown resume unknown, and survives center restart', async () => {
  const token = await runner(); const firstId = await task(); const first = await claim(token, firstId); const session = randomUUID();
  await first.emit(sessionEvent(session), usage(session, 'original'), { type: 'completed', outcome: 'failed', error: 'Fixture completion' });
  const original = (await read(firstId)).data;
  const nextId = await task(session); const next = await claim(token, nextId);
  await next.emit(sessionEvent(session), usage(session, 'resumed', { baseline: { kind: 'sample', sampleId: 'original' }, inputTokens: 18, outputTokens: 9, cacheReadTokens: 150, cacheWriteTokens: 60, costUsd: 0.04 }));
  const resumed = (await read(nextId)).data;
  expect(resumed.legacy).toEqual({ inputTokens: 8, outputTokens: 5, costUsd: 0.02, costKind: 'sdk_estimate', incomplete: false });
  expect(resumed.breakdown.cacheReadTokens.value).toBe(50); expect(resumed.breakdown.cacheWriteTokens.value).toBe(30);
  await next.emit({ type: 'completed', outcome: 'failed', error: 'Fixture completion' });
  const unknownId = await task(session); const unknown = await claim(token, unknownId);
  await unknown.emit(sessionEvent(session), usage(session, 'resume-unknown', { baseline: { kind: 'unknown' }, inputTokens: 21, cacheReadTokens: 210 }));
  const unbased = (await read(unknownId)).data;
  expect(unbased.breakdown.cacheReadTokens.value).toBeNull(); expect(unbased.legacy.inputTokens).toBeNull();
  await app.close(); await start();
  expect((await read(firstId)).data).toEqual(original); expect((await read(nextId)).data).toEqual(resumed); expect((await read(unknownId)).data).toEqual(unbased);
  await save('resume-restart', { original, resumed, unbased, restartUnchanged: true });
});

it('separates model streams without inferring roles, preserves missing cache and zero/error unknown values', async () => {
  const id = await task(); const peer = await claim(await runner(), id); const session = randomUUID();
  await peer.emit(sessionEvent(session), usage(session, 'a'), usage(session, 'b', { model: 'another-model', inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.001 }),
    usage(session, 'zero-error', { model: 'unknown', baseline: { kind: 'unknown' }, inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, costUsd: null, costKind: 'unknown' }),
    usage(session, 'missing-cache', { model: 'old-producer', inputTokens: 0, outputTokens: 0, cacheReadTokens: undefined, cacheWriteTokens: undefined, costUsd: 0 }));
  const result = (await read(id)).data;
  expect(result.breakdown.cacheReadTokens).toEqual({ value: null, knownSubtotal: 100, knownSamples: 2, unknownSamples: 2 });
  expect(result.breakdown.uncachedInputTokens).toEqual({ value: null, knownSubtotal: 13, knownSamples: 3, unknownSamples: 1 });
  expect(result.sources.every(source => source.phaseAttribution === 'unavailable' && source.producerVersion === null)).toBe(true);
  expect(result.sources.find(source => source.model === 'old-producer')!.breakdown.outputTokens.value).toBe(0);
  await save('missing-and-zero', result);
});

it('does not promote informational foreign-source usage or silently accept changed IDs and overlap', async () => {
  const id = await task(); const peer = await claim(await runner(), id); const session = randomUUID();
  await peer.emit(sessionEvent(session), usage(session, 'auth'), usage(session, 'foreign', { source: 'codex.thread.tokenUsage', accounting: 'informational', inputTokens: 999999, cacheReadTokens: 777777 }));
  const result = (await read(id)).data;
  expect(result.legacy.inputTokens).toBe(10); expect(result.breakdown.cacheReadTokens.value).toBe(100);
  expect(result.coverage).toMatchObject({ samplesRead: 2, authoritativeRead: 1, informationalRead: 1 });
  expect(result.sources.find(source => source.accounting === 'informational')).toMatchObject({ inputMeaning: 'source-defined', reference: null, breakdown: { uncachedInputTokens: { value: null } } });
  const events = [usage(session, 'auth', { inputTokens: 11 }), usage(session, 'overlap', { cumulative: false })];
  for (const event of events) {
    const response = await http('/api/runner/events', { attemptId: peer.attempt.id, ownerVersion: peer.attempt.ownerVersion,
      events: [{ ...event, id: randomUUID(), sequence: 4 }] }, peer.token);
    expect(response.status).toBe(409);
    expect(response.data.error.code).toBe(event.sampleId === 'auth' ? 'usage_conflict' : 'usage_overlap');
  }
  expect((await read(id)).data).toEqual(result);
});

it('bounds sample work and source output and labels the known prefix instead of claiming a total', async () => {
  const id = await task(); const peer = await claim(await runner(), id); const session = randomUUID();
  await peer.emit(sessionEvent(session));
  for (let start = 0; start < 1001; start += 50) {
    await peer.emit(...Array.from({ length: Math.min(50, 1001 - start) }, (_, i) => usage(session, `bounded-${start + i}`, {
      model: `model-${(start + i) % 40}`, cumulative: false, inputTokens: 1, outputTokens: 1, cacheReadTokens: 2, cacheWriteTokens: 0, costUsd: 0.001,
    })));
  }
  const result = await read(id);
  expect(result.data.legacy.inputTokens).toBe(1001);
  expect(result.data.coverage).toMatchObject({ samplesRead: 1000, authoritativeRead: 1000, hasMore: true, sourcesOmitted: 8 });
  expect(result.data.sources).toHaveLength(32);
  expect(result.data.breakdown.cacheReadTokens).toEqual({ value: null, knownSubtotal: 2000, knownSamples: 1000, unknownSamples: 0 });
  expect(result.data.caveats).toContain('bounded-prefix'); expect(result.bytes).toBeLessThan(48000);
  await save('bounds', { bytes: result.bytes, returnedSources: result.data.sources.length, coverage: result.data.coverage, breakdown: result.data.breakdown });
});

it('keeps zero distinct from missing data and marks unsafe integer totals unknown', async () => {
  const id = await task(); const peer = await claim(await runner(), id); const session = randomUUID();
  await peer.emit(sessionEvent(session), usage(session, 'zero', { cumulative: false, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 }));
  expect((await read(id)).data.breakdown.cacheReadTokens.value).toBe(0);
  await peer.emit(usage(session, 'huge', { cumulative: false, inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 1, cacheReadTokens: Number.MAX_SAFE_INTEGER }),
    usage(session, 'overflow', { cumulative: false, inputTokens: 1, outputTokens: 1, cacheReadTokens: 1 }));
  const result = (await read(id)).data;
  expect(result.legacy.inputTokens).toBeNull();
  expect(result.breakdown.cacheReadTokens).toEqual({ value: null, knownSubtotal: null, knownSamples: 3, unknownSamples: 0 });
});

it('preserves fixture accounting without assigning Claude input semantics to a different source', async () => {
  const id = await task(undefined, 'fixture'); const peer = await claim(await runner('fixture'), id); const session = randomUUID();
  await peer.emit({ type: 'session', nativeSessionId: session, adapterVersion: 'fixture-1' }, usage(session, 'fixture', { source: 'fixture' }));
  const result = (await read(id)).data;
  expect(result.legacy).toEqual({ inputTokens: 10, outputTokens: 4, costUsd: 0.02, costKind: 'sdk_estimate', incomplete: false });
  expect(result.breakdown.uncachedInputTokens.value).toBeNull(); expect(result.breakdown.cacheReadTokens.value).toBeNull();
  expect(result.breakdown.outputTokens.value).toBe(4);
  expect(result.sources[0]).toMatchObject({ source: 'fixture', inputMeaning: 'source-defined', reference: null });
});
