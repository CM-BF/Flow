import { expect, it } from 'vitest';
import { readBoundedJson } from './response-json.js';
import { readBoundedNativeBodyJson } from './native-activity-body.js';

it('counts UTF-8 bytes across chunks and releases the reader at the exact bound', async () => {
  const bytes = new TextEncoder().encode('"😀"');
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(bytes.subarray(0, 3)); controller.enqueue(bytes.subarray(3)); controller.close();
  } }));
  expect(await readBoundedJson(response, bytes.length)).toBe('😀');
  expect(response.body?.locked).toBe(false);
  await expect(readBoundedJson(new Response(bytes), bytes.length - 1)).rejects.toThrow('byte limit');
});
it('rejects malformed UTF-8 and JSON, releasing the reader on both failures', async () => {
  for (const bytes of [new Uint8Array([34, 255, 34]), new TextEncoder().encode('{')]) {
    const response = new Response(bytes);
    await expect(readBoundedJson(response, 32)).rejects.toThrow();
    expect(response.body?.locked).toBe(false);
  }
});
it('keeps material-specific limits and errors after sharing the decoder', async () => {
  await expect(readBoundedNativeBodyJson(new Response('{}'), 384 * 1024 + 1)).rejects.toThrow('Invalid material response bound.');
  await expect(readBoundedNativeBodyJson(new Response(null), 8)).rejects.toThrow('Material response has no body.');
  await expect(readBoundedNativeBodyJson(new Response('"xxx"'), 4)).rejects.toThrow('Material response exceeds its byte limit.');
});
it('preserves already-aborted non-Error reasons without acquiring the stream', async () => {
  const controller = new AbortController(); controller.abort(null);
  const response = new Response('{}');
  await expect(readBoundedJson(response, 32, controller.signal)).rejects.toBe(null);
  expect(response.body?.locked).toBe(false);
});
