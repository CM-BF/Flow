import { mkdtemp, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import type { ClaimedTask } from '@flow/contracts';
import { createSyntheticProject } from './workspace.js';
import { captureCalculatorWorkspace, type CalculatorCaptureContext, type CalculatorCaptureResult } from './calculator-capture.js';
import { calculatorReceiptJson } from './calculator-receipt.js';
import { runRunner } from '../runtime.js';
import { NativeExecutionError } from '../native-harness/settlement.js';
import { textDigest } from '../verifier.js';

const initial = 'export const add=(a,b)=>a-b;\nexport const subtract=(a,b)=>a-b;\n';
const correct = initial.replace('a-b', 'a+b');
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'flow-eng01f-'));
  const project = await createSyntheticProject(root, 'owned-calculator', { 'calculator.mjs': initial });
  const workspace = await project.acquire();
  cleanup.push(async () => { await workspace.release(); await project.dispose(); await rm(root, { recursive: true }); });
  const context: CalculatorCaptureContext = { executionIdentity: Object.freeze({ taskId: 'host-task', attemptId: 'host-attempt', runnerId: 'host-runner', ownerVersion: 7 }), signal: new AbortController().signal, async assertOwnership() {} };
  return { root, project, workspace, context, file: join(workspace.directory, 'calculator.mjs') };
}

it('captures actual managed Git changes and retains the owned lease after recorded evidence', async () => {
  const api = await fixture(); await writeFile(api.file, correct);
  const result = await captureCalculatorWorkspace(api.workspace, api.context);
  expect(result.state).toBe('recorded');
  if (result.state !== 'recorded') throw Error('Expected recorded evidence');
  expect(result.receipt).toMatchObject({ identity: api.context.executionIdentity, writerSettlement: 'not-attested', source: correct, report: { result: 'passed' } });
  expect(result.receipt.workspace.beforeDigest).toBe(result.receipt.workspace.afterDigest);
  expect(result.receipt.diff.content).toContain('a+b'); expect(result.receipt.workspace.files).toHaveLength(1);
  expect(Buffer.byteLength(calculatorReceiptJson(result.receipt))).toBeLessThan(10_000);
  await expect(api.project.acquire()).rejects.toThrow('already leased');
});

it('records valid wrong arithmetic as failed without executing the source', async () => {
  const api = await fixture();
  expect(await captureCalculatorWorkspace(api.workspace, api.context)).toMatchObject({ state: 'recorded', receipt: { source: initial, report: { result: 'failed' }, writerSettlement: 'not-attested' } });
});

it.each(['extra-untracked', 'deleted', 'executable', 'oversized'] as const)('retains complete %s evidence and rejects the unsupported recipe', async mode => {
  const api = await fixture(); await writeFile(api.file, correct);
  if (mode === 'extra-untracked') await writeFile(join(api.workspace.directory, 'extra.mjs'), 'process.exit(0)');
  if (mode === 'deleted') await rm(api.file);
  if (mode === 'executable') await chmod(api.file, 0o755);
  if (mode === 'oversized') await writeFile(api.file, correct.padEnd(2049, ' '));
  const result = await captureCalculatorWorkspace(api.workspace, api.context);
  expect(result).toMatchObject({ state: 'recorded', receipt: { writerSettlement: 'not-attested', report: { result: 'rejected' } } });
  if (result.state === 'recorded' && mode === 'extra-untracked') expect(result.receipt.workspace.files.map(file => file.path)).toEqual(['calculator.mjs', 'extra.mjs']);
  await expect(api.project.acquire()).rejects.toThrow('already leased');
});

it('returns unknown when source bytes change after the before snapshot', async () => {
  const api = await fixture(); let calls = 0;
  const wrapped = { ...api.workspace, async snapshot() { const value = await api.workspace.snapshot(); if (++calls === 1) await writeFile(api.file, correct); return value; } };
  expect(await captureCalculatorWorkspace(wrapped, api.context)).toEqual({ state: 'unknown', reason: 'content-changed' });
  expect(calls).toBe(1); await expect(api.project.acquire()).rejects.toThrow('already leased');
});

it('returns unknown when an additional file appears during the after snapshot', async () => {
  const api = await fixture(); await writeFile(api.file, correct); let calls = 0;
  const wrapped = { ...api.workspace, async snapshot() { if (++calls === 2) await writeFile(join(api.workspace.directory, 'late.mjs'), 'late'); return api.workspace.snapshot(); } };
  expect(await captureCalculatorWorkspace(wrapped, api.context)).toEqual({ state: 'unknown', reason: 'content-changed' });
  expect(calls).toBe(2); await expect(api.project.acquire()).rejects.toThrow('already leased');
});

it('stops observation on ownership loss without producing a receipt or releasing the workspace', async () => {
  const api = await fixture(); let checks = 0;
  const context = { ...api.context, async assertOwnership() { if (++checks === 3) throw Error('Controlled lost lease'); } };
  expect(await captureCalculatorWorkspace(api.workspace, context)).toEqual({ state: 'unknown', reason: 'capture-unavailable' });
  expect(checks).toBe(3); await expect(api.project.acquire()).rejects.toThrow('already leased');
});

it('rejects absent identity and an already aborted observation before snapshot I/O', async () => {
  const api = await fixture(); let calls = 0;
  const workspace = { ...api.workspace, async snapshot() { calls++; return api.workspace.snapshot(); } };
  expect(await captureCalculatorWorkspace(workspace, { ...api.context, executionIdentity: undefined })).toEqual({ state: 'unknown', reason: 'identity-unavailable' });
  expect(await captureCalculatorWorkspace(workspace, { ...api.context, signal: AbortSignal.abort() })).toEqual({ state: 'unknown', reason: 'capture-unavailable' });
  expect(calls).toBe(0);
});

it('binds identity from an actual claimed host attempt without treating check evidence as execution settlement', async () => {
  const api = await fixture(); await writeFile(api.file, correct);
  const assignment: ClaimedTask = { task: { id: 'center-task', title: 'Capture only', harness: 'fixture', prompt: 'Task text is not identity.' },
    attempt: { id: 'center-attempt', runnerId: 'center-runner', ownerVersion: 19, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() } };
  let claimed = false, captured: CalculatorCaptureResult | undefined; const events: unknown[] = [];
  const shutdown = new AbortController();
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer);
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/runner/claim') { const next = claimed ? null : assignment; claimed = true; res.end(JSON.stringify({ assignment: next, remainingLeaseMs: 60_000 })); }
    else if (req.url === '/api/runner/heartbeat') res.end(JSON.stringify({ action: 'continue', remainingLeaseMs: 60_000, leaseExpiresAt: assignment.attempt.leaseExpiresAt, decision: null }));
    else { events.push(JSON.parse(Buffer.concat(chunks).toString())); res.end(JSON.stringify({ accepted: 0, lastSequence: 0 })); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Missing owned port');
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const run = runRunner({ baseUrl, token: 'synthetic-eng01f-host', workingDirectory: join(api.root, 'host'), signal: shutdown.signal,
    pollIntervalMs: 5, heartbeatIntervalMs: 25, requestTimeoutMs: 500, adapters: [{ name: 'fixture', version: 'capture-test', async run(context) {
      captured = await captureCalculatorWorkspace(api.workspace, context); throw new NativeExecutionError('unknown');
    } }] });
  void run.catch(() => undefined); cleanup.push(async () => { shutdown.abort(); await run; });
  const until = Date.now() + 5000; while (!captured) { if (Date.now() > until) throw Error('Host capture did not finish'); await new Promise(resolve => setTimeout(resolve, 5)); }
  expect(captured).toMatchObject({ state: 'recorded', receipt: { identity: { taskId: 'center-task', attemptId: 'center-attempt', runnerId: 'center-runner', ownerVersion: 19 }, report: { result: 'passed' }, writerSettlement: 'not-attested' } });
  shutdown.abort(); await run; expect(events).toEqual([]);
  expect(await readFile(join(api.root, 'host', textDigest(baseUrl), 'admission.json'), 'utf8')).toContain('center-attempt');
  await expect(api.project.acquire()).rejects.toThrow('already leased');
});
