import { mkdtemp, realpath, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { test, expect, afterAll } from 'vitest';
import { prepareInstalledPackage, readInstalledPackage } from '@flow/plugin-runtime';
import { invokeInstalledTool, type FrozenToolInvocation } from './host.js';

const createdRoots: string[] = [];
afterAll(async () => {
  const retained: string[] = [];
  for (const root of createdRoots) { try { await readFile(root); retained.push(root); } catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') retained.push(root); } }
  const report = process.env.FLOW_X01_HOST_CLEANUP_REPORT;
  if (report) await writeFile(report, JSON.stringify({ checkedAt: new Date().toISOString(), createdRoots, retained }) + '\n');
  expect(retained).toEqual([]);
});

async function fixture(options: { code?: (root: string) => string; version?: string } = {}) {
  let root = await mkdtemp(join(tmpdir(), 'flow-plugin-host-test-'));
  createdRoots.push(root);
  try {
  root = await realpath(root);
  const source = join(root, 'source'); await mkdir(source); const storeRoot = join(root, 'store'); await mkdir(storeRoot, { mode: 0o700 });
  await cp(fileURLToPath(new URL('../../../../fixtures/plugins/text-tool', import.meta.url)), join(source, 'package'), { recursive: true });
  const version = options.version ?? '1.0.0';
  if (options.code) await writeFile(join(source, 'package', 'index.mjs'), options.code(root));
  const pkg = JSON.parse(await readFile(join(source, 'package', 'package.json'), 'utf8')); pkg.version = version;
  await writeFile(join(source, 'package', 'package.json'), JSON.stringify(pkg));
  const tarballPath = join(root, 'package.tgz');
  // A three-file USTAR fixture builder, not a product parser or loader mock.
  const entries: Buffer[] = [];
  for (const name of ['package.json', 'flow-plugin.json', 'index.mjs']) {
    const body = await readFile(join(source, 'package', name));
    const header = Buffer.alloc(512); header.write('package/' + name);
    header.write('0000600\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
    header.write(body.length.toString(8).padStart(11, '0') + '\0', 124); header.write('00000000000\0', 136);
    header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
    entries.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  await writeFile(tarballPath, gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)])));
  const bytes = await readFile(tarballPath);
  const artifact = { artifactId: randomUUID(), name: '@flow-fixtures/text-tool', version, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
  const store = { root: storeRoot, storeId: 'self-owned', allowedDigests: [artifact.sha256] };
  const { receipt } = await prepareInstalledPackage({ artifact, tarballPath, store });
  const binding: FrozenToolInvocation = { bindingId: randomUUID(), invocationId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), ownerVersion: 1,
    material: { artifact, installationId: receipt.installationId, treeDigest: receipt.treeDigest, storeId: store.storeId }, configuration: { prefix: 'verified: ' } };
  return { root, store, binding };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}

test('loads the installed real npm module after authorization and returns bounded text with frozen provenance', async () => {
  const f = await fixture();
  try {
    let authorized = 0; let owned = 0;
    const result = await invokeInstalledTool({ ...f, input: 'hello', signal: new AbortController().signal,
      authorize: async binding => { authorized++; expect(binding).toEqual(f.binding); }, assertOwnership: () => { owned++; } });
    expect(result).toEqual({ kind: 'text', content: 'verified: hello', provenance: {
      bindingId: f.binding.bindingId, invocationId: f.binding.invocationId, taskId: f.binding.taskId, attemptId: f.binding.attemptId, ownerVersion: 1,
      installationId: f.binding.material.installationId, artifactId: f.binding.material.artifact.artifactId,
      artifactSha256: f.binding.material.artifact.sha256, treeDigest: f.binding.material.treeDigest, hostApiMajor: 1 } });
    expect(authorized).toBe(1); expect(owned).toBeGreaterThanOrEqual(1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

function invocation(f: Awaited<ReturnType<typeof fixture>>) {
  return { store: f.store, binding: f.binding, input: 'hello', signal: new AbortController().signal,
    authorize: async (_binding: Readonly<FrozenToolInvocation>) => {}, assertOwnership: () => {} };
}

test('authority and ownership failures block module top-level execution and propagate the original failure', async () => {
  const f = await fixture({ code: root => `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(join(root, 'executed'))}, 'ran'); export const hostApiMajor=1; export function invoke(){return 'ok'}` });
  try {
    const denied = new Error('permission denied'); const fenced = new Error('owner changed');
    await expect(invokeInstalledTool({ ...invocation(f), authorize: async () => { throw denied; } })).rejects.toBe(denied);
    await expect(readFile(join(f.root, 'executed'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(invokeInstalledTool({ ...invocation(f), assertOwnership: () => { throw fenced; } })).rejects.toBe(fenced);
    await expect(readFile(join(f.root, 'executed'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await invokeInstalledTool(invocation(f))).content).toBe('ok');
    expect(await readFile(join(f.root, 'executed'), 'utf8')).toBe('ran');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('pre-abort, untrusted digest, and mismatched frozen material never authorize a load', async () => {
  const f = await fixture(); let calls = 0;
  try {
    const value = { ...invocation(f), authorize: async () => { calls++; } };
    await expect(invokeInstalledTool({ ...value, signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(invokeInstalledTool({ ...value, store: { ...f.store, allowedDigests: [] } })).rejects.toMatchObject({ code: 'UNTRUSTED_PACKAGE' });
    await expect(invokeInstalledTool({ ...value, binding: { ...f.binding, material: { ...f.binding.material, treeDigest: '0'.repeat(64) } } })).rejects.toMatchObject({ code: 'MATERIAL_MISMATCH' });
    expect(calls).toBe(0);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('a frozen invocation detaches configuration before asynchronous authorization', async () => {
  const f = await fixture();
  try {
    const result = await invokeInstalledTool({ ...invocation(f), authorize: async binding => {
      expect(Object.isFrozen(binding)).toBe(true); expect(Object.isFrozen(binding.configuration)).toBe(true);
      f.binding.configuration = { prefix: 'changed later: ' };
    } });
    expect(result.content).toBe('verified: hello');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test.each(['input', 'configuration', 'output', 'nontext', 'invoke rejection', 'import rejection', 'host api'] as const)('bounds input and package behavior: %s', async mode => {
  const f = await fixture({ code: () => mode === 'import rejection' ? "throw new Error('private import failure')"
    : `export const hostApiMajor=${mode === 'host api' ? 2 : 1}; export function invoke(){ ${mode === 'invoke rejection' ? "throw new Error('private invocation failure')" : mode === 'output' ? "return 'x'.repeat(16385)" : mode === 'nontext' ? 'return {}' : "return 'ok'"} }` });
  try {
    const value = invocation(f);
    if (mode === 'input') value.input = 'x'.repeat(16385);
    if (mode === 'configuration') value.binding.configuration = { prefix: 'x'.repeat(16385) };
    const expected = ['input', 'configuration'].includes(mode) ? 'INVALID_INPUT' : ['output', 'nontext'].includes(mode) ? 'OUTPUT_REJECTED' : mode === 'host api' ? 'HOST_API_MISMATCH' : 'PACKAGE_FAILED';
    const failure = await invokeInstalledTool(value).then(() => undefined, error => error);
    expect(failure).toMatchObject({ code: expected }); expect(String(failure)).not.toContain('private');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('one installation has a stable ESM identity across invocations while a different version remains distinct', async () => {
  const code = (version: string) => `export const hostApiMajor=1; let count=0; export function invoke(){return '${version}:'+ ++count+':'+import.meta.url}`;
  const first = await fixture({ code: () => code('v1') }); let second: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    const one = await invokeInstalledTool(invocation(first));
    const next = invocation(first); next.binding = { ...next.binding, invocationId: randomUUID() };
    const two = await invokeInstalledTool(next);
    const installed = await readInstalledPackage({ artifact: first.binding.material.artifact, store: first.store });
    expect(one.content).toBe('v1:1:' + installed.entrypoint.href);
    expect(two.content).toBe('v1:2:' + installed.entrypoint.href);
    expect(installed.entrypoint.search).toBe(''); expect(installed.entrypoint.hash).toBe('');
    second = await fixture({ version: '2.0.0', code: () => code('v2') });
    const other = await invokeInstalledTool(invocation(second));
    expect(other.content).toMatch(/^v2:1:file:/); expect(other.provenance.installationId).not.toBe(one.provenance.installationId);
    // Removing material is not ESM unloading: the existing namespace remains cached.
    const namespace = await import(installed.entrypoint.href);
    await rm(join(first.store.root, installed.receipt.installationId), { recursive: true });
    expect(namespace.invoke()).toBe('v1:3:' + installed.entrypoint.href); // existing executable namespace survives file removal
    await expect(invokeInstalledTool(invocation(first))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  } finally { await rm(first.root, { recursive: true, force: true }); if (second) await rm(second.root, { recursive: true, force: true }); }
});

test.each(['import', 'invoke'] as const)('abort after pending %s is unknown; it does not claim package termination', async phase => {
  const key = 'flow-owned-test-' + randomUUID(); const globals = globalThis as unknown as Record<string, unknown>;
  let started!: () => void; let release!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  globals[key] = () => new Promise<void>(resolve => { release = resolve; started(); });
  const code = phase === 'import'
    ? `await globalThis[${JSON.stringify(key)}](); export const hostApiMajor=1; export function invoke(){return 'late'}`
    : `export const hostApiMajor=1; export async function invoke(){await globalThis[${JSON.stringify(key)}](); return 'late'}`;
  const f = await fixture({ code: () => code }); const abort = new AbortController();
  try {
    const outcome = invokeInstalledTool({ ...invocation(f), signal: abort.signal }).then(() => undefined, error => error);
    await entered; abort.abort();
    expect(await outcome).toMatchObject({ code: 'OUTCOME_UNKNOWN' });
  } finally {
    release?.();
    const installed = await readInstalledPackage({ artifact: f.binding.material.artifact, store: f.store });
    await import(installed.entrypoint.href); // settle the actual import before removing owned fixture files
    delete globals[key]; await rm(f.root, { recursive: true, force: true });
  }
});

test('revocation while the real module import is pending prevents its invoke action', async () => {
  const key = 'flow-grant-gate-' + randomUUID();
  const globals = globalThis as unknown as Record<string, unknown>;
  let started!: () => void; let release!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  globals[key] = () => new Promise<void>(resolve => { release = resolve; started(); });
  const f = await fixture({ code: root => `import {writeFileSync} from 'node:fs'; await globalThis[${JSON.stringify(key)}](); export const hostApiMajor=1; export function invoke(){writeFileSync(${JSON.stringify(join(root, 'invoked'))}, 'ran'); return 'forbidden'}` });
  let granted = true; const denied = new Error('grant revoked during import');
  const outcome = invokeInstalledTool({ ...invocation(f), authorize: async () => { if (!granted) throw denied; } });
  const settled = outcome.then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  try {
    await Promise.race([entered, settled.then(() => { throw Error('Module import did not reach its pending gate'); })]);
    granted = false; release();
    expect((await settled).error).toBe(denied);
    await expect(readFile(join(f.root, 'invoked'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    release?.(); await settled;
    delete globals[key]; await rm(f.root, { recursive: true, force: true });
  }
});
