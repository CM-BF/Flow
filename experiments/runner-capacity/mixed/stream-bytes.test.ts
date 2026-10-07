import { expect, test } from 'vitest';
import { StreamBytes } from './stream-bytes.js';
test('counts connection establishment and final counters once per socket identity', () => {
  const meter = new StreamBytes(); const first = { bytesRead: 10, bytesWritten: 20 };
  meter.addPgClient({ connection: { stream: first } }); meter.add(first);
  expect(meter.sample()).toEqual({ delta: 30, total: 30, streams: 1, complete: true });
  first.bytesRead += 7; first.bytesWritten += 11;
  expect(meter.sample().delta).toBe(18); expect(meter.sample().delta).toBe(0);
  const second = { bytesRead: 3, bytesWritten: 4 }; meter.add(second);
  expect(meter.sample()).toEqual({ delta: 7, total: 55, streams: 2, complete: true });
});
test('missing private pg seam, bad counters, decreasing totals and socket bound are UNKNOWN', () => {
  const missing = new StreamBytes(); missing.addPgClient({}); expect(missing.sample().complete).toBe(false);
  const bounded = new StreamBytes(1); bounded.add({ bytesRead: 1, bytesWritten: 2 }); bounded.add({ bytesRead: 1, bytesWritten: 2 }); expect(bounded.sample().complete).toBe(false);
  const bad = new StreamBytes(); const socket = { bytesRead: 10, bytesWritten: 0 }; bad.add(socket); bad.sample(); socket.bytesRead = 0;
  expect(bad.sample().complete).toBe(false);
  const nan = new StreamBytes(); nan.add({ bytesRead: NaN, bytesWritten: 0 }); expect(nan.sample().complete).toBe(false);
});

test('deadline cleanup destroys only registered owned streams and invalidates complete accounting', () => {
  let closed = 0; const meter = new StreamBytes(); const socket = { bytesRead: 1, bytesWritten: 2, destroy() { closed++; } };
  meter.add(socket); meter.add(socket); meter.destroyOwned(); expect(closed).toBe(1); expect(meter.sample().complete).toBe(false);
});
