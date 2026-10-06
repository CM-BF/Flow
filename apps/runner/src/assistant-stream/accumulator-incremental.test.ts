import { createHash, type Hash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AssistantStreamItem } from './index.js';

type Coalescer = typeof import('./index.js').coalesceAssistantStream;
const originalByteLength = Buffer.byteLength;
const frameBudget = { bytes: Number(process.env.CHAT06P03_PRIOR_BYTES ?? 0), frames: Number(process.env.CHAT06P03_PRIOR_FRAMES ?? 0) };
const prior = { ...frameBudget };
const measurements: unknown[] = [];
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const session = 'synthetic-session';
let serial = 0;
function frame(value: object): SDKMessage & { uuid: string } {
  return { session_id: session, parent_tool_use_id: null, uuid: `synthetic-${++serial}`, ...value } as SDKMessage & { uuid: string };
}
const stream = (event: object) => frame({ type: 'stream_event', event });
const begin = (message = 'message') => stream({ type: 'message_start', message: { id: message } });
const start = (text = '', index = 0) => stream({ type: 'content_block_start', index, content_block: { type: 'text', text } });
const delta = (text: string, index = 0) => stream({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } });
const stop = (index = 0) => stream({ type: 'content_block_stop', index });
const full = (text: string, message = 'message', extra: object = {}) => frame({ type: 'assistant', message: { id: message, content: [{ type: 'text', text }] }, ...extra });
const result = () => frame({ type: 'result', subtype: 'success' });
async function* input(frames: SDKMessage[], controller: AbortController, ending?: 'abort' | 'error') {
  for (const value of frames) {
    frameBudget.bytes += originalByteLength(JSON.stringify(value)); frameBudget.frames++;
    if (frameBudget.bytes > 1_048_576 || frameBudget.frames > 256) throw new Error('Shared synthetic input budget exceeded');
    yield value;
  }
  if (ending === 'abort') controller.abort(new Error('synthetic-abort'));
  if (ending === 'error') throw new Error('synthetic-source-error');
}
async function implementations() {
  return [
    (await import('../../../../docs/evidence/chat06p03/baseline/index.js')).coalesceAssistantStream,
    (await import('./index.js')).coalesceAssistantStream,
  ] as const;
}
async function collect(run: Coalescer, frames: SDKMessage[], ending?: 'abort' | 'error') {
  const controller = new AbortController(); const items: AssistantStreamItem[] = [];
  let failure: string | null = null;
  try { for await (const item of run(input(frames, controller, ending), controller.signal)) items.push(item); }
  catch (error) { failure = error instanceof Error ? error.message : 'unknown'; }
  return { items, failure };
}
async function compare(frames: SDKMessage[], ending?: 'abort' | 'error') {
  const [baseline, candidate] = await implementations();
  const original = await collect(baseline, frames, ending); const actual = await collect(candidate, frames, ending);
  expect(actual).toEqual(original);
  measurements.push({ kind: 'equivalence', suppliedFramesPerImplementation: frames.length, ending: ending ?? 'eof', outputItems: actual.items.length, outputDigest: digest(JSON.stringify(actual)), failure: actual.failure });
  return actual;
}
function patches(items: AssistantStreamItem[]) { return items.flatMap(item => item.kind === 'patch' ? [item.patch] : []); }
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  const name = process.env.CHAT06P03_MEASUREMENTS;
  if (!name) return;
  if (!/^(red|green)-measurements\.json$/.test(name)) throw new Error('Invalid owned evidence filename');
  writeFileSync(resolve('docs/evidence/chat06p03', name), `${JSON.stringify({ prior, total: frameBudget, thisRun: { bytes: frameBudget.bytes - prior.bytes, frames: frameBudget.frames - prior.frames }, measurements }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
});

async function measured(run: Coalescer, frames: SDKMessage[]) {
  const counters = { hashInputBytes: 0, byteLengthInputBytes: 0 };
  const prototype = Object.getPrototypeOf(createHash('sha256')) as Hash;
  const originalUpdate = prototype.update;
  const update = vi.spyOn(prototype, 'update').mockImplementation(function (this: Hash, data: string | NodeJS.ArrayBufferView, encoding?: BufferEncoding) {
    counters.hashInputBytes += typeof data === 'string' ? originalByteLength(data, encoding) : data.byteLength;
    return Reflect.apply(originalUpdate, this, encoding === undefined ? [data] : [data, encoding]) as Hash;
  });
  const byteLength = vi.spyOn(Buffer, 'byteLength').mockImplementation((value, encoding) => {
    const bytes = originalByteLength(value, encoding); counters.byteLengthInputBytes += bytes; return bytes;
  });
  try { return { ...await collect(run, frames), counters }; }
  finally { update.mockRestore(); byteLength.mockRestore(); }
}

test('public coalescer preserves every output while incremental sealing reduces measured input bytes', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  const chunk = 'x'.repeat(4096); const text = chunk.repeat(16);
  const frames = [begin(), start(), ...Array.from({ length: 16 }, () => delta(chunk)), full(text), stop(), result()];
  const [baseline, candidate] = await implementations();
  const original = await measured(baseline, frames); const actual = await measured(candidate, frames);
  expect(actual.items).toEqual(original.items); expect(actual.failure).toBeNull(); expect(original.failure).toBeNull();
  const sealed = patches(actual.items);
  const priorPrefixBytes = sealed.reduce((sum, patch) => sum + patch.fromBytes, 0);
  const newTextBytes = sealed.reduce((sum, patch) => sum + originalByteLength(patch.text), 0);
  measurements.push({ kind: 'actual-input-bytes', baseline: original.counters, candidate: actual.counters, priorPrefixBytes, newTextBytes,
    outputDigest: digest(JSON.stringify(actual.items)), patches: sealed.map(({ text: value, ...rest }) => ({ ...rest, textBytes: originalByteLength(value) })) });
  expect(sealed).toHaveLength(9); expect(newTextBytes).toBe(65_536);
  expect(original.counters.hashInputBytes - actual.counters.hashInputBytes).toBe(priorPrefixBytes);
  expect(original.counters.byteLengthInputBytes - actual.counters.byteLengthInputBytes).toBe(priorPrefixBytes - newTextBytes);
});

test('Unicode, repeated frames, multiple blocks, tool-before-frame, supersedes and late abort preserve exact patches', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  const text = 'a'.repeat(8191) + '🙂中'; const repeated = delta(text);
  const firstFull = full(text); const secondFull = full('β🙂');
  const tool = stream({ type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 'tool-one' } });
  const frames = [begin(), start(), repeated, repeated, firstFull, stop(), full(text, 'message', { aborted: true }), start('', 1), delta('β🙂', 1), secondFull, tool, stop(1),
    begin('replacement'), start('replacement'), full('replacement', 'replacement', { supersedes: [firstFull.uuid] }), stop(), result()];
  const actual = await compare(frames); expect(actual.failure).toBeNull();
  const sealed = patches(actual.items);
  expect(sealed.some(patch => patch.phase === 'superseded' && patch.text === '' && patch.fromBytes === originalByteLength(text))).toBe(true);
  expect(sealed.some(patch => patch.reason === 'aborted')).toBe(true);
  expect(new Set(sealed.map(patch => patch.streamId)).size).toBe(3);
  const toolPosition = actual.items.findIndex(item => item.kind === 'frame' && item.frame.uuid === tool.uuid);
  expect(actual.items[toolPosition - 1]).toMatchObject({ kind: 'marker', patch: { kind: 'tool-boundary' } });
  expect(sealed.filter(patch => patch.blockIndex === 0 && patch.nativeMessageId === 'message').map(patch => patch.text).join('')).toBe(text);
});

test('empty phase and result-before-EOF flushing preserve the complete prefix digest', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  const empty = await compare([begin(), start(), stop(), result()]);
  expect(patches(empty.items)).toEqual([expect.objectContaining({ text: '', fromBytes: 0, phase: 'block-complete', prefixDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })]);
  const terminal = result(); const actual = await compare([begin(), start('tail🙂'), terminal]);
  const index = actual.items.findIndex(item => item.kind === 'frame' && item.frame.uuid === terminal.uuid);
  expect(actual.items[index - 1]).toMatchObject({ kind: 'patch', patch: { text: 'tail🙂', phase: 'streaming' } });
  expect(patches(actual.items).at(-1)).toMatchObject({ text: '', phase: 'incomplete', reason: 'stream-ended', fromBytes: 8, prefixDigest: digest('tail🙂') });
});

test('abort drops the unflushed tail while source failure preserves the same incomplete prefix', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  for (const ending of ['abort', 'error'] as const) {
    const actual = await compare([begin(), start('pending🙂')], ending);
    expect(actual.failure).toBe(ending === 'abort' ? 'synthetic-abort' : 'synthetic-source-error');
    if (ending === 'abort') expect(patches(actual.items)).toHaveLength(0);
    else expect(patches(actual.items)).toEqual([expect.objectContaining({ text: 'pending🙂', phase: 'incomplete', reason: 'stream-ended' })]);
  }
});

test('controlled smaller contract limit compares truncated phases without claiming the production 1MiB boundary', async () => {
  vi.resetModules();
  vi.doMock('../../../../packages/contracts/src/assistant-stream.js', async () => ({
    ...await vi.importActual<Record<string, unknown>>('../../../../packages/contracts/src/assistant-stream.js'), ASSISTANT_ATTEMPT_BYTES: 16, ASSISTANT_PATCH_BYTES: 8,
  }));
  try {
    const text = '🙂'.repeat(5);
    const actual = await compare([begin(), start(text), full(text), result()]);
    const sealed = patches(actual.items);
    expect(sealed.map(patch => patch.text).join('')).toBe('🙂'.repeat(4));
    expect(sealed.at(-1)).toMatchObject({ fromBytes: 8, phase: 'incomplete', reason: 'truncated', truncated: true });
    expect(sealed.at(-1)?.prefixDigest).toBe(digest('🙂'.repeat(4)));
  } finally { vi.doUnmock('../../../../packages/contracts/src/assistant-stream.js'); vi.resetModules(); }
});
