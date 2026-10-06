import { afterAll, beforeAll, expect, test } from 'vitest';
import { TaskReadFixture } from '../../../experiments/bounded-reads/task-projections/fixture.js';
import { eventPage } from './queries.js';
import { list, loadTask } from './tasks.js';
import { transaction } from './database.js';

const fixture = new TaskReadFixture();
const legalPrompt = '界🙂'.repeat(5333); // 15,999 UTF-16 code units: within the real public POST contract.
let primaryId = '';
beforeAll(async () => {
  await fixture.start(); fixture.accountTask(legalPrompt);
  const accepted = await fixture.http('/api/tasks', { title: 'Public Unicode prompt', prompt: legalPrompt, harness: 'fixture' });
  expect(accepted.status).toBe(202); primaryId = accepted.data.task.id;
}, 20_000);
afterAll(() => fixture.close(), 15_000);

test('event reads keep public output while omitting a legal long prompt from decoded PG rows', async () => {
  const baseline = await fixture.sample('public-prompt:old-full-task-row', () => transaction(fixture.pool, client => loadTask(client, primaryId), true));
  const current = await fixture.sample('public-prompt:event-page', () => eventPage(fixture.pool, primaryId, 0));
  expect(current.value.task).toEqual({ id: primaryId, title: 'Public Unicode prompt', harness: 'fixture', status: 'queued', verificationStatus: 'pending', createdAt: baseline.value.created_at.toISOString(), updatedAt: baseline.value.updated_at.toISOString() });
  expect(current.value).toMatchObject({ entries: [], nextCursor: 0, watermark: 0, hasMore: false, pendingDecision: null });
  expect(baseline.measurement.taskFields).toContain('submission');
  expect(current.measurement.taskFields).not.toContain('submission');
  expect(current.measurement.taskRowJsonBytes).toBeLessThan(baseline.measurement.taskRowJsonBytes - Buffer.byteLength(legalPrompt));
  expect(current.measurement.selectCalls).toBe(2);
});

test('list reads omit the legal long prompt without adding a query', async () => {
  const current = await fixture.sample('public-prompt:task-list', () => list(fixture.pool, 1));
  expect(current.value.tasks).toHaveLength(1);
  expect(current.value.tasks[0]).toMatchObject({ id: primaryId, title: 'Public Unicode prompt', harness: 'fixture' });
  expect(current.value.nextCursor).toBeNull();
  expect(current.measurement.taskFields).not.toContain('submission');
  expect(current.measurement.taskRowJsonBytes).toBeLessThan(1024);
  expect(current.measurement.queryCalls).toBe(1);
});
