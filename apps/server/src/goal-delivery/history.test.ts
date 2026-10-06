import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { publicGoalFixture, goalInput, save } from './test-support.js';
const f = publicGoalFixture('history');
const read = (goalId: string, query: string) => f.http(`/api/goals/${goalId}/delivery?${query}`);
it('pages immutable explanation references beyond 50 while sibling activity leaves the fixed page and body stable', async () => {
  const s = await f.setup(); const [a, b] = s.nodes; const c = f.client();
  for (let version = 1; version <= 54; version++) await c.commandGoal(s.goalId, { kind: 'define-input', nodeId: b, expectedInputVersion: version, input: goalInput(`B version ${version + 1}`), reason: `PRIVATE_HISTORY_TEXT_${version}` }, randomUUID());
  const first = await read(s.goalId, 'view=explanations&limit=20'); expect(first.status).toBe(200);
  expect(first.cache).toBe('no-store'); expect(first.body.throughVersion).toBe(57);
  expect(JSON.stringify(first.body)).not.toMatch(/PRIVATE_HISTORY_TEXT|PRIVATE_MATERIAL|"text"/);
  const old = await read(s.goalId, 'view=explanation&version=2'); expect(old.status).toBe(200); expect(old.body.historical).toBe(true);
  expect(old.body.explanation.source.nodeId).toBe(a);
  const plan = await c.goalDelivery(s.goalId, { view: 'plan', limit: 1 });
  const run = await c.commandGoal(s.goalId, { kind: 'execute', nodeId: b, expectedInputVersion: 55, dependencies: [], previousExecutionId: null, reason: 'Independent execution', fixture: { scenario: 'success' } }, randomUUID());
  const all = [...first.body.items]; let cursor = first.body.nextCursor; const sizes = [first.body.items.length];
  while (cursor) {
    const next = await read(s.goalId, `view=explanations&limit=20&after=${encodeURIComponent(cursor)}`);
    expect(next.status).toBe(200); expect(next.body.throughVersion).toBe(57); all.push(...next.body.items); sizes.push(next.body.items.length); cursor = next.body.nextCursor;
  }
  expect(all.map(x => x.reference.version)).toEqual(Array.from({ length: 57 }, (_, i) => i + 1));
  expect(all.every(x => x.reference.goalId === s.goalId)).toBe(true);
  expect((await read(s.goalId, 'view=explanation&version=2')).body).toEqual(old.body);
  expect(await c.goalDelivery(s.goalId, { view: 'plan', limit: 1 })).toEqual(plan);
  expect((await read(s.goalId, 'view=explanations')).body.throughVersion).toBe(58);
  await c.cancel(run.task!.id, randomUUID());
  await f.restart(); expect((await read(s.goalId, 'view=explanation&version=2')).body).toEqual(old.body);
  await save('history', { references: all.length, pageSizes: sizes, fixedThrough: 57, laterThrough: 58, fixedBodyStableAfterRestart: true, requests: f.requests });
});
it('bounds history requests and rejects cross-goal, malformed, missing and unauthorized references', async () => {
  const one = await f.setup(), two = await f.setup();
  const first = await read(one.goalId, 'view=explanations&limit=1');
  expect((await read(two.goalId, `view=explanations&after=${encodeURIComponent(first.body.nextCursor)}`)).status).toBe(400);
  for (const query of ['view=explanations&limit=51', 'view=explanations&limit=0', 'view=explanations&after=bad', 'view=explanation&version=0', 'view=explanation&version=1&extra=1']) expect((await read(one.goalId, query)).status).toBe(400);
  expect((await read(one.goalId, 'view=explanation&version=999')).status).toBe(404);
  expect((await read(randomUUID(), 'view=explanations')).status).toBe(404);
  const runner = (await f.http('/api/runners', { name: 'history denied', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await f.http(`/api/goals/${one.goalId}/delivery?view=explanations`, undefined, runner.token)).status).toBe(403);
  expect((await f.http(`/api/goals/${one.goalId}/delivery?view=explanation&version=1`, undefined, '')).status).toBe(401);
});
