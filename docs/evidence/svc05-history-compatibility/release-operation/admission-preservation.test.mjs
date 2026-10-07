import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, lstat, readdir, writeFile, rename, unlink, rm, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { runnerFiles as observeRunnerFiles } from './runner-files.mjs';
import { compare } from './preservation.mjs';
import { bounded, durable, sha } from '../center-recovery/facts.mjs';
import { admissionValidator, assertNoPendingRunnerFiles } from '../../svc06/browser-recovery/runner-idle.mjs';

const parent = process.env.FLOW_SVC05H_TEST_TMP, output = process.env.FLOW_SVC05H_TEST_FACTS;
assert.ok(parent && output, 'Only exclusive, supervisor-owned test paths');
const parentIdentity = await lstat(parent), records = [];
const baseUrl = 'http://127.0.0.1:61227', namespace = sha(baseUrl);
const journal = (root, name) => join(root, namespace, name);
const runnerFiles = (root, io) => observeRunnerFiles(root, baseUrl, io);
const idle = JSON.stringify({ version: 1, inFlight: null, assignments: [] });
const io = { lstat, readdir, bounded };
const create = async () => {
  const root = await mkdtemp(join(parent, 'runner-'));
  await mkdir(join(root, namespace));
  await writeFile(journal(root, 'admission.json'), idle, { mode: 0o600 });
  await writeFile(join(root, 'history.result'), 'fixed historical delivery', { mode: 0o600 });
  return root;
};
const captured = async work => {
  try { const value = await work(); records.push(value); return value; }
  catch (e) { records.push({ code: e.code, observation: e.runnerObservation }); throw e; }
};
after(async () => {
  await durable(output, { kind: 'self-owned tiny filesystem and synthetic comparison observations', records });
  const now = await lstat(parent);
  assert.equal(now.dev, parentIdentity.dev); assert.equal(now.ino, parentIdentity.ino);
  assert.equal(now.uid, process.getuid()); assert.equal(now.isSymbolicLink(), false);
  await rm(parent, { recursive: true });
});

const currentRunner = 'cfdbf4d4-a6e4-4151-b67d-4f2e59d3dc0a';
const v2 = { version: 2, runnerId: currentRunner, opportunityId: '901712cb-467b-4615-bf6b-04d8c1a03869', assignments: [] };
const v2Options = { validateAdmission: admissionValidator(currentRunner) };

test('admission port defaults to strict v1 and explicitly accepts exact empty v2', async () => {
  const root = await create();
  assert.equal((await captured(() => runnerFiles(root))).admission.idle, true);
  await writeFile(journal(root, 'admission.json'), JSON.stringify(v2));
  await assert.rejects(captured(() => runnerFiles(root)), { code: 'RUNNER_ADMISSION_NOT_IDLE' });
  const observation = await captured(() => observeRunnerFiles(root, baseUrl, undefined, v2Options));
  assert.equal(observation.admission.idle, true);
  assert.ok(observation.files.some(file => file.path === 'history.result'));
  assert.equal(assertNoPendingRunnerFiles(observation).actualClaimRecovery, 'UNKNOWN');
});

test('admission port rejects nonempty assignments, wrong identity and unknown intent fields', async () => {
  const root = await create();
  for (const value of [{ ...v2, assignments: [{ attemptId: 'saved' }] }, { ...v2, runnerId: v2.opportunityId },
    { ...v2, inFlight: null }, { ...v2, pending: false }, { ...v2, opportunityId: null }, { ...v2, version: 3 }]) {
    await writeFile(journal(root, 'admission.json'), JSON.stringify(value));
    await assert.rejects(captured(() => observeRunnerFiles(root, baseUrl, undefined, v2Options)),
      { code: 'RUNNER_ADMISSION_NOT_IDLE' });
  }
});

test('admission port requires synchronous true and keeps final content integrity', async () => {
  const root = await create();
  for (const validateAdmission of [() => 'true', () => Promise.resolve(true)]) {
    await assert.rejects(captured(() => observeRunnerFiles(root, baseUrl, undefined, { validateAdmission })),
      { code: 'RUNNER_ADMISSION_NOT_IDLE' });
  }
  await writeFile(journal(root, 'admission.json'), JSON.stringify(v2));
  let count = 0;
  await assert.rejects(captured(() => observeRunnerFiles(root, baseUrl, { ...io, bounded: async (path, max) => {
    if (path === journal(root, 'admission.json') && ++count === 2)
      await writeFile(path, JSON.stringify({ ...v2, opportunityId: 'a242bbac-51d2-4ef4-b423-cc8251b679a0' }));
    return bounded(path, max);
  } }, v2Options)), error => ['RUNNER_FILE_CHANGED_OR_BOUND', 'RUNNER_ADMISSION_CHANGED'].includes(error.code));
});

test('admission port empty v2 does not hide pending delivery or body material', () => {
  for (const path of ['x/pending-events.json', 'x/uncertain-events.json', 'x/pending-final-proposal.json.tmp',
    'x/confirmed-final-proposal.json', 'x/activity-bodies/body/ack.json']) {
    assert.throws(() => assertNoPendingRunnerFiles({ admission: { idle: true }, files: [{ path }] }));
  }
});


test('namespace uses the exact normalized runtime digest and preserves whole-root history', async () => {
  const root = await create();
  const result = await captured(() => observeRunnerFiles(root, baseUrl + '/'));
  assert.equal(result.admission.path, namespace + '/admission.json');
  assert.equal(result.admission.idle, true);
  assert.ok(result.files.some(f => f.path === 'history.result'));
  assert.ok(result.files.some(f => f.path === namespace + '/admission.json'));
});

test('namespace root or wrong-digest fake admission never satisfies idle', async () => {
  for (const wrong of ['', sha('http://127.0.0.1:61226')]) {
    const root = await mkdtemp(join(parent, 'wrong-'));
    if (wrong) await mkdir(join(root, wrong));
    await writeFile(join(root, wrong, 'admission.json'), idle);
    await assert.rejects(captured(() => runnerFiles(root)), e => e.code === 'RUNNER_ADMISSION_MISSING'
      && e.runnerObservation.observations[0].files.length === 1);
  }
});

test('namespace atomic rename only retries its enumerated admission temporary', async () => {
  const root = await create(); await writeFile(journal(root, 'admission.json.tmp'), idle);
  let renamed = false;
  const result = await captured(() => runnerFiles(root, { ...io, readdir: async (path, options) => {
    const entries = await readdir(path, options);
    if (!renamed && path === join(root, namespace)) { renamed = true; await rename(journal(root, 'admission.json.tmp'), journal(root, 'admission.json')); }
    return entries;
  } }));
  assert.equal(result.retries, 1); assert.equal(result.admission.path, namespace + '/admission.json');
  assert.equal(result.observations[0].code, 'RUNNER_ADMISSION_RENAMED');
  const other = await create(); await writeFile(join(other, 'admission.json.tmp'), idle);
  await assert.rejects(captured(() => runnerFiles(other, { ...io, readdir: async (path, options) => {
    const entries = await readdir(path, options); if (path === other) await unlink(join(other, 'admission.json.tmp')); return entries;
  } })), e => e.code === 'ENOENT' && e.runnerObservation.observations.length === 1);
});

test('enumerated admission temporary rename or disappearance gets a bounded fresh sample', async () => {
  for (const action of ['rename', 'disappear']) {
    const root = await create(); await writeFile(journal(root, 'admission.json.tmp'), idle);
    let changed = false;
    const result = await captured(() => runnerFiles(root, { ...io, readdir: async (path, options) => {
      const names = await readdir(path, options);
      if (!changed && path === join(root, namespace)) { changed = true; if (action === 'rename') await rename(journal(root, 'admission.json.tmp'), journal(root, 'admission.json')); else await unlink(journal(root, 'admission.json.tmp')); }
      return names;
    } }));
    assert.equal(result.retries, 1); assert.equal(result.observations.length, 2);
    assert.equal(result.observations[0].code, 'RUNNER_ADMISSION_RENAMED');
    assert.equal(result.observations[1].outcome, 'idle'); assert.equal(result.admission.idle, true);
    assert.equal(result.files.find(f => f.path === 'history.result').sha256, sha('fixed historical delivery'));
  }
});

test('stable idle observation retains every persistent hash, independent of sampling metadata', async () => {
  const root = await create(), a = await captured(() => runnerFiles(root)), b = await captured(() => runnerFiles(root));
  assert.deepEqual(a.files, b.files); assert.equal(a.retries, 0); assert.equal(a.nonAtomic, true);
  const fixture = phases(); fixture.before.facts.native = a; fixture.after.facts.native = { ...b, retries: 1, observedEntries: 10 };
  assert.equal(compare(fixture.before, fixture.after, 'preflight', fixture.proposal).passed, true);
});

test('in-flight, assignments, malformed admission and remaining temporary file are unknown', async () => {
  for (const value of [JSON.stringify({ version: 1, inFlight: '6a1c914f-745b-4514-93d3-d26078d3fae4', assignments: [] }),
    JSON.stringify({ version: 1, inFlight: null, assignments: [{ attemptId: 'saved-attempt' }] }),
    JSON.stringify({ version: 1, inFlight: null, assignments: [], extra: true })]) {
    const root = await create(); await writeFile(journal(root, 'admission.json'), value);
    await assert.rejects(captured(() => runnerFiles(root)), e => e.code === 'RUNNER_ADMISSION_NOT_IDLE' && e.runnerObservation.observations.length === 1);
  }
  const root = await create(); await writeFile(journal(root, 'admission.json.tmp'), idle);
  await assert.rejects(captured(() => runnerFiles(root)), { code: 'RUNNER_ADMISSION_TEMP_PRESENT' });
});

test('root loss, history disappearance and directory symlink fail closed without resampling', async () => {
  const root = await create(); let removed = false;
  await assert.rejects(captured(() => runnerFiles(root, { ...io, readdir: async (path, options) => {
    const names = await readdir(path, options); if (!removed) { removed = true; await unlink(join(root, 'history.result')); } return names;
  } })), e => e.code === 'ENOENT' && e.runnerObservation.observations.length === 1);
  const second = await create(); let count = 0;
  await assert.rejects(captured(() => runnerFiles(second, { ...io, lstat: async path => {
    if (path === second && ++count === 2) throw Object.assign(Error('root disappeared'), { code: 'ENOENT' }); return lstat(path);
  } })), e => e.code === 'ENOENT');
  const tempDirectory = await create(); await mkdir(journal(tempDirectory, 'admission.json.tmp'));
  await assert.rejects(captured(() => runnerFiles(tempDirectory, { ...io, readdir: async (path, options) => {
    const entries = await readdir(path, options); if (path === join(tempDirectory, namespace)) await rm(journal(tempDirectory, 'admission.json.tmp'), { recursive: true }); return entries;
  } })), { code: 'RUNNER_FILE_IDENTITY' });
  const third = await create(); await symlink(second, join(third, 'nested'));
  await assert.rejects(captured(() => runnerFiles(third)), { code: 'RUNNER_FILE_IDENTITY' });
});

test('persistent temporary churn exhausts exactly two retries; no implicit success', async () => {
  const root = await create();
  await assert.rejects(captured(() => runnerFiles(root, { ...io, readdir: async (path, options) => {
    if (path === join(root, namespace)) { await writeFile(journal(root, 'admission.json.tmp'), idle); const names = await readdir(path, options); await unlink(journal(root, 'admission.json.tmp')); return names; }
    return readdir(path, options);
  } })), e => e.code === 'RUNNER_ADMISSION_RENAMED' && e.runnerObservation.observations.length === 3);
});

test('all explicit release phases preserve old data and accept only their maintenance changes', () => {
  for (const phase of ['preflight', 'materials', 'drained', 'paused', 'resumed', 'published']) {
    const { before, after, proposal } = phases(phase), result = compare(before, after, phase, proposal); records.push(result);
    assert.equal(result.passed, true, JSON.stringify(result.checks));
  }
});

test('bad audit actor, key, versions or old row changes cannot pass', () => {
  for (const mutate of [a => { a.database.audit.at(-1).audit.source = 'unknown'; },
    a => { a.database.audit.at(-1).request_id = 'other'; },
    a => { a.database.audit.at(-1).audit.after.version++; },
    a => { a.database.audit[0].row_digest = 'changed'; }]) {
    const f = phases('resumed'); mutate(f.after.facts); const result = compare(f.before, f.after, 'resumed', f.proposal); records.push(result); assert.equal(result.passed, false);
  }
});

test('in-flight and changed history/config/task/dependency/pointer are rejected, not normalized away', async () => {
  const root = await create(), original = await captured(() => runnerFiles(root));
  await writeFile(join(root, 'history.result'), 'changed historical delivery');
  const changed = await captured(() => runnerFiles(root));
  const f = phases(); f.before.facts.native = original; f.after.facts.native = changed;
  assert.equal(compare(f.before, f.after, 'preflight', f.proposal).checks.nativeFiles, false);
  for (const mutate of [a => { a.native.admission.idle = false; }, a => { a.files['config.json'].sha256 = 'other'; },
    a => { a.database.tables.tasks.protected = ['changed']; }, a => { a.dependencies[0].sha256 = 'changed'; },
    a => { a.release.current = 'other'; }, a => { a.database.tables.runners.protected = ['other-non-maintenance-field']; }]) {
    const f = phases('paused'); mutate(f.after.facts); const result = compare(f.before, f.after, 'paused', f.proposal); records.push(result); assert.equal(result.passed, false);
  }
});

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
