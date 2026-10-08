import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdtemp, mkdir, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { Pool } from 'pg';
import { FlowClient } from '@flow/client';
import { createInteractionController } from '@flow/interaction';
import type { HarnessAdapter, TaskSummary } from '@flow/contracts';
import { openIntentStore } from '../intent-store.js';
import type { createServer } from '../../../server/src/index.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { verifyText } from '../../../runner/src/verifier.js';
import { cleanupAfterCheckpoint, observeConnections, type DirectoryIdentity } from './fixture-cleanup.js';
import { FixtureObservation, observeFixtureAdapter } from './fixture-observation.js';

const pause = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
async function bounded<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error(label)), ms); })]); }
  finally { clearTimeout(timer); }
}
function groupPresent(pgid: number): boolean {
  try { process.kill(-pgid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw Error('Owned group existence unknown'); }
}
async function stopGroup(pgid: number) {
  const signals: string[] = [];
  for (const [signal, grace] of [['SIGTERM', 3000], ['SIGKILL', 1000]] as const) {
    if (!groupPresent(pgid)) return { pgid, stopped: true, signals };
    try { process.kill(-pgid, signal); signals.push(signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw Error('Owned group signal failed'); }
    const until = performance.now() + grace;
    while (groupPresent(pgid) && performance.now() < until) await pause(25);
  }
  return { pgid, stopped: !groupPresent(pgid), signals };
}
type CancelRequest = { path: string; key: string; body: string; upstreamStatus: number; taskId: string; dropped: boolean };
type OwnedGroup = { pgid: number; stop: () => Promise<Awaited<ReturnType<typeof stopGroup>>> };
type Center = Pick<Awaited<ReturnType<typeof createServer>>, 'listen' | 'close'>;
type HandoffRecipe = {
  kind: 'web-handoff';
  createCenter: (options: { databaseUrl: string; ownerToken: string; automaticQueueScan: false }) => Promise<Center>;
  beforeCleanup: () => Promise<unknown>;
};

/** Test-only lifetime: one private center/runtime, explicit fixture barriers, two cancellation commands. */
export class CancelJourney {
  readonly database = `flow_tui01f_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  readonly requests: CancelRequest[] = [];
  readonly facts: Record<string, unknown> = { providerCalls: 0, fixtureOnly: true };
  readonly tasks: string[] = [];
  private readonly observation = new FixtureObservation();
  private readonly token = `synthetic-tui01f-${randomUUID()}`;
  private readonly adminUrl = process.env.FLOW_TEST_DATABASE_URL ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
  private readonly stop = new AbortController();
  private readonly barriers = new Map<string, () => void>();
  private readonly activeAdapters = new Set<string>();
  private readonly sessions = new Set<string>();
  private readonly terminals = new Set<() => Promise<void>>();
  private readonly groups: OwnedGroup[] = [];
  private readonly failures: string[] = [];
  private readonly handoffMarker = randomUUID();
  private admin?: Pool;
  private app?: Center;
  private proxy?: ReturnType<typeof createHttpServer>;
  private runner?: Promise<void>;
  private created = false;
  private directory?: string;
  private directoryIdentity?: DirectoryIdentity;
  private upstream = '';
  private proxyUrl = '';
  private dropTarget?: string;
  client!: FlowClient;
  conversationId = '';

  constructor(readonly evidenceDirectory: string, private readonly recipe?: HandoffRecipe) {
    if (!isAbsolute(evidenceDirectory) || resolve(evidenceDirectory) === resolve('.') || resolve(evidenceDirectory) === tmpdir()) throw Error('Fresh explicit evidence directory required');
    const database = new URL(this.adminUrl);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) || database.pathname !== '/postgres') throw Error('Only local admin database is allowed');
  }
  async save(name: string, value: unknown) {
    if (!/^[a-z0-9-]+\.json$/.test(name)) throw Error('Invalid evidence name');
    if (['checkpoint.json', 'result.json', 'handoff-stages.json'].includes(name)) {
      value = { ...value as Record<string, unknown>, fixtureObservation: this.observation.snapshot() };
    }
    const text = JSON.stringify(value, null, 2).replaceAll(this.token, '[synthetic-token-redacted]').replaceAll(this.adminUrl, '[database-url-redacted]') + '\n';
    if (Buffer.byteLength(text) > 2 * 1024 ** 2) throw Error('Evidence bound exceeded');
    const file = await open(join(this.evidenceDirectory, name), 'wx', 0o600);
    try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
    const directory = await open(this.evidenceDirectory, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
    return { file: name, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
  }
  record(name: string, value: unknown) { this.facts[name] = structuredClone(value); }
  failed(name: string) { this.failures.push(name); }
  async start() {
    await mkdir(this.evidenceDirectory, { mode: 0o700 }); // Never reuse/overwrite a previous run.
    this.directory = await mkdtemp(join(tmpdir(), 'flow-tui01f-'));
    this.directoryIdentity = await this.readDirectoryIdentity();
    this.record('resources', { database: this.database, directory: this.directory, directoryIdentity: this.directoryIdentity, ownerPid: process.pid });
    if (this.recipe) this.record('handoffOwnership', { database: this.database, marker: this.handoffMarker });
    await this.save('reservation.json', this.facts);
    this.admin = new Pool({ connectionString: this.adminUrl, max: 1, connectionTimeoutMillis: 2000, query_timeout: 3000 });
    await this.admin.query(`CREATE DATABASE "${this.database}"`); this.created = true;
    const database = new URL(this.adminUrl); database.pathname = `/${this.database}`;
    if (this.recipe) {
      await this.save('handoff-database-reservation.json', this.facts.handoffOwnership);
      const marker = new Pool({ connectionString: database.href, max: 1, connectionTimeoutMillis: 2000, query_timeout: 3000 });
      try {
        await marker.query('CREATE TABLE public.tui01f_handoff_owner(marker uuid PRIMARY KEY)');
        await marker.query('INSERT INTO public.tui01f_handoff_owner VALUES($1)', [this.handoffMarker]);
      } finally { await marker.end(); }
    }
    const factory = this.recipe?.createCenter ?? (await import('../../../server/src/index.js')).createServer;
    this.app = await factory({ databaseUrl: database.href, ownerToken: this.token, automaticQueueScan: false });
    this.upstream = await this.app.listen({ host: '127.0.0.1', port: 0 });
    this.client = new FlowClient({ baseUrl: this.upstream, token: this.token });
    const registration = await this.client.registerRunner({ name: 'TUI01F synthetic session; no SDK', harnesses: ['claude'], capacity: 1 });
    this.record('runnerId', registration.runnerId);
    this.runner = runRunner({ baseUrl: this.upstream, token: registration.token, workingDirectory: join(this.directory, 'runner'),
      signal: this.stop.signal, adapters: [this.adapter()], pollIntervalMs: 50, heartbeatIntervalMs: 200, requestTimeoutMs: 1500,
      onNotice: notice => this.observation.notice(notice) });
    // Attach immediately; final cleanup still observes any rejection and fails closed.
    void this.runner.catch(() => { this.failed('runner-rejected'); });
    await this.startProxy();
    const accepted = await this.client.createConversation({ title: this.recipe ? 'TUI01F shared Web and terminal' : 'TUI01F synthetic A/B/C', harness: 'claude',
      requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' } }, randomUUID());
    this.conversationId = accepted.conversation.id;
    this.record('origins', { center: this.upstream, proxy: this.proxyUrl, conversationId: this.conversationId });
  }
  private adapter(): HarnessAdapter {
    return observeFixtureAdapter({ name: 'claude', version: 'claude-sdk-0.3.290-v1', run: async context => {
      const id = context.executionIdentity?.taskId;
      if (!id) throw Error('Fixture requires the runner-assigned task identity');
      this.activeAdapters.add(id);
      try {
        const nativeSessionId = context.task.resumeSessionId ?? randomUUID();
        await context.emit({ type: 'session', nativeSessionId,
          adapterVersion: 'claude-sdk-0.3.290-v1', resources: ['fixture:no SDK/provider'] });
        this.sessions.add(id);
        await this.observation.run('barrier', context.executionIdentity, () => new Promise<void>((done, reject) => {
          const abort = () => finish(Error('synthetic adapter interrupted'));
          const finish = (error?: Error) => { context.signal.removeEventListener('abort', abort); this.barriers.delete(id); error ? reject(error) : done(); };
          this.barriers.set(id, () => finish()); context.signal.addEventListener('abort', abort, { once: true });
          if (context.signal.aborted) abort();
        }));
        await context.assertOwnership();
        const content = 'Synthetic fixture completed after observer exit.', artifactId = randomUUID();
        if (this.recipe) {
          const sourceMessageId = randomUUID();
          await context.emit({ type: 'assistant-final', nativeSessionId, sourceMessageId, source: 'claude.sdk.result', content,
            messageId: createHash('sha256').update(JSON.stringify([nativeSessionId, sourceMessageId])).digest('hex'),
            settings: { requested: { model: 'runner-default', permissionMode: 'dontAsk', thinking: 'disabled' },
              effective: { model: null, permissionMode: null, thinking: 'unknown', tools: null } } });
        }
        await context.emit({ type: 'artifact', artifactId, title: 'Fixture text', mediaType: 'text/plain', content,
          version: createHash('sha256').update(content).digest('hex') });
        await context.emit(verifyText(artifactId, content, context.task.verification));
      } finally { this.activeAdapters.delete(id); }
    } }, this.observation);
  }
  async waitTask(id: string, status: TaskSummary['status'], signal?: AbortSignal) {
    const until = performance.now() + 8000;
    while (performance.now() < until) {
      signal?.throwIfAborted();
      const task = await this.client.show(id, AbortSignal.any([AbortSignal.timeout(1500), ...(signal ? [signal] : [])]));
      if (task.status === status) return task;
      await pause(30);
    }
    throw Error(`Task did not reach ${status}`);
  }
  async admit(label: 'A' | 'B' | 'C', signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (this.tasks.length >= 3 || label !== ['A', 'B', 'C'][this.tasks.length]) throw Error('Three ordered turns only');
    const requestSignal = () => AbortSignal.any([AbortSignal.timeout(1500), ...(signal ? [signal] : [])]);
    const current = await this.client.conversation(this.conversationId, requestSignal());
    signal?.throwIfAborted();
    const accepted = await this.client.submitConversationTurn(this.conversationId, {
      expectedRevision: current.conversation.revision, text: `TUI01F synthetic ${label}; no model`, mode: 'follow-up',
    }, randomUUID(), requestSignal());
    const id = accepted.turn.task.id; this.tasks.push(id);
    await this.waitTask(id, 'running', signal);
    const until = performance.now() + 5000;
    while (!this.sessions.has(id) && performance.now() < until) { signal?.throwIfAborted(); await pause(20); }
    if (!this.sessions.has(id)) throw Error('Fixture session was not persisted');
    this.record(`turn${label}`, { id: accepted.turn.id, taskId: id, number: accepted.turn.number });
    return id;
  }
  release(id: string) {
    const release = this.barriers.get(id); if (!release) throw Error('Missing fixture barrier'); release();
  }
  /** Test-only observer connection; never persist the synthetic bearer outside the private runtime. */
  handoffConnection() {
    if (!this.recipe || !this.upstream || !this.conversationId) throw Error('Handoff fixture is not ready');
    return Object.freeze({ origin: this.upstream, token: this.token, conversationId: this.conversationId });
  }
  handoffRuntimePath(kind: 'chrome' | 'pty-journal') {
    if (!this.recipe || !this.directory || !['chrome', 'pty-journal'].includes(kind)) throw Error('Handoff runtime is not ready');
    return join(this.directory, kind);
  }
  registerHandoffGroup(pgid: number) {
    if (!this.recipe || !Number.isSafeInteger(pgid) || pgid <= 1 || this.groups.length >= 2 || this.groups.some(group => group.pgid === pgid)) throw Error('Unexpected handoff process');
    let stopping: Promise<Awaited<ReturnType<typeof stopGroup>>> | undefined;
    const owned = { pgid, stop: () => stopping ??= stopGroup(pgid) }; this.groups.push(owned);
    return owned;
  }
  async observeHandoffTurn(taskId: string) {
    if (!this.recipe || this.tasks.length >= 2 || this.tasks.includes(taskId)) throw Error('Two distinct handoff turns only');
    const snapshot = await this.client.conversation(this.conversationId, AbortSignal.timeout(1500));
    if (snapshot.lastTurn?.task.id !== taskId || snapshot.lastTurn.number !== this.tasks.length + 1) throw Error('Handoff turn identity mismatch');
    this.tasks.push(taskId);
    await this.waitTask(taskId, 'running');
    const until = performance.now() + 5000;
    while (!this.sessions.has(taskId) && performance.now() < until) await pause(20);
    if (!this.sessions.has(taskId)) throw Error('Fixture session was not persisted');
    return snapshot.lastTurn;
  }
  async completeHandoff(facts: { conflict: boolean; draftPreserved: boolean; singleCancel: boolean; recoveredB: boolean; exitWithoutCancel: boolean; visibleFinal: boolean }) {
    if (!this.recipe || this.tasks.length !== 2 || Object.values(facts).some(value => value !== true)) throw Error('Incomplete handoff');
    await this.waitTask(this.tasks[0]!, 'cancelled');
    const last = await this.waitTask(this.tasks[1]!, 'succeeded');
    if (last.verificationStatus !== 'passed') throw Error('Fixture verification failed');
    this.record('handoff', facts);
  }
  dropFirstAckFor(id: string) {
    if (this.dropTarget || this.requests.length || id !== this.tasks[0]) throw Error('ACK drop can only be armed once for A');
    this.dropTarget = id;
  }
  private async startProxy() {
    this.proxy = createHttpServer(async (request, response) => {
      try {
        const path = request.url ?? '', isCancel = /^\/api\/tasks\/[a-f0-9-]{36}\/cancel$/.test(path);
        if (request.method !== 'GET' && !(request.method === 'POST' && isCancel)) { response.writeHead(405); response.end(); return; }
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) { size += chunk.length; if (size > 16 * 1024) throw Error('Proxy request bound'); chunks.push(chunk); }
        const body = Buffer.concat(chunks).toString(); const key = String(request.headers['idempotency-key'] ?? '');
        const headers: Record<string, string> = { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' };
        if (key) headers['idempotency-key'] = key;
        const taskId = path.split('/')[3] ?? '';
        if (isCancel && (!this.tasks.slice(0, 2).includes(taskId) || body !== '{}' || !key || this.requests.length >= 3)) throw Error('Unexpected cancel request');
        const upstream = await fetch(`${this.upstream}${path}`, { method: request.method, headers,
          ...(body ? { body } : {}), signal: AbortSignal.timeout(3000), redirect: 'error' });
        const pieces: Uint8Array[] = []; let bytes = 0;
        const reader = upstream.body?.getReader();
        try {
          while (reader) {
            const piece = await reader.read(); if (piece.done) break;
            bytes += piece.value.length; if (bytes > 512 * 1024) throw Error('Proxy response bound'); pieces.push(piece.value);
          }
        } finally { await reader?.cancel(); }
        const text = Buffer.concat(pieces).toString();
        if (isCancel) {
          const receipt = JSON.parse(text) as { id?: string; status?: string };
          const drop = taskId === this.dropTarget && !this.requests.some(item => item.dropped);
          const observation = { path, key, body, upstreamStatus: upstream.status, taskId, dropped: drop };
          this.requests.push(observation);
          if (drop) {
            if (!upstream.ok || receipt.id !== taskId || !['cancel_requested', 'cancelled'].includes(receipt.status ?? '')) throw Error('Center did not confirm cancellation');
            await this.save('ack-drop.json', { ...observation, receipt, observedAt: new Date().toISOString(), centerResponseFullyRead: true });
            response.destroy(); return;
          }
        }
        response.writeHead(upstream.status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(text);
      } catch { this.failed('proxy-failure'); response.destroy(); }
    });
    await new Promise<void>((done, reject) => { this.proxy!.once('error', reject); this.proxy!.listen(0, '127.0.0.1', done); });
    const address = this.proxy.address(); if (!address || typeof address === 'string') throw Error('Proxy address unavailable');
    this.proxyUrl = `http://127.0.0.1:${address.port}`;
  }
  async terminal(name: string) {
    const connectionId = createHash('sha256').update(name).digest('hex');
    const journal = await openIntentStore(join(this.directory!, 'journals'), connectionId);
    const client = new FlowClient({ baseUrl: this.proxyUrl, token: this.token });
    const controller = createInteractionController({ client, observe: client, queue: client, taskControl: client, connectionId, intents: journal, pollMs: 60_000 });
    let closed = false;
    const close = async () => { if (closed) return; await controller.dispose(); await journal.close(); closed = true; this.terminals.delete(close); };
    this.terminals.add(close); await controller.initialize(); return { controller, journal, close };
  }
  async pty(taskB: string, afterCancelled: (signal: AbortSignal) => Promise<string>) {
    const stage = new AbortController();
    const child = spawn('/usr/bin/python3', ['apps/tui/test-fixtures/cancel_driver.py'], { cwd: resolve('.'), detached: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', TERM: 'xterm-256color', LANG: 'en_US.UTF-8',
        FLOW_URL: this.proxyUrl, FLOW_TOKEN: this.token, FLOW_TUI_STATE_DIR: join(this.directory!, 'pty-journal'),
        TUI_TEST_NODE: process.execPath, TUI_TEST_CONVERSATION: this.conversationId, TUI_TEST_TASK_B: taskB } });
    if (!child.pid) throw Error('Owned PTY leader did not start');
    let stopping: Promise<Awaited<ReturnType<typeof stopGroup>>> | undefined;
    const owned = { pgid: child.pid, stop: () => stopping ??= stopGroup(child.pid!) }; this.groups.push(owned);
    const exit = new Promise<number | null>((done, reject) => { child.once('error', reject); child.once('close', done); });
    void exit.catch(() => {});
    let pending = '', outputBytes = 0, protocol = Promise.resolve(), report: unknown, offered = false;
    let failure: unknown;
    child.stdin.on('error', () => { failure ??= Error('PTY stage pipe closed'); });
    const parse = async (line: string) => {
      const message = JSON.parse(line) as { phase?: string; result?: unknown };
      if (message.phase === 'B-cancelled-visible' && !offered) {
        offered = true; const taskId = await afterCancelled(stage.signal); stage.signal.throwIfAborted(); child.stdin.end(JSON.stringify({ taskId }) + '\n');
      } else if (message.phase === 'finished' && offered && report === undefined) report = message.result;
      else if (message.phase === 'failure') { report = message.result; failure ??= Error('PTY driver failed'); }
      else throw Error('Unexpected PTY protocol');
    };
    child.stdout.on('data', (bytes: Buffer) => {
      outputBytes += bytes.length;
      if (outputBytes > 2 * 1024 ** 2) { failure ??= Error('PTY output bound'); void owned.stop().catch(() => {}); return; }
      pending += bytes.toString();
      let newline: number;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        protocol = protocol.then(() => parse(line)).catch(error => { failure ??= error; void owned.stop().catch(() => {}); });
      }
    });
    child.stderr.on('data', (bytes: Buffer) => { outputBytes += bytes.length; failure ??= Error('PTY stderr observed'); void owned.stop().catch(() => {}); });
    let code: number | null = null;
    try {
      code = await bounded(exit, 26_000, 'Owned PTY deadline'); await protocol;
      const group = await owned.stop(); this.record('ptyGroup', group);
      if (code !== 0 || !group.stopped || !report || pending || failure) throw Error('PTY result incomplete');
      return report as { exitCode: number; rawModeRestored: boolean; resized: number[]; unsentCjkMultilineDraft: boolean };
    } finally {
      // Persist even a timeout/driver error before the fixture considers deleting any recovery data.
      stage.abort();
      await bounded(protocol, 4000, 'PTY stage shutdown unknown').catch(() => { failure ??= Error('PTY stage unknown'); });
      const group = await owned.stop().catch(() => ({ pgid: owned.pgid, stopped: false, signals: [], unknown: true }));
      this.record('ptyGroupFinal', group);
      const capture = { code, group, outputBytes, report: report ?? null, incompleteLine: pending.slice(0, 16000), protocolFailure: failure ? 'PTY protocol failed' : null };
      this.record('ptyCapture', await this.save('pty.json', capture));
      if (!group.stopped || failure) throw Error('PTY cleanup/protocol unknown');
    }
  }
  private async readDirectoryIdentity(): Promise<DirectoryIdentity> {
    if (!this.directory) throw Error('Private directory was not created');
    const info = await lstat(this.directory);
    return { dev: info.dev, ino: info.ino, directory: info.isDirectory(), symbolicLink: info.isSymbolicLink() };
  }
  async close() {
    if (this.recipe) {
      if (!this.facts.handoff || this.tasks.length !== 2 || this.requests.length !== 0) this.failed('incomplete-two-turn-handoff');
    } else if (!this.facts.lostAck || !this.facts.ptyExit || this.tasks.length !== 3 || this.requests.length !== 3) this.failed('incomplete-three-turn-journey');
    const cleanup: Record<string, unknown> = { database: this.database, directory: this.directory ?? null, irreversibleCleanup: false };
    const attempt = async (label: string, operation: () => Promise<unknown>) => {
      try { cleanup[label] = await operation(); } catch { cleanup[label] = 'unknown'; this.failed(label); }
    };
    await attempt('groups', async () => {
      const groups = await Promise.all(this.groups.map(group => group.stop()));
      if (groups.some(group => !group.stopped)) throw Error('Process group remains'); return groups;
    });
    for (const terminal of this.terminals) await attempt('terminalClosed', () => terminal().then(() => true));
    if (this.client) await attempt('allTasks', () => this.client.queryTasks({ limit: 10 }, AbortSignal.timeout(1500)));
    if (this.client) await attempt('tasks', () => Promise.all(this.tasks.map(async id => {
      const task = await this.client.show(id, AbortSignal.timeout(1500));
      return { id: task.id, status: task.status, verificationStatus: task.verificationStatus, attempt: task.attempt };
    })));
    this.stop.abort();
    await attempt('runnerStopped', async () => { await bounded(this.runner ?? Promise.resolve(), 5000, 'Runner shutdown unknown');
      if (this.activeAdapters.size) throw Error('Adapter remains'); return true; });
    await attempt('proxyStopped', async () => {
      if (this.proxy) { this.proxy.closeAllConnections(); await bounded(new Promise<void>((done, reject) => this.proxy!.close(error => error ? reject(error) : done())), 2000, 'Proxy shutdown unknown'); }
      return true;
    });
    await attempt('centerStopped', async () => { await bounded(this.app?.close() ?? Promise.resolve(), 5000, 'Center shutdown unknown'); return true; });
    if (this.created && this.recipe) await attempt('databaseOwnership', async () => {
      const database = new URL(this.adminUrl); database.pathname = `/${this.database}`;
      const marker = new Pool({ connectionString: database.href, max: 1, connectionTimeoutMillis: 2000, query_timeout: 3000 });
      try {
        const rows = (await marker.query('SELECT marker FROM public.tui01f_handoff_owner LIMIT 2')).rows;
        if (rows.length !== 1 || rows[0].marker !== this.handoffMarker) throw Error('Handoff database ownership unknown');
        return { markerMatches: true };
      } finally { await marker.end(); }
    });
    if (this.created) await attempt('connections', async () => {
      const observation = await observeConnections(async () => (await this.admin!.query(
        'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33', [this.database])).rows);
      if (observation.state !== 'empty') this.failed(`connections-${observation.state}`);
      return observation;
    });
    if (this.recipe) await attempt('finalHandoffResourceBounds', this.recipe.beforeCleanup);
    // Unknown shutdown, failed evidence persistence or test failure retains both DB and tmp.
    const retained = await cleanupAfterCheckpoint({
      checkpoint: () => this.save('checkpoint.json', { at: new Date().toISOString(), facts: this.facts, requests: this.requests, failures: this.failures, cleanup }),
      removeDatabase: async () => {
        if (this.created) await this.admin!.query(`DROP DATABASE "${this.database}"`);
        const remaining = this.admin ? (await this.admin.query('SELECT datname FROM pg_database WHERE datname=$1', [this.database])).rows : [];
        if (remaining.length) throw Error('Private database remains');
      },
      readDirectory: () => this.readDirectoryIdentity(),
      removeDirectory: () => rm(this.directory!, { recursive: true, force: false }),
    }, !this.failures.length, this.directoryIdentity);
    this.failures.push(...retained.failures); Object.assign(cleanup, retained);
    cleanup.irreversibleCleanup = retained.databaseRemoved && retained.temporaryRemoved;
    await attempt('adminClosed', async () => { await this.admin?.end(); return true; });
    if (retained.checkpointConfirmed) await this.save('result.json', { at: new Date().toISOString(), facts: this.facts, requests: this.requests, failures: this.failures,
      cleanup, outcome: this.failures.length ? 'failed-or-unknown-retained' : 'passed', checkpoint: 'checkpoint.json' });
    if (!retained.checkpointConfirmed || this.failures.length) throw Error(`TUI01F evidence/cleanup incomplete; inspect explicit evidence before cleanup of ${this.database} or private tmp`);
  }
}
