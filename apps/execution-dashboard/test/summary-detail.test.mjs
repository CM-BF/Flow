import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { request as httpRequest } from 'node:http';
import { aggregate, readTaskDetail } from '../src/aggregate.mjs';
import { readSummary, readAssignments, registryFingerprint } from '../src/read-model.mjs';
import { createGitSnapshot } from '../src/git-snapshot.mjs';
import { documentLimit } from '../src/documents.mjs';
import { summaryFixture } from './summary-detail.browser.mjs';

const execute = promisify(execFile);
const unknown = async now => ({ state: 'unknown', observedAt: new Date(now).toISOString(), claims: [], message: 'synthetic unavailable; not PG authority' });
function traced() {
  const calls = [];
  const context = createGitSnapshot({ run: async (directory, args) => {
    calls.push({ directory, args });
    return (await execute('git', ['-C', directory, ...args], { timeout: 3000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } })).stdout;
  } });
  return { context, calls };
}

// One fixture / two tiny repositories for the whole direct suite, never the real registry.
test('summary/detail reads preserve declared vs observed boundaries', { timeout: 25000 }, async t => {
  let assignmentCalls = 0, releaseAssignments, credentialReads = 0;
  const fakeToken = 'synthetic_summary_token_not_a_credential_12345';
  const localAccess = { metadata: { enabled: true, productUrl: 'http://127.0.0.1:61228/', privateField: fakeToken },
    readOwnerToken: async () => { credentialReads++; return fakeToken; } };
  const waitingAssignments = new Promise(resolve => { releaseAssignments = resolve; });
  const contexts = [];
  const f = await summaryFixture(t, { localAccess, assignmentObserver: async now => { assignmentCalls++; return waitingAssignments; }, gitContext: () => { const trace = traced(); contexts.push(trace); return trace.context; } });
  const [child, parent] = f.tasks, statusFile = task => path.join(task.worktree, task.planDir, 'status.md');
  const original = await readFile(statusFile(child), 'utf8');
  await t.test('live summary is all declarations with zero Git, proof, documents or ledger work', async () => {
    const trace = traced(); const summary = await readSummary(f.registry, Date.now(), trace.context);
    assert.deepEqual(trace.calls, []); assert.equal(assignmentCalls, 0);
    assert.equal(summary.kind, 'summary'); assert.equal(summary.tasks.length, 2);
    const task = summary.tasks[0]; assert.equal(task.sourceCurrent, true); assert.equal(task.current, undefined);
    assert.equal(task.verification.state, 'not_loaded'); assert.equal(task.declarations.checks.state, 'passed');
    assert.match(task.declarations.reviewRecord, /APPROVED/); assert.equal(task.review, undefined); assert.equal(task.documents, undefined); assert.equal(task.git, undefined);
    assert.equal(task.links.basis, 'status-source'); assert.equal(task.links.parent.state, 'known');
    assert.deepEqual(summary.overview.activeIds, [parent.id]); assert.deepEqual(summary.overview.otherActiveIds, [child.id]);
    assert.deepEqual(summary.overview.blockerIds, [child.id]); assert.deepEqual(summary.overview.decisionIds, [child.id]);
  });
  await t.test('timing declarations share the summary observation without loading waiting/proof or poisoning existing progress', async () => {
    const marker = 'WAIT_ONLY_IN_SELECTED_DETAIL';
    const withWaiting = `${original}\n## 等待记录\n${marker}\n`;
    try {
      await writeFile(statusFile(child), withWaiting);
      const now = Date.parse(f.updated), trace = traced();
      const summary = await readSummary(f.registry, now, trace.context);
      const value = summary.tasks[0];
      assert.deepEqual(trace.calls, []); assert.equal(credentialReads, 0);
      assert.equal(summary.generatedAt, new Date(now).toISOString()); assert.equal(summary.generatedAt, summary.startedAt);
      assert.equal(value.declarations.timing.completed.state, 'not_completed');
      assert.equal(value.declarations.timing.source.state, 'declared'); assert.equal(value.declarations.timing.waiting, undefined);
      assert.equal(value.source.path, statusFile(child)); assert.equal(JSON.stringify(summary).includes(marker), false);
      const detail = await readTaskDetail(f.registry, child.id, now + 1000);
      assert.equal(detail.generatedAt, new Date(now + 1000).toISOString());
      assert.notEqual(detail.generatedAt, summary.generatedAt); assert.equal(detail.statusDigestBefore, value.source.digest);
      assert.match(detail.task.status.timing.waiting, /WAIT_ONLY_IN_SELECTED_DETAIL/);
      const invalid = withWaiting.replace(/(\| 任务开工时间 \| )[^|]+/, (_, prefix) => `${prefix}2026-02-30T12:00:00Z `);
      assert.notEqual(invalid, withWaiting); await writeFile(statusFile(child), invalid);
      const badTime = (await readSummary(f.registry, now)).tasks[0];
      assert.ok(badTime.declarations.timing.issues.length); assert.equal(badTime.sourceCurrent, true);
      assert.deepEqual(badTime.progress, value.progress); assert.deepEqual(badTime.declarations.checks, value.declarations.checks);
    } finally { await writeFile(statusFile(child), original); }
  });
  await t.test('source errors, bounded declarations and frozen fallback remain explicit', async () => {
    const now = Date.parse(f.updated); assert.ok(Number.isFinite(now));
    const utc = offset => new Date(now + offset).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
    const oldTime = utc(-48 * 60 * 60 * 1000), futureTime = utc(48 * 60 * 60 * 1000);
    await f.writeStatus(child, { updated: oldTime, owner: 'x'.repeat(2000) });
    const oldRecord = await readFile(statusFile(child), 'utf8');
    assert.notEqual(oldRecord, original); assert.ok(oldRecord.includes(`| 最近更新 / 最近 main 同步核验 | ${oldTime} /`));
    let summary = await readSummary(f.registry, now); let task = summary.tasks[0];
    assert.equal(task.sourceCurrent, false); assert.equal(task.source.stale, true); assert.equal(task.links.parent.state, 'unknown');
    assert.equal(task.links.parent.targetId, parent.id); assert.ok(task.declarations.owner.length < 600); assert.ok(task.declarations.truncatedFields.includes('owner'));
    await writeFile(statusFile(child), original.replace('| Branch | codex/summary-fixture |', '| Branch | wrong |'));
    assert.match((await readSummary(f.registry)).tasks[0].source.issues.join(' '), /分支.*冲突/);
    await f.writeStatus(child, { updated: futureTime });
    const futureRecord = await readFile(statusFile(child), 'utf8');
    assert.notEqual(futureRecord, original); assert.ok(futureRecord.includes(`| 最近更新 / 最近 main 同步核验 | ${futureTime} /`));
    assert.equal((await readSummary(f.registry, now)).tasks[0].source.stale, true);
    await writeFile(statusFile(child), '# invalid'); assert.equal((await readSummary(f.registry)).tasks[0].progress.total, null);
    await writeFile(statusFile(child), 'x'.repeat(documentLimit + 1));
    const trace = traced(); summary = await readSummary(f.registry, Date.now(), trace.context);
    assert.equal(summary.tasks[0].source.mode, 'frozen'); assert.equal(summary.tasks[0].sourceCurrent, false);
    assert.equal(trace.calls.length, 1); assert.equal(trace.calls[0].args[0], 'show');
    await rm(statusFile(child));
    const missing = await readSummary({ ...f.registry, frozenCommit: '0'.repeat(40) });
    assert.equal(missing.tasks[0].source.mode, 'missing'); assert.equal(missing.tasks[0].source.digest, null);
    await writeFile(statusFile(child), original);
  });
  await t.test('summary HTTP finishes while assignment observation is unresolved; no completed response cache', async () => {
    const assignment = fetch(`${f.url}/api/assignments`).then(response => response.json());
    const first = await (await fetch(`${f.url}/api/summary`)).json();
    const second = await (await fetch(`${f.url}/api/summary`)).json();
    assert.notEqual(first.readId, second.readId); assert.equal(assignmentCalls, 1);
    assert.equal(contexts.flatMap(trace => trace.calls).length, 0);
    releaseAssignments(await unknown(Date.now())); assert.equal((await assignment).assignments.state, 'unknown');
  });
  await t.test('selected detail observes only task+main, fresh dirty/deleted/main changes and legacy shape', async () => {
    const extra = { ...child, id: 'T03', worktree: path.join(f.root, 'unselected-not-a-repo') };
    const registry = { ...f.registry, tasks: [...f.tasks, extra] };
    const trace = traced(); const detail = await readTaskDetail(registry, child.id, Date.now(), trace.context);
    assert.deepEqual(new Set(trace.calls.map(call => call.directory)), new Set([child.worktree, f.registry.mainWorktree]));
    assert.equal(detail.consistency, 'matched'); assert.equal(detail.task.review.state, 'approved'); assert.equal(detail.task.main.current, true);
    const comparisons = trace.calls.filter(call => call.directory === child.worktree && call.args.length === 7 && call.args.slice(0, 4).join(' ') === 'diff --name-only -z --no-renames');
    assert.equal(comparisons.length, 1); // Same review/implementation target is reused.
    const ownFile = path.join(child.worktree, 'apps/demo/T01.js'), mainFile = path.join(f.registry.mainWorktree, 'apps/demo/T01.js');
    const body = await readFile(ownFile);
    await writeFile(ownFile, 'changed'); assert.equal((await readTaskDetail(f.registry, child.id)).task.review.state, 'outdated');
    await rm(ownFile); assert.equal((await readTaskDetail(f.registry, child.id)).task.implementationProof.state, 'changed');
    await writeFile(ownFile, body); assert.equal((await readTaskDetail(f.registry, child.id)).task.review.state, 'approved');
    await writeFile(mainFile, 'main dirty'); assert.equal((await readTaskDetail(f.registry, child.id)).task.main.current, false);
    await writeFile(mainFile, body);
    const full = await aggregate(f.registry, Date.now(), createGitSnapshot(), unknown);
    assert.deepEqual(Object.keys(full).sort(), ['assignments','generatedAt','main','milestones','overview','staleAfterHours','tasks','unregisteredAssignments']);
    assert.equal(full.tasks[0].current, true); assert.equal(full.tasks[0].review.state, 'approved'); assert.equal(full.tasks[0].source.digest, undefined);
    assert.equal(full.tasks[0].assignments, null); assert.equal(full.tasks[0].main.current, true);
  });
  await t.test('status changing during detail is not a current proof', async () => {
    const trace = traced(); let changed = false;
    const context = { ...trace.context, execute: async (directory, args) => {
      if (!changed) { changed = true; await writeFile(statusFile(child), original.replace('任务关系可从唯一记录核对', '读取期间更新')); }
      return trace.context.execute(directory, args);
    } };
    const detail = await readTaskDetail(f.registry, child.id, Date.now(), context);
    assert.equal(detail.consistency, 'changed'); assert.notEqual(detail.statusDigestBefore, detail.statusDigestAfter);
    await writeFile(statusFile(child), original);
  });
  await t.test('assignment matching preserves all claims, stale ownership and unknown failures', async () => {
    const claim = { claimId: 'synthetic', version: 3, taskId: child.id, branch: 'wrong', worktree: child.worktree, role: 'writer', state: 'handoff_pending', needsVerification: true, scope: ['apps/demo/T01.js'], next: { lead: 'next', worker: 'worker', branch: child.branch, worktree: child.worktree } };
    const value = await readAssignments(f.registry, Date.now(), async now => ({ state: 'available', observedAt: new Date(now).toISOString(), claims: [claim, { ...claim, claimId: 'unregistered', taskId: 'U01' }, { ...claim, state: 'released' }] }));
    assert.equal(value.byTask[child.id].length, 1); assert.equal(value.byTask[child.id][0].matchesSource, false);
    assert.equal(value.byTask[child.id][0].needsVerification, true); assert.deepEqual(value.byTask[child.id][0].next, claim.next);
    assert.equal(value.unregisteredAssignments[0].claimId, 'unregistered'); assert.deepEqual(value.byTask[parent.id], []);
    const failed = await readAssignments(f.registry, Date.now(), async () => { throw new Error('synthetic unavailable'); });
    assert.equal(failed.assignments.state, 'unknown'); assert.equal(failed.byTask[child.id], null);
    assert.notEqual(value.registryFingerprint, registryFingerprint({ ...f.registry, tasks: [{ ...child, branch: 'other' }, parent] }));
  });
  await t.test('server read-only boundary, selected detail coalescing, documents and snapshot compatibility', async () => {
    contexts.length = 0;
    const [a, b] = await Promise.all([fetch(`${f.url}/api/task?task=T01`).then(r => r.json()), fetch(`${f.url}/api/task?task=T01`).then(r => r.json())]);
    assert.equal(contexts.length, 1); assert.deepEqual(a, b);
    await fetch(`${f.url}/api/task?task=T01`); assert.equal(contexts.length, 2);
    assert.equal((await fetch(`${f.url}/api/task?task=not-registered`)).status, 404);
    assert.equal((await fetch(`${f.url}/api/summary`, { method: 'POST' })).status, 405);
    let inboundHost;
    const observeHost = request => { if (request.url === '/api/summary') inboundHost = request.headers.host; };
    f.server.on('request', observeHost);
    try {
      const responseStatus = await new Promise((resolve, reject) => {
        const request = httpRequest(`${f.url}/api/summary`, { headers: { Host: 'example.invalid' }, agent: false }, response => {
          response.on('error', reject); response.once('aborted', () => reject(new Error('Host probe response aborted')));
          response.once('end', () => resolve(response.statusCode)); response.resume();
        });
        request.setTimeout(2000, () => request.destroy(new Error('Host probe timed out')));
        request.on('error', reject); request.end();
      });
      assert.equal(inboundHost, 'example.invalid', 'The real server must receive the exact untrusted Host');
      assert.equal(responseStatus, 403);
    } finally { f.server.off('request', observeHost); }
    const url = file => `${f.url}/api/document?${new URLSearchParams({ task: child.id, path: file })}`;
    assert.match(await (await fetch(url(`${child.planDir}/plan.md`))).text(), /# 计划/);
    assert.equal((await fetch(url('../../secret'))).status, 404);
    const plan = path.join(child.worktree, child.planDir, 'plan.md'); await rm(plan); await symlink(path.join(f.root, 'outside.md'), plan);
    await writeFile(path.join(f.root, 'outside.md'), 'secret'); assert.equal((await fetch(url(`${child.planDir}/plan.md`))).status, 404);
    await rm(plan); await writeFile(plan, '# 计划\n');
    assert.ok((await (await fetch(`${f.url}/api/snapshot`)).json()).tasks[0].implementationProof);
  });
  await t.test('ACCESS private handler precedes read-only routing and never leaks into dashboard observations', async () => {
    const metadata = await (await fetch(`${f.url}/api/local-access`)).text();
    assert.equal(JSON.parse(metadata).enabled, true); assert.equal(metadata.includes(fakeToken), false); assert.equal(credentialReads, 0);
    for (const endpoint of ['/api/summary', '/api/assignments', '/api/task?task=T01', '/api/snapshot']) {
      const response = await fetch(`${f.url}${endpoint}`);
      assert.equal(response.status, 200); assert.equal((await response.text()).includes(fakeToken), false, endpoint);
    }
    assert.equal(credentialReads, 0);
    const endpoint = `${f.url}/api/local-access/owner-token`;
    assert.equal((await fetch(endpoint)).status, 405);
    assert.equal((await fetch(endpoint, { method: 'POST' })).status, 403);
    const response = await fetch(endpoint, { method: 'POST', headers: {
      Origin: f.url, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'X-Flow-Local-Access': '1',
    } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ownerToken: fakeToken }); assert.equal(credentialReads, 1);
    assert.equal((await fetch(`${f.url}/api/summary`, { method: 'POST' })).status, 405);
  });
  t.diagnostic(JSON.stringify({ repositories: 2, tasks: 2, pg: 0, registry: 'synthetic only' }));
});
