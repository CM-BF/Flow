import { afterAll, beforeAll, expect, test } from 'vitest';
import { TaskReadFixture } from '../../../../experiments/bounded-reads/task-projections/fixture.js';
import { assistantStreams } from './queries.js';
import { loadTask } from '../tasks.js';
import { transaction } from '../database.js';

const fixture = new TaskReadFixture();
const prompt = '界🙂'.repeat(5333);
let taskId = '';
beforeAll(async () => {
  await fixture.start(); fixture.accountTask(prompt);
  const accepted = await fixture.http('/api/tasks', { title: 'Assistant head Unicode', prompt, harness: 'claude' });
  expect(accepted.status).toBe(202); taskId = accepted.data.task.id;
}, 20_000);
afterAll(() => fixture.close(), 15_000);

test('reads an unclaimed task without decoding its legal public prompt', async () => {
  const old = await fixture.sample('head:old-full-task', () => transaction(fixture.pool, client => loadTask(client, taskId), true));
  const current = await fixture.sample('head:unclaimed', () => assistantStreams(fixture.pool, taskId, 1));
  expect(current.value).toEqual({ taskId, attemptId: null, taskStatus: 'queued', taskUpdatedAt: old.value.updated_at.toISOString(), blocks: [], nextCursor: null, finalMessageId: null, settlement: null });
  expect(current.measurement.taskFields).toEqual(['current_attempt_id', 'status', 'updated_at']);
  expect(current.measurement.selectCalls).toBe(1);
  expect(current.measurement.taskRowJsonBytes).toBeLessThan(old.measurement.taskRowJsonBytes - Buffer.byteLength(prompt));
  const http = await fixture.http(`/api/tasks/${taskId}/assistant-stream?limit=1`);
  expect(http.status).toBe(200); expect(http.data).toEqual(current.value);
});
