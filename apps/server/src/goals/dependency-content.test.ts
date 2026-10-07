import { expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import type { GoalArtifactBinding } from '../../../../packages/contracts/src/goals.js';
import { sha256 } from '../database.js';
import { dependencyContent } from './dependency-content.js';

function binding(id: string, content: string): GoalArtifactBinding {
  return { nodeId: id, executionId: `exec-${id}`, taskId: `task-${id}`, artifactId: `artifact-${id}`, artifactVersion: sha256(content), detailId: `detail-${id}` };
}

it('reads multiple short dependencies in one query without changing their ordered content', async () => {
  const bindings = [binding('z', 'short'), binding('a', 'short')];
  const query = vi.fn().mockResolvedValue({ rows: [{ ordinal: 1, content: 'short' }, { ordinal: 2, content: 'short' }] });
  expect(await dependencyContent({ query } as unknown as PoolClient, bindings)).toEqual(bindings.map(item => ({ ...item, content: 'short' })));
  expect(query).toHaveBeenCalledTimes(1);
});

function returned(contents: (string | null)[]) {
  const query = vi.fn().mockResolvedValue({ rows: contents.map((content, index) => ({ ordinal: index + 1, content })) });
  return { client: { query } as unknown as PoolClient, query };
}
const unavailable = { status: 409, code: 'dependency_artifact', message: 'The exact dependency artifact is unavailable.' };
const tooLarge = { status: 409, code: 'input_too_large', message: 'Dependency content exceeds the bounded execution context.' };

it('does not borrow or query for no dependencies', async () => {
  const { client, query } = returned([]);
  expect(await dependencyContent(client, [])).toEqual([]);
  expect(query).not.toHaveBeenCalled();
});

it('preserves duplicate tuples, caller order and every tuple component without mutation', async () => {
  const a = binding('z', 'one'); const b = binding('a', 'two');
  const bindings = [a, b, a]; const snapshot = structuredClone(bindings);
  const { client, query } = returned(['one', 'two', 'one']);
  expect(await dependencyContent(client, bindings)).toEqual([
    { ...a, content: 'one' }, { ...b, content: 'two' }, { ...a, content: 'one' },
  ]);
  expect(bindings).toEqual(snapshot);
  expect(query.mock.calls[0]![1]).toEqual([
    ['task-z', 'task-a', 'task-z'], ['artifact-z', 'artifact-a', 'artifact-z'],
    [a.artifactVersion, b.artifactVersion, a.artifactVersion], ['detail-z', 'detail-a', 'detail-z'],
  ]);
});

it('reads 199 short dependencies with one query and preserves all binding metadata', async () => {
  const bindings = Array.from({ length: 199 }, (_, i) => binding(`node-${199 - i}`, 'x'));
  const { client, query } = returned(bindings.map(() => 'x'));
  const result = await dependencyContent(client, bindings);
  expect(result).toEqual(bindings.map(item => ({ ...item, content: 'x' })));
  expect(query).toHaveBeenCalledTimes(1);
});

it('preserves exact Unicode, combining marks, CRLF and backslash with an independent digest vector', async () => {
  const text = 'A中🙂e\u0301\\_%\r\n';
  const item = { ...binding('unicode', ''), artifactVersion: '6c26c69a9b42ca0cee2e7b628d842c1f301d333b4d0f1681e3c54cdb46328857' };
  expect(Buffer.byteLength(text)).toBe(16);
  expect(await dependencyContent(returned([text]).client, [item])).toEqual([{ ...item, content: text }]);
});

it('accepts empty content and exactly 16000 UTF16 units, including a following empty dependency', async () => {
  const text = '中'.repeat(16000);
  const bindings = [binding('empty', ''), binding('limit', text), binding('tail', '')];
  expect(Buffer.byteLength(text)).toBe(48000);
  expect(await dependencyContent(returned(['', text, '']).client, bindings)).toEqual(bindings.map((item, i) => ({ ...item, content: i === 1 ? text : '' })));
});

it('counts non-BMP characters as two UTF16 units rather than code points or UTF8 bytes', async () => {
  const text = '🙂'.repeat(8000); const bindings = [binding('emoji', text)];
  expect((await dependencyContent(returned([text]).client, bindings))[0]!.content.length).toBe(16000);
  await expect(dependencyContent(returned([text, 'x']).client, [...bindings, binding('next', 'x')])).rejects.toMatchObject(tooLarge);
});

it('rejects a missing first dependency before a later oversized one', async () => {
  const large = 'x'.repeat(16001);
  await expect(dependencyContent(returned([null, large]).client, [binding('missing', 'absent'), binding('large', large)])).rejects.toMatchObject(unavailable);
});

it('rejects a bad hash before a later oversized dependency', async () => {
  const large = 'x'.repeat(16001);
  await expect(dependencyContent(returned(['changed', large]).client, [binding('changed', 'original'), binding('large', large)])).rejects.toMatchObject(unavailable);
});

it('checks the oversized row hash before reporting its length error', async () => {
  await expect(dependencyContent(returned(['x'.repeat(16001)]).client, [binding('large', 'original')])).rejects.toMatchObject(unavailable);
});

it('reports an earlier valid size error before a later missing dependency', async () => {
  const text = 'x'.repeat(16001);
  await expect(dependencyContent(returned([text, null]).client, [binding('large', text), binding('missing', '')])).rejects.toMatchObject(tooLarge);
});

it('checks cumulative UTF16 size even before the SQL UTF8 cutoff is reached', async () => {
  const first = 'x'.repeat(8000); const second = 'y'.repeat(8001);
  await expect(dependencyContent(returned([first, second, null]).client, [binding('a', first), binding('b', second), binding('missing', '')])).rejects.toMatchObject(tooLarge);
});

it('reports size from the full first byte-overshoot row without needing later rows', async () => {
  const text = '中'.repeat(16001);
  await expect(dependencyContent(returned([text]).client, [binding('large', text), binding('unread', '')])).rejects.toMatchObject(tooLarge);
});

it('detects a bad digest in the full crossing row before a later missing dependency', async () => {
  const text = '中'.repeat(16001);
  await expect(dependencyContent(returned([text]).client, [binding('large', text.slice(0, -1) + '文'), binding('unread', '')])).rejects.toMatchObject(unavailable);
});

it('does not turn a truncated or misordered query result into partial accepted context', async () => {
  const a = binding('a', 'a'); const b = binding('b', 'b');
  await expect(dependencyContent(returned(['a']).client, [a, b])).rejects.toMatchObject(unavailable);
  const query = vi.fn().mockResolvedValue({ rows: [{ ordinal: 2, content: 'a' }] });
  await expect(dependencyContent({ query } as unknown as PoolClient, [a])).rejects.toMatchObject(unavailable);
});

it('propagates the original database error without replacing it or retrying', async () => {
  const error = new Error('controlled query failure'); const query = vi.fn().mockRejectedValue(error);
  await expect(dependencyContent({ query } as unknown as PoolClient, [binding('a', 'a')])).rejects.toBe(error);
  expect(query).toHaveBeenCalledTimes(1);
});
