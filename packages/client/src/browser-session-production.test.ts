import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as portServer } from 'node:net';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { taskSubmissionSchema } from '@flow/contracts';
import { createServer, type ServerOptions } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

const database = `flow_f01_browser_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1, connectionTimeoutMillis: 2000 });
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 2000 });
const token = 'synthetic-browser-production-owner';
const facts: Record<string, unknown> = { database, startedAt: new Date().toISOString(), providerCalls: 0, cookieTransport: 'explicit Node test jar, not browser engine' };
let created = false;
async function availablePort() {
  const server = portServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (!address || typeof address === 'string') throw new Error('No owned port');
  return address.port;
}
beforeAll(async () => {
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  if ((facts.before as unknown[]).length) throw new Error('Refuse pre-existing database');
  await admin.query(`CREATE DATABASE ${database}`); created = true;
});
afterAll(async () => {
  try {
    await pool.end();
    facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
    if ((facts.connections as unknown[]).length) throw new Error('Owned connections remain');
    if (created) await admin.query(`DROP DATABASE ${database}`);
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  } finally {
    facts.created = created; facts.finishedAt = new Date().toISOString(); await admin.end();
    if (process.env.FLOW_F01_BROWSER_EVIDENCE) await writeFile(process.env.FLOW_F01_BROWSER_EVIDENCE, JSON.stringify(facts, null, 2));
  }
});

it('mounts migration and the unsupported public probe by default while preserving owner/runner roles', async () => {
  const app = await createServer({ databaseUrl, ownerToken: token });
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const probe = await fetch(address + '/api/browser-session');
    expect(probe.status).toBe(200);
    expect(await probe.json()).toEqual({ protocol: 'flow.browser-session.v1', state: 'unsupported' });
    expect(probe.headers.get('cache-control')).toBe('no-store');
    expect((await pool.query('SELECT version FROM flow.migrations WHERE version=28')).rows).toEqual([{ version: 28 }]);
    expect((await pool.query('SELECT count(*)::int AS n FROM flow.browser_identity')).rows[0]!.n).toBe(0);
    const owner = new FlowClient({ baseUrl: address, token });
    const registration = await owner.registerRunner({ name: 'Legacy role fixture', harnesses: ['fixture'], capacity: 1 });
    const runner = new FlowClient({ baseUrl: address, token: registration.token });
    expect(await runner.claim()).toEqual({ assignment: null, remainingLeaseMs: 0 });
    await expect(owner.claim()).rejects.toMatchObject({ status: 403 });
    await expect(runner.list()).rejects.toMatchObject({ status: 403 });
    expect((await fetch(address + '/api/tasks')).status).toBe(401);
    const response = await fetch(address + '/api/browser-session/connect', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(503); await response.arrayBuffer();
    facts.defaultDisabled = true;
  } finally { await app.close(); }
});

it('uses the actual factory and client for durable cookie identity, restart, write guards and revoked SSE without cancelling work', async () => {
  const port = await availablePort(), address = `http://127.0.0.1:${port}`;
  const browserSession = { cookieOrigin: address, trustedOrigins: [address], authEpoch: 'production-test-1' };
  let app = await createServer({ databaseUrl, ownerToken: token, leaseMs: 300_000, browserSession } as ServerOptions);
  let cookie = '', csrf: string | undefined;
  const realFetch = globalThis.fetch;
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (!String(input).startsWith(address) || init?.credentials !== 'include') return realFetch(input, init);
    const headers = new Headers(init.headers); headers.set('Origin', address); if (cookie) headers.set('Cookie', cookie);
    const response = await realFetch(input, { ...init, headers });
    const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0]!;
    return response;
  });
  const owner = new FlowClient({ baseUrl: address, token });
  const browser = new FlowClient({ baseUrl: address, browserSession: { csrfToken: () => csrf } });
  let stream: ReturnType<FlowClient['watch']> | undefined;
  try {
    await app.listen({ host: '127.0.0.1', port });
    const ready = await browser.connectBrowserSession(token); csrf = ready.csrfToken;
    expect(cookie).toMatch(/^flow-session-[a-f0-9]{24}=/);
    const response = await realFetch(address + '/api/tasks', { headers: { Origin: address, Cookie: cookie, Authorization: 'Bearer invalid' } });
    expect(response.status).toBe(401); await response.arrayBuffer();
    for (const headers of [
      { Origin: 'http://127.0.0.1:1', Cookie: cookie, 'X-Forwarded-Host': `127.0.0.1:${port}` },
      { Origin: address, Cookie: cookie, Host: 'untrusted.example', 'X-Forwarded-Host': `127.0.0.1:${port}`, 'X-Forwarded-Proto': 'http' },
    ]) {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const outgoing = request(address + '/api/tasks', { headers }, incoming => { incoming.resume(); incoming.once('end', () => resolve(incoming.statusCode)); });
        outgoing.once('error', reject); outgoing.end();
      }); expect(status).toBe(403);
    }
    const preflight = await realFetch(address + '/api/tasks', { method: 'OPTIONS', headers: { Origin: address, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'X-Flow-CSRF' } });
    expect(preflight.headers.get('access-control-allow-origin')).toBe(address);
    expect(preflight.headers.get('access-control-allow-credentials')).toBe('true'); await preflight.arrayBuffer();
    const deniedWrite = await realFetch(address + '/api/tasks', { method: 'POST', headers: { Origin: address, Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' });
    expect(deniedWrite.status).toBe(403); await deniedWrite.arrayBuffer();
    const registration = await owner.registerRunner({ name: 'Browser fixture', harnesses: ['fixture'], capacity: 1 });
    const runner = new FlowClient({ baseUrl: address, token: registration.token });
    const accepted = await browser.submit(taskSubmissionSchema.parse({ title: 'Survives disconnect', prompt: 'Synthetic pending work', harness: 'fixture' }), randomUUID());
    let attemptId: string | undefined;
    await expect.poll(async () => { const assignment = (await runner.claim()).assignment; attemptId = assignment?.attempt.id; return assignment?.task.id; }, { timeout: 5000 }).toBe(accepted.task.id);
    await expect(browser.claim()).rejects.toMatchObject({ status: 403 });
    await app.close();
    app = await createServer({ databaseUrl, ownerToken: token, leaseMs: 300_000, browserSession } as ServerOptions);
    await app.listen({ host: '127.0.0.1', port });
    expect(await browser.browserSession()).toEqual(ready);
    stream = browser.watch(accepted.task.id, 0, AbortSignal.timeout(5000));
    expect((await stream.next()).done).toBe(false);
    const oldCookie = cookie;
    expect((await browser.logoutBrowserSession()).state).toBe('unauthenticated');
    expect((await stream.next()).done).toBe(true);
    const task = await owner.show(accepted.task.id); expect(task.status).toBe('running');
    const rejected = await realFetch(address + '/api/tasks', { headers: { Cookie: oldCookie, Origin: address } });
    expect(rejected.status).toBe(401); await rejected.arrayBuffer();
    facts.enabled = { taskId: accepted.task.id, attemptId, centerId: ready.centerId, ownerPrincipalId: ready.ownerPrincipalId,
      restartCookieStable: true, streamRevoked: true, logoutTaskStatus: task.status, forwardedRejected: true };
  } finally { await stream?.return(undefined); spy.mockRestore(); await app.close(); }
});

it('starts the public entry with explicit bounded configuration and rejects malformed configuration before serving', async () => {
  const port = await availablePort(), address = `http://127.0.0.1:${port}`;
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const env = { PATH: process.env.PATH, DATABASE_URL: databaseUrl, FLOW_TOKEN: token, FLOW_PORT: String(port), FLOW_HOST: '127.0.0.1' };
  function run(config: string) {
    const child = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/main.ts'], { cwd: root, env: { ...env, FLOW_BROWSER_SESSION_JSON: config }, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = ''; child.stderr!.on('data', chunk => { stderr = (stderr + chunk).slice(-8192); });
    const exited = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    return { child, exited, stderr: () => stderr };
  }
  async function stop(process: { child: ChildProcess; exited: Promise<number | null> }) {
    if (process.child.exitCode === null && process.child.signalCode === null) process.child.kill('SIGTERM');
    return process.exited;
  }
  const invalid = run('{');
  try { expect(await Promise.race([invalid.exited, new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('Invalid config did not stop startup')), 5000); timer.unref(); })])).toBe(1); expect(invalid.stderr()).toContain('FLOW_BROWSER_SESSION_JSON'); }
  finally { await stop(invalid); }
  const configured = run(JSON.stringify({ cookieOrigin: address, trustedOrigins: [address], authEpoch: 'production-test-1' }));
  try {
    await expect.poll(async () => {
      if (configured.child.exitCode !== null) throw new Error('Owned entry exited: ' + configured.stderr());
      return fetch(address + '/api/health').then(response => response.ok).catch(() => false);
    }, { timeout: 10_000 }).toBe(true);
    const session = await fetch(address + '/api/browser-session', { headers: { Origin: address } });
    expect(session.status).toBe(200); expect((await session.json() as { state: string }).state).toBe('unauthenticated');
  } finally { facts.publicEntryExit = await stop(configured); }
  expect(facts.publicEntryExit).toBe(0);
});
