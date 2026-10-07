import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, realpath, readFile, writeFile, symlink, lstat, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createOwnedWorktrees } from './owned-worktrees.mjs';

const execute = promisify(execFile);
const git = async (repository, ...args) => (await execute('git', ['-C', repository, ...args], { timeout: 5000 })).stdout.trim();
const absent = async value => assert.rejects(lstat(value), error => error.code === 'ENOENT');

async function finish(owner, failure) {
  const result = await owner.cleanup();
  if (result.errors.length) throw new AggregateError(failure ? [failure, ...result.errors] : result.errors,
    'Owned test fixture cleanup failed', { cause: failure ?? result.errors[0] });
  if (failure) throw failure;
  return result;
}

async function withOwner(run, parent) {
  const owner = await createOwnedWorktrees(parent);
  let failure;
  try { await run(owner); } catch (error) { failure = error; }
  await finish(owner, failure);
}

test('five owned trees use a tiny synthetic repository and leave no owned registration or branch', async () => {
  await withOwner(async owner => {
    const peers = [];
    for (let index = 0; index < 5; index++) peers.push(await owner.add(`tree${index}`, `codex/fixture-${index}`));
    for (const peer of peers) {
      assert.equal(await git(peer.worktree, 'branch', '--show-current'), peer.branch);
      assert.equal(await realpath(path.resolve(peer.worktree, await git(peer.worktree, 'rev-parse', '--git-common-dir'))), path.join(owner.repository, '.git'));
      assert.equal(await readFile(path.join(peer.worktree, 'fixture.txt'), 'utf8'), 'Owned coordination test repository.\n');
    }
    const result = await owner.cleanup();
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.remainingOwned, []);
    assert.deepEqual(result.remainingBranches, ['refs/heads/fixture-main']);
    assert.equal(result.rootRemoved, true);
    await absent(owner.root);
  });
});

test('an owned symlink tmp alias and spaces resolve to the same exact registered identity', async () => {
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), 'flow-alias-test-')));
  const actual = path.join(parent, 'actual space');
  const alias = path.join(parent, 'alias space');
  try {
    await mkdir(actual);
    await symlink(actual, alias);
    await withOwner(async owner => {
      assert.ok(owner.root.startsWith(actual + path.sep));
      const peer = await owner.add('tree', 'codex/alias');
      const records = await git(owner.repository, 'worktree', 'list', '--porcelain', '-z');
      assert.ok(records.includes(`worktree ${peer.worktree}\0`));
      assert.equal((await owner.cleanup()).rootRemoved, true);
      await absent(owner.root);
    }, alias);
  } finally {
    await rm(alias);
    await rmdir(actual);
    await rmdir(parent);
  }
});

test('a real post-checkout failure after Git registration is recovered from the creation intent', async () => {
  await withOwner(async owner => {
    await owner.add('first', 'codex/first');
    const hooks = path.join(owner.inputs, 'hooks');
    await mkdir(hooks);
    await writeFile(path.join(hooks, 'post-checkout'), '#!/bin/sh\nexit 29\n', { mode: 0o700 });
    await git(owner.repository, 'config', 'core.hooksPath', hooks);
    let failure;
    try { await owner.add('partial', 'codex/partial'); } catch (error) { failure = error; }
    assert.ok(failure, 'real Git hook must reject worktree add');
    const records = await git(owner.repository, 'worktree', 'list', '--porcelain', '-z');
    assert.ok(records.includes(`worktree ${path.join(owner.root, 'partial')}\0`), 'add registered the partial tree before reporting failure');
    await assert.rejects(finish(owner, failure), error => error === failure, 'cleanup preserves the original command error');
    await absent(owner.root);
  });
});

test('a locked owned tree retains its root and reports failure while later owned trees are removed', async () => {
  await withOwner(async owner => {
    const locked = await owner.add('locked', 'codex/locked');
    const later = await owner.add('later', 'codex/later');
    await git(owner.repository, 'worktree', 'lock', locked.worktree);
    try {
      const result = await owner.cleanup();
      assert.ok(result.errors.length);
      assert.equal(result.rootRemoved, false);
      assert.equal(await git(locked.worktree, 'branch', '--show-current'), locked.branch);
      await absent(later.worktree);
      assert.equal(await git(owner.repository, 'for-each-ref', '--format=%(refname)', `refs/heads/${later.branch}`), '');
    } finally { await git(owner.repository, 'worktree', 'unlock', locked.worktree); }
  });
});

test('non-owned worktree, branch and root sentinel survive and block recursive root removal', async () => {
  const outside = await realpath(await mkdtemp(path.join(tmpdir(), 'flow-sentinel-test-')));
  try {
    await withOwner(async owner => {
      const sentinelTree = path.join(outside, 'sentinel');
      const sentinelFile = path.join(owner.root, 'keep-me');
      const initial = await git(owner.repository, 'rev-parse', 'HEAD');
      await git(owner.repository, 'worktree', 'add', '-b', 'sentinel', sentinelTree, initial);
      await writeFile(sentinelFile, 'do not remove\n');
      try {
        await assert.rejects(owner.add('not-owned', 'sentinel'), /already exists/);
        await owner.add('owned', 'codex/owned');
        const result = await owner.cleanup();
        assert.ok(result.errors.length);
        assert.equal(result.rootRemoved, false);
        assert.equal(await git(sentinelTree, 'rev-parse', 'HEAD'), initial);
        assert.equal(await git(sentinelTree, 'branch', '--show-current'), 'sentinel');
        assert.equal(await readFile(sentinelFile, 'utf8'), 'do not remove\n');
        await absent(path.join(owner.root, 'owned'));
      } finally {
        await git(owner.repository, 'worktree', 'remove', sentinelTree);
        await git(owner.repository, 'branch', '-D', 'sentinel');
        await rm(sentinelFile);
      }
    });
  } finally { await rmdir(outside); }
});
