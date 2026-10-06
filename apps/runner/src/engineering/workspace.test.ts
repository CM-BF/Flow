import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { engineeringReceiptResult, type EngineeringReceipt } from '../../../../packages/contracts/src/engineering.js';
import { createSyntheticProject } from './workspace.js';
import { createTrustedChecker } from './checker.js';
import { createEngineeringFixtureAdapter } from './adapter.js';
import { digest, readTextFile, runCommand } from './resources.js';
import * as resources from './resources.js';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';

const roots: string[] = [];
async function root() { const value = await mkdtemp(join(tmpdir(), 'flow-eng01a-test-')); roots.push(value); return value; }
afterEach(async () => { vi.restoreAllMocks(); for (const directory of roots.splice(0)) await rm(directory, { recursive: true, force: true }); });
const git = (cwd: string, args: string[]) => promisify(execFile)('/usr/bin/git', args, { cwd });
const baseline = `import { readFile } from 'node:fs/promises'; import { join } from 'node:path';
const actual=JSON.parse(await readFile(join(process.argv[2], 'result.json'),'utf8'));
process.stdout.write(JSON.stringify({checks:[{id:'sum',passed:actual.sum===7},{id:'difference',passed:actual.difference===3}]}));`;

it('captures staged, unstaged, ignored untracked, deleted and executable modes in one immutable content set', async () => {
  const project = await createSyntheticProject(await root(), 'project', { '.gitignore': 'ignored.txt\n', 'tracked.txt': 'base\n', 'deleted.txt': 'remove\n', 'run.sh': 'exit 0\n' });
  const workspace = await project.acquire();
  await writeFile(join(workspace.directory, 'tracked.txt'), 'staged\n'); await git(workspace.directory, ['add', 'tracked.txt']);
  await writeFile(join(workspace.directory, 'tracked.txt'), 'unstaged\n'); await rm(join(workspace.directory, 'deleted.txt'));
  await writeFile(join(workspace.directory, 'new.txt'), 'new\n'); await writeFile(join(workspace.directory, 'ignored.txt'), 'ignored\n'); await chmod(join(workspace.directory, 'run.sh'), 0o700);
  const snapshot = await workspace.snapshot();
  expect(snapshot.files.find(file => file.path === 'tracked.txt')).toMatchObject({ base: { mode: '100644' }, index: { mode: '100644' }, worktree: { digest: digest('unstaged\n') } });
  const tracked = snapshot.files.find(file => file.path === 'tracked.txt')!; expect(tracked.base?.oid).not.toBe(tracked.index?.oid);
  expect(snapshot.files.find(file => file.path === 'deleted.txt')?.worktree).toBeNull();
  expect(snapshot.files.find(file => file.path === 'run.sh')?.worktree?.mode).toBe('100755');
  expect(snapshot.files.find(file => file.path === 'ignored.txt')).toMatchObject({ base: null, index: null, worktree: { digest: digest('ignored\n') } });
  expect(snapshot.diff).toContain('+staged'); expect(snapshot.diff).toContain('+unstaged'); expect(snapshot.diff).toContain('UNTRACKED ignored.txt'); expect(snapshot.diff).toContain('old mode 100644');
  expect((await workspace.snapshot()).digest).toBe(snapshot.digest);
  await expect(project.acquire()).rejects.toThrow('already leased'); await expect(project.dispose()).rejects.toThrow('unresolved');
  await workspace.release(); await workspace.release(); await project.dispose();
});

it.each(['binary', 'symlink', 'hardlink', 'oversized', 'untracked-count', 'submodule'] as const)('rejects unsupported %s content without silently omitting it', async kind => {
  const directory = await root(), project = await createSyntheticProject(directory, 'bounded', { 'initial.txt': 'original\n' }), workspace = await project.acquire();
  const path = join(workspace.directory, 'unsupported.txt');
  if (kind === 'binary') await writeFile(path, Buffer.from([0, 1, 2]));
  if (kind === 'symlink') await symlink('initial.txt', path);
  if (kind === 'hardlink') await link(join(workspace.directory, 'initial.txt'), path);
  if (kind === 'oversized') await writeFile(path, 'x'.repeat(65_537));
  if (kind === 'untracked-count') for (let index = 0; index < 128; index++) await writeFile(join(workspace.directory, `extra-${index}.txt`), 'x');
  if (kind === 'submodule') await git(workspace.directory, ['update-index', '--add', '--cacheinfo', `160000,${project.baseCommit},module`]);
  await expect(workspace.snapshot()).rejects.toThrow(); await workspace.release(); await project.dispose();
});

it('does not run external diff or text conversion configured in the synthetic repository', async () => {
  const project = await createSyntheticProject(await root(), 'no-drivers', { 'tracked.txt': 'base\n', '.gitattributes': '*.txt diff=custom\n' }), workspace = await project.acquire();
  await git(workspace.directory, ['config', 'diff.external', '/nonexistent/forbidden-diff']);
  await git(workspace.directory, ['config', 'diff.custom.textconv', '/nonexistent/forbidden-conversion']);
  await writeFile(join(workspace.directory, 'tracked.txt'), 'changed\n');
  expect((await workspace.snapshot()).diff).toContain('+changed'); await workspace.release(); await project.dispose();
});

it('refuses a content set that changes while its diff is captured', async () => {
  const project = await createSyntheticProject(await root(), 'changing', { 'tracked.txt': 'base\n' }), workspace = await project.acquire();
  const original = resources.runCommand; let changed = false;
  vi.spyOn(resources, 'runCommand').mockImplementation(async command => {
    const result = await original(command);
    if (!changed && command.args.includes('diff')) { changed = true; await writeFile(join(workspace.directory, 'tracked.txt'), 'changed during capture\n'); }
    return result;
  });
  await expect(workspace.snapshot()).rejects.toThrow('changed while capturing');
  await workspace.release(); await project.dispose();
});

it('retains the project when an injected checker child cannot be confirmed stopped', async () => {
  const directory = await root(), project = await createSyntheticProject(directory, 'unknown-child', { 'result.json': '{}\n' });
  const checker = await createTrustedChecker(directory, 'fixed', baseline, ['sum', 'difference']);
  const runnerId = randomUUID(), original = resources.runCommand; let retainedWorkspace: Awaited<ReturnType<typeof project.acquire>> | undefined;
  vi.spyOn(resources, 'runCommand').mockImplementation(async command => command.executable === process.execPath
    ? { exitCode: null, signal: null, timedOut: true, outputTruncated: false, childExited: false, elapsedMs: 1000, stdout: '', stderr: '' } : original(command));
  const adapter = createEngineeringFixtureAdapter(runnerId, [{ project, checker, execute: async workspace => { retainedWorkspace = workspace; } }]);
  await expect(adapter.run({ task: { title: 'Unknown child', prompt: 'Controlled injection', harness: 'fixture', engineering: { protocol: 'flow.engineering.v1', targetRunnerId: runnerId, projectId: project.id, baseCommit: project.baseCommit, checker: checker.selection } }, workingDirectory: directory,
    signal: new AbortController().signal, assertOwnership: async () => {}, waitForDecision: async () => 'reject', emit: async () => { throw new Error('Unknown child cannot publish passed evidence.'); } })).rejects.toMatchObject({ settlement: 'unknown' });
  await expect(project.acquire()).rejects.toThrow('already leased'); await expect(checker.dispose()).rejects.toThrow('unresolved');
  // No child was actually dispatched by this explicit injection. Test-only cleanup may release its owned files.
  await retainedWorkspace!.release(); await project.dispose();
});

it('bounds regular-file reads including FIFO, invalid UTF-8 and replacement symlinks', async () => {
  const directory = await root(), path = join(directory, 'file');
  await promisify(execFile)('/usr/bin/mkfifo', [path]); await expect(readTextFile(path, 100)).rejects.toThrow('regular file');
  await rm(path); await writeFile(path, Buffer.from([0xff])); await expect(readTextFile(path, 100)).rejects.toThrow();
  await rm(path); await symlink('/dev/zero', path); await expect(readTextFile(path, 100)).rejects.toThrow();
});

it('returns real exit and bounded output and confirms timeout termination for owned child processes', async () => {
  const cwd = await root();
  const failed = await runCommand({ executable: process.execPath, args: ['-e', 'process.stdout.write("observed");process.exit(7)'], cwd });
  expect(failed).toMatchObject({ exitCode: 7, stdout: 'observed', childExited: true, timedOut: false });
  const noisy = await runCommand({ executable: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(20000));setInterval(()=>{},1000)'], cwd, outputBytes: 100 });
  expect(noisy.outputTruncated).toBe(true); expect(Buffer.byteLength(noisy.stdout)).toBe(100); expect(noisy.childExited).toBe(true);
  const timeout = await runCommand({ executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd, timeoutMs: 50 });
  expect(timeout).toMatchObject({ timedOut: true, childExited: true });
  const stopped = new AbortController(); stopped.abort();
  expect(await runCommand({ executable: '/nonexistent/never-started', args: [], cwd, signal: stopped.signal })).toMatchObject({ exitCode: null, childExited: true });
});

async function execute(source = baseline, result = { sum: 7, difference: 3 }) {
  const directory = await root(), project = await createSyntheticProject(directory, 'fixture', { 'result.json': '{"sum":0,"difference":0}\n' });
  const checker = await createTrustedChecker(directory, 'math', source, ['sum', 'difference']);
  const runnerId = randomUUID(), events: RunnerEventData[] = [];
  const adapter = createEngineeringFixtureAdapter(runnerId, [{ project, checker, execute: async workspace => { await writeFile(join(workspace.directory, 'result.json'), JSON.stringify(result)); } }]);
  const context: HarnessContext = { task: { title: 'Fixture engineering', prompt: 'Use trusted fixture', harness: 'fixture', engineering: { protocol: 'flow.engineering.v1', targetRunnerId: runnerId, projectId: project.id, baseCommit: project.baseCommit, checker: checker.selection } }, workingDirectory: directory,
    signal: new AbortController().signal, assertOwnership: async () => {}, waitForDecision: async () => 'reject', emit: async event => { events.push(event); } };
  let error: unknown; try { await adapter.run(context); } catch (caught) { error = caught; }
  const artifact = events.find(event => event.type === 'artifact'); if (artifact?.type !== 'artifact') throw new Error('Missing engineering artifact');
  const receipt = JSON.parse(artifact.content) as EngineeringReceipt;
  await checker.dispose(); await project.dispose(); return { events, receipt, error };
}

it('requires real fixed checker cases and publishes a digest of the same content set', async () => {
  const { events, receipt, error } = await execute(); expect(error).toBeUndefined();
  expect(receipt.command).toMatchObject({ exitCode: 0, childExited: true, outputTruncated: false });
  expect(receipt.result).toBe('passed'); expect(engineeringReceiptResult(receipt)).toBe('passed');
  expect(receipt.workspace.beforeDigest).toBe(receipt.workspace.afterDigest); expect(receipt.diff.content).toContain('+{"sum":7,"difference":3}');
  expect(events.find(event => event.type === 'verification')).toMatchObject({ verifierId: 'flow.engineering', result: 'passed' });
  expect(events.some(event => event.type === 'completed')).toBe(false);
});

it.each(['wrong-result', 'nonempty-log', 'missing-case', 'mutated-workspace', 'mutated-baseline'] as const)('refuses engineering success for %s', async kind => {
  let source = baseline;
  if (kind === 'nonempty-log') source = 'console.log("looks successful")';
  if (kind === 'missing-case') source = 'console.log(JSON.stringify({checks:[{id:"sum",passed:true}]}))';
  if (kind === 'mutated-workspace') source = baseline + '\nawait (await import("node:fs/promises")).writeFile(join(process.argv[2],"changed.txt"),"unexpected");';
  if (kind === 'mutated-baseline') source = baseline + '\nconst fs=await import("node:fs/promises");await fs.chmod(new URL(import.meta.url),0o600);await fs.appendFile(new URL(import.meta.url),"\\n// changed");';
  const { receipt, error, events } = await execute(source, kind === 'wrong-result' ? { sum: 0, difference: 0 } : undefined);
  expect(receipt.result).toBe('failed'); expect(error).toMatchObject({ settlement: 'settled' });
  expect(events.find(event => event.type === 'verification')).toMatchObject({ result: 'failed' });
});
