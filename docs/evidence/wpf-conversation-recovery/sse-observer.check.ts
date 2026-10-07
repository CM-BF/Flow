// Targeted pure stream checks of the actual fixture observer. No HTTP, PG, Chrome or provider imports/startup.
import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough, Readable, Writable } from "node:stream";
import { once } from "node:events";
import { RecoverySseObserver } from "../../../apps/web/test/conversation-recovery.fixture.ts";

const taskId = "owned-sse-task";
const frame = (newline = "\n", id = taskId) => `event: update${newline}data: ${JSON.stringify({ task: { id, status: "cancelled", title: "中文🙂" }, nextCursor: 1, entries: [{ id: "entry-1", cursor: 1, kind: "text", text: "Cancelled before execution." }] })}${newline}${newline}`;
function fixture() {
  const source = new PassThrough(), abort = new AbortController(), observer = new RecoverySseObserver(taskId);
  // Like the real proxy, transport owns flow and error handling independently of the witness.
  source.on("error", () => undefined); observer.attach(source, abort.signal);
  return { source, abort, observer, close() { observer.stop(); source.destroy(); } };
}

test("UTF-8 and CRLF may split at every byte; original frame identity remains intact", () => {
  const f = fixture();
  try {
    for (const byte of Buffer.from(frame("\r\n"))) f.source.emit("data", Buffer.from([byte]));
    f.observer.stop(); const seen = f.observer.snapshot();
    assert.equal(seen.error, null); assert.equal(seen.frames.length, 1); assert.equal(seen.frames[0]!.nextCursor, 1);
    assert.equal(seen.frames[0]!.entries[0]!.text, "Cancelled before execution.");
    assert.equal(seen.pendingBytesUpperBound, 0); assert.equal(seen.detached, true); assert.equal(f.source.listenerCount("data"), 0);
  } finally { f.close(); }
});

test("passive listener preserves piped bytes and backpressure without consuming another stream", async () => {
  const bytes = Buffer.from(frame()), source = Readable.from([bytes.subarray(0, 9), bytes.subarray(9)]), chunks: Buffer[] = [], paused: boolean[] = [];
  const target = new Writable({ highWaterMark: 1, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); setImmediate(() => { paused.push(source.isPaused()); done(); }); } });
  const observer = new RecoverySseObserver(taskId), abort = new AbortController();
  try {
    source.pipe(target); observer.attach(source, abort.signal);
    await once(target, "finish");
    assert.deepEqual(Buffer.concat(chunks), bytes); assert.ok(paused.some(Boolean)); assert.equal(observer.snapshot().error, null);
    assert.equal(observer.snapshot().stoppedBy, "end"); assert.equal(observer.snapshot().detached, true);
  } finally { observer.stop(); source.destroy(); target.destroy(); }
});

test("comments and LF/CR/mixed line endings remain bounded complete frames", () => {
  const f = fixture();
  try {
    f.source.emit("data", Buffer.from(": heartbeat\r\n\n")); f.source.emit("data", Buffer.from(frame("\r"))); f.source.emit("data", Buffer.from(frame()));
    f.observer.stop(); assert.equal(f.observer.snapshot().error, null);
    assert.equal(f.observer.snapshot().completeFrames, 3); assert.equal(f.observer.snapshot().frames.length, 2);
  } finally { f.close(); }
});

for (const [name, bytes] of [
  ["invalid UTF-8", Buffer.from([0xc0])],
  ["incomplete UTF-8", Buffer.from([0xf0, 0x9f])],
  ["incomplete frame", Buffer.from("data: {\"task\":")],
  ["invalid JSON", Buffer.from("data: nope\n\n")],
  ["wrong task", Buffer.from(frame("\n", "another-task"))],
  ["fifth frame", Buffer.from(frame().repeat(5))],
  ["input bound", Buffer.alloc(64 * 1024 + 1, 0x61)],
] as const) test(`${name} fails closed and removes only observer listeners`, () => {
  const f = fixture();
  try {
    f.source.emit("data", bytes); f.observer.stop();
    assert.ok(f.observer.snapshot().error); assert.equal(f.observer.snapshot().detached, true);
    assert.equal(f.source.listenerCount("data"), 0); assert.equal(f.source.listenerCount("error"), 1);
  } finally { f.close(); }
});

test("abort and a second connection cannot turn the original observation into success", () => {
  const f = fixture(), other = new PassThrough(); other.on("error", () => undefined);
  try {
    f.source.emit("data", Buffer.from(frame())); f.abort.abort();
    assert.equal(f.observer.snapshot().error, "SSE witness aborted"); assert.equal(f.observer.snapshot().detached, true);
    f.observer.attach(other, new AbortController().signal);
    assert.ok(f.observer.snapshot().error); assert.equal(other.listenerCount("data"), 0);
  } finally { f.close(); other.destroy(); }
});

test("natural close of a partial frame is not treated as a complete witness", async () => {
  const f = fixture();
  try {
    f.source.emit("data", Buffer.from("data: {")); const closed = once(f.source, "close"); f.source.destroy(); await closed;
    assert.equal(f.observer.snapshot().error, "SSE witness stopped with an incomplete frame");
    assert.equal(f.observer.snapshot().detached, true);
  } finally { f.close(); }
});
