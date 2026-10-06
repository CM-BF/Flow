import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { aggregate } from '../src/aggregate.mjs';
import { fixture, now, commit } from './fixture.mjs';

const execute = promisify(execFile);
const aggregateUrl = new URL('../src/aggregate.mjs', import.meta.url).href;
const human = { 阶段: 'M2', 优先级: '3', 当前产出: '检查实现结果', 下一可用交付: '查看当前结果', 当前阻塞: 'NONE', 需用户决定: 'NONE' };
async function sample(context) {
  const f = await fixture(context), task = f.tasks[0];
  await mkdir(path.join(task.worktree, 'apps/demo'), { recursive: true });
  await writeFile(path.join(task.worktree, 'apps/demo/main.js'), 'export const value = 1;\n');
  const target = commit(task);
  const options = { human, implementation: { target, scope: 'apps/demo' }, checks: `PASSED ${target}` };
  await f.writeStatus(task, options);
  const review = target => writeFile(path.join(task.worktree, task.planDir, 'review.md'), `**状态：APPROVED**\nReview target commit：${target}\n`);
  await review(target);
  return { ...f, task, target, options, review };
}

/** Real temporary Git subprocesses only; tracing is scoped to this child, never the owner repository. */
async function tracedSnapshot(f, name) {
  const trace = path.join(f.root, `${name}.jsonl`);
  const env = { ...process.env, GIT_TRACE2_EVENT: trace, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  delete env.FLOW_COORDINATION_DATABASE_URL;
  delete env.FLOW_COORDINATION_REPO;
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e', `
    import { aggregate } from ${JSON.stringify(aggregateUrl)};
    const snapshot = await aggregate(JSON.parse(process.argv[1]), Number(process.argv[2]));
    console.log(JSON.stringify(snapshot));
  `, JSON.stringify(f.registry), String(now)], { env, timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
  const events = (await readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const starts = events.filter(event => event.event === 'start').map(event => event.argv);
  const snapshot = JSON.parse(stdout);
  return { snapshot, starts };
}
function comparisons(starts, worktree) {
  return starts.filter(argv => argv[1] === '-C' && argv[2] === worktree && argv[3] === 'diff' && argv[7] !== 'HEAD');
}
function semantics(task) {
  return {
    implementationState: task.implementationProof.state,
    implementationChanges: task.implementationProof.implementationChanges,
    outsideChanges: task.implementationProof.outsideChanges,
    reviewState: task.review.state,
    reviewTarget: task.review.target,
    reviewChanges: task.review.proof?.implementationChanges,
    mainCurrent: task.main.current,
  };
}

test('one matching task target starts one comparison; a second snapshot performs fresh reads', async context => {
  const f = await sample(context);
  const first = await tracedSnapshot(f, 'first');
  const own = first.snapshot.tasks[0];
  context.diagnostic(JSON.stringify({ phase: 'same-target', gitStarts: first.starts.length, targetComparisons: comparisons(first.starts, f.task.worktree).length }));
  assert.equal(comparisons(first.starts, f.task.worktree).length, 1);
  assert.equal(own.review.state, 'approved');
  assert.deepEqual(own.review.proof, own.implementationProof);
  const second = await tracedSnapshot(f, 'second');
  assert.equal(comparisons(second.starts, f.task.worktree).length, 1);
  assert.deepEqual(semantics(second.snapshot.tasks[0]), semantics(own));
});

test('different review target is still independently compared and can invalidate approval', async context => {
  const f = await sample(context);
  await writeFile(path.join(f.task.worktree, 'apps/demo/main.js'), 'export const value = 2;\n');
  const next = commit(f.task);
  await f.writeStatus(f.task, { ...f.options, implementation: { target: next, scope: 'apps/demo' } });
  const result = await tracedSnapshot(f, 'different');
  const own = result.snapshot.tasks[0];
  assert.equal(comparisons(result.starts, f.task.worktree).length, 2);
  assert.equal(own.implementationProof.state, 'unchanged');
  assert.equal(own.review.proof.target, f.target);
  assert.equal(own.review.state, 'outdated');
  assert.deepEqual(own.review.proof.implementationChanges, ['apps/demo/main.js']);
});

test('dirty edits, deletion, and restoration are fresh in subsequent same-process snapshots', async context => {
  const f = await sample(context);
  const file = path.join(f.task.worktree, 'apps/demo/main.js');
  assert.equal((await aggregate(f.registry, now)).tasks[0].review.state, 'approved');
  await writeFile(file, 'changed');
  let own = (await aggregate(f.registry, now)).tasks[0];
  assert.equal(own.review.state, 'outdated'); assert.deepEqual(own.implementationProof.implementationChanges, ['apps/demo/main.js']);
  await rm(file);
  own = (await aggregate(f.registry, now)).tasks[0];
  assert.equal(own.review.state, 'outdated'); assert.deepEqual(own.review.proof.implementationChanges, ['apps/demo/main.js']);
  await writeFile(file, 'export const value = 1;\n');
  own = (await aggregate(f.registry, now)).tasks[0];
  assert.equal(own.review.state, 'approved');
  await writeFile(path.join(f.task.worktree, 'apps/demo/new.js'), 'untracked');
  assert.equal((await aggregate(f.registry, now)).tasks[0].review.state, 'outdated');
});

test('missing target, missing scope and missing review remain unknown, never cached green', async context => {
  const f = await sample(context);
  const absent = 'a'.repeat(40);
  await f.writeStatus(f.task, { ...f.options, implementation: { target: absent, scope: 'apps/demo' } }); await f.review(absent);
  let own = (await aggregate(f.registry, now)).tasks[0];
  assert.equal(own.implementationProof.state, 'unknown'); assert.equal(own.review.state, 'unknown');
  await f.writeStatus(f.task, { ...f.options, implementation: { target: f.target, scope: 'apps/missing' } }); await f.review(f.target);
  own = (await aggregate(f.registry, now)).tasks[0];
  assert.equal(own.implementationProof.state, 'unknown'); assert.equal(own.review.state, 'unknown');
  await f.writeStatus(f.task, f.options); await rm(path.join(f.task.worktree, f.task.planDir, 'review.md'));
  own = (await aggregate(f.registry, now)).tasks[0];
  assert.equal(own.implementationProof.state, 'unchanged'); assert.equal(own.review.state, 'unknown');
  await f.review(f.target);
  assert.equal((await aggregate(f.registry, now)).tasks[0].review.state, 'approved');
});
