import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { taskSubmissionSchema } from '@flow/contracts';
import { FlowClient } from './index.js';
import { createServer } from '../../../apps/server/src/index.js';
import { mapNativeActivity } from '../../../apps/runner/src/native-activity/index.js';
import type { ClaudeQuery } from '../../../apps/runner/src/claude.js';

type SDKMessage = ReturnType<ClaudeQuery> extends AsyncIterable<infer Message> ? Message : never;
const name = `flow_f01_activity_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const facts: Record<string, unknown> = { database: name, startedAt: new Date().toISOString(), modelQueries: 0 };
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let owner: FlowClient;
let created = false;
async function start() {
  // Production factory only: no activity migration, module route or scan injection.
  app = await createServer({ databaseUrl, ownerToken: 'f01-activity-owner', leaseMs: 300_000 });
  owner = new FlowClient({ baseUrl: await app.listen({ host: '127.0.0.1', port: 0 }), token: 'f01-activity-owner' });
}
beforeAll(async () => {
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
  if ((facts.before as unknown[]).length) throw new Error('Refuse pre-existing activity database');
  await admin.query(`CREATE DATABASE ${name}`); created = true; await start();
});
afterAll(async () => {
  try {
    await app?.close(); await pool.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    facts.created = created;
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
    facts.endedAt = new Date().toISOString();
    const path = process.env.FLOW_F01_ACTIVITY_EVIDENCE;
    if (path) await writeFile(path, JSON.stringify(facts, null, 2));
  } finally { await admin.end(); }
});

it('mounts 020 before serving and exposes durable light activity and explicit owner details across restart', async () => {
  expect(app!.hasRoute({ method: 'GET', url: '/api/native-activities/:id' })).toBe(true);
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=20')).rowCount).toBe(1);
  const registration = await owner.registerRunner({ name: 'Activity integration fixture', harnesses: ['claude'], capacity: 1 });
  const runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: registration.token });
  const accepted = await owner.submit(taskSubmissionSchema.parse({ title: 'Typed activity', prompt: 'Synthetic activity only', harness: 'claude' }), randomUUID());
  let assignment: Awaited<ReturnType<FlowClient['claim']>>['assignment'];
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment?.task.id; }, { timeout: 5000 }).toBe(accepted.task.id);
  const session = randomUUID();
  const activity = mapNativeActivity({ type: 'assistant', uuid: randomUUID(), session_id: session, parent_tool_use_id: null, message: { id: randomUUID(), content: [{ type: 'tool_use', id: 'read-material', name: 'Read', input: { path: 'PRIVATE_中文😀' } }] } } as SDKMessage, session)[0]!;
  const event = { ...activity, id: randomUUID(), sequence: 2 };
  const batch = { attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion, events: [
    { id: randomUUID(), sequence: 1, type: 'session' as const, nativeSessionId: session, adapterVersion: 'claude-sdk-0.3.290-v2' }, event,
  ] };
  await runner.report(batch);
  expect(await runner.report(batch)).toMatchObject({ accepted: 0, lastSequence: 2 });
  const page = await owner.nativeActivities(accepted.task.id, { limit: 1 });
  expect(page.activities).toHaveLength(1);
  expect(page.activities[0]).toMatchObject({ attemptId: assignment!.attempt.id, kind: 'tool', phase: 'input-ready', status: 'input-ready' });
  expect(JSON.stringify(page)).not.toContain('PRIVATE_');
  const detail = await owner.nativeActivity(event.activityId);
  expect(detail.body?.content).toContain('PRIVATE_中文😀');
  await expect(runner.nativeActivity(event.activityId)).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
  expect((await fetch(`${app!.listeningOrigin}/api/native-activities/${event.activityId}`)).status).toBe(401);
  await runner.report({ ...batch, events: [{ id: randomUUID(), sequence: 3, type: 'completed', outcome: 'cancelled' }] });
  await app!.close(); app = undefined; await start();
  expect(await owner.nativeActivity(event.activityId)).toMatchObject({ id: event.activityId, status: 'unknown', body: detail.body });
  expect((await owner.nativeActivities(accepted.task.id)).activities).toHaveLength(1);
  facts.activity = { taskId: accepted.task.id, attemptId: assignment!.attempt.id, activityId: event.activityId, privateBodyNotInList: true, restartPreserved: true, cancelledToolState: 'unknown' };
});
