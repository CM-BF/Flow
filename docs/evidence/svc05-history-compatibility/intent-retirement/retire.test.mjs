import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, rm, readdir, rename, open } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { retireIntent, inspectRetirement, identity, sha, source, preservedQueueProtocol } from './retire.mjs';
import { exactHistory } from './host-fence.mjs';

let peakBytes = 0;
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'flow-intent-retirement-'));
  const baseUrl = 'http://127.0.0.1:61227', namespace = sha(baseUrl), directory = join(root, 'runner', namespace);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const journal = join(directory, 'admission.json'), original = Buffer.from(JSON.stringify({ version: 1, inFlight: randomUUID(), assignments: [] }));
  await writeFile(journal, original, { mode: 0o600 });
  await writeFile(join(directory, 'historical-result.txt'), 'fixed history', { mode: 0o600 });
  const request = { source, root, baseUrl, namespace, retirementId: randomUUID(), operationId: randomUUID(), holdVersion: 17,
    runnerId: randomUUID(), originalSha256: sha(original), rootIdentity: identity(await lstat(root)),
    runnerIdentity: identity(await lstat(join(root, 'runner'))), namespaceIdentity: identity(await lstat(directory)), journalIdentity: identity(await lstat(journal)) };
  const fact = { source, sourceClean: true, runnerId: request.runnerId, operationId: request.operationId, version: 17, state: 'maintenance',
    runnerStopped: true, soleWriterConfirmed: true, inventoryComplete: true, globalUnfinished: 0, globalUncertain: 0,
    pendingTasks: 0, pendingQueue: 0, pendingOutbox: 0, pendingFinal: 0, pendingUnknown: 0 };
  const ports = { withFence: async (_request, use) => use(async () => fact) };
  const archive = join(root, 'admission-retirement-' + request.retirementId);
  try { await run({ request, fact, ports, journal, original, archive, directory }); }
  finally {
    const rows = [];
    async function scan(path) { for (const name of await readdir(path)) { const p = join(path, name), st = await lstat(p); if (st.isDirectory()) await scan(p); else rows.push({ path: p.slice(root.length + 1), bytes: st.size, sha256: sha(await readFile(p)) }); } }
    await scan(root); const bytes = rows.reduce((n, row) => n + row.bytes, 0); peakBytes = Math.max(peakBytes, bytes);
    assert.ok(bytes < 1024 * 1024);
    const checkpoint = { kind: 'synthetic-checkpoint', root, dev: request.rootIdentity.dev, ino: request.rootIdentity.ino, rows, bytes };
    if (process.env.FLOW_RETIREMENT_CHECKPOINT_DIR) {
      const file = await open(join(process.env.FLOW_RETIREMENT_CHECKPOINT_DIR, request.retirementId + '.json'), 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(checkpoint) + '\n'); await file.sync(); } finally { await file.close(); }
      const parent = await open(process.env.FLOW_RETIREMENT_CHECKPOINT_DIR, 'r'); try { await parent.sync(); } finally { await parent.close(); }
    }
    console.log(JSON.stringify(checkpoint));
    const st = await lstat(root); assert.deepEqual(identity(st), request.rootIdentity); await rm(root, { recursive: true });
    console.log(JSON.stringify({ kind: 'synthetic-cleanup', root, removed: await lstat(root).then(() => false, e => e.code === 'ENOENT'), peakBytes }));
  }
}

test('retires only the specified intent after durable original and intent, preserving history', () => fixture(async f => {
  f.ports.boundary = async phase => {
    if (phase === 'stage') { assert.deepEqual(await readFile(join(f.archive, 'original.bin')), f.original); assert.equal(JSON.parse(await readFile(join(f.archive, 'intent.json'))).originalSha256, f.request.originalSha256); }
  };
  assert.equal((await retireIntent(f.request, f.ports)).outcome, 'retired');
  assert.deepEqual(JSON.parse(await readFile(f.journal)), { version: 1, inFlight: null, assignments: [] });
  assert.equal(await readFile(join(f.directory, 'historical-result.txt'), 'utf8'), 'fixed history');
  assert.equal((await lstat(join(f.archive, 'original.bin'))).mode & 0o777, 0o600);
  assert.equal((await inspectRetirement(f.request)).current, 'retired-bytes');
}));
test('rejects every source, hold, ownership and pending guard without writing journal', () => fixture(async f => {
  for (const [field, value] of Object.entries({ source: 'bad', sourceClean: false, runnerId: randomUUID(), operationId: randomUUID(), version: 16,
    state: 'draining', runnerStopped: false, soleWriterConfirmed: false, inventoryComplete: false, globalUnfinished: 1,
    globalUncertain: 1, pendingTasks: 1, pendingOutbox: 1, pendingFinal: 1, pendingUnknown: 1 })) {
    const result = await retireIntent(f.request, { withFence: async (_r, use) => use(async () => ({ ...f.fact, [field]: value })) });
    assert.equal(result.outcome, 'not-retired', field); assert.deepEqual(await readFile(f.journal), f.original);
  }
}));
test('rejects wrong namespace, original hash and inode', () => fixture(async f => {
  for (const delta of [{ namespace: 'a'.repeat(64) }, { originalSha256: '0'.repeat(64) }, { journalIdentity: { ...f.request.journalIdentity, ino: 0 } }]) {
    assert.equal((await retireIntent({ ...f.request, ...delta }, f.ports)).outcome, 'not-retired');
    assert.deepEqual(await readFile(f.journal), f.original);
  }
}));
test('backup failure leaves original untouched and retains unknown operation', () => fixture(async f => {
  f.ports.boundary = async phase => { if (phase === 'backup') throw Error('simulated-backup-failure'); };
  assert.equal((await retireIntent(f.request, f.ports)).outcome, 'unknown'); assert.deepEqual(await readFile(f.journal), f.original);
}));
test('intent persistence failure retains durable original and does not rename', () => fixture(async f => {
  f.ports.boundary = async phase => { if (phase === 'intent') await mkdir(join(f.archive, 'intent.json')); };
  assert.equal((await retireIntent(f.request, f.ports)).outcome, 'unknown');
  assert.deepEqual(await readFile(join(f.archive, 'original.bin')), f.original); assert.deepEqual(await readFile(f.journal), f.original);
  assert.equal((await inspectRetirement(f.request)).current, 'original');
}));
test('a fence change during preparation refuses the replacement', () => fixture(async f => {
  let calls = 0; f.ports.withFence = async (_r, use) => use(async () => ({ ...f.fact, globalUnfinished: calls++ ? 1 : 0 }));
  assert.equal((await retireIntent(f.request, f.ports)).outcome, 'unknown'); assert.deepEqual(await readFile(f.journal), f.original);
}));
test('atomic replacement of original inode during preparation is refused', () => fixture(async f => {
  f.ports.boundary = async phase => { if (phase === 'recheck') { await writeFile(f.journal + '.other', f.original, { mode: 0o600 }); await rename(f.journal + '.other', f.journal); } };
  assert.equal((await retireIntent(f.request, f.ports)).code, 'ORIGINAL_CHANGED'); assert.deepEqual(await readFile(f.journal), f.original);
}));
test('audit failure after rename stays unknown and permits read-only byte classification', () => fixture(async f => {
  f.ports.boundary = async phase => { if (phase === 'audit') throw Error('simulated-result-write-failure'); };
  const r = await retireIntent(f.request, f.ports); assert.equal(r.outcome, 'unknown'); assert.equal(r.renamed, true);
  const before = await lstat(f.journal), digest = sha(await readFile(f.journal));
  assert.equal((await inspectRetirement(f.request)).current, 'retired-bytes');
  assert.equal((await lstat(f.journal)).mtimeMs, before.mtimeMs); assert.equal(sha(await readFile(f.journal)), digest);
}));
test('duplicate operation never rewrites a failed pre-rename attempt', () => fixture(async f => {
  f.ports.boundary = async phase => { if (phase === 'stage') throw Error('stopped'); };
  assert.equal((await retireIntent(f.request, f.ports)).outcome, 'unknown');
  delete f.ports.boundary;
  const second = await retireIntent(f.request, f.ports); assert.equal(second.code, 'EEXIST'); assert.equal(second.outcome, 'unknown');
  assert.deepEqual(await readFile(f.journal), f.original);
}));
test('pending queue refuses retirement while empty queue allows the same guarded transition', () => fixture(async f => {
  f.fact.pendingQueue = 1;
  assert.equal((await retireIntent(f.request, f.ports)).outcome, 'not-retired'); assert.deepEqual(await readFile(f.journal), f.original);
  f.fact.pendingQueue = 0; assert.equal((await retireIntent(f.request, f.ports)).outcome, 'retired');
}));
test('actual bounded inventory rejects history changes and all pending/unknown files', () => fixture(async f => {
  await rm(join(f.directory, 'historical-result.txt'));
  f.request.history = [];
  for (let i = 0; i < 4; i++) {
    const path = f.request.namespace + '/' + sha(String(i)) + '/claude-result-' + randomUUID() + '.txt';
    const local = join(f.request.root, 'runner', path); await mkdir(join(f.directory, sha(String(i))), { mode: 0o700 });
    const bytes = Buffer.from('immutable synthetic result ' + i); await writeFile(local, bytes, { mode: 0o600 });
    f.request.history.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
  await exactHistory(f.request);
  const changed = join(f.request.root, 'runner', f.request.history[0].path), original = await readFile(changed);
  await writeFile(changed, 'changed'); await assert.rejects(exactHistory(f.request), { code: 'HISTORY_CHANGED' }); await writeFile(changed, original);
  for (const name of ['pending-events.json', 'pending-final-proposal.json', 'uncertain-events.json', 'unfamiliar.tmp']) {
    const extra = join(f.directory, sha('0'), name); await writeFile(extra, '{}', { mode: 0o600 });
    await assert.rejects(exactHistory(f.request), { code: 'PENDING_OR_UNKNOWN_FILE' }); await rm(extra);
  }
  await exactHistory(f.request);
}));

function queuedConfirmation(f) {
  const hashes = ['1'.repeat(32), '2'.repeat(32), '3'.repeat(32)];
  const tables = [
    ['attempts', ['id', 'task_id', 'runner_id', 'owner_version', 'completed_at']],
    ['tasks', ['id', 'status', 'current_attempt_id']], ['conversation_queue', ['id', 'state']],
  ].map(([name, columns], index) => ({ name, columns, count: 1, digest: createHash('md5').update(hashes[index]).digest('hex') }));
  f.request.confirmation = { protocol: preservedQueueProtocol, baselineSha256: 'b'.repeat(64), tables,
    queuedTasks: [{ id: randomUUID(), status: 'queued', current_attempt_id: null }] };
  f.fact.pendingTasks = 1;
  f.fact.centerEvidence = { ...structuredClone(f.request.confirmation), tables: tables.map((table, index) => ({ name: table.name, columns: table.columns, rowHashes: [hashes[index]] })) };
}
test('preserved queued v2 permits the same queued task only with complete historical evidence', () => fixture(async f => {
  queuedConfirmation(f);
  assert.equal((await retireIntent(f.request, f.ports)).outcome, 'retired');
  const audit = JSON.parse(await readFile(join(f.archive, 'intent.json')));
  assert.deepEqual(audit.initialConfirmation.centerEvidence, f.fact.centerEvidence);
  assert.equal(audit.initialConfirmation.pendingTasks, 1);
  assert.deepEqual(await readFile(join(f.archive, 'original.bin')), f.original);
}));
test('preserved queued v2 rejects a completed attempt added despite active zero and same-count replacement', () => fixture(async f => {
  queuedConfirmation(f);
  const original = structuredClone(f.fact.centerEvidence);
  for (const rows of [[...original.tables[0].rowHashes, '4'.repeat(32)], ['5'.repeat(32)], []]) {
    f.fact.centerEvidence = structuredClone(original); f.fact.centerEvidence.tables[0].rowHashes = rows;
    assert.equal(f.fact.globalUnfinished, 0);
    assert.equal((await retireIntent(f.request, f.ports)).code, 'PRESERVED_QUEUE_CHANGED');
    assert.deepEqual(await readFile(f.journal), f.original);
  }
}));
test('preserved queued v2 never substitutes counts, missing proof or unknown writer for evidence', () => fixture(async f => {
  queuedConfirmation(f);
  const original = structuredClone(f.fact);
  const changes = [{ centerEvidence: undefined }, { soleWriterConfirmed: false }, { inventoryComplete: false }, { pendingUnknown: 1 }, { runnerStopped: false }, { pendingTasks: 0 }];
  for (const change of changes) {
    Object.assign(f.fact, structuredClone(original), change);
    assert.equal((await retireIntent(f.request, f.ports)).outcome, 'not-retired');
    assert.deepEqual(await readFile(f.journal), f.original);
  }
  Object.assign(f.fact, original);
  delete f.request.confirmation; // Legacy caller still rejects this nonzero pending count.
  assert.equal((await retireIntent(f.request, f.ports)).code, 'FENCE_UNCONFIRMED');
}));
test('preserved queued v2 rechecks historical evidence immediately before publication', () => fixture(async f => {
  queuedConfirmation(f);
  f.ports.boundary = async phase => { if (phase === 'recheck') f.fact.centerEvidence.tables[0].rowHashes.push('6'.repeat(32)); };
  assert.equal((await retireIntent(f.request, f.ports)).outcome, 'unknown');
  assert.deepEqual(await readFile(f.journal), f.original);
  assert.deepEqual(await readFile(join(f.archive, 'original.bin')), f.original);
}));
