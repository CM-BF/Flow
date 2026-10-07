import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { prepareInstalledPackage } from '@flow/plugin-runtime';
import { runnerEventSchema } from '../../../../packages/contracts/src/runner.js';
import { PLUGIN_RUNTIME_PROTOCOL, type PluginToolBinding, type PluginGrantRequest, type PluginGrantReceipt } from '../../../../packages/contracts/src/plugin-runtime.js';
import { executePluginTool, PluginAuthorizationUnknown, PluginExecutionUnsettled, type PluginExecutionInput } from './execution.js';
import { textDigest } from '../verifier.js';

const pack = promisify(execFile);
const roots: { path: string; dev: number | null; ino: number | null; removed: boolean }[] = [];
const children: { pid: number | undefined; exitCode: number | null; signal: string | null }[] = [];
afterAll(async () => {
  const retained = [];
  for (const root of roots) {
    try { await fs.lstat(root.path); retained.push(root.path); }
    catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') retained.push(root.path); }
  }
  if (process.env.FLOW_X01_EXECUTION_EVIDENCE) await fs.writeFile(process.env.FLOW_X01_EXECUTION_EVIDENCE, JSON.stringify({ roots, children, retained }, null, 2) + '\n', { flag: 'wx' });
  expect(retained).toEqual([]); expect(children.every(child => child.exitCode === 0 && child.signal === null)).toBe(true);
});
async function withPackage(run: (value: { input: PluginExecutionInput; root: string }) => Promise<void>, code?: (root: string) => string) {
  const path = await fs.mkdtemp(join(tmpdir(), 'flow-x01-execution-'));
  const owned = { path, dev: null as number | null, ino: null as number | null, removed: false }; roots.push(owned);
  try {
    const identity = await fs.lstat(path); owned.dev = identity.dev; owned.ino = identity.ino;
    const root = await fs.realpath(path); const source = join(root, 'package'); await fs.mkdir(source);
    await fs.mkdir(join(root, 'store'), { mode: 0o700 });
    const name = 'flow-owned-execution';
    await fs.writeFile(join(source, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module' }));
    await fs.writeFile(join(source, 'flow-plugin.json'), JSON.stringify({ schemaVersion: 1, hostApiMajor: 1, kind: 'tool', entrypoint: 'index.mjs' }));
    await fs.writeFile(join(source, 'index.mjs'), code?.(root) ?? `export const hostApiMajor=1; export function invoke({input,config}) { return config.prefix+input; }`);
    const tarballPath = join(root, 'package.tgz');
    const packing = pack('/usr/bin/tar', ['--format=ustar', '-czf', tarballPath, '-C', root, 'package'], { timeout: 5000, maxBuffer: 8192 });
    const closed = new Promise<void>(resolve => packing.child.once('close', () => resolve()));
    try { await packing; } finally { await closed; children.push({ pid: packing.child.pid, exitCode: packing.child.exitCode, signal: packing.child.signalCode }); }
    const bytes = await fs.readFile(tarballPath); expect(bytes.byteLength).toBeLessThan(8192);
    const artifact = { artifactId: randomUUID(), name, version: '1.0.0', bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
    const store = { root: join(root, 'store'), storeId: 'execution-store', allowedDigests: [artifact.sha256] };
    const installed = await prepareInstalledPackage({ store, artifact, tarballPath });
    const prompt = '\ufeffhello😀'; const taskId = randomUUID(); const runnerId = randomUUID();
    const binding: PluginToolBinding = { protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: randomUUID(), invocationId: randomUUID(), taskId,
      registrationId: randomUUID(), registrationRevision: 4, versionId: randomUUID(), scope: { workspaceId: 'personal', projectId: null },
      materialInstallOperationId: randomUUID(), targetRunnerId: runnerId, storeId: store.storeId, materialId: installed.receipt.installationId,
      treeDigest: installed.receipt.treeDigest, hostApiMajor: 1, artifact, configuration: { prefix: 'verified: ', flag: true, count: 2 },
      inputDigest: textDigest(prompt), createdAt: new Date().toISOString() };
    const input: PluginExecutionInput = { binding, runnerId, store, ownership: { attemptId: randomUUID(), ownerVersion: 1 },
      task: { id: taskId, title: 'Tool', prompt, harness: 'fixture' }, signal: new AbortController().signal, assertOwnership: () => {},
      authorize: async request => receipt(input, request) };
    await run({ input, root });
  } finally {
    const current = await fs.lstat(path);
    if (current.isDirectory() && !current.isSymbolicLink() && current.dev === owned.dev && current.ino === owned.ino) {
      await fs.rm(path, { recursive: true }); owned.removed = true;
    }
  }
}
function receipt(input: PluginExecutionInput, request: PluginGrantRequest): PluginGrantReceipt {
  return { ...request, protocol: PLUGIN_RUNTIME_PROTOCOL, taskId: input.task.id, runnerId: input.runnerId, authorizedRevision: 4, replayed: false };
}
const traced = (root: string) => `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(join(root, 'loaded'))},'yes');
  export const hostApiMajor=1; export function invoke({input}) { writeFileSync(${JSON.stringify(join(root, 'invoked'))},'yes'); return input; }`;

test('real installed tool returns ordinary artifact/flow.text with exact frozen provenance and phase order', async () => {
  await withPackage(async ({ input }) => {
    const phases: string[] = [];
    input.authorize = async request => { phases.push(request.phase); return receipt(input, request); };
    const result = await executePluginTool(input);
    expect(phases).toEqual(['load', 'invoke']);
    expect(result.artifact.content).toBe('verified: \ufeffhello😀');
    expect(runnerEventSchema.parse({ ...result.artifact, id: randomUUID(), sequence: 1 })).toMatchObject(result.artifact);
    expect(runnerEventSchema.parse({ ...result.verification, id: randomUUID(), sequence: 2 })).toMatchObject({ type: 'verification', result: 'passed', verifierId: 'flow.text' });
    expect(result.provenance).toMatchObject({ bindingId: input.binding.bindingId, invocationId: input.binding.invocationId,
      taskId: input.task.id, attemptId: input.ownership.attemptId, ownerVersion: 1, artifactSha256: input.binding.artifact.sha256 });
    expect(result).not.toHaveProperty('completed');
  });
});
test('wrong frozen input or runner is rejected before authorization or real module import', async () => {
  await withPackage(async ({ input, root }) => {
    let calls = 0; input.authorize = async request => { calls++; return receipt(input, request); };
    await expect(executePluginTool({ ...input, task: { ...input.task, prompt: 'changed' } })).rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
    await expect(executePluginTool({ ...input, runnerId: randomUUID() })).rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
    expect(calls).toBe(0); await expect(fs.lstat(join(root, 'loaded'))).rejects.toMatchObject({ code: 'ENOENT' });
  }, traced);
});
test.each(['load', 'invoke'] as const)('unknown %s acknowledgement retains identity and executes no corresponding action', async phase => {
  await withPackage(async ({ input, root }) => {
    const unknown = new PluginAuthorizationUnknown();
    input.authorize = async request => { if (request.phase === phase) throw unknown; return receipt(input, request); };
    await expect(executePluginTool(input)).rejects.toMatchObject({ name: 'PluginExecutionUnsettled', bindingId: input.binding.bindingId, invocationId: input.binding.invocationId, cause: unknown });
    await expect(fs.lstat(join(root, phase === 'load' ? 'loaded' : 'invoked'))).rejects.toMatchObject({ code: 'ENOENT' });
  }, traced);
});
test.each(['replayed', 'wrong-attempt'] as const)('%s ACK is historical/unknown evidence, never permission to import', async kind => {
  await withPackage(async ({ input, root }) => {
    input.authorize = async request => ({ ...receipt(input, request), ...(kind === 'replayed' ? { replayed: true } : { attemptId: randomUUID() }) });
    await expect(executePluginTool(input)).rejects.toBeInstanceOf(PluginExecutionUnsettled);
    await expect(fs.lstat(join(root, 'loaded'))).rejects.toMatchObject({ code: 'ENOENT' });
  }, traced);
});
test('explicit fence errors preserve identity and pre-abort never calls an authorization port', async () => {
  await withPackage(async ({ input, root }) => {
    const fence = new Error('stale owner'); input.assertOwnership = () => { throw fence; };
    await expect(executePluginTool(input)).rejects.toBe(fence);
    const controller = new AbortController(); controller.abort(); let calls = 0;
    input.authorize = async request => { calls++; return receipt(input, request); };
    await expect(executePluginTool({ ...input, signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(calls).toBe(0); await expect(fs.lstat(join(root, 'loaded'))).rejects.toMatchObject({ code: 'ENOENT' });
  }, traced);
});
test.each(['\0', '\ud800', '\udc00'])('real package output with non-persistable code unit %j is rejected before artifact creation', async output => {
  await withPackage(async ({ input }) => {
    await expect(executePluginTool(input)).rejects.toMatchObject({ code: 'OUTPUT_REJECTED' });
  }, () => `export const hostApiMajor=1; export function invoke(){ return ${JSON.stringify(output)}; }`);
});
test('empty real package output remains a failed flow.text verification, not a fabricated package error', async () => {
  await withPackage(async ({ input }) => {
    const result = await executePluginTool(input);
    expect(result.artifact.content).toBe(''); expect(result.verification).toMatchObject({ type: 'verification', result: 'failed' });
  }, () => `export const hostApiMajor=1; export function invoke(){ return ''; }`);
});

import { createTrustedProcessHost, type ProcessObservation } from './process-host.js';
async function withProcess(code: (root: string) => string, run: (input: PluginExecutionInput, facts: ProcessObservation[], root: string) => Promise<void>) {
  await withPackage(async ({ input, root }) => {
    const facts: ProcessObservation[] = [];
    const host = await createTrustedProcessHost({ resourceRoot: join(root, 'process'), observe: value => facts.push(value) });
    input.invokeTool = host.invoke;
    try { await run(input, facts, root); }
    finally { await host.close(); }
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every(fact => fact.processClosed && fact.protocolEof && fact.stdoutEof && fact.stderrEof)).toBe(true);
    expect(await fs.readdir(join(root, 'process/receipts'))).toEqual([]);
  }, code);
}

test('trusted worker reaches real execution consumer with fresh module state and unchanged provenance', async () => {
  await withProcess(() => `let count=0;export const hostApiMajor=1;export function invoke(){return String(++count)}`, async input => {
    const first = await executePluginTool(input); expect(first.artifact).toMatchObject({ content: '1' });
    expect(first.provenance.invocationId).toBe(input.binding.invocationId);
    input.binding = { ...input.binding, invocationId: randomUUID() };
    const second = await executePluginTool(input); expect(second.artifact).toMatchObject({ content: '1' });
    expect(second.provenance.invocationId).not.toBe(first.provenance.invocationId);
  });
});
test('trusted worker keeps current invoke grant and original rejection after a successful load grant', async () => {
  await withProcess(root => `export const hostApiMajor=1;export function invoke(){throw new Error('must not invoke')}`, async input => {
    const denial = Object.assign(new Error('denied'), { status: 403 }); const phases: string[] = [];
    input.authorize = async request => { phases.push(request.phase); if(request.phase==='invoke')throw denial;return receipt(input,request); };
    await expect(executePluginTool(input)).rejects.toBe(denial); expect(phases).toEqual(['load', 'invoke']);
  });
});
test.each(['import', 'invoke'])('trusted worker terminates %s hang without pretending effects were rolled back', async kind => {
  await withProcess(() => kind === 'import' ? `export const hostApiMajor=1;await new Promise(()=>{});export function invoke(){return 'never'}`
    : `export const hostApiMajor=1;export function invoke(){while(true){}}`, async input => {
      await expect(executePluginTool(input)).rejects.toBeInstanceOf(PluginExecutionUnsettled);
    });
}, 15000);
test('trusted worker does not inherit parent secret and never retains console body', async () => {
  process.env.FLOW_PROCESS_TEST_SECRET = 'DO_NOT_LEAK';
  try { await withProcess(() => `export const hostApiMajor=1;export function invoke({input,config}){console.log(input,config.prefix);return String(process.env.FLOW_PROCESS_TEST_SECRET===undefined)}`, async (input, facts) => {
    input.binding.configuration.prefix = 'PRIVATE_CONFIG';
    const result = await executePluginTool(input); expect(result.artifact).toMatchObject({ content: 'true' });
    expect(facts[0]!.diagnosticBytes).toBeGreaterThan(0); expect(JSON.stringify(facts)).not.toContain('PRIVATE_CONFIG');
  }); } finally { delete process.env.FLOW_PROCESS_TEST_SECRET; }
});
test('trusted worker preserves ownership loss before it can invoke', async () => {
  await withProcess(() => `export const hostApiMajor=1;export function invoke(){return 'never'}`, async input => {
    const lost = new Error('ownership lost'); let granted = false;
    input.authorize = async request => { granted = true; return receipt(input, request); };
    input.assertOwnership = () => { if(granted)throw lost; };
    await expect(executePluginTool(input)).rejects.toBe(lost);
  });
});

test('trusted direct parent abort settles the owned worker without claiming rollback', async () => {
  await withProcess(() => `export const hostApiMajor=1;export function invoke(){return 'never'}`, async input => {
    const abort = new AbortController(); input.signal = abort.signal;
    input.authorize = async request => { if (request.phase === 'load') abort.abort(); return receipt(input, request); };
    await expect(executePluginTool(input)).rejects.toBeInstanceOf(PluginExecutionUnsettled);
  });
});
test('trusted direct diagnostic overflow discards text and retains uncertain business outcome', async () => {
  await withProcess(() => `export const hostApiMajor=1;export function invoke(){process.stdout.write('PRIVATE'.repeat(4000));while(true){}}`, async (input, facts) => {
    await expect(executePluginTool(input)).rejects.toBeInstanceOf(PluginExecutionUnsettled);
    expect(facts[0]!.diagnosticBytes).toBeGreaterThan(16384); expect(JSON.stringify(facts)).not.toContain('PRIVATE');
  });
});


test('trusted settlement retains package failure as cause when owned scratch cannot be cleared', async () => {
  await withPackage(async ({ input, root }) => {
    const facts: ProcessObservation[] = [];
    const host = await createTrustedProcessHost({ resourceRoot: join(root, 'process'), observe: fact => facts.push(fact) });
    input.invokeTool = host.invoke;
    try {
      await expect(executePluginTool(input)).rejects.toMatchObject({ name: 'PluginExecutionUnsettled',
        bindingId: input.binding.bindingId, invocationId: input.binding.invocationId,
        cause: { code: 'OUTCOME_UNKNOWN', cause: { code: 'PACKAGE_FAILED' } } });
      expect(facts).toHaveLength(1); expect(facts[0]).toMatchObject({ exitCode: 0, processClosed: true,
        protocolEof: true, stdoutEof: true, stderrEof: true });
      expect(await fs.readFile(join(root, 'process/scratch/00/owned-note'), 'utf8')).toBe('owned test marker');
      expect(await fs.readdir(join(root, 'process/receipts'))).toEqual(expect.arrayContaining(['owner.json', 'slot-00.json']));
      // Resource HOLD rejects before another spawn; no automatic retry or receipt adoption.
      await expect(executePluginTool(input)).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN');
      expect(facts).toHaveLength(1);
    } finally { await expect(host.close()).rejects.toThrow('PROCESS_RESOURCE_UNKNOWN'); }
  }, () => `import {writeFileSync} from 'node:fs';export const hostApiMajor=1;export function invoke(){writeFileSync('owned-note','owned test marker');throw new Error('package failed')}`);
});
