import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CodexTransportError, type CloseReport, type CodexTransport, type Inbound, type Json } from '../../codex/types.js';
import type { PersistentCodexTransportFactory } from './session-storage.js';

export type ContinuityFixtureMode = 'success' | 'wrong-resume' | 'lost-resume' | 'unknown-close' | 'approval';
/** Test-only transport. No process, network, auth or native calls; it really persists and rereads one owned session file. */
export function persistentTransportFixture({ codeHome, threadId = 'persistent-thread', mode = 'success', beforeTurn }: {
  codeHome: string; threadId?: string; mode?: ContinuityFixtureMode; beforeTurn?: (instance: number) => Promise<void>;
}) {
  const calls: { instance: number; method: string; params: Json }[] = [];
  const instances: { codeHome: string; closed: boolean; reads: number }[] = [];
  const createTransport: PersistentCodexTransportFactory = options => {
    // A second, independent transport must consume the saved fixture, after its predecessor closed.
    assert.ok(instances.every(instance => instance.closed));
    assert.equal(options.codeHome, codeHome);
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
          assert.ok(params && !Array.isArray(params) && typeof params === 'object');
          assert.equal(params.ephemeral, false); assert.equal(params.sandbox, 'read-only'); assert.equal(params.approvalPolicy, 'never');
          assert.equal(params.cwd, options.workingDirectory);
          writeFileSync(join(options.codeHome, 'session.json'), JSON.stringify({ threadId: threadId, remembered: 'remembered 中文🙂' }), { flag: 'wx', mode: 0o600 });
        } else if (method === 'thread/resume') {
          const saved = JSON.parse(readFileSync(join(options.codeHome, 'session.json'), 'utf8')); state.reads++;
          assert.deepEqual(params, { threadId: saved.threadId, model: 'fixture-model', serviceTier: null, cwd: options.workingDirectory, approvalPolicy: 'never', sandbox: 'read-only', excludeTurns: true });
          if (mode === 'lost-resume') throw new CodexTransportError('TIMEOUT', 'unknown');
        } else if (method === 'turn/start') {
          assert.ok(params && !Array.isArray(params) && typeof params === 'object');
          assert.equal(params.threadId, threadId); assert.deepEqual(params.sandboxPolicy, { type: 'readOnly', networkAccess: false });
          assert.equal(params.cwd, options.workingDirectory);
          await beforeTurn?.(instance);
          const saved = JSON.parse(readFileSync(join(options.codeHome, 'session.json'), 'utf8')); state.reads++;
          const final = { type: 'agentMessage', id: `final-${instance}`, text: saved.remembered as string, phase: 'final_answer', delivery: null, questions: null };
          const turn = { id: `turn-${instance}`, status: 'completed', itemsView: 'full', items: [final], error: null };
          if (mode === 'approval') publish({ kind: 'server-request', id: 1, method: 'item/fileChange/requestApproval', params: {} });
          publish({ kind: 'notification', method: 'item/completed', params: { threadId: threadId, turnId: turn.id, completedAtMs: 1, item: final } });
          publish({ kind: 'notification', method: 'turn/completed', params: { threadId: threadId, turn } });
          return { turn: { ...turn, status: 'inProgress', items: [] } };
        } else throw new Error('Unexpected fixture request');
        return { thread: { id: mode === 'wrong-resume' && method === 'thread/resume' ? 'different-thread' : threadId }, model: 'fixture-model',
          modelProvider: 'fixture', serviceTier: null, reasoningEffort: null, approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } };
      },
      receive() {
        if (queue.length) return Promise.resolve(queue.shift()!);
        if (state.closed) return Promise.resolve(null);
        if (waiter) throw new Error('Only one fixture consumer is permitted');
        return new Promise(resolve => { waiter = resolve; });
      },
      async respond(_id, reply) { assert.deepEqual(reply, { result: { decision: 'decline' } }); },
      async close() { state.closed = true; if (waiter) { waiter(null); waiter = undefined; } closeResolve(report); return report; },
      snapshot() { throw new Error('Snapshot is not a continuity authority'); },
    };
    return transport;

  };
  return { createTransport, calls, instances };
}
