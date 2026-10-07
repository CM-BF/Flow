import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, open, lstat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { source, sha, identity, retireIntent } from './retire.mjs';
import { sampleLegacyIntent, requestFromReceipts, compareLegacyRelease } from './release-seam.mjs';

const checkpointDirectory = process.env.FLOW_RETIREMENT_CHECKPOINT_DIR;
assert.ok(checkpointDirectory, 'Exclusive caller-owned directory required');
const clone = value => structuredClone(value);

test('frozen pre-hold input is readable but cannot retire without real maintenance identity', async () => {
  const template = JSON.parse(await readFile(new URL('./frozen-input-template.json', import.meta.url)));
  assert.equal(template.operationId, undefined); assert.equal(template.holdVersion, undefined);
  const root = await mkdtemp(join(checkpointDirectory, 'synthetic-'));
  const namespace = template.namespace, directory = join(root, 'runner', namespace), journal = join(directory, 'admission.json');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const original = Buffer.from(JSON.stringify({ version: 1, inFlight: randomUUID(), assignments: [] }));
  await writeFile(journal, original, { mode: 0o600 });
  const history = [];
  for (let n = 0; n < 4; n++) {
    const path = namespace + '/' + sha('history-' + n) + '/claude-result-' + randomUUID() + '.txt';
    await mkdir(join(root, 'runner', namespace, sha('history-' + n)), { mode: 0o700 });
    const bytes = Buffer.from('synthetic history ' + n);
    await writeFile(join(root, 'runner', path), bytes, { mode: 0o600 }); history.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
  const request = { ...template, root, originalSha256: sha(original), history, rootIdentity: identity(await lstat(root)),
    runnerIdentity: identity(await lstat(join(root, 'runner'))), namespaceIdentity: identity(await lstat(directory)), journalIdentity: identity(await lstat(journal)) };
  const checkpoint = { root, identity: request.rootIdentity, originalSha256: sha(original), history, originalBytes: original.length };
  try {
    const read = await sampleLegacyIntent(request, join(root, 'runner'), template.baseUrl);
    assert.equal(read.admission.idle, false); assert.equal(read.admission.legacyUnresolved, true); assert.equal(read.files.length, 5);
    let called = false;
    const denied = await retireIntent(request, { withFence: async () => { called = true; } });
    assert.equal(denied.code, 'MAINTENANCE_REQUEST'); assert.equal(denied.outcome, 'not-retired'); assert.equal(called, false);
    assert.equal(sha(await readFile(journal)), sha(original));
    await assert.rejects(sampleLegacyIntent({ ...request, originalSha256: '0'.repeat(64) }, join(root, 'runner'), template.baseUrl), { code: 'ORIGINAL_CHANGED' });
    checkpoint.observed = read; checkpoint.retirement = denied;
  } finally {
    const file = await open(join(checkpointDirectory, 'file-case-checkpoint.json'), 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(checkpoint)); await file.sync(); } finally { await file.close(); }
    const parent = await open(checkpointDirectory, 'r'); try { await parent.sync(); } finally { await parent.close(); }
    assert.deepEqual(identity(await lstat(root)), request.rootIdentity);
    await rm(root, { recursive: true });
    console.log(JSON.stringify({ kind: 'synthetic-cleanup', root, checkpointBeforeRemove: true, removed: await lstat(root).then(() => false, e => e.code === 'ENOENT'), maximumPayloadBytes: original.length + history.reduce((n, row) => n + row.bytes, 0) }));
  }
});

function legacyPhase(phase = 'preflight') {
  const data = phases(phase), b = data.before.facts, a = data.after.facts;
  const request = { source, runnerId: 'runner', namespace: sha('http://127.0.0.1:61227'), originalSha256: sha('original'),
    configSha256: 'synthetic', stateSha256: 'state', operationId: 'new-operation', history: [1, 2, 3, 4].map(n => ({ path: 'history-' + n, bytes: 1, sha256: sha('history-' + n) })) };
  b.files['state.json'] = { bytes: 10, sha256: 'state' }; a.files['state.json'] = clone(b.files['state.json']);
  const old = { path: request.namespace + '/admission.json', bytes: 80, sha256: request.originalSha256 };
  b.native = { dev: 1, ino: 3, uid: 1, files: [...request.history, old], totalBytes: 84,
    admission: { idle: false, legacyUnresolved: true, originalSha256: request.originalSha256, newSha256: sha('replacement'), newBytes: 46 } };
  a.native = clone(b.native);
  const retirement = { outcome: 'retired', renamed: true, originalSha256: request.originalSha256, newSha256: sha('replacement') };
  if (['paused', 'resumed', 'published'].includes(phase)) {
    a.native.files[4] = { ...old, bytes: 46, sha256: retirement.newSha256 }; a.native.totalBytes = 50; a.native.admission = { idle: true };
  }
  return { ...data, request, retirement };
}
const comparison = (f, phase) => compareLegacyRelease(f.before, f.after, phase, f.proposal, f.request, f.retirement);

test('all six release phases retain raw non-idle baseline and permit only exact retired bytes', () => {
  for (const phase of ['preflight', 'materials', 'drained', 'paused', 'resumed', 'published']) {
    const f = legacyPhase(phase), original = JSON.stringify(f.before), result = comparison(f, phase);
    assert.equal(result.passed, true, JSON.stringify(result.checks)); assert.equal(result.ordinaryNativeChecks.nativeIdle, false);
    assert.equal(JSON.stringify(f.before), original); assert.equal(result.exception.rawObservationsModified, false);
  }
});
test('retirement receipt, every history hash and actual idle are required after refresh', () => {
  for (const mutate of [f => { f.retirement.outcome = 'unknown'; }, f => { f.retirement.renamed = false; },
    f => { f.retirement.newSha256 = 'other'; }, f => { f.after.facts.native.files[0].sha256 = 'other'; },
    f => { f.after.facts.native.admission.idle = false; }, f => { f.after.facts.native.totalBytes++; },
    f => { f.request.operationId = 'other'; }]) {
    const f = legacyPhase('paused'); mutate(f); assert.equal(comparison(f, 'paused').passed, false);
  }
});
test('legacy allowance never relaxes audits, old data, dependencies, queue or pointer', () => {
  for (const mutate of [a => { a.database.audit.at(-1).audit.source = 'unknown'; }, a => { a.database.audit.at(-1).request_id = 'other'; },
    a => { a.database.tables.tasks.protected = ['other']; }, a => { a.files['config.json'].sha256 = 'other'; },
    a => { a.dependencies[0].sha256 = 'other'; }, a => { a.release.current = 'other'; },
    a => { a.database.queue.push({ state: 'waiting', count: 1 }); }]) {
    const f = legacyPhase('resumed'); mutate(f.after.facts); assert.equal(comparison(f, 'resumed').passed, false);
  }
});
test('request generation binds frozen identity and only takes operation from definite held receipt', () => {
  const f = legacyPhase(), held = { outcome: 'held-runner-stopped', stopped: 'stopped', confirmed: 'stopped', stateSha256: 'state',
    hold: { state: 'maintenance', version: 17, runnerId: 'runner', operationId: randomUUID() } }, authorization = { kind: 'synthetic' };
  const result = requestFromReceipts(f.request, f.before, held, authorization);
  assert.equal(result.operationId, held.hold.operationId); assert.equal(result.holdVersion, 17);
  assert.equal(result.originalSha256, f.request.originalSha256); assert.deepEqual(result.history, f.request.history);
  for (const change of [h => { h.confirmed = 'unknown'; }, h => { h.hold.version = 18; }, h => { h.stateSha256 = 'new'; }]) {
    const h = clone(held); change(h); assert.throws(() => requestFromReceipts(f.request, f.before, h, authorization));
  }
  const moved = clone(f.before); moved.facts.files['config.json'].sha256 = 'new';
  assert.throws(() => requestFromReceipts(f.request, moved, held, authorization));
});

// Synthetic phase DTOs reused verbatim from the already-reviewed comparison checks; no old tests are imported/run.
function phases(phase = 'preflight') {
  const target = 'af51c621696230fbced12227670f014ca73bd8a1', old = '362af3bac77541e5a60979326bcf4d4b8c947915';
  const artifact = name => ({ artifactId: name }), artifacts = [artifact('old-a'), artifact('old-b')];
  const reports = [...artifacts, artifact('new')].map((artifact, i) => ({ artifact, compatibilityId: 'compat-' + i }));
  const privateFile = { bytes: 10, sha256: 'synthetic' }, identity = { runnerId: 'runner', installationId: 'installation', databaseName: 'synthetic' };
  const row = (columns, omitted = [], omittedRunnerId = null) => ({ columns, omitted, omittedRunnerId, count: 1, raw: ['raw-old'], protected: ['protected-old'] });
  const b = { identity, rootIdentity: { dev: 1, ino: 2 }, source: { head: target, dirty: false }, runtimeSource: { head: old, dirty: false },
    files: { 'config.json': privateFile, 'claude.json': privateFile, 'web-release.json': privateFile },
    native: { dev: 1, ino: 3, uid: 1, files: [{ path: 'admission.json', bytes: 47, sha256: 'idle' }, { path: 'history.result', bytes: 4, sha256: 'history' }], totalBytes: 51, admission: { idle: true } },
    invariantStateSha256: 'invariant', lastError: null, lock: 'absent',
    processes: { center: { identity: 'running' }, runner: { identity: 'running' }, web: { identity: 'running' } }, listeners: { center: true, web: true },
    runnerEntrypoints: [{ owned: true }], dependencies: [{ name: 'synthetic-dependency', sha256: 'fixed' }],
    operation: { operationId: 'previous-operation', phase: 'resumed' },
    reports: reports.slice(0, 2).map(r => ({ ...r, files: [{ path: 'index.html', sha256: 'fixed' }], totalBytes: 12 })),
    candidate: { present: false, compatibilityId: null }, release: { version: 2, current: 'old-b', backendHead: old, artifacts, compatibilityIds: { 'old-a': 'historical', 'old-b': 'historical' } },
    database: { markerMatched: true, identityMatched: true, runnerId: 'runner', runners: [{ id: 'runner', revoked: false, maintenance_state: 'accepting', maintenance_version: 15, maintenance_operation_id: null }],
      unfinished: [], uncertain: [], pendingTasks: [], queue: [{ state: 'promoted', count: 1 }], migrations: Array.from({ length: 27 }, (_, i) => ({ version: i + 1, applied_at: 'fixed' })),
      tables: { tasks: row(['id', 'body']), conversations: row(['id', 'queue_checked_at'], ['queue_checked_at']),
        runners: row(['id', 'maintenance_state', 'maintenance_version', 'maintenance_operation_id', 'maintenance_updated_at'], ['maintenance_state', 'maintenance_version', 'maintenance_operation_id', 'maintenance_updated_at'], 'runner'),
        runner_maintenance_audit: row(['id', 'result']) }, audit: [{ id: 'old-audit', row_digest: 'old-audit-hash', audit: { action: 'old' } }] } };
  const proposal = { savedIdentity: identity, savedRootIdentity: b.rootIdentity, savedPrivateFiles: b.files, reports, webPublishRequestCandidate: { artifact: artifact('new'), compatibilityId: 'compat-2' } };
  const before = structuredClone({ outcome: 'observed', facts: b }), after = structuredClone(before), a = after.facts;
  if (phase !== 'preflight') a.candidate = { present: true, compatibilityId: 'compat-2' };
  const actions = ['preflight', 'materials'].includes(phase) ? [] : phase === 'drained' ? ['drain'] : phase === 'paused' ? ['drain', 'hold'] : ['drain', 'hold', 'resume'];
  if (actions.length) {
    a.operation = { operationId: 'new-operation', initialVersion: 15, target, phase: phase === 'drained' ? 'drain-requested' : phase === 'paused' ? 'ready-paused' : 'resumed', drainKey: 'drain-key', holdKey: 'hold-key', resumeKey: 'resume-key' };
    Object.assign(a.database.runners[0], { maintenance_state: phase === 'drained' ? 'draining' : phase === 'paused' ? 'maintenance' : 'accepting', maintenance_version: 15 + actions.length, maintenance_operation_id: actions.length === 3 ? null : 'new-operation' });
    a.database.audit.push(...actions.map((action, n) => ({ id: 'new-audit-' + n, request_id: action + '-key', audit: { action, operationId: 'new-operation', runnerId: 'runner', source: 'trusted-host', before: { version: 15 + n, state: ['accepting', 'draining', 'maintenance'][n] }, after: { version: 16 + n, state: ['draining', 'maintenance', 'accepting'][n] } } })));
    const t = a.database.tables.runner_maintenance_audit; t.count += actions.length; t.protected.push(...actions); t.raw.push(...actions);
    a.database.tables.runners.raw = ['allowed-maintenance-change']; a.database.tables.conversations.raw = ['allowed-queue-scan-change'];
  }
  if (['paused', 'resumed', 'published'].includes(phase)) a.runtimeSource = { head: target, dirty: false };
  if (phase === 'published') { a.release = { version: 3, current: 'new', backendHead: target, artifacts: [...artifacts, artifact('new')], compatibilityIds: Object.fromEntries(reports.map(r => [r.artifact.artifactId, r.compatibilityId])) }; a.webReleaseOperation = { action: 'publish', version: 3, outcome: 'ready' }; }
  return { before, after, proposal };
}
