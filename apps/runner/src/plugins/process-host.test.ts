import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, expect, afterAll } from 'vitest';
import { FrameReader, PROCESS_PROTOCOL } from './process-protocol.js';
import { ProcessResources } from './process-resources.js';
const identity = () => ({ nonce:'a'.repeat(32),bindingId:randomUUID(),invocationId:randomUUID(),taskId:randomUUID(),attemptId:randomUUID(),ownerVersion:1 });
const framed = (value: unknown) => { const b=Buffer.from(JSON.stringify(value));const h=Buffer.alloc(4);h.writeUInt32BE(b.length);return Buffer.concat([h,b]); };
test('trusted framing rejects length before body, truncation, bad UTF8 and wrong sequence',()=>{
 const tooBig=Buffer.alloc(4);tooBig.writeUInt32BE(4097);expect(()=>new FrameReader(4096,()=>{}).push(tooBig)).toThrow();
 const partial=new FrameReader(4096,()=>{});partial.push(Buffer.from([0,0]));expect(()=>partial.end()).toThrow();
 expect(()=>new FrameReader(4096,()=>{}).push(Buffer.from([0,0,0,1,255]))).toThrow();
 expect(()=>new FrameReader(4096,()=>{}).push(framed({protocol:PROCESS_PROTOCOL,identity:identity(),sequence:2,kind:'check'}))).toThrow();
});
test('trusted resource count is reusable and full capacity never prevents owned cleanup',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'flow-process-resources-'));const info=await fs.lstat(root);
 try { const resources=await ProcessResources.open(join(root,'owned'));const items=[];
  for(let n=0;n<32;n++)items.push(await resources.reserve(identity()));
  await expect(resources.reserve(identity())).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
  for(const item of items)await resources.finish(item);
  const next=await resources.reserve(identity());await resources.finish(next);await resources.close();
  expect(await fs.readdir(join(root,'owned/receipts'))).toEqual([]);
 }finally{const current=await fs.lstat(root);expect(current.ino).toBe(info.ino);expect(current.dev).toBe(info.dev);await fs.rm(root,{recursive:true});}
});
test('trusted resources reject linked receipts and unknown remainder without probing old PIDs',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'flow-process-links-'));const info=await fs.lstat(root);
 try {const resources=await ProcessResources.open(join(root,'owned'));const item=await resources.reserve(identity());
  await fs.link(join(root,'owned/receipts/slot-00.json'),join(root,'alias'));
  await expect(resources.update(item,{state:'spawned'})).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
  await expect(resources.reserve(identity())).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
  await expect(resources.close()).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
  await expect(ProcessResources.open(join(root,'owned'))).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
 }finally{const current=await fs.lstat(root);expect(current.ino).toBe(info.ino);expect(current.dev).toBe(info.dev);await fs.rm(root,{recursive:true});}
});

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { prepareInstalledPackage } from '@flow/plugin-runtime';
import { createTrustedProcessHost, type ProcessObservation } from './process-host.js';
import { PluginToolError, type PluginToolInput } from './host.js';

const verifierEvidence: unknown[] = [];
afterAll(async () => { if (process.env.FLOW_PROCESS_VERIFIER_REPORT) await fs.writeFile(process.env.FLOW_PROCESS_VERIFIER_REPORT, JSON.stringify(verifierEvidence, null, 2) + '\n', { flag: 'wx' }); });

// Three finite USTAR entries reuse the real package reader, without an extra tar child.
async function withMaterial(kind: 'tool' | 'verifier', code: (root: string) => string,
  run: (input: PluginToolInput, host: Awaited<ReturnType<typeof createTrustedProcessHost>>, facts: ProcessObservation[], root: string) => Promise<void>) {
  const root = await fs.mkdtemp(join(tmpdir(), 'flow-process-verifier-')); const owned = await fs.lstat(root);
  const facts: ProcessObservation[] = []; let host: Awaited<ReturnType<typeof createTrustedProcessHost>> | undefined;
  try {
    await fs.mkdir(join(root, 'store'), { mode: 0o700 });
    const entries: Buffer[] = [];
    const files = { 'package.json': JSON.stringify({ name: 'flow-process-verifier', version: '1.0.0', type: 'module' }),
      'flow-plugin.json': JSON.stringify({ schemaVersion: 1, hostApiMajor: 1, kind, entrypoint: 'index.mjs' }), 'index.mjs': code(root) };
    for (const [name, text] of Object.entries(files)) {
      const body = Buffer.from(text); const header = Buffer.alloc(512); header.write('package/' + name);
      header.write('0000600\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
      header.write(body.length.toString(8).padStart(11, '0') + '\0', 124); header.write('00000000000\0', 136);
      header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
      header.write(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148);
      entries.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
    }
    const bytes = gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)])); expect(bytes.length).toBeLessThan(8192);
    const tarballPath = join(root, 'material.tgz'); await fs.writeFile(tarballPath, bytes);
    const artifact = { artifactId: randomUUID(), name: 'flow-process-verifier', version: '1.0.0', bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
    const store = { root: join(root, 'store'), storeId: 'verifier-process-test', allowedDigests: [artifact.sha256] };
    const installed = await prepareInstalledPackage({ store, artifact, tarballPath });
    const input: PluginToolInput = { store, binding: { bindingId: randomUUID(), invocationId: randomUUID(), taskId: randomUUID(),
      attemptId: randomUUID(), ownerVersion: 1, material: { artifact, installationId: installed.receipt.installationId,
        treeDigest: installed.receipt.treeDigest, storeId: store.storeId }, configuration: {} }, input: '{"name":"汉😀"}',
      signal: new AbortController().signal, assertOwnership: () => {}, authorize: async () => {} };
    host = await createTrustedProcessHost({ resourceRoot: join(root, 'process'), observe: fact => facts.push(fact) });
    await run(input, host, facts, root);
  } finally {
    // This test owns this exact fresh root, including any intentionally retained failure receipt.
    const current = await fs.lstat(root); expect(current.isSymbolicLink()).toBe(false);
    expect([current.dev, current.ino]).toEqual([owned.dev, owned.ino]);
    if (host) await host.close().catch(error => { expect(error.message).toBe('PROCESS_RESOURCE_UNKNOWN'); });
    expect(facts.every(fact => fact.processClosed && fact.protocolEof && fact.stdoutEof && fact.stderrEof)).toBe(true);
    const nodes: string[] = []; let bytes = 0;
    async function visit(path: string): Promise<void> {
      const value = await fs.lstat(path); expect(value.isSymbolicLink()).toBe(false);
      expect(nodes.length).toBeLessThan(64); nodes.push(path);
      if (value.isDirectory()) for (const name of await fs.readdir(path)) await visit(join(path, name));
      else { expect(value.isFile()).toBe(true); expect(value.nlink).toBe(1); bytes += value.size; expect(bytes).toBeLessThan(1024 * 1024); }
    }
    await visit(root);
    for (const path of nodes.reverse()) { const value = await fs.lstat(path); if (value.isDirectory()) await fs.rmdir(path); else await fs.unlink(path); }
    await expect(fs.lstat(root)).rejects.toMatchObject({ code: 'ENOENT' });
    verifierEvidence.push({ root, dev: owned.dev, ino: owned.ino, removed: true, sampleBytes: bytes, nodes: nodes.length, workers: facts });
  }
}
const markerModule = (root: string) => `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(join(root, 'imported'))},'yes');
 export const hostApiMajor=1;export function invoke(){writeFileSync(${JSON.stringify(join(root, 'invoked'))},'yes');return 'never'}`;

test('trusted verifier worker preserves typed result text, exact pin and fresh module state', async () => {
  await withMaterial('verifier', () => `import {createHash} from 'node:crypto';let count=0;export const hostApiMajor=1;export function invoke({input}){if(++count!==1)throw new Error('shared module');return JSON.stringify({schemaVersion:1,algorithmId:'flow.json-object.required-keys',algorithmVersion:1,inputDigest:createHash('sha256').update(input).digest('hex'),verdict:{result:'passed',reason:'passed',missingKeys:[]}})}`,
    async (input, host, facts) => {
      const phases: string[] = []; input.authorize = async (_, phase) => { phases.push(phase); };
      const first = await host.invokeVerifier(input);
      expect(first.content).toBe(JSON.stringify({ schemaVersion: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1, inputDigest: createHash('sha256').update(input.input).digest('hex'), verdict: { result: 'passed', reason: 'passed', missingKeys: [] } }));
      expect(first.provenance).toMatchObject({ bindingId: input.binding.bindingId, invocationId: input.binding.invocationId,
        artifactSha256: input.binding.material.artifact.sha256, treeDigest: input.binding.material.treeDigest });
      const second = await host.invokeVerifier({ ...input, binding: { ...input.binding, invocationId: randomUUID() } });
      expect(second.content).toBe(first.content); expect(second.provenance.invocationId).not.toBe(first.provenance.invocationId);
      expect(phases).toEqual(['load', 'invoke', 'load', 'invoke']); expect(facts).toHaveLength(2);
    });
});
test.each(['tool', 'verifier'] as const)('trusted worker rejects %s material through the opposite method before import or authorization', async kind => {
  await withMaterial(kind, markerModule, async (input, host, facts, root) => {
    let calls = 0; input.authorize = async () => { calls++; };
    await expect((kind === 'tool' ? host.invokeVerifier : host.invoke)(input)).rejects.toMatchObject({ code: 'PACKAGE_KIND_MISMATCH' });
    expect(calls).toBe(0); expect(facts).toHaveLength(1);
    await expect(fs.lstat(join(root, 'imported'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.lstat(join(root, 'invoked'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
test('trusted verifier cancellation after load authorization is unknown and does not invoke', async () => {
  await withMaterial('verifier', markerModule, async (input, host, facts, root) => {
    const abort = new AbortController(); input.signal = abort.signal;
    input.authorize = async (_, phase) => { if (phase === 'load') abort.abort(); };
    await expect(host.invokeVerifier(input)).rejects.toMatchObject({ code: 'OUTCOME_UNKNOWN' });
    expect(facts).toHaveLength(1); await expect(fs.lstat(join(root, 'invoked'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
test('trusted verifier scratch failure retains unknown settlement and blocks another spawn', async () => {
  await withMaterial('verifier', () => `import {writeFileSync} from 'node:fs';export const hostApiMajor=1;export function invoke(){writeFileSync('retained','yes');throw new Error('package failure')}`,
    async (input, host, facts, root) => {
      const failure = await host.invokeVerifier(input).catch(error => error);
      expect(failure).toBeInstanceOf(PluginToolError); expect(failure).toMatchObject({ code: 'OUTCOME_UNKNOWN', cause: { code: 'PACKAGE_FAILED' } });
      expect(await fs.readdir(join(root, 'process/receipts'))).toEqual(['owner.json', 'slot-00.json']);
      await expect(host.invokeVerifier(input)).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN'); expect(facts).toHaveLength(1);
      await expect(host.close()).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
    });
});
test('trusted explicit tool method keeps its original real worker behavior', async () => {
  await withMaterial('tool', () => `export const hostApiMajor=1;export function invoke({input}){return input}`, async (input, host) => {
    expect((await host.invoke(input)).content).toBe(input.input);
  });
});
test('trusted init requires exactly one known execution kind and rejects the old protocol', () => {
  const init = { protocol: PROCESS_PROTOCOL, identity: identity(), sequence: 1, kind: 'init', executionKind: 'verifier', value: {} };
  const accepted: unknown[] = []; new FrameReader(192 * 1024, value => accepted.push(value)).push(framed(init)); expect(accepted).toHaveLength(1);
  for (const value of [{ ...init, executionKind: 'unknown' }, { ...init, executionKind: ['tool', 'verifier'] },
    { ...init, executionKind: undefined }, { ...init, verifier: true }, { ...init, protocol: 'flow.trusted-plugin-process.v1' }]) {
    expect(() => new FrameReader(192 * 1024, () => {}).push(framed(value))).toThrow();
  }
});
