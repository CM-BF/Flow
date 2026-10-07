import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, expect, test } from 'vitest';
import { prepareInstalledPackage, readInstalledPackage } from '@flow/plugin-runtime';
import { PLUGIN_RUNTIME_PROTOCOL } from '../../../../packages/contracts/src/plugin-runtime.js';
import { executePluginTool, type PluginExecutionInput } from './execution.js';
import { textDigest } from '../verifier.js';

const pack = promisify(execFile);
const packagePath = fileURLToPath(new URL('../../../../experiments/plugins/semver-compare/package/', import.meta.url));
let createInput: (prompt: string) => PluginExecutionInput;
const root: { path?: string; dev?: number; ino?: number; removed: boolean } = { removed: false };
const children: { pid: number | undefined; exitCode: number | null; signal: string | null }[] = [];
let provenance: { upstream: { name: string; version: string; license: string; files: { path: string; sha256: string }[] }; bundle: { bytes: number; sha256: string }; externalRuntimeImports: string[] };

beforeAll(async () => {
  root.path = await fs.mkdtemp(join(tmpdir(), 'flow-semver-package-'));
  const identity = await fs.lstat(root.path); root.dev = identity.dev; root.ino = identity.ino;
  const canonical = await fs.realpath(root.path);
  await fs.cp(packagePath, join(canonical, 'package'), { recursive: true, errorOnExist: true, force: false });
  await fs.mkdir(join(canonical, 'store'), { mode: 0o700 });
  const tarballPath = join(canonical, 'package.tgz');
  const packing = pack('/usr/bin/tar', ['--format=ustar', '-czf', tarballPath, '-C', canonical, 'package'], { timeout: 5000, maxBuffer: 8192 });
  const closed = new Promise<void>(resolve => packing.child.once('close', () => resolve()));
  try { await packing; } finally { await closed; children.push({ pid: packing.child.pid, exitCode: packing.child.exitCode, signal: packing.child.signalCode }); }
  const bytes = await fs.readFile(tarballPath); expect(bytes.length).toBeLessThan(65536);
  const artifact = { artifactId: randomUUID(), name: 'flow-semver-compare', version: '1.0.0', bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
  // Explicit operator trust of this exact built archive, not arbitrary package names/versions.
  const store = { root: join(canonical, 'store'), storeId: 'x01-semver-controlled-store', allowedDigests: [artifact.sha256] };
  const installed = await prepareInstalledPackage({ store, artifact, tarballPath });
  const readBack = await readInstalledPackage({ store, artifact });
  expect(readBack.receipt).toEqual(installed.receipt);
  provenance = JSON.parse(await fs.readFile(join(canonical, 'package/provenance.json'), 'utf8'));
  createInput = prompt => {
    const taskId = randomUUID(); const runnerId = randomUUID();
    const input: PluginExecutionInput = { binding: { protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: randomUUID(), invocationId: randomUUID(), taskId,
      registrationId: randomUUID(), registrationRevision: 1, versionId: randomUUID(), scope: { workspaceId: 'personal', projectId: null },
      materialInstallOperationId: randomUUID(), targetRunnerId: runnerId, storeId: store.storeId, materialId: installed.receipt.installationId,
      treeDigest: installed.receipt.treeDigest, hostApiMajor: 1, artifact, configuration: {}, inputDigest: textDigest(prompt), createdAt: new Date().toISOString() },
      task: { id: taskId, title: 'Compare semantic versions', prompt, harness: 'fixture', verification: { kind: 'contains', expected: '0' } },
      ownership: { attemptId: randomUUID(), ownerVersion: 1 }, runnerId, store, signal: new AbortController().signal, assertOwnership() {},
      authorize: async request => ({ ...request, protocol: PLUGIN_RUNTIME_PROTOCOL, taskId, runnerId, authorizedRevision: 1, replayed: false }) };
    return input;
  };
});
afterAll(async () => {
  if (root.path) {
    const current = await fs.lstat(root.path);
    if (current.isDirectory() && !current.isSymbolicLink() && current.dev === root.dev && current.ino === root.ino) {
      await fs.rm(root.path, { recursive: true }); root.removed = true;
    }
  }
  const retained: string[] = [];
  if (root.path) try { await fs.lstat(root.path); retained.push(root.path); } catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
  if (process.env.FLOW_X01_SEMVER_FACTS) await fs.writeFile(process.env.FLOW_X01_SEMVER_FACTS, JSON.stringify({ roots: [root], children, retained }), { flag: 'wx', mode: 0o600 });
  expect(retained).toEqual([]); expect(children).toHaveLength(1); expect(children[0]).toMatchObject({ exitCode: 0, signal: null });
});

test.each([
  ['1.2.3', '2.0.0', '-1'],
  ['2.0.0', '1.2.3', '1'],
  ['1.2.3+build.7', '1.2.3+build.9', '0'],
  ['1.0.0-beta.2', '1.0.0-beta.11', '-1'],
])('real npm compare %s and %s returns %s through both grant phases', async (left, right, expected) => {
  const input = createInput(JSON.stringify({ left, right })); input.task.verification = { kind: 'contains', expected };
  const phases: string[] = []; const authorize = input.authorize;
  input.authorize = async request => { phases.push(request.phase); return authorize(request); };
  const result = await executePluginTool(input);
  expect(phases).toEqual(['load', 'invoke']);
  expect(result.artifact.content).toBe(expected);
  expect(result.verification).toMatchObject({ type: 'verification', result: 'passed', verifierId: 'flow.text' });
  expect(result.provenance).toEqual({ bindingId: input.binding.bindingId, invocationId: input.binding.invocationId, taskId: input.task.id,
    attemptId: input.ownership.attemptId, ownerVersion: 1, installationId: input.binding.materialId, artifactId: input.binding.artifact.artifactId,
    artifactSha256: input.binding.artifact.sha256, treeDigest: input.binding.treeDigest, hostApiMajor: 1 });
});
test.each(['not-json', '{"left":"no-version","right":"1.0.0"}', '{"left":"1.0.0","right":"2.0.0","loose":true}', JSON.stringify({ left: '1'.repeat(257), right: '1.0.0' })])('invalid input produces no artifact: %s', async prompt => {
  await expect(executePluginTool(createInput(prompt))).rejects.toMatchObject({ code: 'PACKAGE_FAILED' });
});
test('distributed bundle is exact npm7.8.5 ISC composition with no external runtime imports', async () => {
  const source = JSON.parse(await fs.readFile(fileURLToPath(new URL('../../../../docs/evidence/x01/semver-inputs.json', import.meta.url)), 'utf8')));
  expect(provenance.upstream).toMatchObject({ name: 'semver', version: '7.8.5', license: 'ISC' });
  expect(provenance.upstream.files).toEqual(source.upstream.files.map(({ path, bytes, sha256 }: { path: string; bytes: number; sha256: string }) => ({ path, bytes, sha256 })));
  expect(provenance.externalRuntimeImports).toEqual([]);
  const bundle = await fs.readFile(join(packagePath, 'index.mjs'));
  expect({ bytes: bundle.length, sha256: createHash('sha256').update(bundle).digest('hex') }).toEqual(provenance.bundle);
  expect(bundle.toString()).not.toContain('NODE_DEBUG');
  const license = await fs.readFile(join(packagePath, 'license.txt'));
  expect(createHash('sha256').update(license).digest('hex')).toBe(source.upstream.files.find((item: { path: string }) => item.path === 'LICENSE').sha256);
});
