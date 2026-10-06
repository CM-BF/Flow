import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fixture, now, git, commit } from './fixture.mjs';
import { aggregate } from '../src/aggregate.mjs';
import { parseImplementation } from '../src/proof.mjs';
import { defaultRegistry } from '../src/registry.mjs';

const human = { 阶段: 'M2', 优先级: '1', 当前产出: '正在实现安全恢复', 下一可用交付: '可核对的恢复入口', 当前阻塞: 'NONE', 需用户决定: 'NONE' };
const first = snapshot => snapshot.tasks[0];
async function implementationFixture(context) {
  const f = await fixture(context); const task = f.tasks[0];
  await mkdir(path.join(task.worktree, 'apps/demo'), { recursive: true });
  await writeFile(path.join(task.worktree, 'apps/demo/main.js'), 'export const value = 1;\n');
  const target = commit(task);
  const options = { human, implementation: { target, scope: 'apps/demo/' }, checks: `PASSED ${target}`, todo: 'completed' };
  await f.writeStatus(task, options);
  await writeFile(path.join(task.worktree, task.planDir, 'review.md'), `**状态：APPROVED**\nReview target commit：${target}\n`);
  return { ...f, task, target, options };
}

test('structured summaries never mine historical risks or no-decision prose', async context => {
  const f = await fixture(context);
  await f.writeStatus(f.tasks[0], { human, decisions: '历史已解除：需要审批', risks: 'cap=1，历史阻塞', next: 'engineering blob' });
  let snapshot = await aggregate(f.registry, now);
  assert.deepEqual(snapshot.overview.activeIds, ['T01']);
  assert.deepEqual(snapshot.overview.decisionIds, []); assert.deepEqual(snapshot.overview.blockerIds, []);
  assert.deepEqual(snapshot.overview.unknownIds, ['T02']); assert.equal(snapshot.overview.phase, 'M2');
  await f.writeStatus(f.tasks[0], { human: { ...human, 当前阻塞: 'ACTIVE: 等待明确外部文件', 需用户决定: 'REQUIRED: 选择存储区域' } });
  snapshot = await aggregate(f.registry, now);
  assert.deepEqual(snapshot.overview.blockerIds, ['T01']); assert.deepEqual(snapshot.overview.decisionIds, ['T01']);
  await f.writeStatus(f.tasks[0], { human: { ...human, 当前阻塞: 'UNKNOWN', 需用户决定: '无新增事项' } });
  snapshot = await aggregate(f.registry, now);
  assert.deepEqual(snapshot.overview.blockerIds, []); assert.deepEqual(snapshot.overview.decisionIds, []);
  assert.equal(first(snapshot).status.human.complete, false);
});

test('active work is bounded and priority ordered; completed history is separate', async context => {
  const f = await fixture(context);
  await f.writeStatus(f.tasks[0], { human, branchState: 'completed；已交付' });
  await f.writeStatus(f.tasks[1], { human: { ...human, 优先级: '2' } });
  const snapshot = await aggregate(f.registry, now);
  assert.deepEqual(snapshot.overview.activeIds, ['T02']); assert.deepEqual(snapshot.overview.deliveryIds, ['T02']); assert.deepEqual(snapshot.overview.historyIds, ['T01']);
  await f.writeStatus(f.tasks[1], { human, updated: '2025-01-01 00:00 UTC' });
  assert.deepEqual((await aggregate(f.registry, now)).overview.activeIds, []);
});

test('metadata-only changes retain exact implementation approval, including dirty docs', async context => {
  const f = await implementationFixture(context);
  let result = first(await aggregate(f.registry, now));
  assert.equal(result.git.dirty, true); assert.equal(result.review.state, 'approved');
  assert.equal(result.review.proof.state, 'unchanged');
  commit(f.task);
  result = first(await aggregate(f.registry, now));
  assert.notEqual(result.git.head, f.target); assert.equal(result.review.state, 'approved');
  assert.ok(result.review.proof.metadataChanges.includes(`${f.task.planDir}/status.md`));
});

test('tracked changes, additions, deletions and untracked implementation invalidate approval', async context => {
  const f = await implementationFixture(context); commit(f.task);
  const file = path.join(f.task.worktree, 'apps/demo/new.js');
  await writeFile(file, 'new code');
  let result = first(await aggregate(f.registry, now)); assert.equal(result.review.state, 'outdated');
  assert.deepEqual(result.review.proof.implementationChanges, ['apps/demo/new.js']);
  commit(f.task);
  assert.equal(first(await aggregate(f.registry, now)).review.state, 'outdated');
  await rm(file); await rm(path.join(f.task.worktree, 'apps/demo/main.js'));
  result = first(await aggregate(f.registry, now)); assert.equal(result.review.state, 'outdated');
  assert.ok(result.review.proof.implementationChanges.includes('apps/demo/main.js'));
});

test('new code outside a narrow scope is unknown, not metadata approval', async context => {
  const f = await implementationFixture(context);
  await f.writeStatus(f.task, { ...f.options, implementation: { target: f.target, scope: 'apps/demo/main.js' } });
  await writeFile(path.join(f.task.worktree, 'apps/demo/new.js'), 'new');
  const result = first(await aggregate(f.registry, now));
  assert.equal(result.review.state, 'unknown'); assert.deepEqual(result.review.proof.outsideChanges, ['apps/demo/new.js']);
});

test('missing/unsafe/nonexistent scopes and absent target never turn green', async context => {
  const f = await implementationFixture(context);
  for (const scope of ['', '../apps', '/tmp/x', 'apps/*', '.git/config', ':(glob)apps/**', 'apps/missing']) {
    await f.writeStatus(f.task, { ...f.options, implementation: { target: f.target, scope } });
    const result = first(await aggregate(f.registry, now));
    assert.equal(result.review.state, 'unknown', scope); assert.equal(result.main.current, false);
  }
  assert.ok(parseImplementation(f.target, 'apps\\demo').errors.length);
  await f.writeStatus(f.task, { ...f.options, implementation: { target: 'a'.repeat(40), scope: 'apps/demo' } });
  assert.equal(first(await aggregate(f.registry, now)).implementationProof.state, 'unknown');
});

test('main ancestry survives unrelated main metadata commits without owner status rewrites', async context => {
  const f = await implementationFixture(context); commit(f.task);
  git(f.registry.mainWorktree, 'fetch', f.task.worktree, f.target);
  git(f.registry.mainWorktree, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'merge', '--allow-unrelated-histories', '--no-edit', 'FETCH_HEAD');
  let result = first(await aggregate(f.registry, now));
  assert.equal(result.main.current, true); assert.equal(result.main.method, 'ancestor');
  git(f.registry.mainWorktree, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'metadata');
  result = first(await aggregate(f.registry, now));
  assert.equal(result.main.current, true); assert.notEqual(result.main.recordedHead, result.main.mainHead);
  assert.equal(result.main.target, f.target);
});

test('scope-tree integration requires existing target and no omitted new implementation', async context => {
  const f = await implementationFixture(context); commit(f.task);
  await mkdir(path.join(f.registry.mainWorktree, 'apps/demo'), { recursive: true });
  await writeFile(path.join(f.registry.mainWorktree, 'apps/demo/main.js'), 'export const value = 1;\n');
  commit({ worktree: f.registry.mainWorktree });
  let result = first(await aggregate(f.registry, now)); assert.equal(result.main.current, true); assert.equal(result.main.method, 'scope-tree');
  await writeFile(path.join(f.task.worktree, 'apps/omitted.js'), 'new');
  result = first(await aggregate(f.registry, now)); assert.equal(result.main.current, false);
});

test('28 distinct registry sources include D03, I02 and bounded Web platform source', () => {
  const registry = defaultRegistry(); assert.equal(registry.tasks.length, 28);
  assert.equal(registry.tasks.find(task => task.id === 'I02').planDir, 'plans/i02-integration');
  const source = registry.tasks.find(task => task.id === 'WPF-001');
  assert.equal(source.planDir, 'plans/web-platform'); assert.equal(source.evidenceDir, 'docs/evidence/web-platform');
  assert.equal(registry.tasks.find(task => task.id === 'D03').worktree, '/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-human-view');
});

test('executable files under docs are not silently treated as metadata', async context => {
  const f = await implementationFixture(context);
  await writeFile(path.join(f.task.worktree, 'docs/new-script.mjs'), 'console.log(1);');
  const result = first(await aggregate(f.registry, now));
  assert.equal(result.review.state, 'unknown');
  assert.deepEqual(result.review.proof.outsideChanges, ['docs/new-script.mjs']);
});

test('top three never hide other active work, while historical missing summaries stay in history', async () => {
  const { humanOverview } = await import('../src/human.mjs');
  const { parseStatus } = await import('../src/status.mjs');
  const { status } = await import('./fixture.mjs');
  const tasks = Array.from({ length: 6 }, (_, i) => {
    const task = { id: `T0${i + 1}`, branch: `codex/t0${i + 1}` };
    return { ...task, current: true, main: { current: false }, status: parseStatus(status(task, { ...(i < 4 ? { human } : {}), branchState: i === 5 ? 'completed' : 'in-progress' }), task.id) };
  });
  const overview = humanOverview(tasks);
  assert.deepEqual(overview.activeIds, ['T01', 'T02', 'T03']);
  assert.deepEqual(overview.otherActiveIds, ['T04', 'T05']);
  assert.deepEqual(overview.unknownIds, ['T05']);
  assert.deepEqual(overview.historyIds, ['T06']);
});

test('historical main ancestry cannot approve later implementation changes, deletions or dirty paths', async context => {
  const f = await implementationFixture(context); commit(f.task);
  git(f.registry.mainWorktree, 'fetch', f.task.worktree, f.target);
  git(f.registry.mainWorktree, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'merge', '--allow-unrelated-histories', '--no-edit', 'FETCH_HEAD');
  const mainFile = path.join(f.registry.mainWorktree, 'apps/demo/main.js');
  await writeFile(mainFile, 'export const value = 2;\n');
  let result = first(await aggregate(f.registry, now));
  assert.equal(result.main.current, false); assert.equal(result.main.historicalIntegrated, true);
  assert.deepEqual(result.main.dirtyScopePaths, ['apps/demo/main.js']);
  commit({ worktree: f.registry.mainWorktree });
  result = first(await aggregate(f.registry, now));
  assert.equal(result.main.current, false); assert.equal(result.main.method, 'ancestor-changed');
  assert.equal(result.main.scopeEqual, false);
  await rm(mainFile); commit({ worktree: f.registry.mainWorktree });
  result = first(await aggregate(f.registry, now));
  assert.equal(result.main.current, false); assert.equal(result.main.historicalIntegrated, true);
  assert.equal(result.main.method, 'ancestor-changed');
  await writeFile(mainFile, 'export const value = 1;\n'); commit({ worktree: f.registry.mainWorktree });
  await writeFile(path.join(f.registry.mainWorktree, 'apps/demo/new.js'), 'untracked addition');
  result = first(await aggregate(f.registry, now)); assert.equal(result.main.current, false);
  await rm(path.join(f.registry.mainWorktree, 'apps/demo/new.js'));
  result = first(await aggregate(f.registry, now)); assert.equal(result.main.current, true);
});

 test('global phase comes only from the explicit short phase source', async context => {
  const f = await fixture(context);
  await f.writeStatus(f.tasks[0], { human });
  await f.writeStatus(f.tasks[1], { human: { ...human, 阶段: 'implementation and local validation' } });
  const snapshot = await aggregate(f.registry, now);
  assert.equal(snapshot.overview.phase, 'M2');
  assert.ok(snapshot.tasks[1].status.human.missing.includes('阶段'));
  await f.writeStatus(f.tasks[0], { human: { ...human, 阶段: 'x'.repeat(25) } });
  assert.equal((await aggregate(f.registry, now)).overview.phase, null);
});
