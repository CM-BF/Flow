import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import type { HarnessContext, RunnerEvent, RunnerEventData } from '@flow/contracts';
import { CancelJourney } from './fixture.js';
// These are the same fixed af51 modules used by the actual handoff center.
import { assistantSourcePolicy } from '../../../../../personal-history-compatibility/apps/server/src/native-harness-policy.js';
import { saveAssistantFinal } from '../../../../../personal-history-compatibility/apps/server/src/assistant/store.js';
import type { TaskRecord } from '../../../../../personal-history-compatibility/apps/server/src/tasks.js';
import type { AttemptRecord } from '../../../../../personal-history-compatibility/apps/server/src/runners.js';

const executionIdentity = { taskId: '11111111-1111-4111-8111-111111111111', attemptId: '22222222-2222-4222-8222-222222222222',
  runnerId: '33333333-3333-4333-8333-333333333333', ownerVersion: 1 };
const source = assistantSourcePolicy('claude', 'claude.sdk.result');
assert.ok(source);
type Session = Extract<RunnerEvent, { type: 'session' }>;

/** Inject SQL results only; source recognition, event parsing, identity and inserts stay in the real consumer. */
function storedSession(session: () => Session | undefined) {
  const statements: string[] = [];
  const writes: Array<{ text: string; values: unknown[] }> = [];
  const client = { async query(text: string, values: unknown[] = []) {
    statements.push(text);
    if (text.startsWith('SELECT 1 FROM flow.sessions')) {
      assert.deepEqual(values, [session()?.nativeSessionId,
        'claude', executionIdentity.runnerId, executionIdentity.taskId]);
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (text.startsWith('SELECT content FROM flow.details')) {
      assert.deepEqual(values, [executionIdentity.taskId, executionIdentity.attemptId]);
      return { rows: [{ content: JSON.stringify(session()) }], rowCount: 1 };
    }
    if (text.startsWith('SELECT 1 FROM flow.assistant_messages')) return { rows: [], rowCount: 0 };
    if (text.startsWith('INSERT INTO flow.details') || text.startsWith('INSERT INTO flow.assistant_messages')) {
      writes.push({ text, values }); return { rows: [], rowCount: 1 };
    }
    assert.fail(`Unexpected SQL at fixed consumer: ${text}`);
  } } as unknown as PoolClient;
  return { client, statements, writes };
}

async function runFixture(version: string | undefined, receiveFinal: boolean) {
  let session: Session | undefined;
  const events: RunnerEvent[] = [], port = storedSession(() => session);
  const fixture = new CancelJourney('/unused-tui01f-source-evidence', version === undefined ? undefined : {
    kind: 'web-handoff', adapterVersion: version,
    createCenter: async () => { throw Error('No center may be started by this direct consumer'); },
    beforeCleanup: async () => { throw Error('No cleanup lifetime was created'); },
  });
  const adapter = fixture['adapter'](); // The existing fixture adapter; do not duplicate its event producer.
  const task = { id: executionIdentity.taskId, submission: { harness: 'claude' } } as TaskRecord;
  const attempt = { id: executionIdentity.attemptId, runner_id: executionIdentity.runnerId } as AttemptRecord;
  const context = {
    executionIdentity, task: {}, signal: new AbortController().signal, workingDirectory: '/unused',
    assertOwnership: async () => {},
    emit: async (data: RunnerEventData) => {
      const event = { ...data, id: randomUUID(), sequence: events.length + 1 } as RunnerEvent;
      events.push(event);
      if (event.type === 'session') { session = event; attempt.native_session_id = event.nativeSessionId; }
      if (event.type === 'assistant-final' && receiveFinal) await saveAssistantFinal(port.client, task, attempt, event);
    },
  } as HarnessContext;
  const running = adapter.run(context);
  void running.catch(() => {});
  await setImmediate();
  assert.equal(events.length, 1, 'Real session emit must settle before releasing the real fixture barrier');
  fixture.release(executionIdentity.taskId);
  return { running, adapter, events, port };
}

test('[fixture source] original v1 session is rejected by the fixed center before any final write', async () => {
  const { running, events, port } = await runFixture('claude-sdk-0.3.290-v1', true);
  await assert.rejects(running, error => (error as { code?: string; status?: number }).code === 'assistant_source_mismatch'
    && (error as { status?: number }).status === 409);
  assert.deepEqual(events.map(event => event.type), ['session', 'assistant-final']);
  assert.equal(port.writes.length, 0);
});

test('[fixture source] center-selected version lets actual fixture final pass the unchanged fixed consumer', async () => {
  const { running, adapter, events, port } = await runFixture(source.adapterVersion, true);
  await running;
  assert.equal(adapter.version, source.adapterVersion);
  assert.equal((events[0] as Extract<RunnerEvent, { type: 'session' }>).adapterVersion, source.adapterVersion);
  assert.deepEqual(events.map(event => event.type), ['session', 'assistant-final', 'artifact', 'verification']);
  assert.equal(port.writes.length, 2);
  assert.match(port.writes[0]!.text, /^INSERT INTO flow.details/);
  assert.match(port.writes[1]!.text, /^INSERT INTO flow.assistant_messages/);
  assert.equal(port.writes[1]!.values[1], executionIdentity.taskId);
  assert.equal(port.writes[1]!.values[2], executionIdentity.attemptId);
  assert.equal(events.some(event => event.type === 'completed'), false, 'Runtime completion remains outside this adapter evidence');
});

test('[fixture source] legacy default keeps its original version and omits the handoff-only final', async () => {
  const { running, adapter, events, port } = await runFixture(undefined, false);
  await running;
  assert.equal(adapter.version, 'claude-sdk-0.3.290-v1');
  assert.deepEqual(events.map(event => event.type), ['session', 'artifact', 'verification']);
  assert.equal(port.writes.length, 0);
});

test('[fixture source] missing handoff version fails before adapter or center startup', () => {
  assert.throws(() => new CancelJourney('/unused-tui01f-source-evidence', {
    kind: 'web-handoff', adapterVersion: '', createCenter: async () => { throw Error('Unexpected center'); }, beforeCleanup: async () => {},
  }), /Fixed handoff adapter version required/);
});
