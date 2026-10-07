import { expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import { turnPage } from './queries.js';
import * as state from './state.js';
import type { TaskRecord } from '../tasks.js';
import { sha256 } from '../database.js';
import { assistantMessageId } from '../native-harness-policy.js';

const time = new Date('2026-01-01Z');
const settings = { requested: { model: 'requested', thinking: 'disabled' as const, permissionMode: 'dontAsk' as const },
  effective: { model: 'observed', thinking: 'unknown' as const, permissionMode: 'dontAsk', tools: ['Read'] } };
const modes = ['typed', 'pending', 'missing', 'invalid', 'unknown', 'foreign', 'legacy', 'ambiguous', 'unverified', 'duplicate-session'] as const;
function fixture(count = 50) {
  const conversation: state.ConversationRow = { id: 'conversation', title: 'Conversation', harness: 'claude', requested: { model: 'request', thinking: 'disabled', tools: 'none' },
    revision: 1, queue_revision: 0, queue_paused: false, created_at: time, updated_at: time };
  const turns: state.TurnRow[] = [];
  const tasks = new Map<string, TaskRecord>();
  const messages = new Map<string, ReturnType<typeof storedMessage>>();
  const sessions = new Map<string, { task_id: string; attempt_id: string; native_session_id: string; runner_id: string; active_task_id: null; details: { id: string; content: string }[] }>();
  const artifacts = new Map<string, Record<string, unknown>[]>();
  const contexts = new Map<string, Record<string, unknown>>();
  function storedMessage(index: number) {
    const native = `session-${index}`, source = `source-${index}`, content = `reply-${index}`;
    return { id: assistantMessageId('claude.sdk.result', native, source), task_id: `task-${index}`, attempt_id: `attempt-${index}`,
      ordinal: String(index + 1), event_id: `event-${index}`, sequence: 1, native_session_id: native, source: 'claude.sdk.result',
      native_source_identity: null, source_message_id: source, content_digest: sha256(content), detail_id: `detail-${index}`,
      created_at: time, settings: structuredClone(settings), prefix: content, has_more: false, digest: sha256(content) };
  }
  for (let index = 0; index < count; index++) {
    const mode = modes[index % modes.length]!, taskId = `task-${index}`, attemptId = `attempt-${index}`;
    turns.push({ id: `turn-${index}`, conversation_id: 'conversation', number: index + 1, task_id: taskId, user_text: `question-${index}`, created_at: time });
    tasks.set(taskId, { id: taskId, submission: { title: `task-${index}`, prompt: 'frozen prompt', harness: 'claude' },
      status: mode === 'pending' ? 'running' : 'succeeded', verification_status: mode === 'unverified' ? 'failed' : 'passed',
      created_at: time, updated_at: time, cursor: 1, owner_version: 3, current_attempt_id: attemptId, pending_decision: null,
      usage: {}, latest_artifact_id: `artifact-${index}`, latest_artifact_version: sha256(`legacy-${index}`) } as TaskRecord);
    const adapter = ['legacy', 'ambiguous'].includes(mode) ? 'claude-sdk-0.3.290-v1' : mode === 'unknown' ? 'unknown-adapter' : 'claude-sdk-0.3.290-v2';
    const detail = { id: `session-detail-${index}`, content: JSON.stringify({ id: `event-${index}`, sequence: 1, type: 'session', nativeSessionId: `session-${index}`, adapterVersion: adapter, resources: ['model:legacy-model'] }) };
    if (mode !== 'foreign') sessions.set(taskId, { task_id: taskId, attempt_id: attemptId, native_session_id: `session-${index}`, runner_id: 'runner', active_task_id: null, details: mode === 'duplicate-session' ? [detail, { ...detail, id: `${detail.id}-2` }] : [detail] });
    if (!['missing', 'legacy', 'ambiguous'].includes(mode)) {
      const message = storedMessage(index); if (mode === 'invalid') message.digest = sha256('corrupted suffix'); messages.set(taskId, message);
    }
    if (['legacy', 'ambiguous'].includes(mode)) {
      const artifact = { task_id: taskId, artifact_id: `artifact-${index}`, version: sha256(`legacy-${index}`), detail_id: `artifact-detail-${index}`,
        attempt_id: attemptId, title: 'Result', kind: 'artifact', content: `legacy-${index}`, media_type: 'text/plain', artifact_version: sha256(`legacy-${index}`) };
      artifacts.set(taskId, mode === 'ambiguous' ? [artifact, { ...artifact, detail_id: `${artifact.detail_id}-2` }] : [artifact]);
    }
  }
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
    if (sql.includes('FROM flow.conversations WHERE id=')) return { rows: values[0] === conversation.id ? [conversation] : [] };
    if (sql.includes('FROM flow.conversation_turns WHERE conversation_id=')) return { rows: turns.filter(row => row.conversation_id === values[0] && row.number > Number(values[1])).slice(0, Number(values[2])) };
    if (sql.includes('FROM flow.tasks WHERE')) {
      const ids = Array.isArray(values[0]) ? values[0] : [values[0]];
      return { rows: ids.flatMap(id => tasks.has(String(id)) ? [tasks.get(String(id))!] : []).reverse() };
    }
    if (sql.includes('FROM flow.conversation_execution_inputs i')) return { rows: (values[0] as string[]).flatMap(id => contexts.has(id) ? [contexts.get(id)!] : []) };
    if (sql.includes('FROM flow.attempts a')) {
      if (Array.isArray(values[0])) {
        const ids = values[0] as string[], attempts = values[1] as string[], owners = values[2] as number[];
        return { rows: ids.flatMap((id, index) => { const session = sessions.get(id); return session && session.attempt_id === attempts[index] && owners[index] === 3 ? [session] : []; }).reverse() };
      }
      const session = sessions.get(String(values[1]));
      return { rows: session && session.attempt_id === values[0] && values[2] === 3 ? [session] : [] };
    }
    if (sql.includes("kind='session' LIMIT 2")) return { rows: sessions.get(String(values[0]))?.details ?? [] };
    if (sql.includes('flow.assistant_messages')) {
      const ids = Array.isArray(values[0]) ? values[0] as string[] : [String(values[0])];
      const attempts = Array.isArray(values[1]) ? values[1] as string[] : [String(values[1])];
      return { rows: ids.flatMap((id, index) => { const row = messages.get(id); return row?.attempt_id === attempts[index] ? [{ ...row, binding_index: index + 1 }] : []; }).reverse() };
    }
    if (sql.includes('FROM flow.details WHERE id=')) {
      const row = messages.get(String(values[1])); return { rows: row && row.detail_id === values[0] && row.attempt_id === values[2] ? [row] : [] };
    }
    if (sql.includes('FROM flow.artifacts a')) {
      const ids = Array.isArray(values[0]) ? values[0] as string[] : [String(values[0])];
      return { rows: ids.flatMap(id => artifacts.get(id) ?? []).reverse() };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const release = vi.fn();
  const client = Object.assign(new EventEmitter(), { query, release }) as unknown as PoolClient;
  const connect = vi.fn((callback?: (error: Error | undefined, borrowed: PoolClient, done: (error?: Error | boolean) => void) => void) => {
    if (callback) { callback(undefined, client, release); return; }
    return Promise.resolve(client);
  });
  const pool = { connect, query: vi.fn(() => { throw Error('escaped transaction'); }) } as unknown as Pool;
  return { conversation, turns, tasks, messages, sessions, artifacts, contexts, query, release, client, pool };
}

it('keeps mixed 50 turns equivalent to single reads with a constant query bound', async () => {
  const expectedFixture = fixture();
  const expected = [];
  for (const row of expectedFixture.turns) expected.push(await state.turnView(expectedFixture.client, row));
  const f = fixture(); const page = await turnPage(f.pool, 'conversation', 0, 50);
  expect(page.turns).toEqual(expected);
  expect(page.turns.map(turn => turn.id)).toEqual(f.turns.map(row => row.id));
  expect(page.turns.slice(0, 10).map(turn => turn.assistant.state === 'available' ? 'available' : turn.assistant.reason)).toEqual([
    'available', 'execution-pending', 'missing-result', 'invalid-result', 'unknown-adapter', 'missing-session', 'available', 'ambiguous-result', 'invalid-result', 'unknown-adapter',
  ]);
  expect(page.turns[1]!.effective).toMatchObject({ model: 'observed', runnerRequested: { model: 'requested' } });
  expect(page.turns[6]!.effective).toMatchObject({ model: 'legacy-model', source: { kind: 'recorded-adapter-session' } });
  expect(page.nextCursor).toBeNull();
  expect(f.query.mock.calls.length).toBeLessThanOrEqual(9); // BEGIN/COMMIT plus at most seven bounded reads.
  expect(f.query.mock.calls[0]![0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  expect(f.query.mock.calls.at(-1)![0]).toBe('COMMIT'); expect(f.release).toHaveBeenCalledTimes(1);
});

it('retains limit+1 paging, cross-conversation filtering and empty pages without projection reads', async () => {
  const f = fixture(51); f.turns.push({ ...f.turns[0]!, id: 'foreign-turn', conversation_id: 'other' });
  const first = await turnPage(f.pool, 'conversation', 0, 50);
  expect(first.turns).toHaveLength(50); expect(first.nextCursor).toBe(50);
  expect(first.turns.some(turn => turn.id === 'foreign-turn')).toBe(false);
  expect(f.query.mock.calls.find(([sql]) => sql.includes('FROM flow.conversation_turns'))![1]).toEqual(['conversation', 0, 51]);
  const second = await turnPage(f.pool, 'conversation', 50, 50);
  expect(second.turns.map(turn => turn.number)).toEqual([51]); expect(second.nextCursor).toBeNull();
  f.query.mockClear(); const empty = await turnPage(f.pool, 'conversation', 51, 50);
  expect(empty.turns).toEqual([]); expect(empty.nextCursor).toBeNull(); expect(f.query).toHaveBeenCalledTimes(4);
});

it('preserves conversation/task 404 and rolls back the same borrowed client', async () => {
  const f = fixture(1);
  await expect(turnPage(f.pool, 'missing', 0, 50)).rejects.toMatchObject({ status: 404, code: 'conversation_not_found' });
  expect(f.query.mock.calls.at(-1)![0]).toBe('ROLLBACK');
  f.tasks.clear();
  await expect(turnPage(f.pool, 'conversation', 0, 50)).rejects.toMatchObject({ status: 404, code: 'not_found' });
});

it.each(['attempt', 'owner', 'session'] as const)('retains the current %s binding and never falls back from typed invalid', async binding => {
  const f = fixture(1), task = f.tasks.get('task-0')!;
  if (binding === 'attempt') task.current_attempt_id = 'foreign-attempt';
  if (binding === 'owner') task.owner_version++;
  if (binding === 'session') f.messages.get('task-0')!.native_session_id = 'foreign-session';
  const page = await turnPage(f.pool, 'conversation', 0, 50);
  expect(page.turns[0]!.assistant).toEqual({ state: 'unavailable', reason: binding === 'session' ? 'invalid-result' : 'missing-session' });
  const sessionQuery = f.query.mock.calls.find(([sql]) => sql.includes('FROM flow.attempts a'))!;
  expect(sessionQuery[0]).toContain("s.harness='claude' AND s.runner_id=a.runner_id");
  expect(sessionQuery[0]).toContain('a.owner_version=');
});

it('preserves frozen message settings, observed effective settings and allowlisted context', async () => {
  const f = fixture(1), task = f.tasks.get('task-0')!;
  const frozen = { protocol: 'flow.claude-turn-settings.v1' as const, profile: { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) },
    requested: { model: 'configured', thinking: 'adaptive' as const, effort: { kind: 'not-requested' as const }, speed: 'fast' as const } };
  task.submission.messageSettings = frozen;
  const stored = { effective: { ...settings.effective, model: 'actual' }, messageSettings: { snapshot: frozen, observed: { source: 'claude.sdk.system.init', model: 'actual', fastModeState: 'cooldown' } } };
  f.messages.get('task-0')!.settings = stored as unknown as typeof settings;
  f.turns[0]!.conversation_input_id = 'input';
  f.contexts.set('input', { input_id: 'input', id: 'context', context_digest: 'a'.repeat(64), execution_input_digest: 'b'.repeat(64), template_version: 1, sources: [], attachments: [] });
  const page = await turnPage(f.pool, 'conversation', 0, 50);
  expect(page.turns[0]!.messageSettings).toEqual(frozen);
  expect(page.turns[0]!.effective).toMatchObject({ model: 'actual', messageSettings: stored.messageSettings });
  expect(page.turns[0]!.context).toMatchObject({ id: 'context', executionInputId: 'input' });
  expect(page.turns[0]).not.toHaveProperty('context.execution_prompt');
  expect(f.query.mock.calls.filter(([sql]) => sql.includes('FROM flow.conversation_execution_inputs i'))).toHaveLength(1);
});

it('keeps empty/over-budget turnViews free of SQL and leaves unknown failures unchanged', async () => {
  const f = fixture(51);
  expect(await state.turnViews(f.client, [])).toEqual([]);
  await expect(state.turnViews(f.client, f.turns)).rejects.toMatchObject({ status: 400, code: 'conversation_turn_batch_limit' });
  expect(f.query).not.toHaveBeenCalled();
  const original = new Error('query failed'); f.query.mockRejectedValueOnce(original);
  await expect(state.turnViews(f.client, f.turns.slice(0, 1))).rejects.toBe(original);
});

it.each(['missing', 'invalid-artifact', 'invalid-typed'] as const)('keeps the legacy %s result distinct from a valid final', async mode => {
  const f = fixture(7); f.turns.splice(0, 6);
  if (mode === 'missing') f.artifacts.clear();
  if (mode === 'invalid-artifact') f.artifacts.get('task-6')![0]!.content = 'changed after verification';
  if (mode === 'invalid-typed') {
    const row = { ...f.messages.get('task-0')!, task_id: 'task-6', attempt_id: 'attempt-6', native_session_id: 'session-6', digest: 'invalid' };
    f.messages.set('task-6', row);
  }
  const page = await turnPage(f.pool, 'conversation', 0, 50);
  expect(page.turns[0]!.assistant).toEqual({ state: 'unavailable', reason: mode === 'missing' ? 'missing-result' : 'invalid-result' });
  if (mode === 'invalid-typed') expect(f.query.mock.calls.some(([sql]) => sql.includes('FROM flow.artifacts a'))).toBe(false);
});
