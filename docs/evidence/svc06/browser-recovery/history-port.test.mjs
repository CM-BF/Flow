import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { snapshot, checkRuntimeOnly } from '../update-diagnostics-candidate/history-projection.mjs';

test('history port uses explicit config marker and Pool for the same bounded read-only projection', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'svc06b-history-port-'))), output = join(root, 'history.json');
  const calls = [];
  class Pool {
    constructor(options) { calls.push(['pool', options.max]); }
    async connect() { return { query: async (sql, values) => {
      calls.push(['query', sql, values]);
      if (sql.startsWith('SELECT tablename')) return { rows: [{ name: 'tasks' }] };
      if (sql.startsWith('SELECT column_name')) return { rows: [{ column_name: 'id' }] };
      return { rows: [{ count: 1, digest: 'a'.repeat(32) }] };
    }, release: () => calls.push(['release']) }; }
    async end() { calls.push(['end']); }
  }
  const dependencies = { Pool, loadPreviewConfiguration: async directory => {
    assert.equal(directory, '/Users/citrine/.flow-personal'); calls.push(['config']);
    return { directory, installationId: 'synthetic', databaseName: 'synthetic', databaseUrl: 'not-connected' };
  }, assertPreviewMarker: async config => { assert.equal(config.installationId, 'synthetic'); calls.push(['marker']); } };
  try {
    assert.equal((await snapshot(output, undefined, dependencies)).tableCount, 1);
    const value = JSON.parse(await readFile(output));
    assert.deepEqual(value.tables[0], { name: 'tasks', columns: ['id'], count: 1, digest: 'a'.repeat(32) });
    assert.equal(calls[3][1], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert.ok(calls.some(row => row[0] === 'query' && row[1].includes('FROM flow."tasks" LIMIT 10001')));
    assert.deepEqual(calls.slice(-2), [['release'], ['end']]);
    const prior = calls.length;
    await assert.rejects(snapshot(output, undefined, dependencies), /OUTPUT_ALREADY_EXISTS/);
    assert.equal(calls.length, prior, 'exclusive output fails before config, marker or Pool');
  } finally { await rm(root, { recursive: true }); }
});

test('history port default loader keeps the published pg shape without connecting', async () => {
  const result = await checkRuntimeOnly();
  assert.equal(result.databaseConnections, 0); assert.match(result.pgEntry, /pg/);
});
