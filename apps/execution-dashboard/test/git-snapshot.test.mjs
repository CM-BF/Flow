import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createGitSnapshot } from '../src/git-snapshot.mjs';
import { aggregate, observeGit } from '../src/aggregate.mjs';
import { compareImplementation, integrationProof, parseImplementation } from '../src/proof.mjs';
import { status } from './fixture.mjs';

const head = 'a'.repeat(40), nextHead = 'b'.repeat(40);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const declaration = (target = head) => parseImplementation(target, 'src/a,src/b');
const task = (directory, target = head) => ({ worktree: directory, status: { implementation: declaration(target) }, implementationProof: { state: 'unchanged' } });
const main = (target = head) => ({ available: true, branch: 'main', head: target, observedAt: '2026-10-06T00:00:00Z' });
function output(directory, args) {
  if (args[0] === 'rev-parse') return args[1] === '--show-toplevel' ? `${directory}\n` : `${head}\n`;
  if (args[0] === 'branch') return 'main\n';
  if (args[0] === 'cat-file') return 'commit\n';
  if (args[0] === 'ls-tree') return args.slice(args.indexOf('--') + 1).map(scope => `100644 blob ${head}\t${scope.replace(':(literal)', '')}\0`).join('');
  return '';
}

test('budget: default four actual jobs, FIFO handoff, raw stdout and caller args retained', async () => {
  const flights = [], seen = []; let active = 0, peak = 0;
  const context = createGitSnapshot({ run: async (directory, args) => {
    const flight = deferred(); flights.push(flight); seen.push([directory, args]); active++; peak = Math.max(peak, active);
    try { return await flight.promise; } finally { active--; }
  } });
  const results = Array.from({ length: 6 }, (_, i) => context.execute('/repo', [String(i)]));
  await tick(); assert.equal(flights.length, 4); assert.equal(peak, 4);
  flights[0].resolve(' \0raw\n'); await tick(); assert.equal(flights.length, 5);
  flights[1].resolve('1'); await tick(); assert.equal(flights.length, 6);
  for (let i = 2; i < flights.length; i++) flights[i].resolve(String(i));
  assert.equal((await Promise.all(results))[0], ' \0raw\n'); assert.equal(active, 0);
  assert.deepEqual(seen.map(([, args]) => args[0]), ['0', '1', '2', '3', '4', '5']);
});

test('budget: synchronous spawn, timeout and size failures preserve error and release the only permit', async () => {
  for (const code of ['ENOENT', 'ETIMEDOUT', 'E2BIG', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER']) {
    const error = Object.assign(new Error(code), { code }); let calls = 0;
    const context = createGitSnapshot({ concurrency: 1, run: () => { if (++calls === 1) throw error; return Promise.resolve('next'); } });
    const failed = context.execute('/repo', ['first']); const success = context.execute('/repo', ['second']);
    await assert.rejects(failed, value => value === error); assert.equal(await success, 'next');
  }
});

test('budget: rejects invalid concurrency without starting a job', () => {
  for (const concurrency of [0, -1, 1.5, Infinity, NaN]) assert.throws(() => createGitSnapshot({ concurrency }), /concurrency/);
});

test('main: one immutable observation per directory/captured head; terminal HEAD check follows both reads', async () => {
  const calls = [], dirty = deferred(), untracked = deferred();
  const context = createGitSnapshot({ run: async (directory, args) => {
    calls.push([directory, args]);
    if (args[0] === 'diff') return dirty.promise;
    if (args[0] === 'ls-files') return untracked.promise;
    return `${head}\n`;
  } });
  const first = context.mainChanges('/main', head), same = context.mainChanges('/main', head);
  assert.equal(first, same); await tick(); assert.equal(calls.length, 2);
  dirty.resolve('src/tab\tname\0'); await tick(); assert.equal(calls.length, 2);
  untracked.resolve('src/line\nname\0'); const result = await first;
  assert.deepEqual(result, { dirty: 'src/tab\tname\0', untracked: 'src/line\nname\0' }); assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(calls[0][1], ['diff', '--name-only', '-z', '--no-renames', head, '--']);
  assert.deepEqual(calls.at(-1)[1], ['rev-parse', 'HEAD']);
  await context.mainChanges('/other', head); assert.equal(calls.length, 6);
  await assert.rejects(context.mainChanges('/main', nextHead), /HEAD/); assert.equal(calls.length, 9);
});

test('main: failure is shared as unknown, not an empty dirty list, but next snapshot retries', async () => {
  let reads = 0;
  const run = async (directory, args) => { if (args[0] === 'diff') { reads++; throw new Error('read denied'); } return output(directory, args); };
  const context = createGitSnapshot({ run });
  const results = await Promise.all([1, 2].map(() => integrationProof(task('/main'), '/main', main(), context)));
  assert.ok(results.every(result => result.current === false && /read denied/.test(result.reason)));
  assert.equal(reads, 1);
  await integrationProof(task('/main'), '/main', main(), createGitSnapshot({ run })); assert.equal(reads, 2);
});

test('main: queued HEAD change rejects current proof while preserving historical ancestry', async () => {
  const context = createGitSnapshot({ concurrency: 1, run: async (directory, args) => args[0] === 'rev-parse' ? `${nextHead}\n` : output(directory, args) });
  const result = await integrationProof(task('/main'), '/main', main(), context);
  assert.equal(result.current, false); assert.equal(result.historicalIntegrated, true); assert.match(result.reason, /HEAD/);
});

test('proof: captured owner head, exact NUL paths, outside-code unknown and metadata remain distinct', async () => {
  const calls = [];
  const run = async (directory, args) => { calls.push(args); return args[0] === 'diff' && args.length === 6 ? 'docs/raw.json\0outside/code.js\0' : output(directory, args); };
  const result = await compareImplementation('/owner', head, nextHead, declaration(), createGitSnapshot({ run }));
  assert.equal(result.state, 'unknown'); assert.deepEqual(result.outsideChanges, ['outside/code.js']);
  assert.deepEqual(result.metadataChanges, ['docs/raw.json']);
  assert.ok(calls.some(args => args[0] === 'diff' && args[4] === nextHead && args.length === 6));
  assert.ok(!calls.some(args => args.includes('HEAD')));
});

test('tree: MAXBUFFER/E2BIG fallback remains serial within shared budget and discards partial stdout', async () => {
  for (const code of ['ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'E2BIG']) {
    const trees = []; let active = 0, peak = 0;
    const context = createGitSnapshot({ concurrency: 1, run: async (directory, args) => {
      active++; peak = Math.max(peak, active);
      try {
        await tick();
        if (args[0] === 'ls-tree') {
          trees.push(args);
          if (args.length === 8) throw Object.assign(new Error('size limit'), { code, stdout: `partial\toutside\0` });
        }
        return output(directory, args);
      } finally { active--; }
    } });
    const result = await compareImplementation('/owner', head, head, declaration(), context);
    assert.equal(result.state, 'unchanged'); assert.equal(peak, 1); assert.equal(trees.length, 3);
    assert.deepEqual(trees.slice(1).map(args => args.at(-1)), [':(literal)src/a', ':(literal)src/b']);
  }
});

test('tree: singleton size error and ordinary failure remain unknown without retries', async () => {
  for (const [code, scopes] of [['E2BIG', 'src/a'], ['ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'src/a'], ['EACCES', 'src/a,src/b']]) {
    let reads = 0;
    const context = createGitSnapshot({ run: async (directory, args) => {
      if (args[0] === 'ls-tree') { reads++; throw Object.assign(new Error(code), { code }); }
      return output(directory, args);
    } });
    const result = await compareImplementation('/owner', head, head, parseImplementation(head, scopes), context);
    assert.equal(result.state, 'unknown'); assert.equal(reads, 1); assert.match(result.reason, new RegExp(code));
  }
});

test('aggregate: observations, frozen git show, owner/review and main proofs all share one execution budget', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dperf-controlled-'));
  try {
    const owner = path.join(root, 'owner'), mainWorktree = path.join(root, 'main'); await mkdir(owner); await mkdir(mainWorktree);
    const entry = { id: 'T1', title: 'sample', worktree: owner, branch: 'main', planDir: 'plans/test', evidenceDir: 'docs/test' };
    const calls = []; let active = 0, peak = 0;
    const context = createGitSnapshot({ concurrency: 1, run: async (directory, args) => {
      active++; peak = Math.max(peak, active); calls.push([directory, args]);
      try { await tick(); return args[0] === 'show' ? status(entry, { implementation: { target: head, scope: 'src/a,src/b' } }) : output(directory, args); }
      finally { active--; }
    } });
    const registry = { tasks: [entry], mainWorktree, fallbackWorktree: mainWorktree, frozenCommit: head, staleAfterHours: 24 };
    const result = await aggregate(registry, Date.parse('2026-10-06T02:00:00Z'), context);
    assert.equal(peak, 1); assert.equal(result.tasks[0].source.mode, 'frozen'); assert.equal(result.tasks[0].git.available, true);
    assert.equal(result.tasks[0].implementationProof.state, 'unchanged'); assert.equal(result.tasks[0].main.current, true);
    for (const command of ['show', 'status', 'branch', 'cat-file', 'ls-tree', 'diff', 'ls-files', 'merge-base']) assert.ok(calls.some(([, args]) => args[0] === command), command);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// Opt-in measurement is separate from ordinary controlled tests and preserves every run directory.
if (process.env.FLOW_DPERF_EXPERIMENT === '1') test('bounded temporary Git experiment (no real registry or coordination DB)', async () => {
  const evidence = path.resolve(process.env.FLOW_DPERF_EVIDENCE_DIR ?? 'docs/evidence/wpf-dperf03');
  const runDirectory = path.join(evidence, `experiment-${Date.now()}`);
  const budgetFile = path.join(evidence, 'experiment-budget.json');
  const previous = await readFile(budgetFile, 'utf8').then(JSON.parse, error => { if (error.code === 'ENOENT') return { elapsedMs: 0, runs: [] }; throw error; });
  assert.ok(previous.elapsedMs < 35000, 'No remaining work budget; reserve at least 10 seconds for cleanup');
  await mkdir(runDirectory, { recursive: true });
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TRACE2_EVENT: '' };
  delete env.FLOW_COORDINATION_DATABASE_URL; delete env.FLOW_COORDINATION_REPO;
  const report = { recordedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), cases: [], failure: null, cleanup: null };
  const { createHash } = await import('node:crypto');
  report.sources = {};
  for (const source of ['apps/execution-dashboard/src/aggregate.mjs', 'apps/execution-dashboard/src/proof.mjs', 'apps/execution-dashboard/src/git-snapshot.mjs', 'apps/execution-dashboard/test/git-snapshot.test.mjs']) {
    report.sources[source] = createHash('sha256').update(await readFile(source)).digest('hex');
  }
  const start = performance.now(); let root;
  const remaining = () => 35000 - previous.elapsedMs - (performance.now() - start);
  const checkpoint = () => assert.ok(remaining() > 0, 'Work budget exhausted; stop and clean owned temporary repositories');
  const git = (directory, args) => { checkpoint(); return execFileSync('git', ['-C', directory, ...args], { env, encoding: 'utf8', timeout: Math.min(5000, Math.ceil(remaining())), maxBuffer: 2 * 1024 * 1024 }).trim(); };
  async function trace(name, action) {
    checkpoint(); const file = path.join(runDirectory, `${name}.jsonl.log`), before = process.env.GIT_TRACE2_EVENT;
    process.env.GIT_TRACE2_EVENT = file;
    const started = performance.now(); let value;
    try { value = await action(); }
    finally { if (before === undefined) delete process.env.GIT_TRACE2_EVENT; else process.env.GIT_TRACE2_EVENT = before; }
    const events = (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
    const commands = events.filter(event => event.event === 'start').map(event => event.argv);
    let active = 0, peak = 0;
    for (const event of events.filter(event => ['start', 'exit'].includes(event.event)).sort((a, b) => a.time.localeCompare(b.time))) {
      active += event.event === 'start' ? 1 : -1; peak = Math.max(peak, active);
    }
    report.cases.push({ name, elapsedMs: performance.now() - started, gitStarts: commands.length, tracePeakIntervals: peak, unclosedIntervals: active });
    return { value, commands };
  }
  try {
    root = await mkdtemp(path.join(tmpdir(), 'dperf03-git-')); const repos = [], heads = [];
    for (let i = 0; i < 8; i++) {
      checkpoint(); const repo = path.join(root, String(i)); await mkdir(repo); repos.push(repo);
      git(repo, ['init', '-q', '-b', 'main']); await writeFile(path.join(repo, 'sample.txt'), 'same\n');
      git(repo, ['add', '.']); git(repo, ['-c', 'user.name=DPERF fixture', '-c', 'user.email=dperf@example.invalid', 'commit', '-qm', 'sample']);
      heads.push(git(repo, ['rev-parse', 'HEAD']));
    }
    const observations = await trace('eight-repositories', () => { const context = createGitSnapshot(); return Promise.all(repos.map(repo => observeGit(repo, context))); });
    assert.equal(observations.commands.length, 32); assert.ok(observations.value.every(value => value.available && !value.dirty));
    const repo = repos[0], target = heads[0], implementation = parseImplementation(target, 'sample.txt');
    const ownTask = { worktree: repo, status: { implementation }, implementationProof: { state: 'unchanged' } };
    const observedMain = { ...main(target) };
    const proofs = await trace('four-main-proofs', () => { const context = createGitSnapshot(); return Promise.all(Array.from({ length: 4 }, () => integrationProof(ownTask, repo, observedMain, context))); });
    assert.ok(proofs.value.every(proof => proof.current && proof.method === 'ancestor'));
    assert.equal(proofs.commands.length, 23);
    assert.equal(proofs.commands.filter(args => args[3] === 'diff').length, 1);
    assert.equal(proofs.commands.filter(args => args[3] === 'ls-files').length, 1);
    assert.equal(proofs.commands.filter(args => args[3] === 'rev-parse' && args[4] === 'HEAD').length, 1);
    report.cases.at(-1).proofs = proofs.value;
    await trace('freshness-and-isolation', async () => {
      const first = createGitSnapshot(); assert.deepEqual(await first.mainChanges(repo, target), { dirty: '', untracked: '' });
      await writeFile(path.join(repo, 'sample.txt'), 'changed\n'); await writeFile(path.join(repo, 'untracked.txt'), 'new');
      assert.deepEqual(await first.mainChanges(repo, target), { dirty: '', untracked: '' });
      const second = createGitSnapshot(), changed = await second.mainChanges(repo, target);
      assert.equal(changed.dirty, 'sample.txt\0'); assert.equal(changed.untracked, 'untracked.txt\0');
      const other = await second.mainChanges(repos[1], heads[1]); assert.deepEqual(other, { dirty: '', untracked: '' });
      await writeFile(path.join(repo, 'sample.txt'), 'same\n'); await rm(path.join(repo, 'untracked.txt'));
      assert.deepEqual(await createGitSnapshot().mainChanges(repo, target), { dirty: '', untracked: '' });
    });
    await trace('queued-head-movement', async () => {
      const context = createGitSnapshot({ concurrency: 1 });
      const observation = context.mainChanges(repo, target);
      // Both jobs are enqueued but execute resumes on the microtask turn after this synchronous commit.
      git(repo, ['-c', 'user.name=DPERF fixture', '-c', 'user.email=dperf@example.invalid', 'commit', '--allow-empty', '-qm', 'new head']);
      await assert.rejects(observation, /HEAD changed/);
      await assert.rejects(context.mainChanges(repo, target), /HEAD changed/);
      assert.deepEqual(await createGitSnapshot().mainChanges(repo, git(repo, ['rev-parse', 'HEAD'])), { dirty: '', untracked: '' });
    });
    const frozenTask = { id: 'TEMP1', title: 'temporary fixture', branch: 'main', worktree: repos[2], planDir: 'plans/temp', evidenceDir: 'docs/temp' };
    await mkdir(path.join(repos[2], frozenTask.planDir), { recursive: true });
    await writeFile(path.join(repos[2], frozenTask.planDir, 'status.md'), status(frozenTask));
    git(repos[2], ['add', '.']); git(repos[2], ['-c', 'user.name=DPERF fixture', '-c', 'user.email=dperf@example.invalid', 'commit', '-qm', 'frozen status']);
    const frozenCommit = git(repos[2], ['rev-parse', 'HEAD']); await rm(path.join(repos[2], frozenTask.planDir, 'status.md'));
    const fallback = await trace('aggregate-frozen-fallback', () => aggregate({ tasks: [frozenTask], mainWorktree: repos[0], fallbackWorktree: repos[2], frozenCommit, staleAfterHours: 24 }, Date.parse('2026-10-06T02:00:00Z')));
    assert.equal(fallback.value.tasks[0].source.mode, 'frozen'); assert.equal(fallback.commands.filter(args => args[3] === 'show').length, 1);
    const recovered = await trace('real-spawn-failure-releases-permit', async () => {
      const context = createGitSnapshot({ concurrency: 1 });
      const failed = context.execute(path.join(root, 'missing'), ['status']);
      const next = context.execute(repo, ['rev-parse', 'HEAD']);
      await assert.rejects(failed); assert.equal((await next).trim(), git(repo, ['rev-parse', 'HEAD']));
    });
    assert.equal(recovered.commands.length, 2);
    checkpoint();
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; throw error; }
  finally {
    const cleanupStart = performance.now();
    try { if (root) await rm(root, { recursive: true, force: true }); report.cleanup = { state: 'fulfilled', removedOwnedRoot: root, elapsedMs: performance.now() - cleanupStart }; }
    catch (error) { report.cleanup = { state: 'rejected', error: error.message, root }; }
    report.elapsedMs = performance.now() - start;
    report.cumulativeMs = previous.elapsedMs + report.elapsedMs;
    report.scope = 'Owned tiny temporary repositories; Trace2 start/exit intervals are not OS census, CPU, production latency or atomic Git observations';
    await writeFile(path.join(runDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await writeFile(budgetFile, JSON.stringify({ elapsedMs: report.cumulativeMs, runs: [...previous.runs, { directory: runDirectory, elapsedMs: report.elapsedMs, failure: report.failure, cleanup: report.cleanup }] }, null, 2) + '\n');
    console.log(JSON.stringify({ report: path.join(runDirectory, 'report.json'), elapsedMs: report.elapsedMs, cumulativeMs: report.cumulativeMs, cleanup: report.cleanup }));
  }
  assert.equal(report.cleanup.state, 'fulfilled'); assert.ok(report.cumulativeMs <= 45000);
  let bytes = 0;
  const { readdir } = await import('node:fs/promises');
  async function count(directory) { for (const entry of await readdir(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) await count(file); else bytes += (await stat(file)).size; } }
  await count(evidence); assert.ok(bytes <= 8 * 1024 * 1024); console.log(JSON.stringify({ rawBytes: bytes }));
});
