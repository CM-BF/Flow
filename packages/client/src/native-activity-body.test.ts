import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { nativeActivityBodyDescriptorSchema, NATIVE_ACTIVITY_BODY_LIMITS as limits, type NativeActivityBodyDescriptor, type NativeActivityBodyPage } from '../../contracts/src/native-activity-body.js';
import { NativeActivityBodyReader, readNativeActivityBody, readBoundedNativeBodyJson, type NativeBodyRequest } from './native-activity-body.js';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function descriptor(bytes: Uint8Array, state: NativeActivityBodyDescriptor['state'] = 'complete', received = bytes.length): NativeActivityBodyDescriptor {
  return { taskId: 'task', attemptId: 'attempt', activityId: 'a'.repeat(64), protocol: 'native-activity-body-v1', representation: 'sdk-public-material-utf8-v1',
    state, mediaType: 'application/json', bytes: bytes.length, sha256: digest(bytes), receivedBytes: received,
    receivedChunks: Math.ceil(received / limits.chunkBytes), chunkCount: Math.ceil(bytes.length / limits.chunkBytes) };
}
function page(bytes: Uint8Array, info: NativeActivityBodyDescriptor, index: number): NativeActivityBodyPage {
  const nextIndex = Math.min(index + limits.pageChunks, info.receivedChunks);
  const chunks = Array.from({ length: nextIndex - index }, (_, n) => {
    const offset = (index + n) * limits.chunkBytes, chunk = bytes.slice(offset, Math.min(offset + limits.chunkBytes, info.receivedBytes));
    return { index: index + n, offset, bytes: chunk.length, sha256: digest(chunk), base64: Buffer.from(chunk).toString('base64') };
  });
  return { descriptor: { ...info }, chunks, nextIndex, hasMore: nextIndex < info.receivedChunks };
}
function transport(bytes: Uint8Array, info: () => NativeActivityBodyDescriptor) {
  return vi.fn<NativeBodyRequest>(async (path, options) => {
    expect(options.maxBytes).toBe(384 * 1024);
    return page(bytes, info(), Number(new URL(path, 'http://fixture').searchParams.get('afterIndex')));
  });
}

it('lazily recovers over 2MiB across UTF8 boundaries and isolates public bytes from full integrity', async () => {
  const value = 'a'.repeat(65_535) + '🌱' + 'b'.repeat(2_100_000), bytes = Buffer.from(value), info = descriptor(bytes);
  const request = transport(bytes, () => info), reader = new NativeActivityBodyReader(request, info);
  info.sha256 = 'f'.repeat(64); // The constructor owns its validated descriptor snapshot.
  const stable = descriptor(bytes); request.mockImplementation(async path => page(bytes, stable, Number(new URL(path, 'http://fixture').searchParams.get('afterIndex'))));
  expect(request).not.toHaveBeenCalled();
  let result;
  do {
    result = await reader.readNext();
    for (const chunk of result.chunks) chunk.fill(0);
    result.descriptor.sha256 = '0'.repeat(64);
  } while (result.hasMore);
  expect(result.integrity).toBe('complete');
  expect(reader.completeText()).toBe(value); expect(reader.completeText()).toBe(value);
  const calls = request.mock.calls.length;
  expect((await reader.readNext()).integrity).toBe('complete'); expect(request).toHaveBeenCalledTimes(calls);
  reader.close(); expect(() => reader.completeText()).toThrow();
});

it('keeps a receiving tail refreshable and only seals after the center plus full digest agree', async () => {
  const bytes = Buffer.from('x'.repeat(70_000)); let info = descriptor(bytes, 'receiving', 0);
  const request = transport(bytes, () => info), reader = new NativeActivityBodyReader(request, info);
  expect(await reader.readNext()).toMatchObject({ integrity: 'partial', nextIndex: 0, hasMore: false });
  info = descriptor(bytes, 'receiving', 65_536);
  expect(await reader.readNext()).toMatchObject({ integrity: 'partial', nextIndex: 1, hasMore: false });
  info = descriptor(bytes, 'receiving');
  expect(await reader.readNext()).toMatchObject({ integrity: 'partial', nextIndex: 2 });
  expect(() => reader.completeText()).toThrow();
  info = descriptor(bytes);
  expect(await reader.readNext()).toMatchObject({ integrity: 'complete', nextIndex: 2, chunks: [] });
  expect(reader.completeText()).toBe(bytes.toString()); reader.close();
});

it('does not call legacy tails or label interrupted bytes complete', async () => {
  const bytes = Buffer.from('hello'), request = transport(bytes, () => descriptor(bytes, 'interrupted'));
  const interrupted = new NativeActivityBodyReader(request, descriptor(bytes, 'interrupted'));
  expect((await interrupted.readNext()).integrity).toBe('partial'); expect(() => interrupted.completeText()).toThrow();
  const legacy = { ...descriptor(bytes), state: 'legacy' as const, protocol: null, representation: null, mediaType: null, bytes: null, sha256: null, chunkCount: null, receivedBytes: 0, receivedChunks: 0 };
  const reader = new NativeActivityBodyReader(request, legacy);
  expect(await reader.readNext()).toMatchObject({ chunks: [], integrity: 'partial' }); expect(request).toHaveBeenCalledTimes(1);
  interrupted.close(); reader.close();
});

it('rejects a second inflight read and preserves the cursor after an aborted first page', async () => {
  const bytes = Buffer.from('hello'), info = descriptor(bytes); let resolve!: (value: unknown) => void;
  const request = vi.fn<NativeBodyRequest>().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(page(bytes, info, 0));
  const reader = new NativeActivityBodyReader(request, info), controller = new AbortController();
  const first = reader.readNext(controller.signal);
  await expect(reader.readNext()).rejects.toThrow('in flight');
  controller.abort(); resolve(page(bytes, info, 0)); await expect(first).rejects.toThrow();
  expect(await reader.readNext()).toMatchObject({ nextIndex: 1, integrity: 'complete' });
  expect(request.mock.calls.every(([path]) => path.includes('afterIndex=0'))).toBe(true); reader.close();
});

it('does not commit a page cancelled during digest validation', async () => {
  const bytes = Buffer.from('hello'), info = descriptor(bytes), request = transport(bytes, () => info);
  const reader = new NativeActivityBodyReader(request, info), controller = new AbortController();
  const original = crypto.subtle.digest.bind(crypto.subtle);
  const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => { const value = await original(...args); controller.abort(); return value; });
  try { await expect(reader.readNext(controller.signal)).rejects.toThrow(); }
  finally { spy.mockRestore(); }
  expect((await reader.readNext()).integrity).toBe('complete');
  expect(request.mock.calls.every(([path]) => path.includes('afterIndex=0'))).toBe(true); reader.close();
});

const corruptions: [string, (value: NativeActivityBodyPage) => void][] = [
  ['cross task', value => { value.descriptor.taskId = 'other'; }],
  ['cross attempt', value => { value.descriptor.attemptId = 'other'; }],
  ['cursor', value => { value.nextIndex++; }],
  ['false tail', value => { value.hasMore = true; }],
  ['offset', value => { value.chunks[0]!.offset++; }],
  ['gap', value => { value.chunks[0]!.index++; }],
  ['chunk digest', value => { value.chunks[0]!.sha256 = 'b'.repeat(64); }],
  ['noncanonical base64', value => { value.chunks[0]!.base64 = 'YR=='; }],
];
it.each(corruptions)('rejects %s without advancing the cursor', async (_label, corrupt) => {
  const bytes = Buffer.from('a'), info = descriptor(bytes), broken = page(bytes, info, 0); corrupt(broken);
  const request = vi.fn<NativeBodyRequest>().mockResolvedValueOnce(broken).mockResolvedValue(page(bytes, info, 0));
  const reader = new NativeActivityBodyReader(request, info);
  await expect(reader.readNext()).rejects.toThrow();
  expect((await reader.readNext()).integrity).toBe('complete');
  expect(request.mock.calls.every(([path]) => path.includes('afterIndex=0'))).toBe(true); reader.close();
});

it('retains the verified prefix when final full digest fails, with no automatic retry', async () => {
  const bytes = Buffer.from('q'.repeat(limits.chunkBytes * 4 + 1)), info = { ...descriptor(bytes), sha256: 'b'.repeat(64) };
  const request = transport(bytes, () => info), reader = new NativeActivityBodyReader(request, info);
  expect((await reader.readNext()).nextIndex).toBe(4);
  await expect(reader.readNext()).rejects.toThrow('Complete material digest');
  expect(request).toHaveBeenCalledTimes(2); expect(() => reader.completeText()).toThrow();
  await expect(reader.readNext()).rejects.toThrow('Complete material digest');
  expect(request.mock.calls[2]![0]).toContain('afterIndex=4'); reader.close();
});

it('rejects inconsistent descriptors before allocating, and validates requested identity', async () => {
  const info = descriptor(Buffer.from('a'));
  for (const bad of [{ ...info, bytes: limits.bodyBytes + 1 }, { ...info, receivedBytes: 0 }, { ...info, extra: true }, { ...info, protocol: null }]) {
    expect(nativeActivityBodyDescriptorSchema.safeParse(bad).success).toBe(false);
    expect(() => new NativeActivityBodyReader(vi.fn(), bad)).toThrow();
  }
  await expect(readNativeActivityBody(async () => info, 'other', info.activityId)).rejects.toThrow('identity');
});

it('limits response bytes before JSON parse and cancels the source on overflow or abort', async () => {
  const cancel = vi.fn();
  const response = new Response(new ReadableStream({ pull(controller) { controller.enqueue(new TextEncoder().encode('12345')); }, cancel }));
  await expect(readBoundedNativeBodyJson(response, 4)).rejects.toThrow('byte limit'); expect(cancel).toHaveBeenCalledOnce();
  const controller = new AbortController(), never = new Response(new ReadableStream({ cancel }));
  const pending = readBoundedNativeBodyJson(never, 100, controller.signal); controller.abort();
  await expect(pending).rejects.toThrow();
  expect(await readBoundedNativeBodyJson(new Response('{"ok":"中文"}'), 100)).toEqual({ ok: '中文' });
});
