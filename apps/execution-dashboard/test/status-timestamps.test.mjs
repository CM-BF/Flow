import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus } from '../src/status.mjs';

const status = updated => `# T01 status

| 字段 | 值 |
| --- | --- |
| 最近更新 | ${updated} |
| 单一 status owner | timestamp-owner |
| Branch | codex/timestamp-test |
| 工作分支状态 | in-progress |
| 检查状态 | NOT_RUN |
| review | NOT_STARTED |
| 已集成 main 状态 | 尚未集成 |

## TODO
| TODO ID | 状态 | owner | 证据 |
| --- | --- | --- | --- |
| T01-01 | pending | timestamp-owner | 尚未检查 |
`;

const valid = [
  ['legacy minute UTC', '2026-10-06 16:10 UTC', '2026-10-06T16:10:00.000Z'],
  ['legacy second UTC', '2026-10-06 16:10:36 UTC', '2026-10-06T16:10:36.000Z'],
  ['legacy minute Z', '2026-10-06T16:10Z', '2026-10-06T16:10:00.000Z'],
  ['legacy second Z', '2026-10-06T16:10:36Z', '2026-10-06T16:10:36.000Z'],
  ['space separator and Z', '2026-10-06 16:10:36Z', '2026-10-06T16:10:36.000Z'],
  ['millisecond Z', '2026-10-06T16:10:36.850Z', '2026-10-06T16:10:36.850Z'],
  ['one fractional digit UTC', '2026-10-06 16:10:36.8 UTC', '2026-10-06T16:10:36.800Z'],
  ['two fractional digits offset', '2026-10-06T16:10:36.85+00:00', '2026-10-06T16:10:36.850Z'],
  // Exact GO observations relayed by root/manager; no live source reads in tests.
  ['reported TUI UTC record', '2026-10-06T16:10:36.850746+00:00', '2026-10-06T16:10:36.850Z'],
  ['reported COST UTC record', '2026-10-06T14:35:06.228081+00:00', '2026-10-06T14:35:06.228Z'],
  ['truncate without rounding into next second', '2026-10-06T16:10:36.999999999Z', '2026-10-06T16:10:36.999Z'],
  ['minute offset', '2026-10-06T16:10+00:00', '2026-10-06T16:10:00.000Z'],
  ['Gregorian leap day', '2000-02-29T00:00:00Z', '2000-02-29T00:00:00.000Z'],
  ['early leap year', '0096-02-29 00:00 UTC', '0096-02-29T00:00:00.000Z'],
  ['year zero is not 1900', '0000-02-29T00:00Z', '0000-02-29T00:00:00.000Z'],
  ['early ordinary year', '0099-12-31T23:59:59Z', '0099-12-31T23:59:59.000Z'],
  ['end-of-day minute', '2026-10-06T24:00Z', '2026-10-07T00:00:00.000Z'],
  ['end-of-day zero fraction crosses year', '2026-12-31 24:00:00.000000 UTC', '2027-01-01T00:00:00.000Z'],
  ['wrapped update followed by main sync', '源码更新 `2026-10-06T16:10:36.850746+00:00`；main 同步 2026-10-07T01:00Z', '2026-10-06T16:10:36.850Z'],
];

for (const [label, input, expected] of valid) {
  test(`normalizes ${label}`, () => {
    const parsed = parseStatus(status(input), 'T01');
    assert.equal(parsed.updatedAt, expected);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.updatedRecord, input.replace(/`/g, '').trim());
  });
}

const invalid = [
  '2026-00-06T16:10Z', '2026-13-06T16:10Z',
  '2026-10-00T16:10Z', '2026-04-31T16:10Z',
  '2026-02-29T16:10Z', '1900-02-29T16:10Z', '0100-02-29T16:10Z',
  '2026-10-06T25:00Z', '2026-10-06T24:01Z', '2026-10-06T24:00:01Z',
  '2026-10-06T24:00:00.000001Z', '2026-10-06T16:60Z', '2026-10-06T16:10:60Z',
  '2026-10-06T16:10', '2026-10-06T16:10 GMT', '2026-10-06T16:10+01:00',
  '2026-10-06T16:10-00:00', '2026-10-06T16:10+00:000', '2026-10-06T16:10+00:00:00',
  '2026-10-06T16:10Z+01:00', '2026-10-06T16:10UTCjunk', '2026-10-06T16:10:36.Z',
  '2026-10-06T16:10:36.123.456Z', '2026-10-06T16:10.5Z',
  '2026-1-06T16:10Z', '026-10-06T16:10Z', '12026-10-06T16:10Z', '-0001-10-06T16:10Z',
  '更新时间待确认', '',
];

for (const input of invalid) {
  test(`rejects ${input || 'empty update'} without throwing or damaging other fields`, () => {
    const parsed = parseStatus(status(input), 'T01');
    assert.equal(parsed.updatedAt, null);
    assert.deepEqual(parsed.errors, ['缺少可解析 UTC 更新时间']);
    assert.equal(parsed.owner, 'timestamp-owner');
    assert.equal(parsed.branch, 'codex/timestamp-test');
    assert.deepEqual(parsed.todos, [{ id: 'T01-01', state: 'pending', owner: 'timestamp-owner', evidence: '尚未检查' }]);
  });
}

test('equivalent UTC representations yield one instant without changing unrelated status', () => {
  const forms = ['2026-10-06 16:10:36.850 UTC', '2026-10-06T16:10:36.850Z', '2026-10-06T16:10:36.850746+00:00'];
  const parsed = forms.map(value => parseStatus(status(value), 'T01'));
  assert.equal(new Set(parsed.map(value => value.updatedAt)).size, 1);
  for (const value of parsed) {
    assert.equal(value.checks.state, 'not_run');
    assert.equal(value.reviewRecord, 'NOT_STARTED');
    assert.equal(value.mainRecord, '尚未集成');
  }
});

for (const first of ['2026-13-06T16:10Z', '2026-10-06T16:10+00:000', '2026-xx-06T16:10Z', '026-10-06T16:10Z']) {
  test(`never rescues invalid first update ${first} with later main sync`, () => {
    const parsed = parseStatus(status(`更新：\`${first}\`；main 同步：2026-10-07T01:00Z`), 'T01');
    assert.equal(parsed.updatedAt, null);
    assert.deepEqual(parsed.errors, ['缺少可解析 UTC 更新时间']);
  });
}

for (const input of [
  '更新时间待确认；main 同步 2026-10-07T01:00Z',
  '更新 2026/13/06 16:10 UTC；main 同步 2026-10-07T01:00Z',
  '更新时间待确认；`main` 同步 `2026-10-07T01:00Z`',
  'update pending; MAIN sync 2026-10-07T01:00Z',
]) {
  test(`main synchronization cannot supply a missing or malformed primary update: ${input}`, () => {
    const parsed = parseStatus(status(input), 'T01');
    assert.equal(parsed.updatedAt, null);
    assert.deepEqual(parsed.errors, ['缺少可解析 UTC 更新时间']);
    assert.equal(parsed.updatedRecord, input.replace(/`/g, ''));
  });
}

for (const input of [
  '任务 WPF-DPERF05-01 更新于2026-10-06T16:10:36Z',
  '任务 `WPF-DPERF05-01` 更新于 `2026-10-06T16:10:36Z`；main 同步待确认',
]) {
  test(`allows a task identifier in the explanatory prefix: ${input}`, () => {
    const parsed = parseStatus(status(input), 'T01');
    assert.equal(parsed.updatedAt, '2026-10-06T16:10:36.000Z');
    assert.deepEqual(parsed.errors, []);
  });
}

test('old first update remains old even when main sync is newer', () => {
  assert.equal(parseStatus(status('2020-01-01 00:00 UTC；main 同步 2026-10-06T18:00Z'), 'T01').updatedAt, '2020-01-01T00:00:00.000Z');
});

test('future timestamp is preserved for the unchanged aggregate policy to evaluate', () => {
  assert.equal(parseStatus(status('2099-10-06T16:10:36.850746+00:00'), 'T01').updatedAt, '2099-10-06T16:10:36.850Z');
});

function taskTiming(rows, suffix = '') {
  const table = rows.map(([key, value]) => `| ${key} | ${value} |`).join('\n');
  return parseStatus(status('2026-10-07T03:00:00Z').replace('## TODO', `${table}\n\n## TODO`) + suffix, 'T01');
}
const timingRows = [
  ['任务开工时间', '2026-10-07T01:00:00.125Z'],
  ['任务完成时间', 'NOT_COMPLETED'],
  ['任务时间来源', '开工：[本人实际开始记录](../../evidence/start.json)；完成：未发生'],
];

test('task timing has its own whole-field contract and preserves owner provenance', () => {
  const parsed = taskTiming(timingRows);
  assert.deepEqual(parsed.timing.started, { state: 'known', at: '2026-10-07T01:00:00.125Z', record: timingRows[0][1] });
  assert.deepEqual(parsed.timing.completed, { state: 'not_completed', at: null, record: 'NOT_COMPLETED' });
  assert.deepEqual(parsed.timing.source, { state: 'declared', record: timingRows[2][1] });
  assert.deepEqual(parsed.timing.issues, []);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.updatedAt, '2026-10-07T03:00:00.000Z');
});

test('missing optional task timing leaves legacy status and progress intact', () => {
  const parsed = taskTiming([]);
  assert.equal(parsed.timing.started.state, 'unknown');
  assert.equal(parsed.timing.completed.state, 'unknown');
  assert.equal(parsed.timing.source.state, 'unknown');
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.todos.length, 1);
  assert.equal(parsed.owner, 'timestamp-owner');
  assert.equal(parsed.checks.state, 'not_run');
  assert.equal(parsed.reviewRecord, 'NOT_STARTED');
  assert.equal(parsed.mainRecord, '尚未集成');
});

for (const input of ['UNKNOWN', '', '2026-10-07T01:00:00', '2026-10-07 01:00 UTC', '2026-10-07T01:00:00+01:00', '2026-02-29T01:00:00Z', '2026-10-07T24:00:00Z', '2026-10-07T01:00:00Z later 2026-10-07T02:00:00Z', 'opened 2026-10-07T01:00:00Z']) {
  test(`invalid task start ${input || '(empty)'} cannot be rescued by update or another date`, () => {
    const parsed = taskTiming(timingRows.map(row => row[0] === '任务开工时间' ? [row[0], input] : row));
    assert.equal(parsed.timing.started.state, 'unknown');
    assert.equal(parsed.timing.started.at, null);
    assert.ok(parsed.timing.issues.length > 0);
    assert.equal(parsed.timing.completed.state, 'not_completed');
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.updatedAt, '2026-10-07T03:00:00.000Z');
  });
}

for (const key of ['任务开工时间', '任务完成时间', '任务时间来源']) {
  test(`duplicate ${key} is isolated from legacy errors and cannot choose last value`, () => {
    const parsed = taskTiming([...timingRows, [key, '2026-10-07T02:00:00Z']]);
    assert.ok(parsed.timing.issues.some(issue => issue.includes('重复')));
    assert.deepEqual(parsed.errors, []);
    const field = key === '任务开工时间' ? 'started' : key === '任务完成时间' ? 'completed' : 'source';
    assert.equal(parsed.timing[field].state, 'unknown');
    assert.equal(parsed.todos[0].state, 'pending');
  });
}

test('known completion preserves seconds precision; reversed interval is a timing-only issue', () => {
  const valid = taskTiming(timingRows.map(row => row[0] === '任务完成时间' ? [row[0], '2026-10-07T02:00:00Z'] : row));
  assert.equal(valid.timing.completed.at, '2026-10-07T02:00:00.000Z');
  assert.deepEqual(valid.timing.issues, []);
  const reversed = taskTiming(timingRows.map(row => row[0] === '任务完成时间' ? [row[0], '2026-10-07T00:00:00Z'] : row));
  assert.equal(reversed.timing.completed.state, 'known');
  assert.ok(reversed.timing.issues.includes('任务完成时间早于开工时间'));
  assert.deepEqual(reversed.errors, []);
});

test('UNKNOWN end is distinct from NOT_COMPLETED and source absence does not authorize timing', () => {
  const parsed = taskTiming([timingRows[0], ['任务完成时间', 'UNKNOWN']]);
  assert.equal(parsed.timing.completed.state, 'unknown');
  assert.equal(parsed.timing.source.state, 'unknown');
  assert.deepEqual(parsed.errors, []);
});

test('completion alone, future declarations and branch completion never supply a start', () => {
  const parsed = taskTiming([['任务完成时间', '2099-10-07T02:00:00Z'], timingRows[2]]);
  assert.equal(parsed.timing.started.at, null);
  assert.equal(parsed.timing.completed.at, '2099-10-07T02:00:00.000Z');
  assert.deepEqual(parsed.errors, []);
  const branchComplete = parseStatus(status('2026-10-07T03:00:00Z').replace('| 工作分支状态 | in-progress |', '| 工作分支状态 | completed |'), 'T01');
  assert.equal(branchComplete.timing.completed.state, 'unknown');
});

test('waiting records remain source text, including OPEN/UNKNOWN and overlapping intervals', () => {
  const waiting = '## 等待记录\n| ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源 |\n| --- | --- | --- | --- | --- | --- |\n| WAIT01 | 2026-10-07T01:10:00Z | OPEN | 资源 | 等待可用窗口 | 原记录A |\n| WAIT02 | UNKNOWN | OPEN | 审查 | 待独审 | 原记录B |\n';
  const parsed = taskTiming(timingRows, waiting);
  assert.ok(parsed.timing.waiting.includes('WAIT01'));
  assert.ok(parsed.timing.waiting.includes('UNKNOWN'));
  assert.ok(!Object.hasOwn(parsed.timing, 'netWorkMs'));
  assert.deepEqual(parsed.errors, []);
});

test('ordinary duplicated status fields retain existing errors', () => {
  const parsed = taskTiming([['Branch', 'codex/conflict']]);
  assert.deepEqual(parsed.errors, ['重复字段：Branch']);
});
