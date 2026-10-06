import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import type { AssistantMessage, AssistantMessagePage } from '@flow/contracts';
import type { CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { createServer } from '../../../../server/src/index.js';
import { expireLeases } from '../../../../server/src/runners.js';
import { createCodexTransport } from '../../codex/index.js';
import type { CodexTransport } from '../../codex/types.js';
import { guardExecutionProfile, publishNativeExecutionProfile } from '../../execution-profiles.js';
import { runRunner, type RunnerNotice } from '../../runtime.js';
import { textDigest } from '../../verifier.js';
import { configureCodexHarness } from './index.js';

const database = `flow_r05c_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const fixture = fileURLToPath(new URL('./peer.mjs', import.meta.url));
const cleanup: (() => Promise<unknown>)[] = [];
let pool: Pool, app: Awaited<ReturnType<typeof createServer>>, owner: FlowClient, baseUrl: string, created = false;
const facts = { database, nativeProviderCalls: 0, appServerStarts: 0, nativeAuthRequests: 0, databaseRemoved: false,
  samples: [] as { scenario: string; processes: number; peakInboundBytes: number; peakOutboundBytes: number; childClosed: boolean }[] };
async function eventually(condition: () => Promise<boolean> | boolean) {
  const until = Date.now() + 5000;
  while (!await condition()) { if (Date.now() > until) throw new Error('Expected R05C behavior did not occur.'); await new Promise(resolve => setTimeout(resolve, 10)); }
}
beforeAll(async () => {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) throw new Error('Refusing existing database.');
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 2, statement_timeout: 5000 });
  app = await createServer({ databaseUrl, ownerToken: 'r05c-test-owner', leaseMs: 300000, automaticQueueScan: false });
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  owner = new FlowClient({ baseUrl, token: 'r05c-test-owner' });
});
afterEach(async () => { for (const stop of cleanup.splice(0).reverse()) await stop(); });
afterAll(async () => {
  try {
    app?.server.closeAllConnections(); await app?.close(); await pool?.end();
    if (created) {
      await eventually(async () => (await admin.query('SELECT 1 FROM pg_stat_activity WHERE datname=$1', [database])).rowCount === 0);
      await admin.query(`DROP DATABASE ${database}`);
    }
    facts.databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount;
    expect(facts.databaseRemoved).toBe(true);
  } finally {
    await admin.end();
    if (process.env.FLOW_R05C_EVIDENCE) await writeFile(process.env.FLOW_R05C_EVIDENCE, JSON.stringify(facts, null, 2) + '\n');
  }
});
async function get<T>(path: string): Promise<T> {
  const response = await fetch(baseUrl + path, { headers: { authorization: 'Bearer r05c-test-owner' }, signal: AbortSignal.timeout(2000) });
  expect(response.status).toBe(200); return response.json() as Promise<T>;
}

async function execution(mode: string, revokeAfterThread = false) {
  const identity = await owner.registerRunner({ name: `R05C ${mode}`, harnesses: ['codex'], capacity: 1 });
  const directory = await mkdtemp(join(tmpdir(), 'flow-r05c-pg-'));
  const children: CodexTransport[] = [], notices: RunnerNotice[] = [], executions: { controller: AbortController; promise: Promise<void> }[] = [];
  cleanup.push(async () => {
    for (const run of executions) run.controller.abort();
    await Promise.allSettled(executions.map(run => run.promise));
    for (const child of children) expect((await child.close()).child).toBe('confirmed-exited');
    facts.samples.push({ scenario: mode, processes: children.length, peakInboundBytes: Math.max(0, ...children.map(child => child.snapshot().peakInboundBytes)),
      peakOutboundBytes: Math.max(0, ...children.map(child => child.snapshot().peakOutboundBytes)), childClosed: children.every(child => child.snapshot().state === 'closed') });
    await rm(directory, { recursive: true, force: true });
  });
  const configuration: CodexExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model',
    reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
    hostLimits: { wallTimeMs: 3000, maxOutputBytes: 1024 } };
  const configured = configureCodexHarness({ publicProfile: configuration, createTransport(options) {
    const port = createCodexTransport({ spawn: { executable: process.execPath, args: [fixture, mode], cwd: options.workingDirectory, environment: { LANG: 'C' } },
      initialize: { clientInfo: { name: 'r05c-pg-test', title: null, version: '1' }, capabilities: null }, signal: options.signal,
      limits: { requestTimeoutMs: 1000, initializeTimeoutMs: 1000, terminateMs: 100, killMs: 100 } });
    children.push(port);
    return { ...port, async request(method, params, requestOptions) {
      const result = await port.request(method, params, requestOptions);
      if (revokeAfterThread && method === 'thread/start') await owner.revokeRunner(identity.runnerId);
      return result;
    } };
  } });
  const reference = await publishNativeExecutionProfile({ baseUrl, token: identity.token, configuration: configured.descriptor.publicProfile });
  const adapter = guardExecutionProfile(configured.adapter, reference, configured.descriptor.publicProfile);
  const submitted = await owner.submit({ title: 'R05C injected native task', prompt: 'Produce synthetic ordinary final', harness: 'codex', executionProfile: reference,
    verification: { kind: 'contains', expected: '中文🙂' } }, randomUUID());
  function start() {
    const controller = new AbortController();
    const promise = runRunner({ baseUrl, token: identity.token, workingDirectory: directory, adapters: [adapter], signal: controller.signal,
      pollIntervalMs: 10, heartbeatIntervalMs: 40, requestTimeoutMs: 1500, onNotice: notice => notices.push(notice) });
    void promise.catch(() => undefined); const run = { controller, promise }; executions.push(run); return run;
  }
  return { taskId: submitted.task.id, reference, children, notices, directory, start, identity,
    async admission() { return JSON.parse(await readFile(join(directory, textDigest(baseUrl), 'admission.json'), 'utf8')); } };
}

it('runs the real JSONL transport through public profile/task APIs, host claim/outbox and PG final verification', async () => {
  const api = await execution('success'), run = api.start();
  await eventually(async () => (await owner.show(api.taskId)).status === 'succeeded');
  await eventually(async () => (await api.admission()).assignments.length === 0);
  run.controller.abort(); await run.promise;
  const task = await owner.show(api.taskId);
  expect(task).toMatchObject({ status: 'succeeded', verificationStatus: 'passed', usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: 'unknown', incomplete: true } });
  const page = await get<AssistantMessagePage>(`/api/tasks/${api.taskId}/assistant-messages`);
  expect(page.messages).toHaveLength(1); expect(page.messages[0]).not.toHaveProperty('content');
  const final = await get<AssistantMessage>(`/api/assistant-messages/${page.messages[0]!.id}`);
  expect(final.source).toBe('codex.app-server.agent-message');
  if (final.source !== 'codex.app-server.agent-message') throw new Error('Unexpected final source.');
  expect(final.content).toBe('Native peer result 中文🙂');
  expect(final.sourceMessageId).toBe(textDigest(JSON.stringify([final.nativeSourceIdentity.turnId, final.nativeSourceIdentity.itemId])));
  expect(final.id).toBe(textDigest(JSON.stringify([final.source, final.nativeSessionId, final.sourceMessageId])));
  expect(final.settings).toMatchObject({ requested: { serviceTierForTurn: 'default', access: 'none' }, actualExecution: { evidence: 'unknown', tools: null } });
  expect((await api.admission()).assignments).toEqual([]);
  const events = (await pool.query('SELECT e.sequence FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=$1 ORDER BY e.sequence', [api.taskId])).rows;
  expect(events.map(event => event.sequence)).toEqual([1, 2, 3, 4, 5]); expect(final.sequence).toBe(2);
  const details = (await pool.query("SELECT d.kind,d.content FROM flow.details d JOIN flow.timeline t ON d.id=(t.entry->'reference'->>'id') WHERE d.task_id=$1 ORDER BY t.cursor", [api.taskId])).rows;
  expect(details.map(detail => detail.kind)).toEqual(['session', 'detail', 'artifact', 'verification']);
  expect(details.find(detail => detail.kind === 'artifact')!.content).toBe(final.content);
  expect((await owner.reconciliation(api.taskId)).reservationHeld).toBe(false);
  expect(api.children).toHaveLength(1);
});

it.each(['deny:item/commandExecution/requestApproval', 'terminal-tool:mcpToolCall', 'eof'])('retains %s as uncertain in PG and across host restart without a final or another native process', async mode => {
  const api = await execution(mode), run = api.start();
  await eventually(() => api.notices.some(notice => notice.type === 'admission-blocked'));
  await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE task_id=$1", [api.taskId]);
  await expireLeases(pool);
  expect((await owner.show(api.taskId)).status).toBe('uncertain');
  expect((await owner.reconciliation(api.taskId)).reservationHeld).toBe(true);
  expect((await get<AssistantMessagePage>(`/api/tasks/${api.taskId}/assistant-messages`)).messages).toEqual([]);
  expect((await api.admission()).assignments).toHaveLength(1);
  run.controller.abort(); await run.promise;
  const count = api.notices.length, restarted = api.start();
  await eventually(() => api.notices.slice(count).some(notice => notice.type === 'admission-blocked'));
  restarted.controller.abort(); await restarted.promise;
  expect(api.children).toHaveLength(1);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=$1', [api.taskId])).rows[0].n).toBe(0);
});

it('publishes no final after public runner revocation invalidates ownership between native requests', async () => {
  const api = await execution('success', true), run = api.start();
  await expect(run.promise).rejects.toMatchObject({ status: 401 });
  expect((await get<AssistantMessagePage>(`/api/tasks/${api.taskId}/assistant-messages`)).messages).toEqual([]);
  expect((await api.admission()).assignments).toHaveLength(1);
  expect(api.children).toHaveLength(1);
});
