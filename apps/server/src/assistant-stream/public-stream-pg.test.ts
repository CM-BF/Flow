import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { AssistantStreamData, HarnessContext, RunnerEventData } from '../../../../packages/contracts/src/index.js';
import type { CodexExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';
import { assistantStreamIdentity } from '../../../../packages/contracts/src/assistant-stream.js';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { ContinuityCenterFixture } from '../../../../docs/evidence/mature02c02/pg-fixture.js';
import { publicStreamTransport } from '../../../../docs/evidence/mature02c02/public-stream-transport.js';
import { createCodexAdapter } from '../../../runner/src/native-harness/codex/adapter.js';
import { CodexAssistantStream } from '../../../runner/src/native-harness/codex/stream.js';
import { canonical, sha256 } from '../database.js';

// Explicit PG window only. Real task/report/read HTTP and PostgreSQL; injected native transport is not Codex execution.
const center = new ContinuityCenterFixture();
const profile: CodexExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'fixture-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
  hostLimits: { wallTimeMs: 5000, maxOutputBytes: 16384 } };
const check = (name: string, body: () => Promise<void>) => it(name, () => center.preserve(name, body));
beforeAll(() => center.preserve('setup', () => center.start()));
beforeEach(() => center.preserve('case-isolation', async () => { await center.pool.query('UPDATE flow.runners SET revoked=true'); }));
afterAll(() => center.close());
async function assigned() {
  const registration = await center.owner.registerRunner({ name: 'Public stream fixture', harnesses: ['codex'], capacity: 1 });
  const client = new FlowClient({ baseUrl: center.baseUrl, token: registration.token });
  const publication = await client.publishNativeExecutionProfile({ configuration: profile });
  const accepted = await center.owner.submit({ title: 'Public stream', prompt: 'Bounded fixture', harness: 'codex', executionProfile: publication.profile.reference }, randomUUID());
  await center.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [accepted.task.id]);
  const assignment = (await client.claim()).assignment!;
  expect(assignment.task.id).toBe(accepted.task.id);
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  let sequence = 0, reports = 0;
  const seal = (data: RunnerEventData) => ({ ...data, id: randomUUID(), sequence: sequence + 1 });
  async function emit(data: RunnerEventData) {
    const event = seal(data); reports++;
    const ack = await client.report({ ...ownership, events: [event] });
    expect(ack.lastSequence).toBe(event.sequence); sequence = event.sequence;
  }
  return { ...registration, client, assignment, ownership, emit, seal, reports: () => reports };
}
type Assigned = Awaited<ReturnType<typeof assigned>>;
const metadata = (a: Assigned, headers?: Record<string, string>, suffix = '') => center.json(`/api/tasks/${a.assignment.task.id}/assistant-stream${suffix}`, { headers });
const v2 = { 'X-Flow-Assistant-Stream': 'patch-v2' };
function patch(threadId: string, text = '正文🙂'): AssistantStreamData {
  return new CodexAssistantStream().accept({ kind: 'text', threadId, turnId: 'turn', itemId: 'item', index: null, delta: text })[0]!;
}
async function bind(a: Assigned, threadId: string) { await a.emit({ type: 'session', nativeSessionId: threadId, adapterVersion: profile.adapterVersion }); }
async function noFinal(a: Assigned) {
  expect((await center.pool.query('SELECT count(*)::int AS n FROM flow.assistant_messages WHERE attempt_id=$1', [a.ownership.attemptId])).rows[0].n).toBe(0);
  expect((await metadata(a, v2)).value.finalMessageId).toBeNull();
}
function startAdapter(a: Assigned, fragments: 32 | 512) {
  const fixture = publicStreamTransport(fragments), stop = new AbortController();
  center.releases.push(fixture.release);
  const context: HarnessContext = { task: a.assignment.task, workingDirectory: center.ownRoot(), signal: stop.signal,
    async assertOwnership() { stop.signal.throwIfAborted(); const ack = await a.client.heartbeat(a.ownership); if (ack.action !== 'continue') throw Error('Ownership no longer permits output.'); },
    emit: a.emit, async waitForDecision() { throw Error('No fixture decision.'); } };
  // Direct production adapter + real HTTP; the prior continuity suite separately covers runRunner/outbox.
  const outcome = createCodexAdapter(profile, fixture.factory).run(context).then(() => ({ ok: true as const }), error => ({ ok: false as const, error }));
  center.runners.push({ stop, done: outcome.then(() => undefined) });
  return { fixture, stop, outcome };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Fixture progress deadline.')), 3000); })]); }
  finally { clearTimeout(timer); }
}
for (const fragments of [32, 512] as const) check(`persists ${fragments} fragments through real HTTP with separate channels, observer disconnect and matching final`, async () => {
  const a = await assigned(), running = startAdapter(a, fragments);
  try {
    await bounded(running.fixture.deltasDelivered);
    let page: Awaited<ReturnType<typeof metadata>> | undefined;
    for (let poll = 0; poll < 20; poll++) {
      page = await metadata(a, v2);
      if (page.value.blocks.some((b: { channel?: string; bytes: number }) => b.channel === 'text' && b.bytes === Buffer.byteLength(running.fixture.text))) break;
      await sleep(25);
    }
    expect(page!.status).toBe(200);
    const blocks = page!.value.blocks as { id: string; channel: string; bytes: number; prefixDigest: string; status: string }[];
    expect(blocks).toHaveLength(3);
    expect(blocks.find(b => b.channel === 'text')).toMatchObject({ bytes: Buffer.byteLength(running.fixture.text), prefixDigest: sha256(running.fixture.text), status: 'streaming' });
    expect(new Set(blocks.map(b => b.channel))).toEqual(new Set(['text', 'reasoning-summary', 'reasoning-text']));
    const observer = new AbortController(); const stream = center.owner.watch(a.assignment.task.id, 0, AbortSignal.any([observer.signal, AbortSignal.timeout(2000)]));
    try { expect((await stream.next()).done).toBe(false); } finally { observer.abort(); await stream.return(undefined); }
    expect(running.stop.signal.aborted).toBe(false); expect(running.fixture.state.closed).toBe(false);
    running.fixture.release(); expect(await bounded(running.outcome)).toEqual({ ok: true });
    await a.emit({ type: 'completed', outcome: 'succeeded' });
    const reader = center.readClient('patch-v2');
    const persisted = await reader.assistantStream(a.assignment.task.id);
    const text = persisted.blocks.find(b => b.channel === 'text')!;
    expect(persisted.settlement).toMatchObject({ replaceStreamIds: [text.id], retainStreamIds: expect.arrayContaining(blocks.filter(b => b.channel !== 'text').map(b => b.id)) });
    for (const block of persisted.blocks) {
      const body = await reader.assistantStreamBlock(a.assignment.task.id, block.id);
      const expected = block.channel === 'text' ? running.fixture.text : block.channel === 'reasoning-summary' ? running.fixture.summary : running.fixture.reasoning;
      expect(body.content).toBe(expected); expect(body.prefixDigest).toBe(sha256(expected));
    }
    const final = (await center.pool.query('SELECT content_digest,native_source_identity,settings FROM flow.assistant_messages WHERE attempt_id=$1', [a.ownership.attemptId])).rows[0];
    expect(final).toMatchObject({ content_digest: sha256(running.fixture.text), native_source_identity: { turnId: running.fixture.turnId, itemId: running.fixture.itemId }, settings: { actualExecution: { model: null, evidence: 'unknown' } } });
    const count = Number((await center.pool.query('SELECT count(*) FROM flow.assistant_stream_patches WHERE attempt_id=$1', [a.ownership.attemptId])).rows[0].count);
    expect(count).toBeLessThanOrEqual(12); expect(a.reports()).toBeLessThanOrEqual(18);
    const observed = (center.facts.fragmentSamples ??= []) as unknown[];
    observed.push({ fragments, durablePatches: count, actualReportRequests: a.reports(), utf8Bytes: Buffer.byteLength(running.fixture.text), digest: final.content_digest, observerDisconnected: true });
    expect(running.fixture.state).toMatchObject({ closed: true, receiving: 0, peakReceiving: 1, factories: 1 });
  } finally { running.fixture.release(); running.stop.abort(); await running.outcome; }
});
check('rejects unbound or foreign session/source/turn and stale attempt before durable writes', async () => {
  const a = await assigned(), thread = randomUUID(), data = patch(thread);
  const rejected = (value: RunnerEventData, code: string, ownership = a.ownership) => expect(a.client.report({ ...ownership, events: [a.seal(value)] })).rejects.toMatchObject({ status: 409, code });
  await rejected(data, 'stream_session'); await bind(a, thread);
  await rejected({ ...data, nativeSessionId: randomUUID() }, 'stream_session');
  await rejected({ ...data, nativeTurnId: 'foreign-turn' }, 'stream_identity');
  const { nativeTurnId: _turn, channel: _channel, ...plain } = data;
  await rejected({ ...plain, source: 'claude.sdk.stream' }, 'stream_session');
  await rejected(data, 'stale_owner', { ...a.ownership, ownerVersion: a.ownership.ownerVersion + 1 });
  expect((await center.pool.query('SELECT count(*)::int AS n FROM flow.assistant_stream_patches WHERE attempt_id=$1', [a.ownership.attemptId])).rows[0].n).toBe(0);
  await a.emit(data); await noFinal(a);
});
check('filters mixed historical metadata and patches before LIMIT for legacy/invalid readers and denies hidden direct blocks', async () => {
  const a = await assigned(), thread = randomUUID(), codex = patch(thread); await bind(a, thread); await a.emit(codex);
  // Deliberately stored historical rows exercise defensive reader SQL. The previous case proves producers cannot mix harness sources.
  const legacyIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const { nativeTurnId: _turn, channel: _channel, ...plain } = patch(thread, `legacy-${i}`);
    const data: AssistantStreamData = { ...plain, source: 'claude.sdk.stream', nativeMessageId: `legacy-${i}` };
    data.streamId = sha256(assistantStreamIdentity(data)); const sequence = 3 + i; legacyIds.push(data.streamId);
    const { type: _type, text: _text, fromBytes: _from, ...header } = data;
    await center.pool.query('INSERT INTO flow.assistant_stream_blocks(id,task_id,attempt_id,first_sequence,last_sequence,revision,bytes,header) VALUES($1,$2,$3,$4,$4,1,$5,$6)', [data.streamId, a.assignment.task.id, a.ownership.attemptId, sequence, Buffer.byteLength(data.text), header]);
    await center.pool.query('INSERT INTO flow.assistant_stream_patches(stream_id,revision,task_id,attempt_id,event_id,sequence,data,payload_digest) VALUES($1,1,$2,$3,$4,$5,$6,$7)', [data.streamId, a.assignment.task.id, a.ownership.attemptId, randomUUID(), sequence, data, sha256(canonical(data))]);
  }
  for (const headers of [undefined, { 'X-Flow-Assistant-Stream': 'patch-v1' }, { 'X-Flow-Assistant-Stream': 'unknown' }, { 'X-Flow-Assistant-Stream': 'patch-v2, patch-v2' }]) {
    const first = await metadata(a, headers, '?limit=1'); expect(first.status).toBe(200); expect(first.value.blocks.map((b: { id: string }) => b.id)).toEqual([legacyIds[0]]); expect(first.value.nextCursor).toBe(legacyIds[0]);
    const next = await metadata(a, headers, `?limit=1&after=${legacyIds[0]}`); expect(next.value.blocks.map((b: { id: string }) => b.id)).toEqual([legacyIds[1]]); expect(next.value.nextCursor).toBeNull();
    expect((await metadata(a, headers, `/${codex.streamId}`)).status).toBe(404);
    expect((await metadata(a, headers, `?after=${codex.streamId}`)).status).toBe(400);
    const patches = await metadata(a, headers, `/patches?attemptId=${a.ownership.attemptId}&limit=1`);
    expect(patches.value.patches.map((p: AssistantStreamData) => p.streamId)).toEqual([legacyIds[0]]); expect(patches.value.hasMore).toBe(true);
  }
  const first = await metadata(a, v2, '?limit=1'); expect(first.value.blocks[0].id).toBe(codex.streamId); expect(first.value.nextCursor).toBe(codex.streamId);
  expect((await metadata(a, v2, `/${codex.streamId}`)).value.content).toBe(codex.text);
});
check('replays an ACK-lost immutable event without duplicating its prefix or fabricating a final', async () => {
  const a = await assigned(), thread = randomUUID(); await bind(a, thread);
  const event = a.seal(patch(thread)); const batch = { ...a.ownership, events: [event] };
  // The caller deliberately discards the first successful HTTP ACK; the identical sealed event is then retried.
  await a.client.report(batch);
  expect(await a.client.report(batch)).toEqual({ accepted: 0, lastSequence: event.sequence });
  await expect(a.client.report({ ...batch, events: [{ ...event, text: 'changed' }] })).rejects.toMatchObject({ status: 409, code: 'event_conflict' });
  const rows = (await center.pool.query('SELECT data FROM flow.assistant_stream_patches WHERE attempt_id=$1', [a.ownership.attemptId])).rows;
  expect(rows).toHaveLength(1); expect(rows[0].data.text).toBe('正文🙂'); await noFinal(a);
});
check('keeps interrupted prefixes without a final after public cancellation or runner revocation', async () => {
  const observations = [];
  for (const cause of ['cancel', 'revoke'] as const) {
    const a = await assigned(), running = startAdapter(a, 32);
    try {
      await bounded(running.fixture.deltasDelivered);
      if (cause === 'cancel') {
        await center.owner.cancel(a.assignment.task.id, randomUUID()); expect((await a.client.heartbeat(a.ownership)).action).toBe('cancel'); running.stop.abort();
      } else await center.owner.revokeRunner(a.runnerId);
      running.fixture.release(); const outcome = await bounded(running.outcome);
      expect(outcome).toMatchObject({ ok: false, error: { settlement: 'unknown' } });
      await noFinal(a); expect(running.fixture.state).toMatchObject({ closed: true, receiving: 0 });
      const page = await metadata(a, v2); expect(page.value.settlement).toBeNull(); expect(page.value.blocks.length).toBeGreaterThan(0);
      observations.push({ cause, finalAbsent: true, injectedPortClosed: running.fixture.state.closed });
    } finally { running.fixture.release(); running.stop.abort(); await running.outcome; }
  }
  center.facts.interruptions = observations;
});
