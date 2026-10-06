import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { parseTaskLinks, resolveTaskLinks } from '../src/task-links.mjs';
import { parseStatus } from '../src/status.mjs';
import { aggregate } from '../src/aggregate.mjs';
import { fixture, status, now } from './fixture.mjs';

const lead = 'Web /root（执行管理 d01_owner）';
const plan = task => `${task.worktree}/${task.planDir}/plan.md`;
function task(id, rows = [], source = {}) {
  return { id, title: `Task ${id}`, worktree: `/registered/${id}`, planDir: `plans/${id}`, current: true, source: { mode: 'live', stale: false, ...source }, status: { taskLinks: parseTaskLinks(id, rows) } };
}
const big = id => task(id, [['任务层级', '大task'], ['大task ID', `[${id}](plan.md)`], ['co-lead', lead]]);
const child = (id, parent, extra = []) => task(id, [['所属大task', `[${parent.id}](${plan(parent)})`], ['co-lead', lead], ...extra]);
const resolve = (target, others = []) => resolveTaskLinks([target, ...others]).get(target.id);

test('explicit two-level declarations resolve without changing progress or inferring slash-separated leads', () => {
  const parent = big('P01'), sub = child('S01', parent);
  parent.progress = { completed: 0, total: 4 }; sub.progress = { completed: 9, total: 9 };
  const before = JSON.stringify([parent, sub]);
  const result = resolve(sub, [parent]);
  assert.equal(result.kind, 'subtask'); assert.equal(result.parent.state, 'known'); assert.equal(result.parent.targetId, 'P01');
  assert.equal(result.coLead.value, lead); assert.equal(JSON.stringify([parent, sub]), before);
  assert.equal(resolve(parent).parent.state, 'none');
});
test('explicit big task can omit its redundant self ID, but old tasks do not become big implicitly', () => {
  assert.equal(resolve(task('P01', [['任务层级', '大task']])).parent.state, 'none');
  assert.equal(resolve(task('P01')).kind, 'unknown');
  assert.equal(resolve(task('P01', [['大task ID', '[P01](plan.md)']])).kind, 'unknown');
});
test('duplicate fields and multi-value parents remain unknown and retain declarations', () => {
  const parent = big('P01');
  const sub = child('S01', parent, [['所属大task', '[P02](../P02/plan.md)'], ['co-lead', 'Other']]);
  const result = resolve(sub, [parent]);
  assert.equal(result.parent.state, 'unknown'); assert.equal(result.parent.targetId, undefined);
  assert.match(result.parent.record, /P01.*P02/); assert.equal(result.coLead.state, 'unknown');
  for (const value of ['[P01](a) [P02](b)', 'P01', '[P01](a), [P01](a)']) {
    assert.equal(parseTaskLinks('S01', [['所属大task', value]]).parent.state, 'unknown');
  }
});
test('the actual status parser retains duplicate rows instead of trusting the last value', () => {
  const original = status({ id: 'S01', branch: 'codex/s01' }, { human: { '所属大task': '[P01](/one/plan.md)', 'co-lead': lead } });
  const parsed = parseStatus(original.replace('| co-lead |', '| 所属大task | [P02](/two/plan.md) |\n| co-lead |'), 'S01');
  assert.match(parsed.errors.join(), /重复字段/); assert.equal(parsed.taskLinks.parent.state, 'unknown');
  assert.match(parsed.taskLinks.parent.record, /P01.*P02/);
});
test('ID and canonical plan path must both match before creating a navigation action', () => {
  const parent = big('P01');
  const sub = task('S01', [['所属大task', '[P01](/registered/P02/plans/P02/plan.md)']]);
  const result = resolve(sub, [parent]);
  assert.equal(result.parent.state, 'unknown'); assert.equal(result.parent.targetId, undefined); assert.match(result.parent.reason, /链接不一致/);
  const relative = task('S01', [['所属大task', '[P01](../../../P01/plans/P01/plan.md)']]);
  assert.equal(resolve(relative, [parent]).parent.state, 'known');
});
test('self, cycle, and third level are unknown, including MATURE-shaped IDs', () => {
  const self = task('WPF-MATURE-02', [['所属大task', '[WPF-MATURE-02](plan.md)']]);
  assert.match(resolve(self).parent.reason, /自引用/);
  const parent = big('P01'), sub = child('S01', parent);
  parent.status.taskLinks = child('P01', sub).status.taskLinks;
  assert.match(resolve(sub, [parent]).parent.reason, /循环/);
  parent.status.taskLinks = child('P01', big('G01')).status.taskLinks;
  assert.match(resolve(sub, [parent, big('G01')]).parent.reason, /超过两层/);
});
test('unknown parent is pending registration; registered legacy parent remains unknown', () => {
  const parent = big('P01'), sub = child('S01', parent);
  assert.match(resolve(sub).parent.reason, /未登记/);
  parent.status.taskLinks = parseTaskLinks('P01', []);
  assert.match(resolve(sub, [parent]).parent.reason, /层级未明确/);
});
for (const [label, source, reason] of [['missing', { mode: 'missing' }, /缺失/], ['frozen', { mode: 'frozen' }, /冻结/], ['stale', { stale: true }, /陈旧/]]) {
  test(`registered ${label} parent stays inspectable but never known`, () => {
    const parent = big('P01'), sub = child('S01', parent); parent.source = source;
    const result = resolve(sub, [parent]);
    assert.equal(result.parent.state, 'unknown'); assert.equal(result.parent.targetId, 'P01'); assert.match(result.parent.reason, reason);
  });
}
test('invalid own source invalidates relation and co-lead, without borrowing parent ownership', () => {
  const parent = big('P01'), sub = child('S01', parent); sub.current = false;
  const result = resolve(sub, [parent]); assert.equal(result.parent.state, 'unknown'); assert.equal(result.coLead.state, 'unknown');
});
test('contradictory big identity, layer or self plan does not resolve', () => {
  const parent = big('P01'), sub = child('S01', parent);
  for (const rows of [[['任务层级', '大task'], ['大task ID', '[P02](plan.md)']], [['任务层级', '大task'], ['大task ID', '[P01](/elsewhere/plan.md)']], [['任务层级', '大task'], ['任务层级', '子task']]]) {
    parent.status.taskLinks = parseTaskLinks('P01', rows); assert.equal(resolve(sub, [parent]).parent.state, 'unknown');
  }
});
test('external and malicious link declarations never become locations, bounded raw text remains visible', () => {
  for (const target of ['https://attacker.invalid/a', '//attacker.invalid/a', 'javascript:alert', '%6aavascript:alert', 'file:///private/key', 'a%00b', 'a%5Cb', 'a?b', '%bad']) {
    const parsed = parseTaskLinks('S01', [['所属大task', `[P01](${target})`]]); assert.equal(parsed.parent.state, 'unknown', target); assert.equal(parsed.parent.location, undefined);
  }
  const html = '<img src=x onerror=alert(1)>';
  assert.equal(parseTaskLinks('S01', [['co-lead', html]]).coLead.value, html);
  assert.equal(parseTaskLinks('S01', [['co-lead', 'x'.repeat(161)]]).coLead.state, 'unknown');
  assert.ok(parseTaskLinks('S01', [['所属大task', 'x'.repeat(3000)]]).parent.record.length < 2100);
});
test('actual aggregation follows status changes, missing/frozen sources, and registered-only documents', async context => {
  const f = await fixture(context), [sub, parent] = f.tasks;
  const parentHuman = { '任务层级': '大task', '大task ID': '[T02](plan.md)', 'co-lead': lead };
  await f.writeStatus(parent, { human: parentHuman });
  await f.writeStatus(sub, { human: { '所属大task': `[T02](${plan(parent)})`, 'co-lead': lead }, todo: 'completed' });
  let snapshot = await aggregate(f.registry, now);
  assert.equal(snapshot.tasks[0].links.parent.state, 'known'); assert.equal(snapshot.tasks[1].progress.completed, 0);
  const response = await fetch(`${f.url}/api/document?${new URLSearchParams({ task: parent.id, path: `${parent.planDir}/plan.md` })}`);
  assert.equal(response.status, 200); assert.match(await response.text(), /计划/);
  const denied = await fetch(`${f.url}/api/document?${new URLSearchParams({ task: parent.id, path: '/etc/passwd' })}`); assert.equal(denied.status, 404);
  await f.writeStatus(sub, { human: { '所属大task': '[T02](/private/not-a-plan)', 'co-lead': lead } });
  snapshot = await aggregate(f.registry, now); assert.equal(snapshot.tasks[0].links.parent.targetId, undefined);
  await f.writeStatus(sub, { human: { '所属大task': `[T02](${plan(parent)})`, 'co-lead': lead } });
  await f.writeStatus(parent, { human: parentHuman, updated: '2026-10-01 00:00 UTC' });
  snapshot = await aggregate(f.registry, now); assert.match(snapshot.tasks[0].links.parent.reason, /陈旧/);
  await rm(path.join(parent.worktree, parent.planDir, 'status.md'));
  snapshot = await aggregate(f.registry, now); assert.match(snapshot.tasks[0].links.parent.reason, /缺失/);
  await rm(path.join(sub.worktree, sub.planDir, 'status.md'));
  snapshot = await aggregate(f.registry, now); assert.equal(snapshot.tasks[0].source.mode, 'frozen'); assert.equal(snapshot.tasks[0].links.parent.state, 'unknown');
});
