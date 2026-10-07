import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { open, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { browserSessionReadySchema, browserSessionReadSchema } from '../../../../packages/contracts/src/browser-session.js';
import { createServer } from '../index.js';
import { sha256 } from '../database.js';
import { createBrowserSessionAuthentication, migrateBrowserSessions } from './index.js';
import { createBrowserSessionFixture } from './fixture.js';

const ownerToken = 'connection01-synthetic-owner';
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1, connectionTimeoutMillis: 1000, statement_timeout: 5000, query_timeout: 6000 });
const databases: { name: string; marker: string; pool: Pool; url: string; removed: boolean }[] = [];
const fixtures: Awaited<ReturnType<typeof createBrowserSessionFixture>>[] = [];
const facts = { providerCalls: 0, productionMount: false, samples: [] as Record<string, unknown>[], databases: [] as Record<string, unknown>[] };
let pool: Pool;
async function ownershipEvidence(name: string, value: unknown) {
  const directory = process.env.FLOW_CONNECTION01_RUN_DIRECTORY;
  if (!directory) return;
  const file = await open(join(directory, name + '.json'), 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
}
async function database() {
  const name = `flow_connection01_${randomUUID().replaceAll('-', '')}`, marker = randomUUID(), url = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
  expect((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount).toBe(0);
  await ownershipEvidence(name + '-allocated', { name, marker, created: false });
  await admin.query(`CREATE DATABASE ${name}`);
  const owned = new Pool({ connectionString: url, max: 6, connectionTimeoutMillis: 1000, statement_timeout: 5000, query_timeout: 6000 });
  const record = { name, marker, pool: owned, url, removed: false }; databases.push(record);
  await owned.query('CREATE TABLE public.connection_test_owner (marker text PRIMARY KEY)'); await owned.query('INSERT INTO public.connection_test_owner VALUES($1)', [marker]);
  await ownershipEvidence(name + '-created', { name, marker, oid: (await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [name])).rows[0].oid });
  const baseline = await createServer({ databaseUrl: url, ownerToken, automaticQueueScan: false }); await baseline.close();
  const legacyId = randomUUID();
  await owned.query('INSERT INTO flow.tasks(id,submission) VALUES($1,$2)', [legacyId, JSON.stringify({ title: 'Pre-028 preserved', prompt: 'Synthetic existing row', harness: 'fixture' })]);
  const oldRow = (await owned.query('SELECT * FROM flow.tasks WHERE id=$1', [legacyId])).rows[0];
  await migrateBrowserSessions(owned); await migrateBrowserSessions(owned);
  expect((await owned.query('SELECT * FROM flow.tasks WHERE id=$1', [legacyId])).rows[0]).toEqual(oldRow);
  expect((await owned.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(r => r.version)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  return record;
}
beforeAll(async () => { pool = (await database()).pool; });
beforeEach(async () => { await pool.query('DELETE FROM flow.browser_sessions'); });
afterEach(async () => { for (const f of fixtures.splice(0).reverse()) await f.close(); });
afterAll(async () => {
  try {
    for (const d of databases) {
      expect((await d.pool.query('SELECT marker FROM public.connection_test_owner')).rows).toEqual([{ marker: d.marker }]);
      await d.pool.end();
      const connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [d.name])).rows;
      await ownershipEvidence(d.name + '-before-drop', { name: d.name, markerVerified: true, connections });
      expect(connections).toEqual([]);
      await admin.query(`DROP DATABASE ${d.name}`);
      d.removed = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [d.name])).rowCount; expect(d.removed).toBe(true);
      await ownershipEvidence(d.name + '-removed', { name: d.name, removed: d.removed });
      facts.databases.push({ database: d.name, identityVerified: true, removed: d.removed });
    }
  } finally { await admin.end(); if (process.env.FLOW_CONNECTION01_EVIDENCE) await writeFile(process.env.FLOW_CONNECTION01_EVIDENCE, JSON.stringify(facts, null, 2) + '\n'); }
});
async function fixture(options: Partial<Parameters<typeof createBrowserSessionFixture>[1]> = {}, storage = pool) {
  const f = await createBrowserSessionFixture(storage, { ownerToken, ...options }); fixtures.push(f); return f;
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function request(f: Fixture, path: string, options: { cookie?: string; token?: string; csrf?: string; origin?: string | null; method?: string; body?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(options.origin === null ? {} : { Origin: options.origin ?? f.browserOrigin }), ...options.headers };
  if (options.cookie) headers.Cookie = options.cookie; if (options.token !== undefined) headers.Authorization = `Bearer ${options.token}`; if (options.csrf) headers['X-Flow-CSRF'] = options.csrf;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(f.address + path, { method: options.method ?? 'GET', headers, body: options.body, signal: AbortSignal.timeout(5000) });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
function rawRequest(url: string, headers: Record<string, string>) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = httpRequest(url, { headers, agent: false }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode!, body })); response.on('error', reject);
    });
    request.setTimeout(3000, () => request.destroy(new Error('Owned HTTP request timed out.')));
    request.on('error', reject); request.end();
  });
}
async function bounded(promise: Promise<unknown>, stage: string) {
  let timer: NodeJS.Timeout | undefined;
  try { await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out: ' + stage)), 3000); })]); }
  finally { clearTimeout(timer); }
}
async function connect(f: Fixture) {
  const result = await request(f, '/api/browser-session/connect', { token: ownerToken, method: 'POST', body: '{}' }); expect(result.status).toBe(200);
  return { ...result, ready: browserSessionReadySchema.parse(result.body), cookie: result.headers.get('set-cookie')!.split(';')[0]! };
}
async function task() {
  const id = randomUUID(); await pool.query("INSERT INTO flow.tasks(id,submission,status) VALUES($1,$2,'running')", [id, JSON.stringify({ title: 'Observed fixture task', prompt: 'No model', harness: 'fixture' })]); return id;
}
async function stream(f: Fixture, id: string, cookie?: string, token?: string) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(`${f.address}/api/tasks/${id}/stream`, { headers: { Origin: f.browserOrigin, ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: controller.signal });
  expect(response.status).toBe(200); const reader = response.body!.getReader(), decoder = new TextDecoder();
  let buffered = ''; const page = async () => {
    for (;;) {
      const split = buffered.indexOf('\n\n'); if (split >= 0) { const frame = buffered.slice(0, split); buffered = buffered.slice(split + 2); return frame; }
      const next = await reader.read(); if (next.done) return null; buffered += decoder.decode(next.value, { stream: true });
    }
  };
  return { page, async close() { clearTimeout(timer); await reader.cancel(); controller.abort(); } };
}

it('keeps unconfigured sessions unsupported while the old bearer-only HTTP and stream consumers remain usable', async () => {
  const f = await fixture({ enabled: false });
  expect(browserSessionReadSchema.parse((await request(f, '/api/browser-session')).body).state).toBe('unsupported');
  expect((await request(f, '/api/browser-session/connect', { token: ownerToken, method: 'POST', body: '{}' })).status).toBe(503);
  expect((await request(f, '/api/protected', { origin: null })).status).toBe(401);
  expect((await request(f, '/api/protected', { origin: null, token: ownerToken })).status).toBe(200);
  const id = await task(), s = await stream(f, id, undefined, ownerToken);
  try { expect(await s.page()).toContain('running'); } finally { await s.close(); }
  expect((await pool.query('SELECT status FROM flow.tasks WHERE id=$1', [id])).rows[0].status).toBe('running');
});
it('persists random center/principal and the same absolute session across GET reload and process-factory restart', async () => {
  let f = await fixture(); const login = await connect(f), cookie = login.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Path=/'); expect(cookie).toContain('Max-Age=28800'); expect(cookie).toContain('SameSite=Strict'); expect(cookie).not.toContain('Domain=');
  const before = (await pool.query('SELECT * FROM flow.browser_sessions')).rows;
  const read = await request(f, '/api/browser-session', { cookie: login.cookie }); expect(read.body).toEqual(login.ready); expect(read.headers.get('set-cookie')).toBeNull(); expect(read.headers.get('cache-control')).toBe('no-store');
  expect((await pool.query('SELECT * FROM flow.browser_sessions')).rows).toEqual(before);
  expect(JSON.stringify(before)).not.toContain(login.cookie.split('=')[1]); expect(JSON.stringify(before)).not.toContain(ownerToken);
  const port = f.port; await f.close(); f = await fixture({ port });
  expect((await request(f, '/api/browser-session', { cookie: login.cookie })).body).toEqual(login.ready);
  facts.samples.push({ case: 'reload-restart', centerId: login.ready.centerId, principal: login.ready.ownerPrincipalId, expiresAt: login.ready.expiresAt, noReadRenewal: true, noPlaintextStored: true });
});
it.each(['token', 'epoch'] as const)('revokes old cookies on trusted startup %s rotation while keeping random principal identity', async kind => {
  const f = await fixture(), login = await connect(f);
  await createBrowserSessionAuthentication(pool, { ownerToken: kind === 'token' ? 'rotated-owner' : ownerToken,
    browserSession: { cookieOrigin: f.address, trustedOrigins: [f.address], authEpoch: kind === 'epoch' ? 'new-epoch' : 'fixture-epoch-1' } });
  expect((await request(f, '/api/protected', { cookie: login.cookie })).status).toBe(401);
  expect((await request(f, '/api/browser-session/connect', { token: ownerToken, method: 'POST', body: '{}' })).status).toBe(401);
  const identity = (await pool.query('SELECT center_id,owner_principal_id FROM flow.browser_identity')).rows[0]; expect(identity).toEqual({ center_id: login.ready.centerId, owner_principal_id: login.ready.ownerPrincipalId });
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.browser_sessions')).rows[0].n).toBe(0);
});
it('expires absolutely without read mutation and logout revokes only its session without cancelling task work', async () => {
  const f = await fixture(), login = await connect(f), other = await connect(f), id = await task();
  expect((await request(f, '/api/browser-session/logout', { cookie: login.cookie, csrf: login.ready.csrfToken, method: 'POST', body: '{}' })).status).toBe(200);
  expect((await request(f, '/api/protected', { cookie: login.cookie })).status).toBe(401);
  expect((await request(f, '/api/protected', { cookie: other.cookie })).status).toBe(200);
  await pool.query("UPDATE flow.browser_sessions SET created_at=now()-interval '9 hours',expires_at=now()-interval '1 hour'");
  const row = (await pool.query('SELECT * FROM flow.browser_sessions')).rows;
  expect((await request(f, '/api/browser-session', { cookie: other.cookie })).body.state).toBe('unauthenticated');
  expect((await pool.query('SELECT * FROM flow.browser_sessions')).rows).toEqual(row);
  expect((await pool.query('SELECT status FROM flow.tasks WHERE id=$1', [id])).rows[0].status).toBe('running');
});
it('keeps a newer connection when an older logout response arrives late', async () => {
  let entered!: () => void, release!: () => void;
  const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const f = await fixture({ async beforeLogoutResponse() { entered(); await gate; } });
  const old = await connect(f), id = await task(), s = await stream(f, id, old.cookie);
  let logout: Promise<Awaited<ReturnType<typeof request>>> | undefined;
  try {
    expect(await s.page()).toContain('running');
    logout = request(f, '/api/browser-session/logout', { cookie: old.cookie, csrf: old.ready.csrfToken, method: 'POST', body: '{}' });
    // Observe a possible rejection immediately, including if the gate wait fails.
    void logout.catch(() => undefined);
    await bounded(enteredPromise, 'revoked logout awaiting response');
    const current = await connect(f);
    expect(current.cookie.split('=')[0]).toBe(old.cookie.split('=')[0]);
    expect(current.cookie).not.toBe(old.cookie);
    release();
    const late = await logout;
    expect(late.status).toBe(200);
    expect(late.body.state).toBe('unauthenticated');
    expect(late.headers.get('set-cookie')).toBeNull();
    expect((await request(f, '/api/browser-session', { cookie: current.cookie })).body).toEqual(current.ready);
    expect((await request(f, '/api/protected', { cookie: current.cookie, csrf: current.ready.csrfToken, method: 'POST', body: '{}' })).status).toBe(200);
    expect((await request(f, '/api/browser-session', { cookie: old.cookie })).body.state).toBe('unauthenticated');
    expect((await request(f, '/api/protected', { cookie: old.cookie, csrf: old.ready.csrfToken, method: 'POST', body: '{}' })).status).toBe(401);
    expect(await s.page()).toBeNull();
    expect((await pool.query('SELECT status FROM flow.tasks WHERE id=$1', [id])).rows[0].status).toBe('running');
    facts.samples.push({ case: 'late-logout-response', deletesCookie: false, newerSessionValid: true, oldSessionUnauthorized: true, oldStreamClosed: true, taskStatus: 'running' });
  } finally {
    release();
    await logout?.catch(() => undefined);
    await s.close();
  }
});
it.each(['wrong', '', 'Basic secret'])('never falls back to a valid cookie from invalid explicit authorization %s', async invalid => {
  const f = await fixture(), login = await connect(f);
  const headers = { Authorization: invalid === 'wrong' ? 'Bearer wrong' : invalid };
  expect((await request(f, '/api/browser-session', { cookie: login.cookie, headers })).status).toBe(401);
  expect((await request(f, '/api/protected', { cookie: login.cookie, headers })).status).toBe(401);
});
it('preserves runner bearer authority and denies owner cookies access to runner endpoints', async () => {
  const f = await fixture(), login = await connect(f), id = randomUUID(), token = randomUUID();
  await pool.query('INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES($1,$2,$3,$4,1)', [id, 'Connection fixture', sha256(token), ['fixture']]);
  expect((await request(f, '/api/runner/protected', { token, origin: null })).body).toEqual({ runnerId: id });
  expect((await request(f, '/api/protected', { token, cookie: login.cookie })).status).toBe(403);
  expect((await request(f, '/api/runner/protected', { cookie: login.cookie })).status).toBe(403);
  expect((await request(f, '/api/browser-session/connect', { token, method: 'POST', body: '{}' })).status).toBe(403);
  await pool.query('UPDATE flow.runners SET revoked=true WHERE id=$1', [id]); expect((await request(f, '/api/runner/protected', { token })).status).toBe(401);
});
it('requires exact trusted Origin and CSRF on cookie writes, allowing only same-origin safe browser reads without Origin', async () => {
  const f = await fixture({ browserOrigin: 'http://127.0.0.1:54321' }), login = await connect(f);
  expect((await request(f, '/api/protected', { cookie: login.cookie, origin: 'http://127.0.0.1:54322' })).status).toBe(403);
  expect((await request(f, '/api/protected', { cookie: login.cookie, origin: 'null' })).status).toBe(403);
  expect((await request(f, '/api/protected', { cookie: login.cookie, origin: null })).status).toBe(403);
  expect((await request(f, '/api/protected', { cookie: login.cookie, origin: null, headers: { 'Sec-Fetch-Site': 'same-origin' } })).status).toBe(200);
  expect((await request(f, '/api/protected', { cookie: login.cookie, origin: null, headers: { 'Sec-Fetch-Site': 'same-site' } })).status).toBe(403);
  for (const csrf of [undefined, 'wrong']) expect((await request(f, '/api/protected', { cookie: login.cookie, csrf, method: 'POST', body: '{}' })).status).toBe(403);
  expect((await request(f, '/api/protected', { cookie: login.cookie, csrf: login.ready.csrfToken, method: 'POST', body: '{}' })).status).toBe(200); expect(f.writes()).toBe(1);
  expect((await request(f, '/api/browser-session/connect', { token: ownerToken, origin: 'https://untrusted.invalid', method: 'POST', body: '{}' })).status).toBe(403);
  const preflight = await fetch(f.address + '/api/protected', { method: 'OPTIONS', headers: { Origin: f.browserOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'X-Flow-CSRF,Content-Type' } });
  expect(preflight.headers.get('access-control-allow-origin')).toBe(f.browserOrigin); expect(preflight.headers.get('access-control-allow-credentials')).toBe('true');
  expect(preflight.headers.get('access-control-allow-headers')).toContain('X-Flow-CSRF');
  const denied = await fetch(f.address + '/api/protected', { method: 'OPTIONS', headers: { Origin: 'https://untrusted.invalid', 'Access-Control-Request-Method': 'POST' } }); expect(denied.headers.get('access-control-allow-origin')).toBeNull();
});
it('rejects Cookie confusion across ports and centers even when local browser cookie delivery shares a hostname', async () => {
  const first = await fixture(), a = await connect(first), second = await fixture(), b = await connect(second);
  expect(a.cookie.split('=')[0]).not.toBe(b.cookie.split('=')[0]); expect(a.ready.centerId).toBe(b.ready.centerId);
  expect((await request(second, '/api/protected', { cookie: a.cookie })).status).toBe(401);
  const renamed = b.cookie.split('=')[0] + '=' + a.cookie.split('=')[1]; expect((await request(second, '/api/protected', { cookie: renamed })).status).toBe(401);
  const separate = await database(), third = await fixture({}, separate.pool), c = await connect(third);
  expect(c.ready.centerId).not.toBe(a.ready.centerId); expect(c.ready.ownerPrincipalId).not.toBe(a.ready.ownerPrincipalId);
  expect((await request(third, '/api/protected', { cookie: c.cookie.split('=')[0] + '=' + a.cookie.split('=')[1] })).status).toBe(401);
});
it('serializes a 32-session capacity limit and rejects overflow without evicting a live session', async () => {
  const f = await fixture(), first = await connect(f);
  const requests = await Promise.all(Array.from({ length: 32 }, () => request(f, '/api/browser-session/connect', { token: ownerToken, method: 'POST', body: '{}' })));
  expect(requests.filter(r => r.status === 200)).toHaveLength(31); expect(requests.filter(r => r.status === 409)).toHaveLength(1);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.browser_sessions')).rows[0].n).toBe(32);
  expect((await request(f, '/api/protected', { cookie: first.cookie })).status).toBe(200);
  facts.samples.push({ case: 'capacity', accepted: 32, rejectedOverflow: 1, firstStillValid: true });
});
it.each(['logout', 'expiry', 'rotation'] as const)('closes an already-open SSE on %s without cancelling its running task', async reason => {
  const f = await fixture(), login = await connect(f), id = await task(), s = await stream(f, id, login.cookie);
  try {
    expect(await s.page()).toContain('running');
    if (reason === 'logout') await request(f, '/api/browser-session/logout', { cookie: login.cookie, csrf: login.ready.csrfToken, method: 'POST', body: '{}' });
    else if (reason === 'expiry') await pool.query("UPDATE flow.browser_sessions SET created_at=now()-interval '9 hours',expires_at=now()-interval '1 hour'");
    else await createBrowserSessionAuthentication(pool, { ownerToken, browserSession: { cookieOrigin: f.address, trustedOrigins: [f.address], authEpoch: 'rotated' } });
    expect(await s.page()).toBeNull(); expect((await pool.query('SELECT status FROM flow.tasks WHERE id=$1', [id])).rows[0].status).toBe('running');
    facts.samples.push({ case: 'open-SSE-' + reason, closed: true, taskStatus: 'running', authChecks: f.streamChecks() });
  } finally { await s.close(); }
});
it('rechecks authorization after a read and before publishing a newly fetched SSE page', async () => {
  let invalidate = false;
  const f = await fixture({ async beforeStreamAuthorize(n) { if (invalidate && n === 5) await pool.query('DELETE FROM flow.browser_sessions'); } });
  const login = await connect(f), id = await task(), s = await stream(f, id, login.cookie);
  try {
    expect(await s.page()).toContain('running'); invalidate = true;
    await pool.query("UPDATE flow.tasks SET status='waiting' WHERE id=$1", [id]);
    expect(await s.page()).toBeNull(); expect(f.streamChecks()).toBe(5);
  } finally { await s.close(); }
});
it('rejects malformed settings/commands and duplicate session cookies without turning reads into control', async () => {
  for (const cookieOrigin of ['*', 'http://example.com', 'http://127.0.0.1:1/path', 'https://user:pass@example.com']) await expect(createBrowserSessionAuthentication(pool, { ownerToken,
    browserSession: { cookieOrigin, trustedOrigins: ['http://127.0.0.1:1'], authEpoch: 'one' } })).rejects.toThrow();
  const f = await fixture(), login = await connect(f);
  expect((await request(f, '/api/protected', { cookie: login.cookie + '; ' + login.cookie })).status).toBe(401);
  expect((await request(f, '/api/browser-session/connect', { token: ownerToken, method: 'POST', body: '{"token":"do not accept"}' })).status).toBe(400);
  expect((await request(f, '/api/browser-session/connect', { cookie: login.cookie, method: 'POST', body: '{}' })).status).toBe(401);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.browser_sessions')).rows[0].n).toBe(1);
});
it('preserves the unmodified public createServer bearer client and two-argument stream consumer', async () => {
  const app = await createServer({ databaseUrl: databases[0]!.url, ownerToken, automaticQueueScan: false });
  const address = await app.listen({ host: '127.0.0.1', port: 0 }), client = new FlowClient({ baseUrl: address, token: ownerToken });
  try {
    const accepted = await client.submit({ title: 'Old bearer API', prompt: 'No execution', harness: 'fixture' }, randomUUID());
    expect((await client.show(accepted.task.id)).status).toBe('queued');
    const f = { address, browserOrigin: address } as Fixture, s = await stream(f, accepted.task.id, undefined, ownerToken);
    try { expect(await s.page()).toContain('queued'); } finally { await s.close(); }
    expect((await client.show(accepted.task.id)).status).toBe('queued');
  } finally { await app.close(); }
});

it('keeps a no-cookie read side-effect free and rejects a mismatched destination despite forwarded headers', async () => {
  const f = await fixture();
  const before = (await pool.query('SELECT * FROM flow.browser_identity')).rows;
  expect((await request(f, '/api/browser-session')).body.state).toBe('unauthenticated');
  expect((await pool.query('SELECT * FROM flow.browser_identity')).rows).toEqual(before);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.browser_sessions')).rows[0].n).toBe(0);
  const login = await connect(f);
  expect((await rawRequest(f.address + '/api/protected', { Cookie: login.cookie, Origin: f.address, Host: '127.0.0.1:1', 'X-Forwarded-Host': new URL(f.address).host, 'X-Forwarded-Proto': 'http' })).status).toBe(403);
});
it('sets the HTTPS cookie policy without claiming a browser or TLS journey', async () => {
  const f = await fixture();
  const auth = await createBrowserSessionAuthentication(pool, { ownerToken, browserSession: { cookieOrigin: 'https://center.example', trustedOrigins: ['https://web.example'], authEpoch: 'https-policy' } });
  let cookie = '';
  const request = { headers: { authorization: 'Bearer ' + ownerToken, origin: 'https://web.example', host: 'center.example' }, protocol: 'https', raw: { rawHeaders: ['authorization', 'Bearer ' + ownerToken] } };
  const reply = { header(name: string, value: string) { if (name === 'Set-Cookie') cookie = value; } };
  await auth.connect(request as any, reply as any);
  expect(cookie).toContain('__Host-flow-session-'); expect(cookie).toContain('; Secure'); expect(cookie).toContain('SameSite=None'); expect(cookie).not.toContain('Domain=');
  expect((await requestSessionCount()).n).toBe(1);
  async function requestSessionCount() { return (await pool.query('SELECT count(*)::int AS n FROM flow.browser_sessions')).rows[0]; }
  await f.close();
});
it('does not create an observer after preClose overtakes its initial asynchronous authorization', async () => {
  let entered!: () => void, release!: () => void, closing!: () => void;
  const enteredPromise = new Promise<void>(r => { entered = r; }), gate = new Promise<void>(r => { release = r; });
  const closingPromise = new Promise<void>(r => { closing = r; });
  const f = await fixture({ onClosing: closing, async beforeStreamAuthorize(count) { if (count === 1) { entered(); await gate; } } });
  const login = await connect(f), id = await task();
  const response = rawRequest(f.address + '/api/tasks/' + id + '/stream', { Cookie: login.cookie, Origin: f.address });
  // Attach a rejection handler immediately; the gate must be released even if an assertion fails.
  const outcome = response.then(value => ({ value }), error => ({ error }));
  let close: Promise<void> | undefined;
  try {
    await bounded(enteredPromise, 'initial stream authorization'); close = f.close();
    await bounded(closingPromise, 'stream preClose'); release();
    const result = await outcome; if ('error' in result) throw result.error;
    expect(result.value.status).toBe(503); expect(result.value.body).not.toContain('event: update');
    await bounded(close, 'HTTP close');
    facts.samples.push({ case: 'initial-authorization-close', observerCreated: false, status: result.value.status });
  } finally { release(); await outcome; if (close) await close; }
});

it('restores the same connection after a real owned center process exits and restarts', async () => {
  async function start(port?: number) {
    const script = `import { Pool } from 'pg';
      import { createBrowserSessionFixture } from './apps/server/src/browser-session/fixture.ts';
      const pool = new Pool({ connectionString: ${JSON.stringify(databases[0]!.url)}, max: 3, statement_timeout: 5000 });
      const fixture = await createBrowserSessionFixture(pool, ${JSON.stringify({ ownerToken, port })});
      process.on('message', async message => { if (message === 'close') {
        await fixture.close(); await pool.end(); process.disconnect();
      } });
      process.send({ address: fixture.address, port: fixture.port });`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
      cwd: process.cwd(), env: { PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let output = '';
    const collect = (chunk: Buffer) => { output += chunk.toString(); if (Buffer.byteLength(output) > 16384) child.kill('SIGTERM'); };
    child.stdout!.on('data', collect); child.stderr!.on('data', collect);
    const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    const ready = new Promise<{ address: string; port: number }>((resolve, reject) => {
      child.once('error', reject); child.once('message', value => resolve(value as { address: string; port: number }));
      void exited.then(result => reject(new Error('Owned center exited before ready: ' + JSON.stringify(result) + output)));
    });
    let stopped = false;
    async function close() {
      if (stopped) return; stopped = true;
      if (child.connected) child.send('close');
      try { await bounded(exited, 'owned center exit'); }
      catch (error) { child.kill('SIGTERM'); await bounded(exited, 'owned center termination'); throw error; }
      const result = await exited;
      facts.samples.push({ case: 'owned-process', pid: child.pid, ...result, outputBytes: Buffer.byteLength(output) });
      expect(result).toEqual({ code: 0, signal: null });
    }
    try { await bounded(ready, 'owned center ready'); return { ...(await ready), close }; }
    catch (error) { await close(); throw error; }
  }
  const first = await start(); let second: Awaited<ReturnType<typeof start>> | undefined;
  try {
    const initial = { address: first.address, browserOrigin: first.address } as Fixture;
    const login = await connect(initial); await first.close(); second = await start(first.port);
    const restarted = { address: second.address, browserOrigin: second.address } as Fixture;
    expect((await request(restarted, '/api/browser-session', { cookie: login.cookie })).body).toEqual(login.ready);
    facts.samples.push({ case: 'actual-process-restart', sameCookie: true, sameCenter: true, samePrincipal: true, sameAbsoluteExpiry: true });
  } finally { await second?.close(); await first.close(); }
});
