import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, expect, test } from 'vitest';
import { prepareInstalledPackage, readInstalledPackage, type InstalledPackageReceipt, type TrustedPackageStore } from '@flow/plugin-runtime';
import { PLUGIN_RUNTIME_PROTOCOL } from '../../../../packages/contracts/src/plugin-runtime.js';
import { executePluginTool, type PluginExecutionInput } from './execution.js';
import { textDigest } from '../verifier.js';

const pack = promisify(execFile);
const fixedPackage = fileURLToPath(new URL('../../../../experiments/plugins/semver-compare/package/', import.meta.url));
const root: { path?: string; dev?: number; ino?: number; removed: boolean } = { removed: false };
const children: { pid: number | undefined; exitCode: number | null; signal: string | null }[] = [];
const observations: unknown[] = [];
let store: TrustedPackageStore;
let first: InstalledPackageReceipt;
let second: InstalledPackageReceipt;
let pinnedBeforeUpgrade: PluginExecutionInput;

async function archive(version: string) {
  const directory = join(root.path!, version);
  await fs.mkdir(directory);
  await fs.cp(fixedPackage, join(directory, 'package'), { recursive: true, errorOnExist: true, force: false });
  // This is a new Flow wrapper release of the same exact npm bundle, not an npm upgrade.
  const manifest = JSON.parse(await fs.readFile(join(directory, 'package/package.json'), 'utf8'));
  await fs.writeFile(join(directory, 'package/package.json'), JSON.stringify({ ...manifest, version }) + '\n');
  const tarballPath = join(directory, 'package.tgz');
  const packing = pack('/usr/bin/tar', ['--format=ustar', '-czf', tarballPath, '-C', directory, 'package'], { timeout: 5000, maxBuffer: 8192 });
  const closed = new Promise<void>(resolve => packing.child.once('close', () => resolve()));
  try { await packing; } finally {
    await closed; children.push({ pid: packing.child.pid, exitCode: packing.child.exitCode, signal: packing.child.signalCode });
  }
  const bytes = await fs.readFile(tarballPath); expect(bytes.length).toBeLessThan(65536);
  return { tarballPath, artifact: { artifactId: randomUUID(), name: 'flow-semver-compare', version, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') } };
}

function invocation(receipt: InstalledPackageReceipt): PluginExecutionInput {
  const taskId = randomUUID(); const runnerId = randomUUID(); const prompt = JSON.stringify({ left: '1.0.0-beta.2', right: '1.0.0-beta.11' });
  return { binding: { protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: randomUUID(), invocationId: randomUUID(), taskId,
    registrationId: randomUUID(), registrationRevision: receipt.artifact.version === '1.0.0' ? 1 : 2, versionId: randomUUID(),
    scope: { workspaceId: 'personal', projectId: null }, materialInstallOperationId: randomUUID(), targetRunnerId: runnerId,
    storeId: store.storeId, materialId: receipt.installationId, treeDigest: receipt.treeDigest, hostApiMajor: 1,
    artifact: { ...receipt.artifact }, configuration: {}, inputDigest: textDigest(prompt), createdAt: new Date().toISOString() },
  task: { id: taskId, title: 'Compare pinned release', prompt, harness: 'fixture', verification: { kind: 'contains', expected: '-1' } },
  ownership: { attemptId: randomUUID(), ownerVersion: 1 }, runnerId, store, signal: new AbortController().signal, assertOwnership() {},
  authorize: async request => ({ ...request, protocol: PLUGIN_RUNTIME_PROTOCOL, taskId, runnerId, authorizedRevision: 2, replayed: false }) };
}

beforeAll(async () => {
  root.path = await fs.mkdtemp(join(tmpdir(), 'flow-semver-pinning-package-'));
  const identity = await fs.lstat(root.path); root.dev = identity.dev; root.ino = identity.ino;
  root.path = await fs.realpath(root.path);
  const oldArchive = await archive('1.0.0'); const newArchive = await archive('1.0.1');
  await fs.mkdir(join(root.path, 'store'), { mode: 0o700 });
  store = { root: join(root.path, 'store'), storeId: 'x01-semver-pinning', allowedDigests: [oldArchive.artifact.sha256, newArchive.artifact.sha256] };
  first = (await prepareInstalledPackage({ store, ...oldArchive })).receipt;
  pinnedBeforeUpgrade = invocation(first);
  second = (await prepareInstalledPackage({ store, ...newArchive })).receipt;
});

afterAll(async () => {
  if (root.path) {
    const current = await fs.lstat(root.path);
    if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== root.dev || current.ino !== root.ino) throw new Error('Owned package root changed; retain it.');
    await fs.rm(root.path, { recursive: true }); root.removed = true;
    await expect(fs.lstat(root.path)).rejects.toMatchObject({ code: 'ENOENT' });
  }
  if (process.env.FLOW_X01_SEMVER_FACTS) await fs.writeFile(process.env.FLOW_X01_SEMVER_FACTS,
    JSON.stringify({ roots: [root], children, receipts: [first, second], observations }), { flag: 'wx', mode: 0o600 });
  expect(children).toHaveLength(2);
  for (const child of children) expect(child).toMatchObject({ exitCode: 0, signal: null });
});

test('new material installation preserves the old frozen binding and both exact release identities', async () => {
  const snapshot = JSON.stringify(pinnedBeforeUpgrade.binding);
  expect(second.installationId).not.toBe(first.installationId);
  expect(second.treeDigest).not.toBe(first.treeDigest);
  expect(second.artifact.sha256).not.toBe(first.artifact.sha256);
  expect(first.files).toHaveLength(5);
  expect(first.files.find(file => file.path === 'index.mjs')).toEqual({ path: 'index.mjs', bytes: 9749,
    sha256: '2ab17629625064a227043d068cbecdf184725391c606dc30b9aa9959ab3702b7' });
  expect(second.files.find(file => file.path === 'index.mjs')).toEqual(first.files.find(file => file.path === 'index.mjs'));
  for (const [input, receipt] of [[pinnedBeforeUpgrade, first], [invocation(second), second]] as const) {
    const phases: string[] = []; const authorize = input.authorize;
    input.authorize = async request => { phases.push(request.phase); return authorize(request); };
    const result = await executePluginTool(input);
    expect(phases).toEqual(['load', 'invoke']);
    expect(result.artifact.content).toBe('-1');
    expect(result.verification).toMatchObject({ type: 'verification', result: 'passed', verifierId: 'flow.text' });
    expect(result.provenance).toMatchObject({ installationId: receipt.installationId, treeDigest: receipt.treeDigest,
      artifactId: receipt.artifact.artifactId, artifactSha256: receipt.artifact.sha256, bindingId: input.binding.bindingId, invocationId: input.binding.invocationId });
    expect((await readInstalledPackage({ store, artifact: receipt.artifact })).receipt).toEqual(receipt);
    observations.push({ release: receipt.artifact.version, phases, artifact: result.artifact, provenance: result.provenance });
  }
  expect(JSON.stringify(pinnedBeforeUpgrade.binding)).toBe(snapshot);
});

test('substituting the new artifact into an old material pin fails before either grant', async () => {
  const input = invocation(first); input.binding.artifact = { ...second.artifact };
  const phases: string[] = [];
  input.authorize = async request => { phases.push(request.phase); throw new Error('Must not authorize a substituted material.'); };
  await expect(executePluginTool(input)).rejects.toMatchObject({ code: 'MATERIAL_MISMATCH' });
  expect(phases).toEqual([]);
});

test('a historical pin does not bypass current operator digest trust', async () => {
  const input = invocation(first); input.store = { ...store, allowedDigests: [second.artifact.sha256] };
  const phases: string[] = [];
  input.authorize = async request => { phases.push(request.phase); throw new Error('Must not authorize untrusted material.'); };
  await expect(executePluginTool(input)).rejects.toMatchObject({ code: 'UNTRUSTED_PACKAGE' });
  expect(phases).toEqual([]);
});
