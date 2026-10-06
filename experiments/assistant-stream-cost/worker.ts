import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool as PgPool } from 'pg';
import { installObserver, type RequestWork } from './observer.js';
import { buildScenario, PATCH_COUNTS } from './workload.js';

const dependency = createRequire(new URL('../../../../Flow/package.json', import.meta.url));
const { Pool, Client } = dependency('pg') as typeof import('pg');
const abort = new AbortController();
const checkpoint = (message: unknown) => new Promise<void>((resolve, reject) => {
  if (!process.send) { reject(new Error('Owned IPC channel missing')); return; }
  process.send(message as object, error => error ? reject(error) : resolve());
});
process.on('message', (message: any) => { if (message?.kind === 'stop') abort.abort(new Error('work budget ended')); });
process.once('message', async (input: any) => {
  if (input?.kind !== 'run') return;
  const result: any = { groups: [], checks: [], failure: null, cleanup: {}, httpRequests: 0, failedRequests: [] };
  let app: Awaited<ReturnType<typeof import('../../apps/server/src/index.js')['createServer']>> | undefined;
  let pool: PgPool | undefined;
  const measurement = installObserver(Client.prototype);
  let current: { work: RequestWork; id: string } | undefined;
  const deadline = input.workDeadlineEpochMs as number;
  let base = '';
  const ownerToken = randomUUID();
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  function remaining() { abort.signal.throwIfAborted(); const ms = deadline - Date.now(); assert(ms > 1600, 'Insufficient remaining work/query budget'); return ms; }
  async function http(path: string, body?: unknown, token = ownerToken, prefix?: string) {
    const timeout = Math.min(2000, remaining()); assert(++result.httpRequests <= 256, 'HTTP request cap');
    const work = prefix === undefined ? undefined : measurement.begin(prefix);
    const id = randomUUID(); if (work) current = { work, id };
    const payload = body === undefined ? undefined : JSON.stringify(body); const start = performance.now();
    try {
      const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(work ? { 'x-chat06p01-sample': id } : {}) }, body: payload, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(timeout)]) });
      const reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; assert(bytes <= 1048576, 'HTTP response cap'); chunks.push(part.value); } }
      finally { await reader.cancel(); reader.releaseLock(); }
      const text = Buffer.concat(chunks).toString('utf8'); const elapsedMs = performance.now() - start;
      assert(response.ok, `HTTP ${response.status} at ${path}`);
      return { status: response.status, body: JSON.parse(text), httpUtf8Bytes: bytes, inputJsonUtf8Bytes: payload ? Buffer.byteLength(payload) : 0, elapsedMs, work };
    } catch (error) { if (work) result.failedRequests.push({ path, work, elapsedMs: performance.now() - start }); throw error; }
    finally { if (work) { measurement.end(work); current = undefined; } }
  }
  async function query(text: string, values?: unknown[]) { remaining(); return pool!.query(text, values); }
  try {
    const scenarios = PATCH_COUNTS.map(buildScenario); // Hash setup before any observation window.
    const { createServer } = await import('../../apps/server/src/index.js');
    remaining();
    app = await createServer({ databaseUrl: input.databaseUrl, ownerToken, leaseMs: 300000, automaticQueueScan: false });
    app.addHook('onRequest', (request, _reply, done) => {
      const selected = current;
      if (selected && request.headers['x-chat06p01-sample'] === selected.id) measurement.within(selected.work, done); else done();
    });
    base = await app.listen({ host: '127.0.0.1', port: 0 });
    pool = new Pool({ connectionString: input.databaseUrl, max: 1, application_name: 'chat06p01-observer', connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 });
    pool.on('error', error => { result.failure ??= `observer idle error ${error.name}`; abort.abort(new Error('observer idle connection failed')); });
    for (const scenario of scenarios) {
      const group: any = { patchCount: scenario.patchCount, inputUtf8Bytes: scenario.inputUtf8Bytes, contentDigest: scenario.contentDigest, sourcePrediction: scenario.sourcePrediction, samples: [], persisted: null, publicPatches: [] };
      result.groups.push(group);
      const runner = (await http('/api/runners', { name: 'CHAT06P01 no-execution fixture', harnesses: ['claude'], capacity: 1 })).body;
      const accepted = (await http('/api/tasks', { title: 'Fixed Unicode stream', prompt: 'Synthetic stream, no provider', harness: 'claude' })).body;
      group.taskId = accepted.task.id;
      await checkpoint({ kind: 'task', taskId: group.taskId });
      let assignment: any;
      for (let attempt = 0; attempt < 10; attempt++) { assignment = (await http('/api/runner/claim', {}, runner.token)).body.assignment; if (assignment) break; await delay(100, undefined, { signal: abort.signal }); }
      assert(assignment && assignment.task.id === group.taskId, 'Expected real claim for the submitted task');
      group.attemptId = assignment.attempt.id; group.nativeSessionId = randomUUID();
      await checkpoint({ kind: 'claim', taskId: group.taskId, attemptId: group.attemptId });
      const ownership = { attemptId: group.attemptId, ownerVersion: assignment.attempt.ownerVersion };
      await http('/api/runner/events', { ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: group.nativeSessionId, adapterVersion: 'claude-sdk-0.3.290-v2' }] }, runner.token);
      const nativeMessageId = randomUUID(); const streamId = hash(JSON.stringify([group.nativeSessionId, nativeMessageId, 0])); group.streamId = streamId;
      for (const patch of scenario.patches) {
        const event = { type: 'assistant-stream', id: randomUUID(), sequence: patch.revision + 1, streamId, nativeSessionId: group.nativeSessionId, nativeMessageId, parentToolUseId: null, source: 'claude.sdk.stream', sourceMessageId: randomUUID(), blockIndex: 0, ...patch, reason: null, truncated: false };
        const prefix = scenario.text.slice(0, patch.revision * (scenario.text.length / scenario.patchCount));
        const response = await http('/api/runner/events', { ...ownership, events: [event] }, runner.token, prefix);
        const sample = { revision: patch.revision, fromBytes: patch.fromBytes, addedUtf8Bytes: Buffer.byteLength(patch.text), prefixUtf8Bytes: Buffer.byteLength(prefix), ...response }; group.samples.push(sample);
        await checkpoint({ kind: 'sample', taskId: group.taskId, patchCount: scenario.patchCount, sample }); // Outside the measured HTTP interval.
        const work = response.work!;
        assert.deepEqual(work.instrumentationErrors, []); assert(work.sql.every(row => row.succeeded)); assert(work.backgroundSql.every(row => row.succeeded));
        assert.equal(work.sql.filter(row => row.kind === 'prefix-read').length, 1);
        assert.equal(work.sql.filter(row => row.kind === 'prefix-read').reduce((n, row) => n + row.prefixContentUtf8Bytes, 0), patch.fromBytes);
        const hashes = work.hashes.filter(row => row.kind === 'expected-prefix'); assert.equal(hashes.length, 1); assert.equal(hashes[0]!.inputUtf8Bytes, Buffer.byteLength(prefix));
        assert.equal(work.sql.filter(row => row.kind === 'commit').length, 1);
        assert.equal(response.body.accepted, 1); assert.equal(response.body.lastSequence, event.sequence);
      }
      let after = 0; let rebuilt = ''; let pages = 0;
      do {
        const page = (await http(`/api/tasks/${group.taskId}/assistant-stream/patches?attemptId=${group.attemptId}&after=${after}&limit=8`)).body;
        assert(++pages <= 8); assert(page.patches.length <= 8);
        for (const patch of page.patches) { assert.equal(patch.fromBytes, Buffer.byteLength(rebuilt)); rebuilt += patch.text; assert.equal(hash(rebuilt), patch.prefixDigest); }
        group.publicPatches.push(page); after = page.nextCursor; if (!page.hasMore) break;
      } while (true);
      assert.equal(rebuilt, scenario.text);
      const block = (await http(`/api/tasks/${group.taskId}/assistant-stream/${streamId}`)).body; assert.equal(block.content, scenario.text); assert.equal(block.phase, 'block-complete');
      group.persisted = (await query("SELECT count(*)::int AS patches,sum(octet_length(data->>'text'))::int AS text_bytes,sum(octet_length(data::text))::int AS patch_json_bytes FROM flow.assistant_stream_patches WHERE attempt_id=$1", [group.attemptId])).rows[0];
      assert.equal(group.persisted.patches, scenario.patchCount); assert.equal(group.persisted.text_bytes, scenario.inputUtf8Bytes);
      group.blocks = (await query('SELECT id,revision,bytes FROM flow.assistant_stream_blocks WHERE attempt_id=$1', [group.attemptId])).rows;
      assert.deepEqual(group.blocks, [{ id: streamId, revision: scenario.patchCount, bytes: scenario.inputUtf8Bytes }]);
      await http('/api/runner/events', { ...ownership, events: [{ id: randomUUID(), sequence: scenario.patchCount + 2, type: 'completed', outcome: 'cancelled' }] }, runner.token);
      group.finalTask = (await http(`/api/tasks/${group.taskId}`)).body; assert.equal(group.finalTask.status, 'cancelled');
      result.checks.push(`N=${scenario.patchCount}: exact public prefix/digest/offset/bytes, storage and cancelled attempt verified`);
    }
    result.storage = (await query("SELECT pg_database_size(current_database())::float8 AS database_bytes,pg_total_relation_size('flow.assistant_stream_patches')::float8 AS patches_relation_bytes,pg_total_relation_size('flow.assistant_stream_blocks')::float8 AS blocks_relation_bytes")).rows[0];
    result.counts = (await query('SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.attempts) AS attempts,(SELECT count(*)::int FROM flow.sessions) AS sessions')).rows[0];
    assert.deepEqual(result.counts, { tasks: 3, attempts: 3, sessions: 3 });
  } catch (error) { result.failure = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '<redacted>') : 'unknown worker failure'; }
  finally {
    try { if (app) { await app.close(); result.cleanup.appClosed = true; } }
    catch (error) { result.cleanup.appCloseError = error instanceof Error ? error.name : 'unknown'; result.failure ??= 'app close failed'; }
    finally {
      try { if (pool) await pool.end(); result.cleanup.poolClosed = true; }
      catch (error) { result.cleanup.poolCloseError = error instanceof Error ? error.name : 'unknown'; result.failure ??= 'observer pool close failed'; }
      finally { measurement.restore(); result.cleanup.observerRestored = true; }
    }
  }
  process.send?.({ kind: 'result', result }, error => { process.exitCode = error || result.failure ? 1 : 0; process.disconnect?.(); });
});
