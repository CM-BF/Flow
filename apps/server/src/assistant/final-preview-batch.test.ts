import { expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import * as store from './store.js';
import { HttpError, sha256 } from '../database.js';
import { assistantMessageId } from '../native-harness-policy.js';

function message(index: number, prefix = 'reply', hasMore = false) {
  const session = `session-${index}`, sourceMessage = `source-${index}`;
  return { binding_index: index + 1, id: assistantMessageId('claude.sdk.result', session, sourceMessage),
    ordinal: String(index + 1), task_id: `task-${index}`, attempt_id: `attempt-${index}`, event_id: `event-${index}`,
    sequence: 1, native_session_id: session, source: 'claude.sdk.result', native_source_identity: null,
    source_message_id: sourceMessage, content_digest: sha256(prefix), detail_id: `detail-${index}`, created_at: new Date('2026-01-01Z'),
    settings: { requested: { model: 'requested', thinking: 'disabled', permissionMode: 'dontAsk' },
      effective: { model: 'observed', thinking: 'unknown', permissionMode: 'dontAsk', tools: ['Read'] } },
    prefix, has_more: hasMore, digest: sha256(prefix) };
}
function connection(rows: unknown[]) {
  const query = vi.fn(async () => ({ rows }));
  return { client: { query } as unknown as PoolClient, query };
}

it.each([
  ['empty', '', '', false],
  ['escapes', 'Backslash \\ and literal \\x41\n中文🙂', 'Backslash \\ and literal \\x41\n中文🙂', false],
  ['4000 ASCII', 'a'.repeat(4000), 'a'.repeat(4000), false],
  ['4001 ASCII prefix', 'a'.repeat(4000), 'a'.repeat(4000), true],
  ['4000 BMP prefix', '汉'.repeat(4000), '汉'.repeat(4000), true],
  ['4000 UTF16 emoji', '🙂'.repeat(2000), '🙂'.repeat(2000), false],
  ['4002 UTF16 emoji', '🙂'.repeat(2001), '🙂'.repeat(2000), false],
  ['4000 codepoint emoji', '🙂'.repeat(4000), '🙂'.repeat(2000), false],
  ['split surrogate', 'a'.repeat(3999) + '🙂', 'a'.repeat(3999), false],
  ['combining exact', 'e\u0301'.repeat(2000), 'e\u0301'.repeat(2000), false],
  ['combining overflow', 'e\u0301'.repeat(2001), 'e\u0301'.repeat(2000), false],
  ['ZWJ sequence', '👩‍💻'.repeat(801), '👩‍💻'.repeat(800), false],
] as const)('preserves the single preview UTF16 boundary for %s', async (_name, prefix, expected, hasMore) => {
  const row = message(0, prefix, hasMore), { client, query } = connection([row]);
  const [result] = await store.readAssistantFinalPreviews(client, [{ taskId: row.task_id, attemptId: row.attempt_id }]);
  expect(result).toMatchObject({ preview: { text: expected, truncated: hasMore || expected.length < prefix.length,
    contentDigest: row.content_digest, settings: row.settings } });
  expect(result).not.toHaveProperty('preview.content');
  expect(query).toHaveBeenCalledTimes(1);
  expect(await store.readAssistantFinalPreview(client, row.task_id, row.attempt_id)).toEqual(result!.preview);
});

it('keeps mixed 50 results aligned, paired and isolated when rows arrive out of order', async () => {
  const rows = Array.from({ length: 50 }, (_, index) => message(index));
  rows[12]!.digest = sha256('corruption beyond the prefix');
  rows[17]!.id = 'invalid';
  rows[22]!.settings = {} as (typeof rows)[number]['settings'];
  const { client, query } = connection(rows.filter((_, index) => index !== 7).reverse());
  const requests = rows.map(row => ({ taskId: row.task_id, attemptId: row.attempt_id }));
  const results = await store.readAssistantFinalPreviews(client, requests);
  expect(results).toHaveLength(50);
  expect(results[7]).toEqual({ preview: null });
  for (const [index, code] of [[12, 'assistant_content_mismatch'], [17, 'assistant_identity'], [22, 'assistant_source_mismatch']] as const) {
    expect(results[index]).toMatchObject({ error: { code, status: 409 } });
  }
  expect(results[49]).toMatchObject({ preview: { taskId: 'task-49', attemptId: 'attempt-49' } });
  expect(query).toHaveBeenCalledTimes(1);
  const [sql, parameters] = query.mock.calls[0]! as unknown as [string, unknown[]];
  expect(parameters).toEqual([requests.map(value => value.taskId), requests.map(value => value.attemptId)]);
  expect(sql).toContain('WITH ORDINALITY');
  expect(sql).toMatch(/m\.task_id=request\.task_id AND m\.attempt_id=request\.attempt_id/);
  expect(sql).toContain("sha256(convert_to(d.content,'UTF8'))");
  expect(sql).toContain('left(d.content,4000)');
});

it('does no reads for empty or rejected over-budget input', async () => {
  const { client, query } = connection([]);
  expect(await store.readAssistantFinalPreviews(client, [])).toEqual([]);
  await expect(store.readAssistantFinalPreviews(client, Array.from({ length: 51 }, () => ({ taskId: 't', attemptId: 'a' })))).rejects.toMatchObject({ status: 400, code: 'assistant_preview_batch_limit' });
  expect(query).not.toHaveBeenCalled();
});

it('keeps single-item validation failures throwing and unknown query failures unchanged', async () => {
  const row = message(0); row.digest = 'incorrect';
  await expect(store.readAssistantFinalPreview(connection([row]).client, row.task_id, row.attempt_id)).rejects.toBeInstanceOf(HttpError);
  const original = new Error('database unavailable');
  const client = { query: vi.fn().mockRejectedValue(original) } as unknown as PoolClient;
  await expect(store.readAssistantFinalPreviews(client, [{ taskId: 'task', attemptId: 'attempt' }])).rejects.toBe(original);
});
