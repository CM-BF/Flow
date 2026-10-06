import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { engineeringProfileConfigurationJson, engineeringProfileConfigurationSchema } from '../../../../packages/contracts/src/engineering-profile.js';
import { engineeringIntentSchema } from '../../../../packages/contracts/src/engineering.js';
import { prepareEngineeringSetup } from './setup.js';
import { restoreSyntheticProject } from './workspace.js';
import { digest, runCommand } from './resources.js';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function environment(extra = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'flow-eng01b-'))); roots.push(root);
  const workingDirectory = join(root, 'host'), manifest = join(root, 'settings.json');
  await writeFile(manifest, JSON.stringify({ protocol: 'flow.engineering-setup.v1', recipe: 'calculator-v1', projectId: 'calculator', checkerTimeoutMs: 2000, ...extra }));
  return { root, workingDirectory, manifest };
}
function reference(configuration: Parameters<typeof engineeringProfileConfigurationJson>[0]) { return { id: randomUUID(), runnerId: randomUUID(), configDigest: digest(engineeringProfileConfigurationJson(configuration)) }; }
function context(setup: Awaited<ReturnType<typeof prepareEngineeringSetup>>, pin: ReturnType<typeof reference>, events: RunnerEventData[]): HarnessContext {
  const profile = setup.configuration;
  return { task: { title: 'Configured engineering', prompt: 'Fixed recipe', harness: 'fixture', engineering: {
    protocol: 'flow.engineering.v1', targetRunnerId: pin.runnerId, projectId: profile.project.id, baseCommit: profile.project.baseCommit, checker: profile.checker, profile: pin } },
    workingDirectory: '/unused-owned-by-host', signal: new AbortController().signal, assertOwnership: async () => {}, waitForDecision: async () => 'reject', emit: async event => { events.push(event); } };
}

it('uses a strict finite fixture codec and preserves the old intent shape when its pin is absent', async () => {
  const env = await environment(), setup = await prepareEngineeringSetup(env.workingDirectory, env.manifest);
  expect(engineeringProfileConfigurationSchema.parse(setup.configuration).purpose).toBe('engineering-fixture');
  for (const value of [{ ...setup.configuration, executable: '/bin/sh' }, { ...setup.configuration, harness: 'codex' }, { ...setup.configuration, purpose: 'ordinary' }, { ...setup.configuration, recipe: 'caller-code' }]) expect(engineeringProfileConfigurationSchema.safeParse(value).success).toBe(false);
  const intent = context(setup, reference(setup.configuration), []).task.engineering!;
  const { profile, ...legacy } = intent; expect(engineeringIntentSchema.parse(legacy)).toEqual(legacy); expect(engineeringIntentSchema.parse(intent).profile).toEqual(profile);
});

it.each([{ source: 'arbitrary-code' }, { argv: ['--dangerous'] }, { environment: { TOKEN: 'not-accepted' } }, { repository: '/personal' }, { expected: true }])('rejects untrusted setup fields %j before creating host storage', async extra => {
  const env = await environment(extra); await expect(prepareEngineeringSetup(env.workingDirectory, env.manifest)).rejects.toThrow();
  await expect(readFile(join(env.workingDirectory, 'engineering-fixture', 'setup.json'))).rejects.toMatchObject({ code: 'ENOENT' });
});

it('restores the same base/checker and immutable pin and refuses a changed configuration or runner', async () => {
  const env = await environment(), first = await prepareEngineeringSetup(env.workingDirectory, env.manifest), pin = reference(first.configuration);
  await first.bind(pin); const second = await prepareEngineeringSetup(env.workingDirectory, env.manifest);
  expect(second.configuration).toEqual(first.configuration); await second.bind(pin);
  await expect(second.bind({ ...pin, runnerId: randomUUID() })).rejects.toThrow('another published identity');
  await writeFile(env.manifest, JSON.stringify({ protocol: 'flow.engineering-setup.v1', recipe: 'calculator-v1', projectId: 'changed', checkerTimeoutMs: 2000 }));
  await expect(prepareEngineeringSetup(env.workingDirectory, env.manifest)).rejects.toThrow('configuration changed');
});

it('publishes only after a matching task pin and executes the fixed recipe from restored storage', async () => {
  const env = await environment(), setup = await prepareEngineeringSetup(env.workingDirectory, env.manifest), pin = reference(setup.configuration), events: RunnerEventData[] = [];
  const adapter = await setup.bind(pin), wrong = context(setup, { ...pin, id: randomUUID() }, events);
  await expect(adapter.run(wrong)).rejects.toThrow('immutable setup pin'); expect(events).toEqual([]);
  const restored = await prepareEngineeringSetup(env.workingDirectory, env.manifest);
  await (await restored.bind(pin)).run(context(restored, pin, events));
  expect(events.find(event => event.type === 'verification')).toMatchObject({ verifierId: 'flow.engineering', result: 'passed' });
  const artifact = events.find(event => event.type === 'artifact'); if (artifact?.type !== 'artifact') throw new Error('Missing fixed receipt');
  expect(JSON.parse(artifact.content).workspace.baseCommit).toBe(setup.configuration.project.baseCommit);
});

it('preserves incomplete or replaced storage rather than recreating a repository', async () => {
  const env = await environment(); await mkdir(join(env.workingDirectory, 'engineering-fixture'), { recursive: true, mode: 0o700 });
  const sentinel = join(env.workingDirectory, 'engineering-fixture', 'sentinel'); await writeFile(sentinel, 'retain');
  await expect(prepareEngineeringSetup(env.workingDirectory, env.manifest)).rejects.toThrow(); expect(await readFile(sentinel, 'utf8')).toBe('retain');
  const fresh = await environment(); await prepareEngineeringSetup(fresh.workingDirectory, fresh.manifest);
  const root = join(fresh.workingDirectory, 'engineering-fixture'), saved = JSON.parse(await readFile(join(root, 'setup.json'), 'utf8'));
  await rename(root, `${root}-original`); await mkdir(root, { mode: 0o700 }); await writeFile(join(root, 'setup.json'), JSON.stringify(saved));
  await expect(prepareEngineeringSetup(fresh.workingDirectory, fresh.manifest)).rejects.toThrow('identity changed');
});

it('loads in a fresh Node process while retaining an active project lease and preventing new writes', async () => {
  const env = await environment(), setup = await prepareEngineeringSetup(env.workingDirectory, env.manifest), pin = reference(setup.configuration);
  await setup.bind(pin);
  const record = JSON.parse(await readFile(join(env.workingDirectory, 'engineering-fixture', 'setup.json'), 'utf8')).value;
  const projectRoot = join(env.workingDirectory, 'engineering-fixture', record.projectDirectory);
  const project = await restoreSyntheticProject(projectRoot, { id: setup.configuration.project.id, baseCommit: setup.configuration.project.baseCommit });
  const workspace = await project.acquire(); await writeFile(join(workspace.directory, 'effect.txt'), 'unresolved effect\n');
  const before = await readFile(join(projectRoot, 'active-lease.json'), 'utf8');
  const code = `const {prepareEngineeringSetup}=await import(process.argv[1]);const setup=await prepareEngineeringSetup(process.argv[2],process.argv[3]);process.stdout.write(JSON.stringify(setup.configuration));`;
  const child = await runCommand({ executable: process.execPath, args: ['--import', 'tsx', '--input-type=module', '-e', code, fileURLToPath(new URL('./setup.ts', import.meta.url)), env.workingDirectory, env.manifest], cwd: fileURLToPath(new URL('../../../../', import.meta.url)), timeoutMs: 5000 });
  expect(child).toMatchObject({ exitCode: 0, childExited: true }); expect(JSON.parse(child.stdout)).toEqual(setup.configuration);
  const restored = await prepareEngineeringSetup(env.workingDirectory, env.manifest), events: RunnerEventData[] = [];
  await expect((await restored.bind(pin)).run(context(restored, pin, events))).rejects.toThrow('already leased');
  expect(events).toEqual([]); expect(await readFile(join(projectRoot, 'active-lease.json'), 'utf8')).toBe(before); expect(await readFile(join(workspace.directory, 'effect.txt'), 'utf8')).toBe('unresolved effect\n');
  // Explicit synthetic injection has no running executor; teardown alone can confirm and release it.
  await workspace.release();
});
