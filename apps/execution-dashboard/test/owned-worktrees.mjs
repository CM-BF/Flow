import path from 'node:path';
import { mkdtemp, realpath, mkdir, writeFile, lstat, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const gitEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
Object.assign(gitEnvironment, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
const git = async (repository, ...args) => (await execute('git', ['-C', repository, ...args], {
  timeout: 5000, maxBuffer: 1024 * 1024, env: gitEnvironment,
})).stdout.trimEnd();

async function canonicalPath(value) {
  try { return await realpath(value); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await realpath(path.dirname(value)), path.basename(value));
  }
}

async function worktreeRecords(repository) {
  const output = await git(repository, 'worktree', 'list', '--porcelain', '-z');
  return Promise.all(output.split('\0\0').filter(Boolean).map(async record => {
    const fields = record.split('\0');
    const registeredPath = fields.find(field => field.startsWith('worktree '))?.slice(9);
    if (!registeredPath) throw new Error('Invalid worktree porcelain record');
    return { registeredPath, canonicalPath: await canonicalPath(registeredPath),
      branch: fields.find(field => field.startsWith('branch '))?.slice(7),
      head: fields.find(field => field.startsWith('HEAD '))?.slice(5) };
  }));
}

async function branchTip(repository, branch) {
  const output = await git(repository, 'for-each-ref', '--format=%(refname) %(objectname)', `refs/heads/${branch}`);
  return output.split('\n').find(line => line.startsWith(`refs/heads/${branch} `))?.split(' ')[1];
}

async function exists(value) {
  try { await lstat(value); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

// Private fixture: every linked tree belongs to a tiny repository created here,
// never to Flow. The caller may only place its own request files in inputs.
export async function createOwnedWorktrees(parent = tmpdir()) {
  const createdRoot = await mkdtemp(path.join(parent, 'flow-claims-test-'));
  let root;
  let rootIdentity;
  let repository;
  let inputs;
  const owned = [];
  let disposed = false;
  let initialHead;
  let commonDirectory;
  try {
    root = await realpath(createdRoot);
    rootIdentity = await lstat(root);
    repository = path.join(root, 'repository');
    inputs = path.join(root, 'inputs');
    await mkdir(repository);
    await mkdir(inputs);
    await git(repository, 'init', '--initial-branch=fixture-main');
    await writeFile(path.join(repository, 'fixture.txt'), 'Owned coordination test repository.\n');
    await git(repository, 'add', 'fixture.txt');
    await git(repository, '-c', 'user.name=Flow fixture', '-c', 'user.email=fixture@invalid',
      '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Fixture');
    initialHead = await git(repository, 'rev-parse', 'HEAD');
    commonDirectory = await realpath(path.join(repository, '.git'));
  } catch (error) {
    try { await rm(createdRoot, { recursive: true }); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Fixture initialization and cleanup failed', { cause: error }); }
    throw error;
  }

  async function verifyRepository() {
    const identity = await lstat(root);
    if (identity.isSymbolicLink() || identity.dev !== rootIdentity.dev || identity.ino !== rootIdentity.ino) {
      throw new Error('Owned temporary root identity changed');
    }
    const actual = await realpath(path.resolve(repository, await git(repository, 'rev-parse', '--git-common-dir')));
    if (actual !== commonDirectory) throw new Error('Owned repository identity changed');
  }

  async function add(name, branch) {
    if (disposed) throw new Error('Fixture already removed');
    if (!/^[a-zA-Z0-9_-]+$/.test(name) || owned.some(item => item.name === name || item.branch === branch)) {
      throw new Error('Unique literal owned worktree name required');
    }
    await verifyRepository();
    await git(repository, 'check-ref-format', '--branch', branch);
    const worktree = path.join(root, name);
    if (await exists(worktree) || await branchTip(repository, branch)) throw new Error('Worktree path or branch already exists');
    // Record intent before add/switch: either command can mutate Git then fail.
    const item = { name, worktree, branch, head: initialHead, gitDirectory: null, removed: false };
    owned.push(item);
    await git(repository, 'worktree', 'add', '--detach', worktree, initialHead);
    item.gitDirectory = await realpath(path.resolve(worktree, await git(worktree, 'rev-parse', '--git-dir')));
    await git(worktree, 'switch', '-c', branch);
    return { worktree, branch };
  }

  async function removeOne(item) {
    const records = await worktreeRecords(repository);
    const matching = records.filter(record => record.canonicalPath === item.worktree);
    if (matching.length > 1) throw new Error(`Ambiguous owned registration: ${item.name}`);
    const record = matching[0];
    if (record) {
      if (record.head !== item.head || (record.branch && record.branch !== `refs/heads/${item.branch}`)) {
        throw new Error(`Owned worktree identity changed: ${item.name}`);
      }
      const actualGitDirectory = await realpath(path.resolve(item.worktree, await git(item.worktree, 'rev-parse', '--git-dir')));
      if (item.gitDirectory && actualGitDirectory !== item.gitDirectory) throw new Error(`Owned gitdir changed: ${item.name}`);
      // One force only: a locked tree is retained and reported, never force-unlocked.
      await git(repository, 'worktree', 'remove', '--force', record.registeredPath);
    } else if (await exists(item.worktree)) {
      throw new Error(`Unregistered worktree path retained: ${item.name}`);
    }
    const remaining = await worktreeRecords(repository);
    if (remaining.some(value => value.canonicalPath === item.worktree)) throw new Error(`Registration remains: ${item.name}`);
    const tip = await branchTip(repository, item.branch);
    if (tip) {
      if (tip !== item.head || remaining.some(value => value.branch === `refs/heads/${item.branch}`)) {
        throw new Error(`Owned branch changed or is in use: ${item.branch}`);
      }
      await git(repository, 'branch', '-D', item.branch);
      if (await branchTip(repository, item.branch)) throw new Error(`Owned branch remains: ${item.branch}`);
    }
    item.removed = true;
  }

  async function cleanup() {
    if (disposed) return { errors: [], rootRemoved: true, remainingOwned: [], remainingBranches: [] };
    const errors = [];
    try { await verifyRepository(); }
    catch (error) { return { errors: [error], rootRemoved: false }; }
    for (const item of owned) {
      try { await removeOne(item); }
      catch (error) { errors.push(error); }
    }
    let remainingOwned, remainingBranches;
    try {
      const records = await worktreeRecords(repository);
      remainingOwned = records.filter(record => owned.some(item => item.worktree === record.canonicalPath));
      remainingBranches = (await git(repository, 'for-each-ref', '--format=%(refname)', 'refs/heads')).split('\n').filter(Boolean);
      const unexpectedFiles = (await readdir(root)).filter(name => !['repository', 'inputs', ...owned.map(item => item.name)].includes(name));
      if (records.some(record => record.canonicalPath !== repository) || remainingBranches.some(ref => ref !== 'refs/heads/fixture-main') || unexpectedFiles.length) {
        errors.push(new Error('Remaining registrations, branches or unowned root entries; retain root'));
      }
      if (!errors.length) { await verifyRepository(); await rm(root, { recursive: true }); disposed = true; }
    } catch (error) { errors.push(error); }
    return { errors, rootRemoved: disposed, remainingOwned, remainingBranches };
  }
  return { root, repository, inputs, add, cleanup };
}
