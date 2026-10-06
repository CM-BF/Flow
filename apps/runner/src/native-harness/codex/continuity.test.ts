import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { nativeExecutionProfileConfigurationJson, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { CodexTransportError, type CloseReport, type CodexTransport, type Inbound, type Json } from '../../codex/types.js';
import { guardExecutionProfile } from '../../execution-profiles.js';
import { createNativeFileRecipe } from '../../engineering/native-policy.js';
import { textDigest } from '../../verifier.js';
import { configureCodexHarness, createCodexSessionStorage } from './index.js';

const profile: CodexExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'fixture-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
  hostLimits: { wallTimeMs: 1000, maxOutputBytes: 1024 }, sessionPersistence: 'host-owned' };
const runnerId = '5668918f-58a1-4703-89dc-705e92a8b4c4';
const pin = { id: '6a287c9c-e6c0-4b78-a63a-9fcc7a45d62f', runnerId, configDigest: textDigest(nativeExecutionProfileConfigurationJson(profile)) };
const roots: { path: string; dev: number; ino: number }[] = [];
afterAll(() => {
  const receipt = roots.map(root => {
    const current = lstatSync(root.path); expect([current.dev, current.ino]).toEqual([root.dev, root.ino]);
    rmSync(root.path, { recursive: true }); expect(() => lstatSync(root.path)).toThrow(); return { ...root, absent: true };
  });
  if (process.env.FLOW_C02_CONTINUITY_REPORT) writeFileSync(process.env.FLOW_C02_CONTINUITY_REPORT, JSON.stringify(receipt), { flag: 'wx', mode: 0o600 });
});
type Mode = 'success' | 'wrong-resume' | 'lost-resume' | 'unknown-close' | 'approval';
function setup(mode: Mode = 'success') {
  const root = mkdtempSync(join(tmpdir(), 'flow-c02-continuity-')); const { dev, ino } = lstatSync(root); roots.push({ path: root, dev, ino });
  const events: RunnerEventData[] = [], calls: { instance: number; method: string; params: Json }[] = [];
  const instances: { codeHome: string; closed: boolean; reads: number }[] = [];
  const storage = createCodexSessionStorage({ codeHome: root, runnerId, configDigest: pin.configDigest, createTransport(options) {
    // A second, independent transport must consume the saved fixture, after its predecessor closed.
    expect(instances.every(instance => instance.closed)).toBe(true);
    const state = { codeHome: options.codeHome, closed: false, reads: 0 }; instances.push(state); const instance = instances.length;
    const queue: Inbound[] = []; let waiter: ((message: Inbound | null) => void) | undefined;
    let closeResolve!: (report: CloseReport) => void;
    const closed = new Promise<CloseReport>(resolve => { closeResolve = resolve; });
    const report: CloseReport = { reason: 'CLOSED', child: mode === 'unknown-close' ? 'unconfirmed' : 'confirmed-exited', exitCode: 0, signal: null, remoteEffects: 'unknown' };
    function publish(message: Inbound) { if (waiter) { const deliver = waiter; waiter = undefined; deliver(message); } else queue.push(message); }
    const transport: CodexTransport = {
      ready: Promise.resolve({ userAgent: 'in-memory-fixture', platformFamily: 'fixture', platformOs: 'fixture' }), closed,
      async request(method, params): Promise<Json> {
        calls.push({ instance, method, params });
        if (method === 'thread/start') {
          expect(params).toMatchObject({ ephemeral: false, sandbox: 'read-only', approvalPolicy: 'never' });
          writeFileSync(join(options.codeHome, 'session.json'), JSON.stringify({ threadId: 'persistent-thread', remembered: 'remembered 中文🙂' }), { flag: 'wx', mode: 0o600 });
        } else if (method === 'thread/resume') {
          const saved = JSON.parse(readFileSync(join(options.codeHome, 'session.json'), 'utf8')); state.reads++;
          expect(params).toEqual({ threadId: saved.threadId, model: 'fixture-model', serviceTier: null, cwd: root, approvalPolicy: 'never', sandbox: 'read-only', excludeTurns: true });
          if (mode === 'lost-resume') throw new CodexTransportError('TIMEOUT', 'unknown');
        } else if (method === 'turn/start') {
          expect(params).toMatchObject({ threadId: 'persistent-thread', sandboxPolicy: { type: 'readOnly', networkAccess: false } });
          const saved = JSON.parse(readFileSync(join(options.codeHome, 'session.json'), 'utf8')); state.reads++;
          const final = { type: 'agentMessage', id: `final-${instance}`, text: saved.remembered as string, phase: 'final_answer', delivery: null, questions: null };
          const turn = { id: `turn-${instance}`, status: 'completed', itemsView: 'full', items: [final], error: null };
          if (mode === 'approval') publish({ kind: 'server-request', id: 1, method: 'item/fileChange/requestApproval', params: {} });
          publish({ kind: 'notification', method: 'item/completed', params: { threadId: 'persistent-thread', turnId: turn.id, completedAtMs: 1, item: final } });
          publish({ kind: 'notification', method: 'turn/completed', params: { threadId: 'persistent-thread', turn } });
          return { turn: { ...turn, status: 'inProgress', items: [] } };
        } else throw new Error('Unexpected fixture request');
        return { thread: { id: mode === 'wrong-resume' && method === 'thread/resume' ? 'different-thread' : 'persistent-thread' }, model: 'fixture-model',
          modelProvider: 'fixture', serviceTier: null, reasoningEffort: null, approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } };
      },
      receive() {
        if (queue.length) return Promise.resolve(queue.shift()!);
        if (state.closed) return Promise.resolve(null);
        if (waiter) throw new Error('Only one fixture consumer is permitted');
        return new Promise(resolve => { waiter = resolve; });
      },
      async respond(_id, reply) { expect(reply).toEqual({ result: { decision: 'decline' } }); },
      async close() { state.closed = true; if (waiter) { waiter(null); waiter = undefined; } closeResolve(report); return report; },
      snapshot() { throw new Error('Snapshot is not a continuity authority'); },
    };
    return transport;
  } });
  const configured = configureCodexHarness({ publicProfile: profile, sessionStorage: storage });
  const adapter = guardExecutionProfile(configured.adapter, pin, profile);
  function context(resumeSessionId?: string): HarnessContext {
    return { task: { title: 'Persistent fixture', prompt: 'Next turn', harness: 'codex', executionProfile: pin, ...(resumeSessionId ? { resumeSessionId } : {}) },
      executionIdentity: { runnerId, taskId: `task-${events.length}`, attemptId: `attempt-${events.length}`, ownerVersion: 1 }, workingDirectory: root,
      signal: new AbortController().signal, async assertOwnership() {}, async emit(event) { events.push(event); }, async waitForDecision() { throw new Error('No interactive approval'); } };
  }
  return { root, adapter, context, calls, instances, events };
}

it('closes one transport and resumes the exact stored thread in another, using the same trusted directory', async () => {
  const api = setup(); await api.adapter.run(api.context());
  expect(api.instances).toMatchObject([{ codeHome: api.root, closed: true, reads: 1 }]);
  expect(api.events[0]).toMatchObject({ type: 'session', nativeSessionId: 'persistent-thread' });
  await api.adapter.run(api.context('persistent-thread'));
  expect(api.calls.map(call => call.method)).toEqual(['thread/start', 'turn/start', 'thread/resume', 'turn/start']);
  expect(api.instances).toMatchObject([{ codeHome: api.root, closed: true }, { codeHome: api.root, closed: true, reads: 2 }]);
  expect(api.events.filter(event => event.type === 'assistant-final')).toMatchObject([
    { nativeSessionId: 'persistent-thread', content: 'remembered 中文🙂' },
    { nativeSessionId: 'persistent-thread', content: 'remembered 中文🙂', settings: { actualExecution: { evidence: 'unknown', model: null } } },
  ]);
  expect(JSON.stringify(api.events)).not.toContain(api.root);
});

it.each(['wrong-resume', 'lost-resume'] as const)('does not start or replay a turn after %s', async mode => {
  const api = setup(mode); await api.adapter.run(api.context()); const before = api.events.length;
  await expect(api.adapter.run(api.context('persistent-thread'))).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.calls.map(call => call.method)).toEqual(['thread/start', 'turn/start', 'thread/resume']);
  expect(api.events).toHaveLength(before); expect(api.instances.every(instance => instance.closed)).toBe(true);
});

it('rejects a different profile id using the existing execution guard before any factory', async () => {
  const api = setup(); const ctx = api.context();
  await expect(api.adapter.run({ ...ctx, task: { ...ctx.task, executionProfile: { ...pin, id: 'c7159e6d-172f-4bba-bd99-e5e509dfc6b0' } } })).rejects.toThrow('does not match');
  expect(api.instances).toEqual([]); expect(api.events).toEqual([]);
});

it.each(['unknown-close', 'approval'] as const)('does not publish a final after %s', async mode => {
  const api = setup(mode); await expect(api.adapter.run(api.context())).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.events).toEqual([]); expect(api.instances.every(instance => instance.closed)).toBe(true);
});

it('preserves old ephemeral refusal and the separate engineering start recipe', async () => {
  const { sessionPersistence: _unused, ...legacy } = profile; let factoryCalls = 0;
  const old = configureCodexHarness({ publicProfile: legacy, createTransport() { factoryCalls++; throw new Error('must not launch'); } });
  const api = setup(); await expect(old.adapter.run(api.context('persistent-thread'))).rejects.toMatchObject({ settlement: 'settled' });
  expect(factoryCalls).toBe(0); expect(old.descriptor.ports).toEqual({});
  const recipe = createNativeFileRecipe('gpt-6-astra', '/owned-fixture', 'Fix calculator');
  expect(recipe.threadMethod ?? 'thread/start').toBe('thread/start');
  expect(recipe.startThread).toMatchObject({ ephemeral: true, approvalPolicy: 'untrusted', sandbox: 'workspace-write' });
  expect(recipe.startTurn('engineering-thread')).toMatchObject({ sandboxPolicy: { type: 'workspaceWrite', networkAccess: false } });
});
