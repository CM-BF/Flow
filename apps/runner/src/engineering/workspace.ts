import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, opendir, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { directoryIdentity, readDirectoryRecord, recordDirectory, writeRecord } from './identity.js';
import { ENGINEERING_MAX_FILES, ENGINEERING_MAX_FILE_BYTES, ENGINEERING_MAX_WORKSPACE_BYTES, engineeringPathSchema, engineeringSnapshotJson, type EngineeringFile } from '../../../../packages/contracts/src/engineering.js';
import { NativeExecutionError } from '../native-harness/settlement.js';
import { digest, readTextFile, runCommand } from './resources.js';

export interface WorkspaceSnapshot { baseCommit: string; headCommit: string; files: EngineeringFile[]; digest: string; diff: string }
export interface EngineeringWorkspace { directory: string; leaseId: string; snapshot(): Promise<WorkspaceSnapshot>; release(): Promise<void> }
export interface SyntheticProject { rootDirectory: string; id: string; baseCommit: string; acquire(): Promise<EngineeringWorkspace>; dispose(): Promise<void> }
const gitOptions = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'core.autocrlf=false', '-c', 'core.filemode=true', '-c', 'core.quotePath=false', '-c', 'commit.gpgSign=false'];

async function git(cwd: string, args: string[], allowDifference = false): Promise<string> {
  const result = await runCommand({ executable: '/usr/bin/git', args: [...gitOptions, ...args], cwd, outputBytes: 524_288 });
  if (!result.childExited) throw new NativeExecutionError('unknown');
  if (result.timedOut || result.outputTruncated || result.signal || (result.exitCode !== 0 && !(allowDifference && result.exitCode === 1))) throw new Error('Managed engineering Git command failed.');
  return result.stdout;
}

/** Owns only a newly created synthetic repository. No API accepts an existing/personal Git repository. */
export async function createSyntheticProject(parent: string, id: string, initial: Record<string, string>): Promise<SyntheticProject> {
  if (Object.keys(initial).length > ENGINEERING_MAX_FILES || Object.values(initial).reduce((total, content) => total + Buffer.byteLength(content), 0) > ENGINEERING_MAX_WORKSPACE_BYTES) throw new Error('Synthetic baseline exceeds its bounds.');
  const root = await realpath(await mkdtemp(join(parent, 'flow-engineering-'))), repository = join(root, 'repository');
  await mkdir(repository); await mkdir(join(root, 'worktrees'));
  try {
    for (const [path, content] of Object.entries(initial)) {
      engineeringPathSchema.parse(path);
      if (Buffer.byteLength(content) > ENGINEERING_MAX_FILE_BYTES || content.includes('\0')) throw new Error('Invalid synthetic source.');
      const target = join(repository, path); await mkdir(join(target, '..'), { recursive: true }); await writeFile(target, content, { mode: 0o600 });
    }
    await git(repository, ['init', '--quiet']);
    await git(repository, ['add', '--all']);
    await git(repository, ['-c', 'user.name=Flow fixture', '-c', 'user.email=flow-fixture@invalid', 'commit', '--quiet', '--no-gpg-sign', '-m', 'Synthetic engineering baseline']);
    const baseCommit = (await git(repository, ['rev-parse', 'HEAD'])).trim();
    await recordDirectory(root, '.flow-project.json', { id, baseCommit });
    return projectHandle(root, id, baseCommit, false);
  } catch (error) { if (!(error instanceof NativeExecutionError && error.settlement === 'unknown')) await rm(root, { recursive: true, force: true }); throw error; }
}

const projectRecord = z.strictObject({ id: z.string().min(1).max(128), baseCommit: z.string().regex(/^[a-f0-9]{40}$/) });
const leaseRecord = z.strictObject({ leaseId: z.uuid(), baseCommit: z.string().regex(/^[a-f0-9]{40}$/) });
/** Restores only a marked synthetic repository with the expected immutable identity; never initializes a missing one. */
export async function restoreSyntheticProject(root: string, expected: { id: string; baseCommit: string }): Promise<SyntheticProject> {
  const recorded = await readDirectoryRecord(root, '.flow-project.json', projectRecord);
  if (recorded.id !== expected.id || recorded.baseCommit !== expected.baseCommit) throw new Error('Synthetic project identity changed.');
  const repository = join(root, 'repository'); await directoryIdentity(repository); await directoryIdentity(join(root, 'worktrees'));
  const common = (await git(repository, ['rev-parse', '--git-common-dir'])).trim();
  if (resolve(repository, common) !== join(repository, '.git') || (await git(repository, ['rev-parse', 'HEAD'])).trim() !== expected.baseCommit
    || (await git(repository, ['status', '--porcelain', '--untracked-files=all', '--ignored'])).trim()) throw new Error('Synthetic repository baseline changed.');
  let active = false;
  try {
    const lease = leaseRecord.parse(JSON.parse((await readTextFile(join(root, 'active-lease.json'), 1024)).content));
    if (lease.baseCommit !== expected.baseCommit) throw new Error('Synthetic lease belongs to another baseline.');
    active = true;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await countWorkspaces(root);
  return projectHandle(root, expected.id, expected.baseCommit, active);
}
async function countWorkspaces(root: string): Promise<number> {
  let count = 0;
  for await (const entry of await opendir(join(root, 'worktrees'))) {
    if (!entry.isDirectory() || !z.uuid().safeParse(entry.name).success || ++count > 8) throw new Error('Synthetic worktree registry is invalid.');
  }
  return count;
}
function projectHandle(root: string, id: string, baseCommit: string, initialActive: boolean): SyntheticProject {
  let active = initialActive, disposed = false;
  return { rootDirectory: root, id, baseCommit,
    async acquire() {
      if (disposed || active || await countWorkspaces(root) >= 8) throw new Error('Synthetic project is unavailable or already leased.');
      const leaseId = randomUUID(), leaseFile = join(root, 'active-lease.json'), directory = join(root, 'worktrees', leaseId);
      await writeRecord(leaseFile, { leaseId, baseCommit }); active = true;
      try { await git(join(root, 'repository'), ['worktree', 'add', '--quiet', '-b', `codex/engineering-${leaseId}`, directory, baseCommit]); }
      catch (error) { if (!(error instanceof NativeExecutionError && error.settlement === 'unknown')) { active = false; await rm(leaseFile); } throw error; }
      let released = false;
      return { directory, leaseId, snapshot: () => snapshot(directory, baseCommit),
        async release() {
          if (released) return;
          const recorded = leaseRecord.parse(JSON.parse((await readTextFile(leaseFile, 1024)).content));
          if (recorded.leaseId !== leaseId || recorded.baseCommit !== baseCommit) throw new Error('Engineering project lease changed.');
          await rm(leaseFile); active = false; released = true;
        },
      };
    },
    async dispose() {
      if (active) throw new Error('Cannot remove a project with unresolved engineering execution.');
      try { await lstat(join(root, 'active-lease.json')); throw new Error('Cannot remove a project with unresolved engineering execution.'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      await readDirectoryRecord(root, '.flow-project.json', projectRecord); disposed = true; await rm(root, { recursive: true });
    },
  };
}

async function snapshot(directory: string, baseCommit: string): Promise<WorkspaceSnapshot> {
  const headCommit = (await git(directory, ['rev-parse', 'HEAD'])).trim();
  if (headCommit !== baseCommit) throw new Error('Engineering fixture cannot move the immutable baseline commit.');
  const base = await gitEntries(directory, ['ls-tree', '-r', '-z', baseCommit], false);
  const index = await gitEntries(directory, ['ls-files', '--stage', '-z'], true);
  const working = await workingFiles(directory);
  const paths = [...new Set([...base.keys(), ...index.keys(), ...working.keys()])].sort();
  if (paths.length > ENGINEERING_MAX_FILES) throw new Error('Too many engineering files.');
  const files = paths.map(path => ({ path, base: base.get(path) ?? null, index: index.get(path) ?? null, worktree: working.get(path) ?? null }));
  const serialized = engineeringSnapshotJson({ baseCommit, headCommit, files });
  let diff = '';
  const append = (piece: string) => { if (Buffer.byteLength(diff) + Buffer.byteLength(piece) > 262_144) throw new Error('Engineering diff exceeds its bound.'); diff += piece; };
  append('STAGED\n'); append(await git(directory, ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-renames', baseCommit, '--']));
  append('UNSTAGED\n'); append(await git(directory, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--']));
  for (const path of working.keys()) if (!index.has(path)) { append(`UNTRACKED ${path}\n`); append(await git(directory, ['diff', '--no-index', '--no-ext-diff', '--no-textconv', '--', '/dev/null', path], true)); }
  const finalIndex = await gitEntries(directory, ['ls-files', '--stage', '-z'], true), finalWorking = await workingFiles(directory);
  const finalPaths = [...new Set([...base.keys(), ...finalIndex.keys(), ...finalWorking.keys()])].sort();
  const finalFiles = finalPaths.map(path => ({ path, base: base.get(path) ?? null, index: finalIndex.get(path) ?? null, worktree: finalWorking.get(path) ?? null }));
  if (serialized !== engineeringSnapshotJson({ baseCommit, headCommit: (await git(directory, ['rev-parse', 'HEAD'])).trim(), files: finalFiles })) throw new Error('Engineering content changed while capturing its diff.');
  return { baseCommit, headCommit, files, digest: digest(serialized), diff };
}

type GitFile = NonNullable<EngineeringFile['index']>;
async function gitEntries(directory: string, args: string[], indexed: boolean): Promise<Map<string, GitFile>> {
  const entries = new Map<string, GitFile>();
  for (const line of (await git(directory, args)).split('\0').filter(Boolean)) {
    const match = /^(\d+) (\S+) (\S+)\t([\s\S]+)$/.exec(line);
    if (!match) throw new Error('Unsupported engineering Git entry.');
    const [, mode, second, third, path] = match;
    if ((mode !== '100644' && mode !== '100755') || (indexed ? third !== '0' : second !== 'blob')) throw new Error('Submodules, links and unmerged entries are unsupported.');
    engineeringPathSchema.parse(path); const oid = indexed ? second! : third!;
    if (entries.has(path!) || entries.size >= ENGINEERING_MAX_FILES) throw new Error('Invalid engineering Git entry set.');
    const text = await git(directory, ['cat-file', 'blob', oid]);
    if (Buffer.byteLength(text) > ENGINEERING_MAX_FILE_BYTES || text.includes('\0') || text.includes('\uFFFD')) throw new Error('Binary or oversized Git blobs are unsupported.');
    entries.set(path!, { mode, oid });
  }
  return entries;
}

async function workingFiles(directory: string): Promise<Map<string, NonNullable<EngineeringFile['worktree']>>> {
  const files = new Map<string, NonNullable<EngineeringFile['worktree']>>(); let total = 0, visited = 0;
  async function walk(relative: string, depth: number) {
    if (depth > 16) throw new Error('Engineering directory depth exceeded.');
    for await (const entry of await opendir(join(directory, relative))) {
      const name = entry.name;
      if (!relative && name === '.git') continue;
      const path = relative ? `${relative}/${name}` : name; engineeringPathSchema.parse(path);
      if (++visited > 256) throw new Error('Engineering directory entries exceeded.');
      const metadata = await lstat(join(directory, path));
      if (metadata.isDirectory()) await walk(path, depth + 1);
      else {
        const file = await readTextFile(join(directory, path), ENGINEERING_MAX_FILE_BYTES);
        total += Buffer.byteLength(file.content);
        if (files.size >= ENGINEERING_MAX_FILES || total > ENGINEERING_MAX_WORKSPACE_BYTES) throw new Error('Engineering workspace bytes exceeded.');
        files.set(path, { digest: digest(file.content), bytes: Buffer.byteLength(file.content), mode: file.mode });
      }
    }
  }
  await walk('', 0); return files;
}
