import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createSession, compressSession, retrieveOriginals, encodeSession, decodeSession, resumeProjection, forkSession, hash } from './host.mjs';
import { storeOriginal, retrieveByRef } from './vendor/acp-kernel-0.0.101/dist/index.js';

const [mode, file, countArg, repetitionArg] = process.argv.slice(2);
const count = Number(countArg); const repetition = Number(repetitionArg);
assert.ok([1, 10, 100].includes(count)); assert.ok(Number.isInteger(repetition) && repetition >= 0 && repetition < 20);
const metrics = {};
async function measure(name, action) {
  const started = performance.now(); const cpu = process.cpuUsage(); const rssBeforeBytes = process.memoryUsage().rss;
  const value = await action(); const used = process.cpuUsage(cpu);
  metrics[name] = { wallMs: performance.now() - started, cpuUserMs: used.user / 1000, cpuSystemMs: used.system / 1000,
    rssBeforeBytes, rssAfterBytes: process.memoryUsage().rss };
  return value;
}
const sessionId = index => `sample-${count}-${repetition}-${index}`;
let result;
if (mode === 'prepare') {
  const originals = await measure('create', () => Array.from({ length: count }, (_, index) => createSession(sessionId(index))));
  const sessions = await measure('compressAndStore', () => originals.map(compressSession));
  const retrieved = await measure('retrieve', () => sessions.map(retrieveOriginals));
  const text = await measure('serializeAndWrite', async () => {
    const serialized = JSON.stringify(sessions.map(encodeSession));
    await writeFile(file, serialized, { flag: 'wx', mode: 0o600 }); return serialized;
  });
  result = { rawBytes: sessions.reduce((sum, session) => sum + session.rawBytes, 0),
    visibleBytes: sessions.reduce((sum, session) => sum + session.visibleBytes, 0), serializedBytes: Buffer.byteLength(text),
    retrievedBytes: retrieved.reduce((sum, item) => sum + item.bytes, 0), originalDigest: hash(JSON.stringify(sessions.map(session => session.rawDigest))),
    snapshotDigest: hash(text), verifiedRefs: retrieved.reduce((sum, item) => sum + item.verified, 0),
    warnings: sessions.flatMap(session => session.compressionWarnings) };
} else if (mode === 'restart') {
  const sessions = await measure('readDeserializeAndValidate', async () => {
    const text = await readFile(file, 'utf8'); const items = JSON.parse(text);
    assert.equal(items.length, count);
    return items.map((item, index) => decodeSession(item, { sessionId: sessionId(index), revision: 1 }));
  });
  await measure('resumeProjection', () => sessions.forEach(resumeProjection));
  await measure('forkAndVerifyIsolation', () => {
    for (const parent of sessions) {
      const before = encodeSession(parent);
      const child = forkSession(parent, `${parent.sessionId}-fork`);
      retrieveOriginals(child);
      child.state.blocks[0].summary = 'fork-only changed summary';
      child.contentStore = storeOriginal(child.contentStore, { ref: 'm90001', rawId: 'fork-only', text: child.sessionId,
        kind: 'synthetic', tokens: 1, head: 'fork-only' });
      assert.equal(retrieveByRef(child.contentStore, 'm90001').text, child.sessionId);
      assert.equal(retrieveByRef(parent.contentStore, 'm90001').ok, false);
      assert.equal(encodeSession(parent), before); assert.equal(child.parentSessionId, parent.sessionId);
    }
    if (sessions.length > 1) assert.notEqual(sessions[0].expected[0].hash, sessions[1].expected[0].hash);
  });
  result = { verifiedRefs: sessions.reduce((sum, session) => sum + retrieveOriginals(session).verified, 0),
    originalDigest: hash(JSON.stringify(sessions.map(session => session.rawDigest))), forks: sessions.length };
} else throw new Error('Unknown probe mode');
process.stdout.write(JSON.stringify({ mode, pid: process.pid, metrics, peakRssBytes: process.resourceUsage().maxRSS * 1024, ...result }));
