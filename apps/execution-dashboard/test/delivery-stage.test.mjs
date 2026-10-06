import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus } from '../src/status.mjs';
import { humanOverview } from '../src/human.mjs';

function task(id, { stage, branch = 'in-progress', priority = 2, blocker = 'NONE', current = true, mainCurrent = true } = {}) {
  return { id, current, main: { current: mainCurrent }, status: parseStatus(`# ${id} 状态
| 单一status owner / model | Test / gpt-6-astra |
| Branch | codex/test |
| 最近更新 | 2026-10-06 05:04 UTC |
| 工作分支状态 | ${branch} |
${stage === undefined ? '' : `| 本片段交付阶段 | ${stage} |`}
| 阶段 | M2 |
| 优先级 | ${priority} |
| 当前产出 | 本片段可用 |
| 下一可用交付 | 后继任意文案，不用于推断 |
| 当前阻塞 | ${blocker} |
| 需用户决定 | NONE |
| TODO ID | 状态 | Owner | 证据 |
| ${id}-01 | completed | Test | saved |
| ${id}-02 | pending | Test | future work |
`, id) };
}

test('delivered slice leaves next deliveries despite open future TODO and changed main scope', () => {
  const done = task('T01', { stage: 'delivered', branch: 'in-progress；完整原计划仍open', mainCurrent: false });
  const view = humanOverview([done]);
  assert.deepEqual(view.deliveryIds, []);
  assert.deepEqual(view.historyIds, ['T01']);
  assert.equal(done.status.todos[1].state, 'pending');
});

test('review and integration remain actionable after author completion, planning does not', () => {
  const tasks = [task('T01', { stage: 'review', branch: 'completed', priority: 2 }), task('T02', { stage: 'integration', branch: 'delivered', priority: 1 }), task('T03', { stage: 'planning', priority: 1 })];
  const view = humanOverview(tasks);
  assert.deepEqual(view.deliveryIds, ['T02', 'T01']);
  assert.deepEqual(view.activeIds, ['T02', 'T01']);
  assert.deepEqual(view.historyIds, []);
});

test('invalid explicit stage stays unknown instead of falling back to active branch', () => {
  const invalid = task('T01', { stage: 'complete-ish' });
  assert.deepEqual(invalid.status.human.delivery, { state: 'unknown', source: 'explicit' });
  assert.ok(invalid.status.human.missing.includes('本片段交付阶段'));
  const view = humanOverview([invalid]);
  assert.deepEqual(view.deliveryIds, []);
  assert.deepEqual(view.unknownIds, ['T01']);
});

test('legacy author completion is labelled legacy and preserves review/main uncertainty', () => {
  const legacy = task('T01', { branch: 'completed', mainCurrent: false });
  const delivered = task('T02', { branch: 'delivered；后继pending', mainCurrent: false });
  const unknown = task('T03', { branch: 'APPROVED but waiting for main' });
  const active = task('T04', { branch: 'in-progress', priority: 3 });
  const view = humanOverview([legacy, delivered, unknown, active]);
  assert.deepEqual(legacy.status.human.delivery, { state: 'unknown', source: 'legacy' });
  assert.equal(legacy.main.current, false);
  assert.deepEqual(view.deliveryIds, ['T04']);
  assert.deepEqual(view.historyIds, ['T01', 'T02']);
  assert.equal(unknown.status.branchState, 'APPROVED but waiting for main');
});

test('current blocked work has delivery priority; stale and invalid facts never become candidates', () => {
  const tasks = [task('T01', { stage: 'implementation', priority: 1 }), task('T02', { stage: 'review', priority: 8, blocker: 'ACTIVE: 缺少必要的交付证据' }), task('T03', { stage: 'integration', priority: 2 }), task('T04', { stage: 'implementation', priority: 3 }), task('T05', { stage: 'integration', priority: 1, current: false })];
  const view = humanOverview(tasks);
  assert.deepEqual(view.deliveryIds, ['T02', 'T01', 'T03']);
  assert.deepEqual(view.blockerIds, ['T02']);
  assert.deepEqual(view.otherActiveIds, ['T02']);
  assert.ok(view.unknownIds.includes('T05'));
});
