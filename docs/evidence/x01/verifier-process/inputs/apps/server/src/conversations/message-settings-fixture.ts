import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { request as nodeRequest } from 'node:http';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import type { ClaimedTask, RunnerEventData } from '@flow/contracts';
import { createServer } from '../index.js';
import { migrate } from '../database.js';
import { migrateConversations } from './index.js';
import { migrateExecutionProfiles } from '../execution-profiles/index.js';
import { migrateConversationQueue } from '../conversation-queue/index.js';
import { migrateClaudeMessageSettings } from './message-settings-migration.js';
import { CLAUDE_TURN_SETTINGS_PROTOCOL, type ClaudeTurnSettings } from '../../../../packages/contracts/src/claude-turn-settings.js';
import type { ExecutionProfileConfiguration, ExecutionProfilePublished } from '../../../../packages/contracts/src/execution-profiles.js';
import type { ConversationCreated, ConversationTurnAccepted } from '../../../../packages/contracts/src/conversations.js';

export const choices: ClaudeTurnSettings['requested'][] = [
  { model: 'synthetic-alias-a', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'fast' },
  { model: 'synthetic-alias-b', thinking: 'disabled', effort: { kind: 'level', value: 'low' }, speed: 'standard' },
  { model: 'synthetic-alias-b', thinking: 'disabled', effort: { kind: 'not-requested' }, speed: 'standard' },
];
export const legacyConfiguration: ExecutionProfileConfiguration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'legacy-profile-model', thinking: 'disabled',
  permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: 'a'.repeat(64), limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 } };
const bounds = { connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 6000 };

/** One fresh owned database. No existing test database, provider or automatic queue worker. */
export class MessageSettingsFixture {
  readonly database = `flow_message_settings_${randomUUID().replaceAll('-', '')}`;
  readonly ownerToken = randomUUID();
  readonly legacyConversation = randomUUID();
  readonly legacyQueue = randomUUID();
  readonly legacyTask = randomUUID();
  readonly facts: Record<string, unknown> = { providerCalls: 0, upgradeMigrationSequence: [1, 2, 7, 10, 11, 32], maxTasks: 32, maxEvidenceBytes: 32768 };
  readonly admin: Pool;
  readonly pool: Pool;
  readonly boss: PgBoss;
  private readonly databaseUrl: string;
  private app?: Awaited<ReturnType<typeof createServer>>;
  private origin = '';
  private creationRequested = false;
  private started = 0;
  private requests = 0;
  constructor() {
    const configured = process.env.FLOW_M02_SETTINGS_ADMIN_URL;
    if (!configured) throw new Error('Explicit approved FLOW_M02_SETTINGS_ADMIN_URL is required.');
    const url = new URL(configured);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432') throw new Error('Only the approved local database endpoint is allowed.');
    url.pathname = '/postgres'; this.admin = new Pool({ ...bounds, connectionString: url.href, max: 1 });
    url.pathname = `/${this.database}`; this.databaseUrl = url.href;
    this.pool = new Pool({ ...bounds, connectionString: url.href, max: 2 });
    this.boss = new PgBoss({ connectionString: url.href, max: 1, connectionTimeoutMillis: 2000 });
    // Never serialize an error object, SQL parameter, credential or response body as evidence.
    this.pool.on('error', () => { this.facts.poolError = true; });
    this.admin.on('error', () => { this.facts.adminError = true; });
    this.boss.on('error', () => { this.facts.bossError = true; });
  }
  async start(): Promise<void> {
    this.started = performance.now(); this.facts.startedAt = new Date().toISOString();
    assert.equal((await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database])).rowCount, 0);
    this.creationRequested = true;
    await this.admin.query(`CREATE DATABASE "${this.database}"`);
    // Only the real prerequisite migration functions precede the upgrade specimen.
    // The production factory runs afterward, so future factory mounting cannot falsify pre-032 evidence.
    await migrate(this.pool); await migrateConversations(this.pool); await migrateExecutionProfiles(this.pool); await migrateConversationQueue(this.pool);
    assert.equal((await this.pool.query('SELECT 1 FROM flow.migrations WHERE version=32')).rowCount, 0);
    this.facts.pre032Absent = true;
    // Pre-032 rows prove the nullable migration preserves legacy data byte-for-byte.
    await this.pool.query('INSERT INTO flow.conversations(id,title,harness,requested) VALUES($1,$2,$3,$4)',
      [this.legacyConversation, 'Legacy migration fixture', 'claude', { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' }]);
    await this.pool.query('INSERT INTO flow.conversation_queue(id,conversation_id,sequence,user_text) VALUES($1,$2,1,$3)', [this.legacyQueue, this.legacyConversation, 'unchanged legacy text']);
    await this.pool.query('INSERT INTO flow.tasks(id,submission) VALUES($1,$2)', [this.legacyTask, { title: 'Legacy migration fixture', prompt: 'unchanged legacy prompt', harness: 'fixture' }]);
    await migrateClaudeMessageSettings(this.pool);
    this.app = await createServer({ databaseUrl: this.databaseUrl, ownerToken: this.ownerToken, leaseMs: 300_000, automaticQueueScan: false });
    await this.boss.start({ attempts: 1 });
    this.origin = await this.app.listen({ host: '127.0.0.1', port: 0 });
  }
  async http<T>(path: string, body?: unknown, options: { token?: string; key?: string; status?: number; headers?: Record<string, string> } = {}): Promise<T> {
    assert.ok(performance.now() - this.started < 120_000, 'Functional work deadline exceeded');
    assert.ok(++this.requests <= 256, 'HTTP request budget exceeded');
    const response = await fetch(`${this.origin}${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'omit',
      headers: { authorization: `Bearer ${options.token ?? this.ownerToken}`, 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID(), ...options.headers },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(7000) });
    const text = await response.text(); assert.ok(Buffer.byteLength(text) <= 131072, 'Response exceeds fixture bound');
    assert.equal(response.status, options.status ?? 200, 'Unexpected HTTP status');
    return JSON.parse(text) as T;
  }
  async profile(optIn = true) {
    const runner = await this.http<{ runnerId: string; token: string }>('/api/runners', { name: 'Injected message settings fixture', harnesses: ['claude'], capacity: 1 });
    const publication = await this.http<ExecutionProfilePublished>('/api/runner/execution-profile', { configuration: { ...legacyConfiguration,
      ...(optIn ? { turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices } } : {}) } }, { token: runner.token });
    const reference = publication.profile.reference;
    return { ...runner, publication, reference, settings: (choice = 0): ClaudeTurnSettings => ({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, requested: choices[choice]! }) };
  }
  async duplicateHeaderCatalog(): Promise<unknown> {
    assert.ok(performance.now() - this.started < 120_000); assert.ok(++this.requests <= 256);
    return new Promise((resolve, reject) => {
      const request = nodeRequest(`${this.origin}/api/execution-profiles?limit=1`, { agent: false,
        headers: ['Host', new URL(this.origin).host, 'Authorization', `Bearer ${this.ownerToken}`,
          'X-Flow-Execution-Profile', CLAUDE_TURN_SETTINGS_PROTOCOL, 'X-Flow-Execution-Profile', CLAUDE_TURN_SETTINGS_PROTOCOL] }, response => {
        const chunks: Buffer[] = []; let bytes = 0;
        response.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 131072) request.destroy(new Error('Response bound')); else chunks.push(chunk); });
        response.on('error', reject);
        response.on('end', () => { try { assert.equal(response.statusCode, 200); resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); } });
      });
      request.setTimeout(7000, () => request.destroy(new Error('HTTP deadline'))); request.on('error', reject); request.end();
    });
  }
  async conversation(profile?: ClaudeTurnSettings['profile']): Promise<string> {
    const created = await this.http<ConversationCreated>('/api/conversations', { title: 'Message settings fixture', ...(profile ? { executionProfile: profile } : {}) }, { status: 201 });
    return created.conversation.id;
  }
  async send(conversationId: string, settings: ClaudeTurnSettings, expectedRevision = 0, key = randomUUID()) {
    return this.http<ConversationTurnAccepted>(`/api/conversations/${conversationId}/turns`, { expectedRevision, text: 'Frozen message', messageSettings: settings }, { status: 202, key });
  }
  async claim(token: string, taskId: string): Promise<ClaimedTask> {
    // Scheduler readiness is a separately owned concern; no polling or retrying an unknown claim ACK.
    await this.pool.query("UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1 AND status='queued'", [taskId]);
    const result = await this.http<{ assignment: ClaimedTask | null }>('/api/runner/claim', {}, { token });
    assert.equal(result.assignment?.task.id, taskId); return result.assignment!;
  }
  async report(token: string, assignment: ClaimedTask, events: RunnerEventData[], sequence = 1, status = 200) {
    return this.http('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
      events: events.map((event, index) => ({ ...event, id: randomUUID(), sequence: sequence + index })) }, { token, status });
  }
  async close(): Promise<void> {
    const errors: string[] = [];
    async function settle<T>(name: string, action: () => Promise<T>): Promise<T | undefined> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([action(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Cleanup deadline')), 8000); })]); }
      catch { errors.push(name); return undefined; } finally { clearTimeout(timer); }
    }
    const counts = this.creationRequested ? await settle('counts', () => this.pool.query('SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.attempts) AS attempts')) : undefined;
    const appClosed = await settle('app-close', async () => { await this.app?.close(); return true; });
    const bossClosed = await settle('boss-close', async () => { await this.boss.stop({ graceful: true, timeout: 3000 }); return true; });
    const poolClosed = await settle('pool-close', async () => { await this.pool.end(); return true; });
    const exists = await settle('database-exists', () => this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database]));
    const connections = await settle('connections', () => this.admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [this.database]));
    if (this.creationRequested && appClosed && bossClosed && poolClosed && exists?.rowCount === 1 && connections?.rowCount === 0) {
      await settle('drop', () => this.admin.query(`DROP DATABASE "${this.database}"`));
    }
    const remaining = await settle('remaining', () => this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database]));
    const adminClosed = await settle('admin-close', async () => { await this.admin.end(); return true; });
    Object.assign(this.facts, { database: this.database, creationRequested: this.creationRequested, counts: counts?.rows[0] ?? null,
      requests: this.requests, appClosed: appClosed ?? false, bossClosed: bossClosed ?? false, poolClosed: poolClosed ?? false, adminClosed: adminClosed ?? false,
      connections: connections?.rowCount ?? null, absent: remaining?.rowCount === 0, errors, elapsedMs: performance.now() - this.started, finishedAt: new Date().toISOString() });
    const encoded = JSON.stringify(this.facts, null, 2) + '\n'; assert.ok(Buffer.byteLength(encoded) <= 32768);
    if (process.env.FLOW_M02_SETTINGS_EVIDENCE) await writeFile(process.env.FLOW_M02_SETTINGS_EVIDENCE, encoded, { flag: 'wx' });
    assert.deepEqual(errors, []); assert.equal(remaining?.rowCount, 0); assert.ok((counts?.rows[0]?.tasks ?? 33) <= 32);
  }
}
