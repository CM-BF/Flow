import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import net from 'node:net';
import { fixture } from './fixture.mjs';
import { coordinationPool, initializeLedger, applyCommand, readAssignments, assignmentSnapshot } from '../src/coordination/ledger.mjs';
import { literalScope, scopesOverlap } from '../src/coordination/input.mjs';
const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const cli = fileURLToPath(new URL('../src/coordination/cli.mjs', import.meta.url));
const adminUrl = process.env.FLOW_COORDINATION_TEST_ADMIN;

test('literal paths compare by segments, reject traversal/globs, and normalize directory slash', () => {
  assert.deepEqual(literalScope(['foo/', 'foo', 'foobar/file']), ['foo', 'foobar/file']);
  assert.equal(scopesOverlap(['foo'], ['foobar/file']), false);
  assert.equal(scopesOverlap(['foo'], ['foo/child']), true);
  for (const value of ['../x', 'a/../b', '/tmp/x', './foo', 'a//b', '**/foo', 'a\\b', 'foo[0]', '.git/config']) assert.throws(() => literalScope([value]));
});

test('independent PostgreSQL processes allocate atomically, replay receipts, fence changes and retain handoff occupancy', { skip: !adminUrl, timeout: 20000 }, async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'flow-claims-test-'));
  const dbName = `flow_claims_test_${process.pid}`;
  const admin = new pg.Pool({ connectionString: adminUrl });
  let pool;
  try {
    await admin.query(`CREATE DATABASE ${dbName}`);
    const target = new URL(adminUrl); target.pathname = `/${dbName}`;
    pool = coordinationPool(target.toString());
    await initializeLedger(pool);
    const worktrees = [];
    for (let index = 0; index < 5; index++) {
      const worktree = path.join(temporary, `tree${index}`);
      await execute('git', ['-C', repository, 'worktree', 'add', '--detach', worktree, 'HEAD']);
      worktrees.push(worktree);
    }
    // Detached trees are deliberately refused; test peers use explicit local branch names.
    for (let index = 0; index < 5; index++) await execute('git', ['-C', worktrees[index], 'switch', '-c', `codex/d04-test-${process.pid}-${index}`]);
    const command = (id, index, scope, taskId = id) => ({ requestId: id, actor: { lead: 'lead', worker: id }, taskId, role: 'writer', branch: `codex/d04-test-${process.pid}-${index}`, worktree: worktrees[index], scope });
    const peer = async input => {
      const file = path.join(temporary, `${input.requestId}.json`);
      await writeFile(file, JSON.stringify(input));
      try {
        const result = await execute(process.execPath, [cli, 'take', file], { env: { ...process.env, FLOW_COORDINATION_DATABASE_URL: target.toString(), FLOW_COORDINATION_REPO: repository }, timeout: 5000 });
        return { ok: true, receipt: JSON.parse(result.stdout) };
      } catch (error) { return { ok: false, error: JSON.parse(error.stderr) }; }
    };
    const identical = await Promise.all([peer(command('SAME-A', 0, ['alpha'], 'SAME')), peer(command('SAME-B', 1, ['beta'], 'SAME'))]);
    assert.equal(identical.filter(value => value.ok).length, 1);
    assert.equal(identical.find(value => !value.ok).error.code, 'CONFLICT');
    let current = identical.find(value => value.ok).receipt.claim;
    const release = value => applyCommand(pool, { action: 'release', requestId: `release-${value.claimId}`, actor: value, claimId: value.claimId, version: value.version, stoppedWriting: true }, repository);
    await release(current);
    const nested = await Promise.all([peer(command('PARENT', 0, ['src'])), peer(command('CHILD', 1, ['src/nested/file.ts']))]);
    assert.equal(nested.filter(value => value.ok).length, 1);
    await release(nested.find(value => value.ok).receipt.claim);
    const separateInputs = [command('FREE-A', 0, ['foo']), command('FREE-B', 1, ['foobar'])];
    const separate = await Promise.all(separateInputs.map(peer));
    assert.ok(separate.every(value => value.ok));
    assert.deepEqual((await peer(separateInputs[0])).receipt, separate[0].receipt, 'lost response retry returns original committed receipt');
    const changedRequest = await peer({ ...separateInputs[0], scope: ['other'] });
    assert.equal(changedRequest.error.code, 'REQUEST_CONFLICT');
    current = separate[0].receipt.claim;
    const update = (action, extra = {}) => ({ action, requestId: `${action}-${crypto.randomUUID()}`, actor: current, claimId: current.claimId, version: current.version, ...extra });
    await assert.rejects(applyCommand(pool, update('amend', { scope: ['foobar/child'] }), repository), error => error.code === 'CONFLICT');
    assert.deepEqual((await readAssignments(pool)).claims.find(c => c.claimId === current.claimId).scope, ['foo']);
    const amended = await applyCommand(pool, update('amend', { scope: ['foo', 'new/file'] }), repository);
    await assert.rejects(applyCommand(pool, update('release', { stoppedWriting: true }), repository), error => error.code === 'STALE_VERSION');
    await assert.rejects(applyCommand(pool, update('handoff', { stoppedWriting: true, next: { lead: 'other', worker: 'other', worktree: worktrees[2], branch: `codex/d04-test-${process.pid}-2` } }), repository), error => error.code === 'STALE_VERSION');
    current = amended.claim;
    await assert.rejects(applyCommand(pool, update('release'), repository), error => error.code === 'INVALID');
    const next = { lead: 'next-lead', worker: 'next-worker', worktree: worktrees[2], branch: `codex/d04-test-${process.pid}-2` };
    const handing = await applyCommand(pool, update('handoff', { stoppedWriting: true, next }), repository);
    assert.equal(handing.claim.state, 'handoff_pending');
    assert.equal((await peer(command('INTRUDER', 3, ['new/file']))).error.code, 'CONFLICT');
    const accepted = await applyCommand(pool, { action: 'accept', requestId: 'accept', actor: next, claimId: current.claimId, version: handing.claim.version }, repository);
    assert.equal(accepted.claim.worker, next.worker);
    await assert.rejects(applyCommand(pool, { action: 'touch', requestId: 'old-writer', actor: current, claimId: current.claimId, version: accepted.claim.version }, repository), error => error.code === 'OWNER_MISMATCH');
    const stale = await readAssignments(pool, Date.now() + 25 * 3600000);
    assert.ok(stale.claims.find(c => c.claimId === current.claimId).needsVerification);
    assert.equal((await peer(command('STALE-STEAL', 3, ['foo']))).error.code, 'CONFLICT');
    const reviewer = { ...command('REVIEW', 3, ['foo']), role: 'review' };
    assert.ok((await peer(reviewer)).ok);
    const audit = await pool.query('SELECT count(*)::int AS count FROM flow_engineering.audit');
    assert.ok(audit.rows[0].count >= 9);
  } finally {
    if (pool) await pool.end();
    const listing = await execute('git', ['-C', repository, 'worktree', 'list', '--porcelain']);
    for (const line of listing.stdout.split('\n')) if (line.startsWith(`worktree ${temporary}/`)) await execute('git', ['-C', repository, 'worktree', 'remove', '--force', line.slice(9)]);
    for (let index = 0; index < 5; index++) await execute('git', ['-C', repository, 'branch', '-D', `codex/d04-test-${process.pid}-${index}`]).catch(() => {});
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.end();
    await rm(temporary, { recursive: true, force: true });
  }
});

test('missing and unreachable coordination databases return unknown within bounded time', async () => {
  assert.equal((await assignmentSnapshot('')).state, 'unknown');
  const start = performance.now();
  const result = await assignmentSnapshot('postgresql://fake:fake@127.0.0.1:1/nonexistent');
  assert.equal(result.state, 'unknown');
  assert.deepEqual(result.claims, []);
  assert.ok(performance.now() - start < 2500);
});


test('a silent PostgreSQL endpoint cannot hang the dashboard or erase progress', { timeout: 5000 }, async context => {
  const sockets = new Set();
  const blackhole = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => blackhole.listen(0, '127.0.0.1', resolve));
  const prior = process.env.FLOW_COORDINATION_DATABASE_URL;
  process.env.FLOW_COORDINATION_DATABASE_URL = `postgresql://fake:fake@127.0.0.1:${blackhole.address().port}/ignored`;
  try {
    const f = await fixture(context);
    const start = performance.now();
    const response = await fetch(`${f.url}/api/snapshot`);
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.equal(snapshot.assignments.state, 'unknown');
    assert.equal(snapshot.tasks.length, 2);
    assert.ok(snapshot.tasks.every(task => task.source.mode === 'live' && task.assignments === null));
    assert.ok(performance.now() - start < 2500, 'connection timeout must bound status response');
  } finally {
    if (prior === undefined) delete process.env.FLOW_COORDINATION_DATABASE_URL; else process.env.FLOW_COORDINATION_DATABASE_URL = prior;
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => blackhole.close(resolve));
  }
});
