import assert from 'node:assert/strict';
import { lstat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { cleanupAfterCheckpoint, observeConnections } from '../../../../apps/tui/src/task-controls/fixture-cleanup.ts';
import { writeRecord } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/continuous-native-goal-acceptance/experiments/continuous-goal-acceptance/records.mjs';
const database = 'flow_tui01f_bb02a6d703a3', marker = '3b98f9e6-4f13-48bb-aaee-8723d9141dd9';
const directory = '/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/flow-tui01f-CviAys';
const evidence = new URL('./', import.meta.url).pathname;
const expected = { dev: 16777234, ino: 123194387, directory: true, symbolicLink: false };
const facts = { at: new Date().toISOString(), database, marker, directory, expected, groups: [], outcome: 'unknown-retain' };
const identity = async () => { const s = await lstat(directory); return { dev: s.dev, ino: s.ino, directory: s.isDirectory(), symbolicLink: s.isSymbolicLink() }; };
await writeRecord(join(evidence, 'cleanup-once-reservation.json'), facts, { exclusive: true });
let admin, target;
try {
  for (const pgid of [18112, 19956, 24633]) {
    try { process.kill(-pgid, 0); throw Error('Owned group present'); }
    catch (error) { assert.equal(error.code, 'ESRCH'); facts.groups.push({ pgid, state: 'absent' }); }
  }
  assert.deepEqual(await identity(), expected);
  const url = new URL(process.env.FLOW_TEST_DATABASE_URL ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname === '/postgres');
  const options = { max: 1, connectionTimeoutMillis: 1500, query_timeout: 2000, statement_timeout: 1500 };
  admin = new Pool({ ...options, connectionString: url.href }); admin.on('error', () => { facts.adminError = true; });
  url.pathname = '/' + database; target = new Pool({ ...options, connectionString: url.href }); target.on('error', () => { facts.targetError = true; });
  const owned = (await target.query('SELECT marker FROM public.tui01f_handoff_owner LIMIT 2')).rows;
  assert(owned.length === 1 && owned[0].marker === marker); facts.markerMatches = true;
  facts.taskCount = Number((await target.query('SELECT count(*) AS count FROM flow.tasks')).rows[0].count); assert.equal(facts.taskCount, 0);
  facts.databaseBytes = Number((await admin.query('SELECT pg_database_size($1) AS bytes', [database])).rows[0].bytes);
  await target.end(); target = undefined;
  facts.connections = await observeConnections(async () => (await admin.query('SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33', [database])).rows);
  assert.equal(facts.connections.state, 'empty'); assert(!facts.adminError && !facts.targetError);
  facts.cleanup = await cleanupAfterCheckpoint({
    checkpoint: () => writeRecord(join(evidence, 'cleanup-once-checkpoint.json'), facts, { exclusive: true }),
    removeDatabase: async () => { await admin.query('DROP DATABASE "flow_tui01f_bb02a6d703a3"');
      facts.databaseRemaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows; assert.equal(facts.databaseRemaining.length, 0); },
    readDirectory: identity,
    removeDirectory: async () => { await rm(directory, { recursive: true, force: false });
      await assert.rejects(lstat(directory), { code: 'ENOENT' }); },
  }, true, expected);
  assert(facts.cleanup.checkpointConfirmed && facts.cleanup.databaseRemoved && facts.cleanup.temporaryRemoved && !facts.cleanup.failures.length);
  facts.outcome = 'normal-cleanup-confirmed';
} catch (error) { facts.failure = { name: error.name, code: error.code ?? null, message: 'Ownership, bounded observation or normal cleanup not confirmed; retain remaining resources' }; }
finally {
  for (const [name, pool] of [['target', target], ['admin', admin]]) if (pool) {
    try { await pool.end(); facts[name + 'Closed'] = true; }
    catch (error) { facts.outcome = 'unknown-retain'; facts[name + 'CloseError'] = { name: error.name, code: error.code ?? null }; }
  }
  facts.endedAt = new Date().toISOString(); await writeRecord(join(evidence, 'cleanup-once-result.json'), facts, { exclusive: true });
}
process.stdout.write(JSON.stringify(facts) + '\n');
if (facts.outcome !== 'normal-cleanup-confirmed') process.exitCode = 1;
