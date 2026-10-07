import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { create } from 'tar';
import { expect, test, afterAll } from 'vitest';
import { prepareInstalledPackage } from '@flow/plugin-runtime';
import { executePluginVerifier, PluginExecutionUnsettled, PluginAuthorizationUnknown, type PluginVerifierExecutionInput } from './execution.js';
import { invokeInstalledTool } from './host.js';
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const roots: { path: string; dev: number; ino: number; removed: boolean }[] = [];
afterAll(async () => {
  expect(roots.every(root => root.removed)).toBe(true);
  if (process.env.FLOW_AV02_FIXTURE_REPORT) await fs.writeFile(process.env.FLOW_AV02_FIXTURE_REPORT, JSON.stringify({ roots }));
});
const moduleSource = (fake = false) => `export const hostApiMajor=1;
export function invoke({input}) {
 const value=JSON.parse(input); let parsed, verdict;
 try { parsed=JSON.parse(value.source.content); } catch { verdict={result:'failed',reason:'invalid-json',missingKeys:[]}; }
 if(!verdict) { if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed)) verdict={result:'failed',reason:'not-object',missingKeys:[]};
 else { const missingKeys=value.rule.requiredKeys.filter(key=>!Object.hasOwn(parsed,key)); verdict=missingKeys.length?{result:'failed',reason:'missing-required-keys',missingKeys}:{result:'passed',reason:'passed',missingKeys:[]}; } }
 ${fake ? "verdict={result:'passed',reason:'passed',missingKeys:[]};" : ''}
 return JSON.stringify({schemaVersion:1,algorithmId:value.rule.algorithmId,algorithmVersion:1,inputDigest:value.inputDigest,verdict});
}`;
async function withPackages(run: (a: PluginVerifierExecutionInput, b: PluginVerifierExecutionInput, bad: PluginVerifierExecutionInput) => Promise<void>) {
  const path = await fs.mkdtemp(join(tmpdir(), 'flow-av02-')); const stat = await fs.lstat(path); const owned = { path, dev: stat.dev, ino: stat.ino, removed: false }; roots.push(owned);
  try {
    const root = await fs.realpath(path); const storeRoot = join(root, 'store'); await fs.mkdir(storeRoot, { mode: 0o700 });
    const inputs: PluginVerifierExecutionInput[] = [];
    for (const [index, version] of ['1.0.0', '1.0.1', '1.0.2'].entries()) {
      const dir = join(root, 'source-' + index); await fs.mkdir(join(dir, 'package'), { recursive: true });
      await fs.writeFile(join(dir, 'package/package.json'), JSON.stringify({ name: 'flow-owned-json-verifier', version, type: 'module' }));
      await fs.writeFile(join(dir, 'package/flow-plugin.json'), JSON.stringify({ schemaVersion: 1, hostApiMajor: 1, kind: 'verifier', entrypoint: 'index.mjs' }));
      await fs.writeFile(join(dir, 'package/index.mjs'), moduleSource(index === 2));
      const tarballPath = join(root, index + '.tgz'); await create({ cwd: dir, file: tarballPath, gzip: true, portable: true, noMtime: true }, ['package']);
      const bytes = await fs.readFile(tarballPath); const artifact = { artifactId: randomUUID(), name: 'flow-owned-json-verifier', version, bytes: bytes.length, sha256: digest(bytes), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
      const store = { root: storeRoot, storeId: 'av02-owned', allowedDigests: [artifact.sha256] }; const installed = await prepareInstalledPackage({ store, artifact, tarballPath });
      expect(installed.receipt.manifest.kind).toBe('verifier');
      inputs.push({ store, binding: { bindingId: randomUUID(), invocationId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), ownerVersion: 1,
        material: { installationId: installed.receipt.installationId, storeId: store.storeId, treeDigest: installed.receipt.treeDigest, artifact }, configuration: {} },
        verification: { source: { taskId: 'source-task', attemptId: 'source-attempt', artifactId: 'source-artifact', content: '{"id":1}', version: digest('{"id":1}') }, rule: { schemaVersion: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1, requiredKeys: ['id'] } },
        trustedAlgorithms: [{ artifactSha256: artifact.sha256, treeDigest: installed.receipt.treeDigest, hostApiMajor: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1 }],
        signal: new AbortController().signal, assertOwnership: () => {}, authorize: async () => {} });
    }
    await run(inputs[0]!, inputs[1]!, inputs[2]!);
  } finally {
    const current = await fs.lstat(path); if (current.dev !== owned.dev || current.ino !== owned.ino || current.isSymbolicLink()) throw new Error('FIXTURE_IDENTITY_CHANGED');
    await fs.rm(path, { recursive: true }); await expect(fs.lstat(path)).rejects.toMatchObject({ code: 'ENOENT' }); owned.removed = true;
  }
}
test('AV02 real verifier A/B materials keep exact provenance and changed rules cannot reuse passed identity', async () => {
  await withPackages(async (a, b) => {
    const phases: string[] = []; a.authorize = async (_, phase) => { phases.push(phase); };
    const first = await executePluginVerifier(a); expect(first.output.verdict.result).toBe('passed'); expect(phases).toEqual(['load', 'invoke']);
    expect(first.provenance.artifactSha256).toBe(a.binding.material.artifact.sha256);
    const upgraded = await executePluginVerifier(b); expect(upgraded.provenance.artifactSha256).toBe(b.binding.material.artifact.sha256); expect(upgraded.output.inputDigest).not.toBe(first.output.inputDigest);
    const second = await executePluginVerifier({ ...a, verification: { ...a.verification, rule: { ...a.verification.rule, requiredKeys: ['email', 'id'] } } });
    expect(second.output.verdict).toEqual({ result: 'failed', reason: 'missing-required-keys', missingKeys: ['email'] }); expect(second.output.inputDigest).not.toBe(first.output.inputDigest);
  });
});
test('AV02 fake passed and verifier-as-tool are rejected through real installed consumers', async () => {
  await withPackages(async (a, _b, bad) => {
    await expect(executePluginVerifier({ ...bad, verification: { ...bad.verification, rule: { ...bad.verification.rule, requiredKeys: ['missing'] } } })).rejects.toMatchObject({ code: 'VERIFIER_VERDICT_MISMATCH' });
    let phases = 0; a.authorize = async () => { phases++; };
    await expect(invokeInstalledTool({ ...a, input: '{}' })).rejects.toMatchObject({ code: 'PACKAGE_KIND_MISMATCH' }); expect(phases).toBe(0);
  });
});
test('AV02 untrusted material/source and unknown phase preserve explicit failure boundaries', async () => {
  await withPackages(async a => {
    let phases = 0; a.authorize = async () => { phases++; };
    await expect(executePluginVerifier({ ...a, trustedAlgorithms: [] })).rejects.toMatchObject({ code: 'VERIFIER_ALGORITHM_UNTRUSTED' });
    await expect(executePluginVerifier({ ...a, verification: { ...a.verification, source: { ...a.verification.source, version: 'a'.repeat(64) } } })).rejects.toMatchObject({ code: 'SOURCE_VERSION_MISMATCH' }); expect(phases).toBe(0);
    a.authorize = async () => { throw new PluginAuthorizationUnknown(); };
    await expect(executePluginVerifier(a)).rejects.toBeInstanceOf(PluginExecutionUnsettled);
    await expect(executePluginVerifier({ ...a, signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
