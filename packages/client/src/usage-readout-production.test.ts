import { randomUUID } from 'node:crypto';
import { statfs, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { taskSubmissionSchema, type ClaimedTask, type EventBatch } from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

const database = `flow_f01_usage_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const ownerToken = 'isolated-usage-production-owner';
const facts: Record<string, unknown> = { database, startedAt: new Date().toISOString(), providerCalls: 0 };
let created = false;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
async function start() {
  app = await createServer({ databaseUrl, ownerToken, leaseMs: 300_000 });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  return { address, owner: new FlowClient({ baseUrl: address, token: ownerToken }) };
}
beforeAll(async () => {
  const space = await statfs(process.cwd());
  facts.availableBeforeBytes = space.bavail * space.bsize;
  if (Number(facts.availableBeforeBytes) < 1024 ** 3 + 96 * 1024 ** 2) throw new Error('Preserve shared completion reserve');
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  if ((facts.before as unknown[]).length) throw new Error('Refuse pre-existing database');
  await admin.query(`CREATE DATABASE ${database}`); created = true;
});
afterAll(async () => {
  try {
    await app?.close();
    facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
    if ((facts.connections as unknown[]).length) throw new Error('Owned connections remain');
    if (created) await admin.query(`DROP DATABASE ${database}`);
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  } finally {
    facts.created = created; facts.finishedAt = new Date().toISOString();
    await admin.end();
    const space = await statfs(process.cwd()); facts.availableAfterBytes = space.bavail * space.bsize;
    if (process.env.FLOW_USAGE_PRODUCTION_FACTS) await writeFile(process.env.FLOW_USAGE_PRODUCTION_FACTS, JSON.stringify(facts, null, 2) + '\n');
  }
});

it('mounts the owner-only readout through the real factory and shared client, with durable replay and unchanged legacy totals', async () => {
  const { address, owner } = await start();
  const accepted = await owner.submit(taskSubmissionSchema.parse({ title: 'Readout wiring', prompt: 'PRIVATE_USAGE_PROMPT', harness: 'claude' }), randomUUID());
  const registration = await owner.registerRunner({ name: 'Synthetic usage publisher', harnesses: ['claude'], capacity: 1 });
  const runner = new FlowClient({ baseUrl: address, token: registration.token });
  let claimed: ClaimedTask | null = null;
  await expect.poll(async () => { claimed = (await runner.claim()).assignment; return claimed?.task.id; }).toBe(accepted.task.id);
  const session = randomUUID();
  const batch: EventBatch = { attemptId: claimed!.attempt.id, ownerVersion: claimed!.attempt.ownerVersion, events: [
    { id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: session, adapterVersion: 'claude-sdk-0.3.290-v2', resources: [] },
    { id: randomUUID(), sequence: 2, type: 'usage', source: 'claude.modelUsage', scope: 'session', scopeId: session, model: 'synthetic-source', sampleId: 'first', cumulative: true,
      baseline: { kind: 'new-session' }, accounting: 'authoritative', inputTokens: 4, outputTokens: 142, cacheReadTokens: 1769, cacheWriteTokens: 1983, costUsd: 0.01, costKind: 'sdk_estimate' },
  ] };
  await runner.report(batch);
  const first = await owner.taskUsage(accepted.task.id);
  expect(first.legacy).toEqual((await owner.show(accepted.task.id)).usage);
  expect(first.breakdown).toMatchObject({ uncachedInputTokens: { value: 4 }, cacheReadTokens: { value: 1769 }, cacheWriteTokens: { value: 1983 }, outputTokens: { value: 142 }, sdkEstimateUsd: { value: 0.01 }, providerActualUsd: { value: null } });
  expect(first.sources[0]).toMatchObject({ producerVersion: null, coverage: 'unverified', phaseAttribution: 'unavailable' });
  expect(JSON.stringify(first)).not.toContain('PRIVATE_USAGE_PROMPT');
  await runner.report(batch);
  expect(await owner.taskUsage(accepted.task.id)).toEqual(first);
  await expect(runner.taskUsage(accepted.task.id)).rejects.toMatchObject({ status: 403 });
  const path = `/api/tasks/${accepted.task.id}/usage-readout`;
  expect((await fetch(address + path)).status).toBe(401);
  const raw = await fetch(address + path, { headers: { authorization: `Bearer ${ownerToken}` } });
  expect(raw.headers.get('cache-control')).toBe('no-store');
  expect(await raw.json()).toEqual(first);
  await expect(owner.taskUsage('missing')).rejects.toMatchObject({ status: 404 });
  await runner.report({ attemptId: batch.attemptId, ownerVersion: batch.ownerVersion, events: [{ id: randomUUID(), sequence: 3, type: 'completed', outcome: 'failed', error: 'Synthetic usage-only task closed' }] });
  await app!.close(); app = undefined;
  const restarted = await start();
  expect(await restarted.owner.taskUsage(accepted.task.id)).toEqual(first);
  facts.readout = first; facts.taskId = accepted.task.id; facts.attemptId = batch.attemptId;
  facts.replayUnchanged = true; facts.restartUnchanged = true; facts.legacyUnchanged = true;
  facts.defaultFactoryRoute = true; facts.auth = { missing: 401, runner: 403 }; facts.responseBytes = Buffer.byteLength(JSON.stringify(first));
});
