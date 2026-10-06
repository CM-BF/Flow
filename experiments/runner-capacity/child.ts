import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from '../../apps/server/src/index.js';
import { canonical } from '../../apps/server/src/database.js';
import { runRunner } from '../../apps/runner/src/runtime.js';
import { createFixtureAdapter } from '../../apps/runner/src/fixture.js';
import type { HarnessAdapter } from '../../packages/contracts/src/index.js';
import { boundedText } from './http.js';

type Configuration = { role: 'center'; databaseUrl: string; ownerToken: string } |
  { role: 'runner'; baseUrl: string; token: string; directory: string; label: string };
const shutdown = new AbortController();
const send = (value: Record<string, unknown>) => { if (process.connected) process.send?.({ ...value, pid: process.pid, monotonicMs: performance.now() }); };
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
process.on('SIGTERM', () => shutdown.abort());
process.on('message', value => { if ((value as { kind?: string }).kind === 'stop') shutdown.abort(); });
process.on('disconnect', () => shutdown.abort());

async function center(config: Extract<Configuration, { role: 'center' }>) {
  const app = await createServer({ databaseUrl: config.databaseUrl, ownerToken: config.ownerToken, leaseMs: 10_000 });
  let activeRequests = 0;
  let connectionsPending = false;
  app.addHook('onRequest', async () => { activeRequests++; });
  app.addHook('onResponse', async () => { activeRequests--; });
  const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  send({ kind: 'ready', baseUrl });
  const timer = setInterval(() => {
    if (connectionsPending) return;
    connectionsPending = true;
    app.server.getConnections((error, tcpConnections) => {
      connectionsPending = false;
      if (!error) send({ kind: 'center-sample', activeRequests, tcpConnections, rssBytes: process.memoryUsage().rss, cpu: process.cpuUsage() });
    });
  }, 100);
  try { await new Promise<void>(resolve => shutdown.signal.aborted ? resolve() : shutdown.signal.addEventListener('abort', () => resolve(), { once: true })); }
  finally { clearInterval(timer); await app.close(); }
}

async function runner(config: Extract<Configuration, { role: 'runner' }>) {
  const originalFetch = globalThis.fetch;
  let claimedTaskId: string | null = null;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith(config.baseUrl + '/')) throw new Error('S01 runner refused a non-owned network destination.');
    const start = performance.now();
    const reporting = url.endsWith('/api/runner/events');
    const batch = reporting && typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    if (batch) send({ kind: 'report-start', label: config.label, attemptId: batch.attemptId,
      events: batch.events.map((event: Record<string, unknown>) => ({ id: event.id, sequence: event.sequence, type: event.type, digest: hash(canonical(event)) })) });
    try {
      const response = await originalFetch(input, init);
      const body = await boundedText(response);
      if (url.endsWith('/api/runner/claim') && response.ok) {
        const claim = JSON.parse(body);
        const id: unknown = claim.assignment?.task.id;
        claimedTaskId = typeof id === 'string' ? id : null;
        if (claimedTaskId) send({ kind: 'claim-grant', label: config.label, taskId: claimedTaskId,
          attemptId: claim.assignment.attempt.id, runnerId: claim.assignment.attempt.runnerId,
          initialLeaseExpiresAt: claim.assignment.attempt.leaseExpiresAt, remainingLeaseMs: claim.remainingLeaseMs });
      }
      send({ kind: 'http', label: config.label, path: new URL(url).pathname, elapsedMs: performance.now() - start, status: response.status, bytes: Buffer.byteLength(body) });
      if (batch) send({ kind: 'report-response', label: config.label, attemptId: batch.attemptId, status: response.status, response: JSON.parse(body) });
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) { send({ kind: 'http-failure', label: config.label, path: new URL(url).pathname, elapsedMs: performance.now() - start }); throw error; }
  };
  const fixture = createFixtureAdapter();
  const adapter: HarnessAdapter = {
    name: 'fixture', version: fixture.version,
    async run(context) {
      const taskId = claimedTaskId;
      if (!taskId) throw new Error('S01 adapter has no observed claim identity.');
      send({ kind: 'adapter-start', taskId, label: config.label });
      try {
        await context.assertOwnership();
        send({ kind: 'tool-start', taskId, label: config.label });
        const startedAt = performance.now();
        const bytes = Buffer.alloc(65_536, 83);
        const file = join(context.workingDirectory, 's01-tool.bin');
        await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
        const actual = await readFile(file);
        if (hash(actual) !== hash(bytes)) throw new Error('S01 local operation digest mismatch.');
        send({ kind: 'tool-end', taskId, label: config.label, elapsedMs: performance.now() - startedAt, bytes: actual.length, digest: hash(actual) });
        await fixture.run({ ...context, async emit(data) {
          const start = performance.now();
          await context.emit(data);
          send({ kind: 'emit-ack', taskId, label: config.label, eventType: data.type, elapsedMs: performance.now() - start });
        } });
      } finally { send({ kind: 'adapter-end', taskId, label: config.label }); }
    },
  };
  send({ kind: 'ready', label: config.label });
  try {
    await runRunner({ baseUrl: config.baseUrl, token: config.token, workingDirectory: config.directory, adapters: [adapter], signal: shutdown.signal,
      pollIntervalMs: 50, heartbeatIntervalMs: 1000, requestTimeoutMs: 3000, onNotice: notice => send({ kind: 'notice', label: config.label, notice }) });
  } finally { globalThis.fetch = originalFetch; }
}

process.once('message', async value => {
  const config = value as Configuration;
  try {
    if (config.role === 'center') await center(config);
    else if (config.role === 'runner') await runner(config);
    else throw new Error('Unknown S01 child role.');
    // IPC ordering plus its completion callback flushes all preceding observations.
    await new Promise<void>((resolve, reject) => process.connected
      ? process.send!({ kind: 'closed', pid: process.pid, monotonicMs: performance.now() }, error => error ? reject(error) : resolve())
      : resolve());
  } catch (error) {
    send({ kind: 'failure', name: error instanceof Error ? error.name : 'UnknownError' });
    process.exitCode = 1;
  } finally { if (process.connected) process.disconnect?.(); }
});
