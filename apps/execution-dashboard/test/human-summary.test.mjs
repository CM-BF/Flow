import test from 'node:test';
import assert from 'node:assert/strict';
import { humanOverview, parseHuman } from '../src/human.mjs';
import { parseTaskLinks, resolveTaskLinks } from '../src/task-links.mjs';

function task(id, { parent, priority = 2, stage = 'implementation', current = true, complete = true, blocker = 'NONE', decision = 'NONE', declared = true } = {}) {
  const fields = { 阶段: 'M2', 优先级: String(priority), 本片段交付阶段: stage, 当前产出: complete ? `Output ${id}` : '', 下一可用交付: `Next ${id}`, 当前阻塞: blocker, 需用户决定: decision };
  const rows = declared ? parent ? [['所属大task', `[${parent}](/registered/${parent}/plans/task/plan.md)`]] : [['任务层级', '大task']] : [];
  return { id, title: id, worktree: `/registered/${id}`, planDir: 'plans/task', current, source: { mode: 'live', stale: false },
    progress: { completed: 1, total: 3 }, status: { branchState: 'in-progress', taskLinks: parseTaskLinks(id, rows),
      human: parseHuman(pattern => Object.entries(fields).find(([key]) => pattern.test(key))?.[1] ?? '') } };
}
function linked(tasks) { const links = resolveTaskLinks(tasks); return tasks.map(task => ({ ...task, links: links.get(task.id) })); }

test('confirmed parent and child use one headline slot while other directions fill both top threes', () => {
  const tasks = linked([task('ENG-001'), task('ENG01D', { parent: 'ENG-001', priority: 1 }), task('Q01', { priority: 3 }), task('R01', { priority: 4 })]);
  const result = humanOverview(tasks);
  assert.deepEqual(result.activeIds, ['ENG-001', 'Q01', 'R01']);
  assert.deepEqual(result.deliveryIds, ['ENG-001', 'Q01', 'R01']);
  assert.deepEqual(result.otherActiveIds, ['ENG01D']);
});

test('child blockers and decisions stay independently visible without changing parent priority or facts', () => {
  const tasks = linked([task('P01', { priority: 8 }), task('S01', { parent: 'P01', priority: 1, blocker: 'ACTIVE: Await input', decision: 'REQUIRED: Pick a destination' }),
    task('A01', { priority: 2 }), task('A02', { priority: 3 }), task('A03', { priority: 4 })]);
  const before = JSON.stringify(tasks), result = humanOverview(tasks);
  assert.deepEqual(result.activeIds, ['A01', 'A02', 'A03']);
  assert.deepEqual(result.deliveryIds, ['A01', 'A02', 'A03']);
  assert.deepEqual(result.blockerIds, ['S01']); assert.deepEqual(result.decisionIds, ['S01']);
  assert.deepEqual(result.otherActiveIds, ['S01', 'P01']); assert.equal(JSON.stringify(tasks), before);
});

for (const stage of ['planning', 'delivered']) test(`a ${stage} parent never suppresses an active child`, () => {
  const tasks = linked([task('P01', { stage }), task('S01', { parent: 'P01' })]);
  assert.equal(tasks[1].links.parent.state, 'known');
  assert.deepEqual(humanOverview(tasks).activeIds, ['S01']); assert.deepEqual(humanOverview(tasks).deliveryIds, ['S01']);
});

test('a parent with incomplete human facts does not borrow its child summary', () => {
  const tasks = linked([task('P01', { complete: false }), task('S01', { parent: 'P01' })]);
  const result = humanOverview(tasks);
  assert.equal(tasks[1].links.parent.state, 'known'); assert.deepEqual(result.activeIds, ['S01']);
  assert.deepEqual(result.otherActiveIds, ['P01']); assert.deepEqual(result.unknownIds, ['P01']);
});

test('an unknown relation with a registered target remains separate', () => {
  const tasks = linked([task('P01'), task('S01', { parent: 'P01' })]);
  tasks[1].links.parent = { state: 'unknown', targetId: 'P01', reason: 'Unverified declaration' };
  assert.deepEqual(humanOverview(tasks).activeIds, ['P01', 'S01']);
});

test('stale, missing and cyclic parent sources cannot group children', () => {
  for (const fault of ['stale', 'missing', 'cycle']) {
    const parent = task('P01', fault === 'cycle' ? { parent: 'S01' } : {});
    if (fault === 'stale') { parent.current = false; parent.source.stale = true; }
    if (fault === 'missing') { parent.current = false; parent.source.mode = 'missing'; }
    const tasks = linked([parent, task('S01', { parent: 'P01' })]);
    assert.equal(tasks[1].links.parent.state, 'unknown', fault);
    assert.ok(humanOverview(tasks).activeIds.includes('S01'), fault);
  }
});

test('legacy names and undeclared relationships preserve prior priority ordering', () => {
  const tasks = linked([task('ENG-001', { declared: false }), task('ENG01D', { declared: false }), task('Q01'), task('R01')]);
  assert.deepEqual(humanOverview(tasks).activeIds, ['ENG-001', 'ENG01D', 'Q01']);
  assert.deepEqual(humanOverview(tasks).otherActiveIds, ['R01']);
});

test('signals sort by explicit owner priority, stable ID ties, and unknown last without reading severity words', () => {
  const tasks = linked([task('Z1', { priority: 'UNKNOWN', blocker: 'ACTIVE: critical', decision: 'REQUIRED: urgent' }),
    task('B1', { priority: 9, blocker: 'ACTIVE: minor', decision: 'REQUIRED: later' }),
    task('A2', { priority: 1, blocker: 'ACTIVE: same', decision: 'REQUIRED: same' }),
    task('A1', { priority: 1, blocker: 'ACTIVE: same', decision: 'REQUIRED: same' })]);
  const before = JSON.stringify(tasks), expected = ['A1', 'A2', 'B1', 'Z1'];
  assert.deepEqual(humanOverview(tasks).blockerIds, expected);
  assert.deepEqual(humanOverview([...tasks].reverse()).decisionIds, expected);
  assert.equal(JSON.stringify(tasks), before);
});
test('signal grouping keeps every child and original parent record without synthesizing parent signals', () => {
  const tasks = linked([task('P1', { priority: 8 }), task('C1', { parent: 'P1', priority: 1, blocker: 'ACTIVE: same' }),
    task('C2', { parent: 'P1', priority: 3, blocker: 'ACTIVE: same' }), task('Q1', { priority: 2, blocker: 'ACTIVE: same' })]);
  const before = JSON.stringify(tasks), result = humanOverview(tasks);
  assert.deepEqual(result.blockerIds, ['C1', 'Q1', 'C2']);
  assert.deepEqual(result.blockerGroups, [{ parentId: 'P1', relation: 'known', taskIds: ['C1', 'C2'] }, { parentId: 'Q1', relation: 'known', taskIds: ['Q1'] }]);
  assert.equal(tasks[0].status.human.blocker.state, 'none');
  assert.equal(JSON.stringify(tasks), before);
  tasks[0].status.human.blocker = { state: 'active', text: 'parent own blocker' };
  assert.deepEqual(humanOverview(tasks).blockerGroups[0].taskIds, ['C1', 'C2', 'P1']);
});
test('unknown relation with targetId, invalid kind or stale parent never creates a signal family', () => {
  for (const fault of ['unknown', 'kind', 'stale', 'missing']) {
    const tasks = linked([task('P1'), task('C1', { parent: 'P1', blocker: 'ACTIVE: wait' })]);
    if (fault === 'unknown') tasks[1].links.parent.state = 'unknown';
    if (fault === 'kind') tasks[1].links.kind = 'unknown';
    if (fault === 'stale') tasks[0].source.stale = true;
    if (fault === 'missing') tasks.shift();
    assert.deepEqual(humanOverview(tasks).blockerGroups, [{ parentId: null, relation: 'unknown', taskIds: ['C1'] }], fault);
  }
});
