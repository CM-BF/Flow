import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { prepareInstalledPackage, readInstalledPackage, type InstalledPackageReceipt, type TrustedPackageStore } from '@flow/plugin-runtime';
import { invokeInstalledTool, type PluginToolInput } from './host.js';

const pack = promisify(execFile);
const releases = fileURLToPath(new URL('../../../../experiments/plugins/semver-range-upgrade/releases/', import.meta.url));
const children: { pid: number | undefined; exitCode: number | null; signal: string | null }[] = [];
const observations: unknown[] = [];
let root: { path: string; dev: number; ino: number };
let store: TrustedPackageStore;
let oldReceipt: InstalledPackageReceipt;
let newReceipt: InstalledPackageReceipt;
let originalPin: PluginToolInput;
let frozen: string;
let baseline: Awaited<ReturnType<typeof invokeInstalledTool>>;
const baselinePhases: string[] = [];

async function archive(version: string) {
  const tarballPath = join(root.path, `${version}.tgz`);
  const packing = pack('/usr/bin/tar', ['--format=ustar', '-czf', tarballPath, '-C', join(releases, version), 'package'], { timeout: 5000, maxBuffer: 8192 });
  const closed = new Promise<void>(resolve => packing.child.once('close', () => resolve()));
  try { await packing; } finally {
    await closed; children.push({ pid: packing.child.pid, exitCode: packing.child.exitCode, signal: packing.child.signalCode });
  }
  const bytes = await fs.readFile(tarballPath); expect(bytes.length).toBeLessThan(65536);
  return { tarballPath, artifact: { artifactId: randomUUID(), name: 'flow-semver-range', version, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') } };
}
function invocation(receipt: InstalledPackageReceipt): PluginToolInput {
  return { store, binding: { bindingId: randomUUID(), invocationId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), ownerVersion: 1,
    material: { installationId: receipt.installationId, storeId: store.storeId, treeDigest: receipt.treeDigest, artifact: { ...receipt.artifact } }, configuration: {} },
  input: JSON.stringify({ version: '1.1.0-a', range: '~1.1', includePrerelease: true }), signal: new AbortController().signal,
  assertOwnership() {}, authorize: async () => {} };
}
beforeAll(async () => {
  const path = await fs.mkdtemp(join(tmpdir(), 'flow-upstream-host-')); const identity = await fs.lstat(path);
  root = { path: await fs.realpath(path), dev: identity.dev, ino: identity.ino };
  const first = await archive('7.8.4'); const second = await archive('7.8.5');
  await fs.mkdir(join(root.path, 'store'), { mode: 0o700 });
  store = { root: join(root.path, 'store'), storeId: 'x01-upstream-range', allowedDigests: [first.artifact.sha256, second.artifact.sha256] };
  oldReceipt = (await prepareInstalledPackage({ store, ...first })).receipt;
  originalPin = invocation(oldReceipt); frozen = JSON.stringify(originalPin.binding);
  originalPin.authorize = async (_, phase) => { baselinePhases.push(phase); };
  baseline = await invokeInstalledTool(originalPin);
  observations.push({ release: oldReceipt.artifact.version, input: originalPin.input, phases: baselinePhases, result: baseline, beforeNewMaterial: true });
  newReceipt = (await prepareInstalledPackage({ store, ...second })).receipt;
});
afterAll(async () => {
  // The supervising caller removes its own TMP only after confirmed process closure.
  if (process.env.FLOW_UPSTREAM_FACTS) await fs.writeFile(process.env.FLOW_UPSTREAM_FACTS, JSON.stringify({ root, children, receipts: [oldReceipt, newReceipt], observations }), { flag: 'wx', mode: 0o600 });
  expect(children).toHaveLength(2);
  for (const child of children) expect(child).toMatchObject({ exitCode: 0, signal: null });
});

test('real upstream 7.8.4 to 7.8.5 to rollback changes the same range result and preserves the old material pin', async () => {
  expect(oldReceipt.artifact.sha256).not.toBe(newReceipt.artifact.sha256);
  expect(oldReceipt.treeDigest).not.toBe(newReceipt.treeDigest);
  expect(oldReceipt.files.find(f => f.path === 'index.mjs')!.sha256).not.toBe(newReceipt.files.find(f => f.path === 'index.mjs')!.sha256);
  expect(baselinePhases).toEqual(['load', 'invoke']);
  const inputs = [invocation(newReceipt), invocation(oldReceipt)];
  const contents: string[] = [baseline.content];
  for (const [index, input] of inputs.entries()) {
    const phases: string[] = []; input.authorize = async (_binding, phase) => { phases.push(phase); };
    const result = await invokeInstalledTool(input); contents.push(result.content);
    expect(phases).toEqual(['load', 'invoke']);
    expect(result.provenance).toMatchObject({ bindingId: input.binding.bindingId, invocationId: input.binding.invocationId,
      installationId: input.binding.material.installationId, treeDigest: input.binding.material.treeDigest, artifactSha256: input.binding.material.artifact.sha256 });
    expect((await readInstalledPackage({ store, artifact: input.binding.material.artifact })).receipt).toEqual(index === 0 ? newReceipt : oldReceipt);
    observations.push({ release: input.binding.material.artifact.version, input: input.input, phases, result });
  }
  expect(contents).toEqual(['false', 'true', 'false']);
  expect(new Set([originalPin, ...inputs].map(i => i.binding.invocationId)).size).toBe(3);
  expect(JSON.stringify(originalPin.binding)).toBe(frozen);
  const oldSource = JSON.parse(await fs.readFile(join(releases, '7.8.4/package/upstream.json'), 'utf8'));
  const newSource = JSON.parse(await fs.readFile(join(releases, '7.8.5/package/upstream.json'), 'utf8'));
  expect(oldSource.gitHead).toBe('8640bd68f1653e504b53e9be4030eccdfe4c307a');
  expect(newSource.gitHead).toBe('6e05b7637396ac66522cff8731f07cfe0ef49a29');
  expect(oldSource.integrity).not.toBe(newSource.integrity);
});
test('the pinned dependency does not bypass material identity or current digest trust', async () => {
  const changed = invocation(oldReceipt); changed.binding.material.artifact = { ...newReceipt.artifact };
  const phases: string[] = []; changed.authorize = async (_, phase) => { phases.push(phase); };
  await expect(invokeInstalledTool(changed)).rejects.toMatchObject({ code: 'MATERIAL_MISMATCH' });
  const untrusted = invocation(oldReceipt); untrusted.store = { ...store, allowedDigests: [newReceipt.artifact.sha256] }; untrusted.authorize = changed.authorize;
  await expect(invokeInstalledTool(untrusted)).rejects.toMatchObject({ code: 'UNTRUSTED_PACKAGE' });
  expect(phases).toEqual([]);
});
test('the shared adapter bounds JSON fields and preserves ordinary semver booleans', async () => {
  for (const receipt of [oldReceipt, newReceipt]) {
    const input = invocation(receipt); input.input = JSON.stringify({ version: '1.2.3', range: '^1.2', includePrerelease: false });
    expect((await invokeInstalledTool(input)).content).toBe('true');
    for (const invalid of ['null', '{', JSON.stringify({ version: 'x'.repeat(257), range: '*', includePrerelease: true }),
      JSON.stringify({ version: '1', range: '*', includePrerelease: 'true' }), ' '.repeat(4097)]) {
      await expect(invokeInstalledTool({ ...input, input: invalid })).rejects.toMatchObject({ code: 'PACKAGE_FAILED' });
    }
  }
});
