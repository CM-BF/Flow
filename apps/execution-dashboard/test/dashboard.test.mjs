import { test } from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { writeFile, rm, mkdir, symlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { aggregate } from '../src/aggregate.mjs';
import { validateRegistry } from '../src/registry.mjs';
import { fixture, now, git, commit, status } from './fixture.mjs';

const getTask = (snapshot, id = 'T01') => snapshot.tasks.find(task => task.id === id);

test('reads only authoritative owners and reflects independent status changes over HTTP', async context => {
  const f = await fixture(context);
  const [first, second] = f.tasks;
  await mkdir(path.join(second.worktree, first.planDir), { recursive: true });
  await writeFile(path.join(second.worktree, first.planDir, 'status.md'), status(first, { owner: 'wrong-copy', todo: 'completed' }));
  const before = await (await fetch(`${f.url}/api/snapshot`)).json();
  assert.match(getTask(before).status.owner, /^owner-T01/);
  assert.equal(getTask(before).progress.completed, 0);
  await f.writeStatus(first, { todo: 'completed（branch）', branchState: '实现已提交，分支完成，待review' });
  const after = await (await fetch(`${f.url}/api/snapshot`)).json();
  assert.equal(getTask(after).progress.completed, 1);
  assert.equal(getTask(after, 'T02').progress.completed, 0);
  assert.equal(getTask(after).git.dirty, true);
  assert.equal(getTask(after).status.checks.state, 'not_run');
  assert.equal(getTask(after).review.state, 'not_started');
  assert.match(getTask(after).main.record, /未集成/);
  assert.equal(getTask(after).main.current, false);
});

test('empty review never means approval; historical checks remain unknown without explicit field', async context => {
  const f = await fixture(context); const task = f.tasks[0];
  await f.writeStatus(task, { todo: 'completed', checks: '', review: 'APPROVED' });
  await writeFile(path.join(task.worktree, task.planDir, 'review.md'), ' \n');
  const result = getTask(await aggregate(f.registry, now));
  assert.equal(result.review.state, 'not_started');
  assert.equal(result.status.checks.state, 'unknown');
  assert.equal(result.progress.completed, 1);
  assert.match(result.main.record, /未集成/);
});

test('missing status uses frozen baseline and marks unknown without affecting another task', async context => {
  const f = await fixture(context); const task = f.tasks[0];
  await rm(path.join(task.worktree, task.planDir, 'status.md'));
  const result = await aggregate(f.registry, now);
  assert.equal(getTask(result).source.mode, 'frozen');
  assert.equal(getTask(result).current, false);
  assert.match(getTask(result).issues[0], /冻结基线旧记录/);
  assert.equal(getTask(result, 'T02').current, true);
  f.registry.frozenCommit = '0'.repeat(40);
  assert.equal(getTask(await aggregate(f.registry, now)).source.mode, 'missing');
});

test('malformed, duplicate, stale and future status cannot silently become current', async context => {
  const f = await fixture(context); const task = f.tasks[0];
  await writeFile(path.join(task.worktree, task.planDir, 'status.md'), 'broken markdown\n');
  let result = getTask(await aggregate(f.registry, now));
  assert.equal(result.current, false); assert.ok(result.status.errors.length > 0);
  await writeFile(path.join(task.worktree, task.planDir, 'status.md'), status(task).replace('| T01-01 | pending | owner | 尚未检查 |', '| T01-01 | completed | owner | done |\n| T01-01 | pending | owner | conflict |'));
  result = getTask(await aggregate(f.registry, now)); assert.equal(result.current, false); assert.match(result.issues.join(' '), /重复 TODO ID/); assert.equal(result.progress.completed, null);
  await writeFile(path.join(task.worktree, task.planDir, 'status.md'), status(task).replace('| Branch | codex/t01 |', '| Branch | codex/t01 |\n| Branch | codex/wrong |'));
  result = getTask(await aggregate(f.registry, now)); assert.equal(result.current, false); assert.match(result.issues.join(' '), /重复字段/);
  await f.writeStatus(task, { updated: '2026-10-01 01:59 UTC' });
  result = getTask(await aggregate(f.registry, now)); assert.equal(result.source.stale, true);
  await f.writeStatus(task, { updated: '2027-10-01 01:59 UTC' });
  result = getTask(await aggregate(f.registry, now)); assert.match(result.issues.join(' '), /未来/);
});

test('branch changes conflict and registry explicitly switches to a new owner worktree', async context => {
  const f = await fixture(context); const task = f.tasks[0];
  git(task.worktree, 'switch', '-qc', 'codex/unregistered');
  let result = getTask(await aggregate(f.registry, now));
  assert.equal(result.current, false); assert.match(result.issues.join(' '), /冲突/);
  const target = f.tasks[1];
  await mkdir(path.join(target.worktree, task.planDir), { recursive: true });
  const next = { ...task, worktree: target.worktree, branch: target.branch };
  await writeFile(path.join(target.worktree, task.planDir, 'status.md'), status(next, { owner: 'replacement-owner' }));
  await writeFile(path.join(target.worktree, task.planDir, 'review.md'), '');
  f.registry.tasks[0] = next;
  result = getTask(await aggregate(f.registry, now));
  assert.match(result.status.owner, /replacement-owner/); assert.equal(result.source.path, `${target.worktree}/${task.planDir}/status.md`);
});

test('documents reject traversal, encoded traversal, absolute paths and arbitrary task files', async context => {
  const f = await fixture(context); const task = f.tasks[0];
  const requests = ['../../AGENTS.md', '/etc/passwd', `${task.planDir}/../t02/status.md`, '%2e%2e/%2e%2e/AGENTS.md', '.git/config', `${task.evidenceDir}/unreferenced.md`, `${task.evidenceDir}/x.html`, 'plans/t02/status.md', `${task.planDir}\\status.md`];
  for (const candidate of requests) {
    const response = await fetch(`${f.url}/api/document?${new URLSearchParams({ task: task.id, path: candidate })}`);
    assert.equal(response.status, 404, candidate);
  }
  assert.equal((await fetch(`${f.url}/api/document?task=UNKNOWN&path=plans/t01/status.md`)).status, 404);
  assert.equal((await fetch(`${f.url}/api/document?task=T01&path=plans/t01/status.md`)).status, 200);
});

test('referenced symlinks cannot escape task scope inside or outside registered worktree', async context => {
  const f = await fixture(context); const task = f.tasks[0];
  await writeFile(path.join(task.worktree, 'private.md'), 'not exposed');
  const links = ['outside.md', 'other-task.md'];
  await symlink(path.join(f.tasks[1].worktree, f.tasks[1].planDir, 'status.md'), path.join(task.worktree, task.evidenceDir, links[0]));
  await symlink(path.join(task.worktree, 'private.md'), path.join(task.worktree, task.evidenceDir, links[1]));
  await writeFile(path.join(task.worktree, task.planDir, 'plan.md'), links.map(name => `[${name}](../../${task.evidenceDir}/${name})`).join('\n'));
  for (const name of links) assert.equal((await fetch(`${f.url}/api/document?${new URLSearchParams({ task: task.id, path: `${task.evidenceDir}/${name}` })}`)).status, 404);
});

test('untrusted text stays text with read-only HTTP and restrictive browser headers', async context => {
  const f = await fixture(context); const task = f.tasks[0];
  const injected = '<img src=x onerror="window.pwned=true"><script>alert(1)</script>';
  await f.writeStatus(task, { owner: injected });
  const snapshot = await (await fetch(`${f.url}/api/snapshot`)).json(); assert.match(getTask(snapshot).status.owner, /<script>/);
  const document = await fetch(`${f.url}/api/document?task=T01&path=plans/t01/status.md`);
  assert.match(document.headers.get('content-type'), /^text\/plain/);
  assert.equal(document.headers.get('x-content-type-options'), 'nosniff');
  assert.match(document.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(await document.text(), /<script>/);
  assert.equal((await fetch(`${f.url}/api/snapshot`, { method: 'POST' })).status, 405);
  const forbiddenHost = await new Promise((resolve, reject) => { const request = http.get(`${f.url}/api/snapshot`, { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); }); request.on('error', reject); });
  assert.equal(forbiddenHost, 403);
  const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8'); assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML/);
});

test('invalid registry, duplicate owners and oversized files are rejected', async context => {
  const f = await fixture(context); const task = f.tasks[0];
  assert.throws(() => validateRegistry({ ...f.registry, tasks: [task, task] }), /唯一/);
  assert.throws(() => validateRegistry({ ...f.registry, tasks: [{ ...task, planDir: 'plans/../private' }] }), /超出范围/);
  await writeFile(path.join(task.worktree, task.planDir, 'plan.md'), 'x'.repeat(2 * 1024 * 1024 + 1));
  assert.equal((await fetch(`${f.url}/api/document?task=T01&path=plans/t01/plan.md`)).status, 404);
});
