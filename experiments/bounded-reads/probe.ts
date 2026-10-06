import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, open } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { createServer } from '../../apps/server/src/index.js';
import type { EventPage, TaskSnapshot, WorkspacePage, ClaimedTask, RunnerRegistration } from '../../packages/contracts/src/index.js';
import { MAX_BATCH_BYTES, MAX_DETAIL_BYTES } from '../../packages/contracts/src/index.js';
import { compareCandidate } from './candidate.js';
import { distribution, captureProjectionQueries } from './measurements.js';
import { DETAIL_MARKER, DETAIL_TEXT, PROMPT_TEXT, seedHistory } from './fixture.js';

const started = performance.now();
const output = new URL(process.argv[2] ?? '../../docs/evidence/b01/results.json', import.meta.url);
const compareExperimentalCandidate = process.env.FLOW_B01_COMPARE_CANDIDATE === '1';
const maxBytes = 96 * 1024 * 1024;
const signal = AbortSignal.timeout(110_000);
const adminUrl = new URL(process.env.FLOW_B01_ADMIN_URL ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres');
assert.equal(adminUrl.hostname, '127.0.0.1', 'Only the authorized local development PG is allowed');
assert.equal(adminUrl.port, '55432');
assert.equal(adminUrl.pathname, '/postgres');
assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Run with Node24');
const admin = new Pool({ connectionString: adminUrl.href, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
const projection = captureProjectionQueries();
const ownerToken = randomUUID();
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let pool: Pool | undefined;
let database: string | undefined;
let origin = '';
let transferredBytes = 0;
let requestBodyBytes = 0;
let detailRequests = 0;
let checkCount = 0;
let reserved = false;
const cleanupErrors: string[] = [];
const scenarios: Record<string, unknown>[] = [];
const resources: { database: string; port?: number; dropped: boolean }[] = [];
const checks: { label: string; result: 'passed' }[] = [];
const evidence: Record<string, unknown> = {
  status: 'started', startedAt: new Date().toISOString(),
  baseCommit: 'edee6b1c5d74c2ee46ec98bab2844579db6a00c4',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version, loadAverageStart: loadavg(), modelCalls: 0, cloudResources: 0, userFiles: 0,
  limits: { elapsedMs: 120000, responseBytes: maxBytes, tasksPerScenario: 128, timelineRowsPerScenario: 16384 },
  method: { consumer: 'sequential HTTP API consumer; no browser or UI evidence', warmSamples: 50,
    cold: 'Snapshot/events initial requests are after seed; workspaceFirstRequest is before catchup. workspaceSteady is already warm. PG/OS caches NOT flushed.',
    percentiles: 'nearest rank; n=50 p99 equals maximum, not a stable tail estimate',
    latency: 'HTTP request to completed response body; JSON.parse excluded',
    candidateComparison: compareExperimentalCandidate,
    bytes: 'UTF-8 uncompressed HTTP response body only; excludes headers/TCP/TLS',
    seededHistory: 'SQL bulk synthetic completed records, bypassing write ingress; HTTP ingress limits checked separately',
    agentCapacity: 'Not measured; 1/16/128 are stored task counts, never executing agents' }, scenarios, checks, cleanupErrors, resources,
};

const hardStop = setTimeout(() => {
  evidence.status = 'failed'; evidence.failure = '120-second hard limit; cleanup unconfirmed';
  if (reserved) writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  process.exit(1);
}, 120000);

function check(label: string, test: () => void) {
  test(); checkCount++; checks.push({ label, result: 'passed' });
}

async function request<T>(path: string, body?: unknown, token: string = ownerToken, expectedStatus = 200) {
  signal.throwIfAborted();
  if (path.startsWith('/api/details/')) detailRequests++;
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  requestBodyBytes += serialized === undefined ? 0 : Buffer.byteLength(serialized);
  const before = performance.now();
  const response = await fetch(origin + path, { method: serialized === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, ...(serialized === undefined ? {} : { 'content-type': 'application/json', 'idempotency-key': randomUUID() }) },
    body: serialized, signal });
  const bytes = Buffer.from(await response.arrayBuffer());
  const elapsedMs = performance.now() - before;
  transferredBytes += bytes.length;
  assert(transferredBytes <= maxBytes, 'Response data budget exceeded');
  assert.equal(response.status, expectedStatus, `Unexpected HTTP status for ${path}`);
  return { body: JSON.parse(bytes.toString('utf8')) as T, bytes: bytes.length, elapsedMs, raw: bytes.toString('utf8') };
}

async function startScenario(label: string) {
  const databaseName = `flow_b01_${process.pid}_${label}`;
  assert(/^flow_b01_[0-9]+_[a-z0-9_]+$/.test(databaseName));
  await admin.query(`CREATE DATABASE ${databaseName}`);
  database = databaseName;
  const resource: typeof resources[number] = { database, dropped: false }; resources.push(resource);
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = `/${database}`;
  pool = new Pool({ connectionString: databaseUrl.href, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  server = await createServer({ databaseUrl: databaseUrl.href, ownerToken, leaseMs: 300000 });
  origin = await server.listen({ host: '127.0.0.1', port: 0 });
  resource.port = Number(new URL(origin).port);
  return { database, port: resource.port };
}

async function cleanupScenario() {
  if (server) { await server.close(); server = undefined; }
  if (pool) { await pool.end(); pool = undefined; }
  if (database) { await admin.query(`DROP DATABASE ${database}`); resources.find(resource => resource.database === database)!.dropped = true; database = undefined; }
}

async function measureEndpoint(path: string, phase = 'first-after-seed') {
  const first = await request(path);
  const milliseconds: number[] = [];
  const bytes: number[] = [];
  for (let sample = 0; sample < 50; sample++) {
    const result = await request(path); milliseconds.push(result.elapsedMs); bytes.push(result.bytes);
  }
  return { path, phase, firstRequest: { elapsedMs: first.elapsedMs, bytes: first.bytes }, warm: distribution(milliseconds), milliseconds, bytes };
}

async function verifyLayering(eventsPerTask: number) {
  const before = detailRequests;
  const snapshot = await request<TaskSnapshot>('/api/tasks/b01-task-1');
  const events = await request<EventPage>('/api/tasks/b01-task-1/events?after=0&limit=100');
  const workspace = await request<WorkspacePage>('/api/workspace?after=0&limit=100');
  check('snapshot/event/workspace separate detail content; API consumer has zero unopened detail requests', () => {
    for (const result of [snapshot, events, workspace]) assert(!result.raw.includes(DETAIL_MARKER));
    assert.equal(snapshot.body.prompt, PROMPT_TEXT); assert(!workspace.raw.includes(PROMPT_TEXT));
    assert.equal(detailRequests - before, 0);
    assert.equal(snapshot.body.entries.length, Math.min(eventsPerTask, 100));
    assert.equal(events.body.entries.length, Math.min(eventsPerTask, 100));
    assert(workspace.body.entries.length <= 100);
    for (const entry of snapshot.body.entries) if (entry.kind === 'reference') assert.deepEqual(Object.keys(entry.reference).sort(), ['id', 'title']);
  });
  const detail = await request<{ content: string }>('/api/details/b01-detail-1');
  check('explicit detail expansion makes exactly one request with intact UTF-8 content', () => {
    assert.equal(detailRequests - before, 1); assert.equal(detail.body.content, DETAIL_TEXT);
    assert(Buffer.byteLength(DETAIL_TEXT) > DETAIL_TEXT.length);
  });
  return { evidenceKind: 'API consumer', unopenedDetailRequests: 0, expandedDetailRequests: 1,
    bytes: { snapshot: snapshot.bytes, events: events.bytes, workspace: workspace.bytes, detail: detail.bytes },
    detailContentUtf8Bytes: Buffer.byteLength(DETAIL_TEXT), detailContentUtf16Units: DETAIL_TEXT.length };
}

async function drainWorkspace(expected: number) {
  let cursor = 0; let pending = true; let pages = 0; let entries = 0; let maximumPage = 0;
  const seen = new Set<string>(); const milliseconds: number[] = [];
  while (pending) {
    assert(pages < 400, 'Workspace drain page bound exceeded');
    const result = await request<WorkspacePage>(`/api/workspace?after=${cursor}&limit=100`);
    milliseconds.push(result.elapsedMs); pages++; maximumPage = Math.max(maximumPage, result.body.entries.length);
    for (const item of result.body.entries) { assert(!seen.has(item.id)); assert(item.cursor > cursor); seen.add(item.id); cursor = item.cursor; entries++; }
    pending = result.body.hasMore || result.body.projectionPending;
  }
  check('workspace drains all synthetic history without duplicate entries and with at most 100 per page', () => {
    assert.equal(entries, expected); assert(maximumPage <= 100);
  });
  return { pages, entries, maximumPage, cursor, milliseconds, latency: distribution(milliseconds) };
}

async function drainEvents(expected: number) {
  let cursor = 0; let pages = 0; let entries = 0; let hasMore = true;
  while (hasMore) {
    assert(pages < 200, 'Events drain page bound exceeded');
    const page = (await request<EventPage>(`/api/tasks/b01-task-1/events?after=${cursor}&limit=100`)).body;
    assert(page.entries.length <= 100); assert.equal(page.watermark, expected);
    for (const entry of page.entries) { assert.equal(entry.cursor, cursor + 1); cursor = entry.cursor; entries++; }
    assert.equal(page.nextCursor, cursor); hasMore = page.hasMore; pages++;
  }
  check('events drains complete ordered task history without gaps/duplicates', () => assert.equal(entries, expected));
  return { pages, entries, cursor };
}

async function projectionPlans() {
  await pool!.query('ANALYZE flow.workspace_feed');
  const plans = [];
  for (const query of projection.queries.values()) {
    await pool!.query('BEGIN');
    try {
      const result = await pool!.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.text}`, query.values);
      plans.push({ query: query.text, values: query.values, plan: result.rows[0]['QUERY PLAN'][0] });
    } finally { await pool!.query('ROLLBACK'); }
  }
  return plans;
}

async function runReadScenario(tasks: number, eventsPerTask: number) {
  const resource = await startScenario(`t${tasks}_e${eventsPerTask}`);
  const record: Record<string, unknown> = { tasks, eventsPerTask, timelineRows: tasks * eventsPerTask, ...resource };
  scenarios.push(record);
  await seedHistory(pool!, tasks, eventsPerTask);
  // Measure first read before any layering/drain checks have warmed this endpoint.
  record.snapshot = await measureEndpoint('/api/tasks/b01-task-1');
  record.events = await measureEndpoint('/api/tasks/b01-task-1/events?after=0&limit=100');
  record.workspaceFirstRequest = await request<WorkspacePage>('/api/workspace?after=0&limit=100').then(result => ({ elapsedMs: result.elapsedMs, bytes: result.bytes, returned: result.body.entries.length, projectionPending: result.body.projectionPending }));
  const baselineInsert = [...projection.queries.keys()].find(sql => sql.includes('SELECT tl.task_id'));
  assert(baselineInsert, 'Must capture the real projection update query');
  if (compareExperimentalCandidate) {
    record.candidateBacklog = await compareCandidate(pool!, baselineInsert);
    check('candidate SQL preserves baseline backlog batch', () => {});
  }
  record.catchup = await drainWorkspace(tasks * (eventsPerTask + 1));
  const watermark = (record.catchup as { cursor: number }).cursor;
  record.workspaceSteady = await measureEndpoint(`/api/workspace?after=${watermark}&limit=100`, 'after-catchup-already-warm');
  record.layering = await verifyLayering(eventsPerTask);
  record.eventPagination = await drainEvents(eventsPerTask);
  record.projectionPlansAfterCatchup = await projectionPlans();
  if (compareExperimentalCandidate) {
    record.candidateConverged = await compareCandidate(pool!, baselineInsert);
    check('candidate SQL preserves empty converged batch', () => {});
  }
  record.storage = (await pool!.query(`SELECT pg_database_size(current_database())::text database_bytes,
    pg_total_relation_size('flow.timeline')::text timeline_bytes,pg_total_relation_size('flow.workspace_feed')::text workspace_bytes`)).rows[0];
  await cleanupScenario(); record.cleanedUp = true;
}

async function runIngressBounds() {
  const resource = await startScenario('bounds');
  const task = await request<{ task: { id: string } }>('/api/tasks', { title: 'B01 ingress boundary', prompt: 'Synthetic boundary check', harness: 'fixture' }, ownerToken, 202);
  const runner = await request<RunnerRegistration>('/api/runners', { name: 'B01 synthetic events', harnesses: ['fixture'], capacity: 1 });
  let assignment: ClaimedTask | null = null;
  for (let attempt = 0; attempt < 30 && !assignment; attempt++) {
    assignment = (await request<{ assignment: ClaimedTask | null }>('/api/runner/claim', {}, runner.body.token)).body.assignment;
    if (!assignment) await sleep(100, undefined, { signal });
  }
  assert(assignment, 'No assignment after three seconds');
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const message = (sequence: number) => ({ id: `b01-message-${sequence}`, sequence, type: 'message', text: '文'.repeat(4000) });
  const batch = { ...ownership, events: Array.from({ length: 50 }, (_, index) => message(index + 1)) };
  const accepted = await request<{ accepted: number }>('/api/runner/events', batch, runner.body.token);
  check('50-event batch with 4000-unit CJK messages accepted', () => assert.equal(accepted.body.accepted, 50));
  await request('/api/runner/events', { ...ownership, events: Array.from({ length: 51 }, (_, index) => message(index + 51)) }, runner.body.token, 400);
  check('51-event batch rejected', () => {});
  const detailEvent = (sequence: number, content: string) => ({ id: `b01-bound-detail-${sequence}`, sequence, type: 'detail', title: '边界', content, mediaType: 'text/plain' });
  const exactContent = '文'.repeat(Math.floor(MAX_DETAIL_BYTES / 3)) + 'x'.repeat(MAX_DETAIL_BYTES % 3);
  const exact = await request<{ accepted: number }>('/api/runner/events', { ...ownership, events: [detailEvent(51, exactContent)] }, runner.body.token);
  check('exact 1 MiB detail accepted by UTF-8 bytes', () => { assert.equal(Buffer.byteLength(exactContent), MAX_DETAIL_BYTES); assert.equal(exact.body.accepted, 1); });
  await request('/api/runner/events', { ...ownership, events: [detailEvent(52, exactContent + 'x')] }, runner.body.token, 400);
  check('1 MiB plus one UTF-8 byte detail rejected', () => {});
  await request('/api/runner/events', { ...ownership, events: [detailEvent(52, exactContent), detailEvent(53, exactContent)] }, runner.body.token, 413);
  check('batch above 2 MiB rejected by HTTP body limit', () => {});
  await request(`/api/tasks/${task.body.task.id}/events?limit=101`, undefined, ownerToken, 400);
  await request('/api/workspace?limit=101', undefined, ownerToken, 400);
  check('events/workspace limit=101 rejected', () => {});
  const largePage = await request<EventPage>(`/api/tasks/${task.body.task.id}/events?limit=100`);
  check('valid large CJK text remains inline; detail content is only a reference', () => {
    assert.equal(largePage.body.entries.length, 51);
    assert.equal(largePage.body.entries[0]!.kind, 'text');
    assert(!largePage.raw.includes(exactContent));
    assert.equal(largePage.body.entries[50]!.kind, 'reference');
  });
  const result = { ...resource, acceptedBatchBytes: Buffer.byteLength(JSON.stringify(batch)), exactDetailUtf8Bytes: Buffer.byteLength(exactContent),
    detailMaxBytes: MAX_DETAIL_BYTES, batchMaxBytes: MAX_BATCH_BYTES, messageUtf16Units: 4000, messageUtf8Bytes: 12000,
    largeEventsPageBytes: largePage.bytes, largeEventsPageEntries: largePage.body.entries.length };
  await cleanupScenario(); return { ...result, cleanedUp: true };
}

try {
  const file = await open(output, 'wx'); await file.close(); reserved = true;
  evidence.sourceFiles = Object.fromEntries(await Promise.all(['probe.ts', 'fixture.ts', 'measurements.ts', 'candidate.ts', '../../apps/server/src/m2-workspace.ts', '../../apps/server/src/index.ts', '../../packages/contracts/src/runner.ts'].map(async file => [file, createHash('sha256').update(await readFile(new URL(file, import.meta.url))).digest('hex')])));
  evidence.postgresVersion = (await admin.query('SHOW server_version')).rows[0]?.server_version;
  for (const [tasks, events] of [[1, 128], [16, 128], [128, 128], [1, 16384]]) await runReadScenario(tasks!, events!);
  evidence.ingressBounds = await runIngressBounds();
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'failed';
  evidence.failure = error instanceof assert.AssertionError ? error.message : `Operation failed (${error instanceof Error ? error.name : 'unknown'}); no credentials logged`;
  process.exitCode = 1;
} finally {
  try { await cleanupScenario(); } catch { cleanupErrors.push('scenario resources; must inspect own DB/process'); process.exitCode = 1; }
  try { await admin.end(); } catch { cleanupErrors.push('admin pool'); process.exitCode = 1; }
  projection.restore(); clearTimeout(hardStop);
  evidence.endedAt = new Date().toISOString();
  evidence.elapsedMs = performance.now() - started;
  evidence.responseBytes = transferredBytes; evidence.requestBodyBytes = requestBodyBytes; evidence.checkCount = checkCount;
  evidence.cleanup = { serverClosed: !server, poolClosed: !pool, databaseDropped: !database, errors: cleanupErrors };
  evidence.exitCode = process.exitCode ?? 0; evidence.loadAverageEnd = loadavg();
  if (cleanupErrors.length) evidence.status = 'failed';
  if (reserved) await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ status: evidence.status, elapsedMs: evidence.elapsedMs, responseBytes: transferredBytes, checkCount, exitCode: process.exitCode ?? 0, cleanupErrors }));
}
