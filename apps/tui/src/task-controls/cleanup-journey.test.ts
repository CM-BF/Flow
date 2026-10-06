import { test, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { Pool } from 'pg';
import { createServer } from '../../../server/src/index.js';
import { cleanupAfterCheckpoint, observeConnections, type DirectoryIdentity } from './fixture-cleanup.js';

/** A single future scoped PG consumer; no task, runtime, PTY or SDK starts here. */
test('production center close can be observed before checkpoint-gated private resource cleanup', async () => {
  const evidence = process.env.FLOW_TUI01F_CLEANUP_EVIDENCE_DIR;
  if (!evidence || !isAbsolute(evidence) || [resolve('.'), tmpdir()].includes(resolve(evidence))) throw Error('Fresh explicit cleanup evidence directory required');
  const adminUrl = process.env.FLOW_TEST_DATABASE_URL ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
  const parsed = new URL(adminUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.pathname !== '/postgres') throw Error('Local admin database required');
  await mkdir(evidence, { mode: 0o700 }); // No previous evidence may be reused.
  const database = `flow_tui01f_cleanup_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const facts: Record<string, unknown> = { database, ownerPid: process.pid, provider: 0, tasks: 0, runtimes: 0, PTY: 0 };
  const errors: string[] = [];
  let directory: string | undefined, originalIdentity: DirectoryIdentity | undefined;
  let databaseOid: number | undefined, ready = false;
  let app: Awaited<ReturnType<typeof createServer>> | undefined;
  const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 2000, query_timeout: 3000 });
  const marker = { operationId: randomUUID(), database };
  const save = async (name: string, value: unknown) => {
    const text = JSON.stringify(value, null, 2) + '\n';
    if (Buffer.byteLength(text) > 1024 ** 2) throw Error('Evidence bound exceeded');
    const file = await open(join(evidence, name), 'wx', 0o600);
    try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
    const parent = await open(evidence, 'r');
    try { await parent.sync(); } finally { await parent.close(); }
  };
  const identity = async (): Promise<DirectoryIdentity> => {
    if (!directory) throw Error('Private directory unavailable');
    const stat = await lstat(directory);
    return { dev: stat.dev, ino: stat.ino, directory: stat.isDirectory(), symbolicLink: stat.isSymbolicLink() };
  };
  const closeWithin = async (operation: Promise<unknown>) => {
    let timer: NodeJS.Timeout | undefined;
    try { await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Close unknown')), 5000); })]); }
    finally { clearTimeout(timer); }
  };
  try {
    directory = await mkdtemp(join(tmpdir(), 'flow-tui01f-cleanup-'));
    originalIdentity = await identity(); Object.assign(facts, { directory, originalIdentity, marker });
    const file = await open(join(directory, 'marker.json'), 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(marker)); await file.sync(); } finally { await file.close(); }
    await save('reservation.json', facts);
    await admin.query(`CREATE DATABASE "${database}"`);
    const created = (await admin.query('SELECT oid,datname,datdba FROM pg_database WHERE datname=$1', [database])).rows[0];
    if (!created || created.datname !== database) throw Error('Private database identity unknown');
    databaseOid = created.oid; facts.databaseIdentity = created;
    parsed.pathname = `/${database}`;
    app = await createServer({ databaseUrl: parsed.href, ownerToken: `synthetic-${randomUUID()}`, automaticQueueScan: false });
    facts.origin = await app.listen({ host: '127.0.0.1', port: 0 });
    ready = true;
  } catch { errors.push('setup-unknown'); }
  // Even a failed checkpoint must not leave the owned HTTP listener running.
  try { await closeWithin(app?.close() ?? Promise.resolve()); facts.centerClosed = true; }
  catch { errors.push('center-close-unknown'); }
  if (databaseOid !== undefined) {
    const observation = await observeConnections(async () => (await admin.query(
      'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33', [database])).rows);
    facts.connections = observation;
    if (observation.state !== 'empty') errors.push(`connections-${observation.state}`);
  }
  const cleanup = await cleanupAfterCheckpoint({
    checkpoint: () => save('checkpoint.json', { facts, errors }),
    removeDatabase: async () => {
      const current = (await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [database])).rows[0];
      if (current?.oid !== databaseOid) throw Error('Database identity changed');
      await admin.query(`DROP DATABASE "${database}"`);
      if ((await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [database])).rowCount) throw Error('Private database remains');
    },
    readDirectory: async () => {
      if (await readFile(join(directory!, 'marker.json'), 'utf8') !== JSON.stringify(marker)) throw Error('Private marker changed');
      return identity();
    },
    removeDirectory: () => rm(directory!, { recursive: true, force: false }),
  }, ready && errors.length === 0, originalIdentity);
  errors.push(...cleanup.failures);
  try { await closeWithin(admin.end()); facts.adminClosed = true; }
  catch { errors.push('admin-close-unknown'); }
  await save('result.json', { facts, cleanup, errors, outcome: errors.length ? 'failed-or-unknown' : 'passed' });
  expect(errors).toEqual([]);
  expect(cleanup).toMatchObject({ checkpointConfirmed: true, databaseRemoved: true, temporaryRemoved: true });
}, 60_000);
