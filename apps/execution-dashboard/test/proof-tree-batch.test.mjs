import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compareImplementation, integrationProof, parseImplementation } from '../src/proof.mjs';

const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TRACE2_EVENT: '' };
function git(directory, args, input) {
  return execFileSync('git', ['-C', directory, ...args], { env, input, encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024 }).trim();
}
async function fixture(context) {
  const root = await mkdtemp(path.join(tmpdir(), 'flow-proof-batch-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo');
  await mkdir(repo);
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.name', 'Proof fixture']);
  git(repo, ['config', 'user.email', 'proof@example.invalid']);
  const write = async (name, text = name) => { await mkdir(path.dirname(path.join(repo, name)), { recursive: true }); await writeFile(path.join(repo, name), text); };
  const commit = () => { git(repo, ['add', '.']); git(repo, ['commit', '-qm', 'fixture']); return git(repo, ['rev-parse', 'HEAD']); };
  return { root, repo, write, commit };
}
async function traced(f, action) {
  const trace = path.join(f.root, `trace-${Date.now()}-${Math.random()}.jsonl`);
  const previous = process.env.GIT_TRACE2_EVENT;
  process.env.GIT_TRACE2_EVENT = trace;
  let result;
  try { result = await action(); }
  finally { if (previous === undefined) delete process.env.GIT_TRACE2_EVENT; else process.env.GIT_TRACE2_EVENT = previous; }
  const events = (await readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const commands = events.filter(event => event.event === 'start').map(event => event.argv);
  return { result, trees: commands.filter(argv => argv[3] === 'ls-tree'), commands };
}
const declaration = (target, scopes) => parseImplementation(target, scopes.join(','));
const compare = (f, target, scopes) => compareImplementation(f.repo, target, git(f.repo, ['rev-parse', 'HEAD']), declaration(target, scopes));
async function mainProof(f, target, scopes) {
  return integrationProof({ worktree: f.repo, status: { implementation: declaration(target, scopes), mainRecord: target }, implementationProof: { state: 'unchanged' } }, f.repo, { available: true, branch: 'main', head: git(f.repo, ['rev-parse', 'HEAD']), observedAt: new Date().toISOString() });
}

test('128 literal declarations use one tree read without changing public proof or next-snapshot freshness', async context => {
  const f = await fixture(context), scopes = [];
  for (let i = 0; i < 128; i++) { scopes.push(`src/f${i}.txt`); await f.write(scopes.at(-1)); }
  const target = f.commit();
  const first = await traced(f, () => compare(f, target, scopes));
  assert.equal(first.result.state, 'unchanged');
  assert.equal(first.trees.length, 1);
  assert.equal(first.trees[0].filter(arg => arg.startsWith(':(literal)')).length, 128);
  await f.write(scopes[63], 'changed');
  const next = await traced(f, () => compare(f, target, scopes));
  assert.equal(next.result.state, 'changed');
  assert.deepEqual(next.result.implementationChanges, [scopes[63]]);
  assert.equal(next.trees.length, 1);
});

test('overlapping directories and duplicate declarations preserve full NUL records including unusual descendant names', async context => {
  const f = await fixture(context);
  for (const name of ['src/目录.txt', 'src/tab\tname', 'src/line\nname', 'src/run']) await f.write(name);
  await chmod(path.join(f.repo, 'src/run'), 0o755);
  await symlink('目录.txt', path.join(f.repo, 'src/link'));
  let target = f.commit();
  git(f.repo, ['update-index', '--add', '--cacheinfo', `160000,${target},src/gitlink`]);
  git(f.repo, ['commit', '-qm', 'gitlink']);
  target = git(f.repo, ['rev-parse', 'HEAD']);
  git(f.repo, ['update-index', '--skip-worktree', 'src/gitlink']);
  const scopes = ['src', 'src/run', 'src', 'src/link', 'src/gitlink'];
  const before = await traced(f, () => mainProof(f, target, scopes));
  assert.equal(before.result.current, true, JSON.stringify(before.result));
  assert.equal(before.trees.length, 2);
  await chmod(path.join(f.repo, 'src/run'), 0o644);
  assert.equal((await mainProof(f, target, scopes)).current, false);
  git(f.repo, ['add', 'src/run']); git(f.repo, ['commit', '-qm', 'mode changed']);
  const changed = await mainProof(f, target, scopes);
  assert.equal(changed.scopeEqual, false);
  assert.equal(changed.historicalIntegrated, true);
});

test('missing individual scope is unknown even when another scope or similarly named directory returns entries', async context => {
  const f = await fixture(context); await f.write('alpha-long/a.txt'); await f.write('present.txt'); const target = f.commit();
  for (const missing of ['alpha', 'absent.txt']) {
    const proof = await compare(f, target, ['present.txt', 'alpha-long', missing]);
    assert.equal(proof.state, 'unknown'); assert.match(proof.reason, new RegExp(missing));
  }
});

test('main deletion is a changed tree, not a missing source or green proof', async context => {
  const f = await fixture(context); await f.write('one/a'); await f.write('two/b'); const target = f.commit();
  await rm(path.join(f.repo, 'two'), { recursive: true }); f.commit();
  const proof = await mainProof(f, target, ['one', 'two']);
  assert.equal(proof.scopeEqual, false); assert.equal(proof.current, false); assert.equal(proof.method, 'ancestor-changed');
});

test('different repositories or commits cannot reuse a successful tree', async context => {
  const a = await fixture(context), b = await fixture(context); await a.write('src/a', 'A'); await b.write('src/a', 'B');
  const targetA = a.commit(), targetB = b.commit();
  assert.equal((await compare(a, targetA, ['src'])).state, 'unchanged');
  assert.equal((await compare(b, targetA, ['src'])).state, 'unknown');
  assert.equal((await compare(b, targetB, ['src'])).state, 'unchanged');
});

async function indexedLargeTree(f, groups) {
  const blob = git(f.repo, ['hash-object', '-w', '--stdin'], 'x');
  const subtrees = [];
  for (const [name, count] of groups) {
    const entries = Array.from({ length: count }, (_, i) => `100644 blob ${blob}\t${String(i).padStart(5, '0')}-${'x'.repeat(115)}\0`).join('');
    const tree = git(f.repo, ['mktree', '-z'], entries);
    subtrees.push(`040000 tree ${tree}\t${name}\0`);
  }
  const tree = git(f.repo, ['mktree', '-z'], subtrees.join(''));
  const target = git(f.repo, ['commit-tree', tree, '-m', 'large immutable tree']);
  git(f.repo, ['update-ref', 'HEAD', target]); git(f.repo, ['read-tree', target]);
  const files = execFileSync('git', ['-C', f.repo, 'ls-files', '-z'], { env, maxBuffer: 8 * 1024 * 1024 });
  git(f.repo, ['update-index', '--skip-worktree', '-z', '--stdin'], files);
  return target;
}

test('combined stdout overflow falls back serially and retains scopes that fit the original per-scope limit', async context => {
  const f = await fixture(context), target = await indexedLargeTree(f, [['one', 7500], ['two', 7500]]);
  const result = await traced(f, () => compare(f, target, ['one', 'two']));
  assert.equal(result.result.state, 'unchanged');
  assert.equal(result.trees.length, 3);
  assert.equal(result.trees[0].filter(arg => arg.startsWith(':(literal)')).length, 2);
  assert.equal(result.trees[1].filter(arg => arg.startsWith(':(literal)')).length, 1);
  assert.equal(result.trees[2].filter(arg => arg.startsWith(':(literal)')).length, 1);
});

test('one scope larger than maxBuffer remains unknown without retry or relabeling as missing', async context => {
  const f = await fixture(context), target = await indexedLargeTree(f, [['large', 15000]]);
  const result = await traced(f, () => compare(f, target, ['large']));
  assert.equal(result.result.state, 'unknown'); assert.match(result.result.reason, /maxBuffer/i);
  assert.equal(result.trees.length, 1); assert.doesNotMatch(result.result.reason, /不存在实现路径/);
});

test('bad target fails without tree retries, and invalid declarations retain validation semantics', async context => {
  const f = await fixture(context); await f.write('ok'); const target = f.commit();
  const bad = await traced(f, () => compare(f, 'a'.repeat(40), ['ok']));
  assert.equal(bad.result.state, 'unknown'); assert.equal(bad.trees.length, 0);
  for (const scope of ['../bad', '/root', 'src/*', '.git/config']) assert.ok(declaration(target, [scope]).errors.length);
  assert.ok(declaration(target, Array.from({ length: 129 }, (_, i) => `s${i}`)).errors.length);
});


test('argument overflow splits the batch but an oversized literal remains unknown', async context => {
  const f = await fixture(context); await f.write('present'); const target = f.commit();
  const argumentLimit = Number(execFileSync('getconf', ['ARG_MAX'], { encoding: 'utf8' }).trim());
  const scopeLength = Math.ceil(argumentLimit * 4 / 128);
  const scopes = Array.from({ length: 128 }, (_, i) => `absent${i}/${'x'.repeat(scopeLength)}`);
  const split = await traced(f, () => compare(f, target, scopes));
  assert.equal(split.result.state, 'unknown');
  assert.match(split.result.reason, /不存在实现路径/);
  assert.ok(split.trees.length > 1 && split.trees.length <= 255);
  const leaf = await traced(f, () => compare(f, target, ['x'.repeat(argumentLimit * 2)]));
  assert.equal(leaf.result.state, 'unknown'); assert.match(leaf.result.reason, /E2BIG/);
  assert.equal(leaf.trees.length, 0);
});

async function controlledGit(f, mode, action) {
  const bin = path.join(f.root, 'bin'); await mkdir(bin, { recursive: true });
  const attempts = path.join(f.root, `attempts-${mode}.txt`);
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const script = `#!${process.execPath}
const fs = require('node:fs');
const cp = require('node:child_process');
const args = process.argv.slice(2);
if (args[2] === 'ls-tree') {
  fs.appendFileSync(${JSON.stringify(attempts)}, 'attempt' + String.fromCharCode(10));
  if (${JSON.stringify(mode)} === 'timeout') setTimeout(() => process.exit(1), 15000);
  else { process.stderr.write('controlled ordinary Git failure'); process.exit(128); }
} else {
  const result = cp.spawnSync(${JSON.stringify(realGit)}, args, { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}`;
  await writeFile(path.join(bin, 'git'), script); await chmod(path.join(bin, 'git'), 0o755);
  const previous = process.env.PATH; process.env.PATH = `${bin}:${previous}`;
  try { const result = await action(); return { result, attempts: (await readFile(attempts, 'utf8').catch(() => { throw new Error(JSON.stringify(result)); })).trim().split('\n').length }; }
  finally { process.env.PATH = previous; }
}

test('ordinary Git failure and timeout stay unknown without splitting or retry', async context => {
  const f = await fixture(context); await f.write('one'); await f.write('two'); const target = f.commit();
  for (const mode of ['failure', 'timeout']) {
    const outcome = await controlledGit(f, mode, () => compare(f, target, ['one', 'two']));
    assert.equal(outcome.result.state, 'unknown'); assert.equal(outcome.attempts, 1);
    assert.doesNotMatch(outcome.result.reason, /不存在实现路径/);
  }
});
