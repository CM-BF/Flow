/** Fixed release phase checks, adapted from SVC05 preservation. No service or database calls. */
import { fileURLToPath } from 'node:url';
import { bounded, durable } from '../center-recovery/facts.mjs';
const target = 'af51c621696230fbced12227670f014ca73bd8a1';
const oldTarget = '362af3bac77541e5a60979326bcf4d4b8c947915';
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const contains = (all, old) => {
  const counts = new Map(); for (const x of all) counts.set(x, (counts.get(x) ?? 0) + 1);
  for (const x of old) { if (!counts.get(x)) return false; counts.set(x, counts.get(x) - 1); } return true;
};
const read = async path => JSON.parse((await bounded(path, 4 * 1024 * 1024)).bytes);

export function compare(before, after, phase, proposal) {
  if (!['preflight', 'materials', 'drained', 'paused', 'resumed', 'published'].includes(phase)) throw Error('PHASE');
  if (before.outcome !== 'observed' || after.outcome !== 'observed') return { passed: false, checks: { observed: false } };
  const b = before.facts, a = after.facts, db = a.database;
  const oldRunner = b.database.runners.find(r => r.id === b.identity.runnerId), runner = db.runners.find(r => r.id === b.identity.runnerId);
  const actions = ['preflight', 'materials'].includes(phase) ? [] : phase === 'drained' ? ['drain'] : phase === 'paused' ? ['drain', 'hold'] : ['drain', 'hold', 'resume'];
  const expectedState = phase === 'drained' ? 'draining' : phase === 'paused' ? 'maintenance' : 'accepting';
  const started = ['paused', 'resumed', 'published'].includes(phase);
  const checks = {
    source: a.source.head === target && !a.source.dirty,
    runtime: a.runtimeSource?.head === (started ? target : oldTarget) && a.runtimeSource?.dirty === false,
    identity: equal(b.identity, a.identity) && equal(b.rootIdentity, a.rootIdentity) && equal(a.identity, proposal.savedIdentity) && equal(a.rootIdentity, proposal.savedRootIdentity) && db.markerMatched && db.identityMatched && db.runnerId === b.identity.runnerId,
    config: equal(b.files['config.json'], a.files['config.json']) && equal(b.files['claude.json'], a.files['claude.json']) && equal(a.files['config.json'], proposal.savedPrivateFiles['config.json']) && equal(a.files['claude.json'], proposal.savedPrivateFiles['claude.json']),
    nativeIdle: b.native?.admission?.idle === true && a.native?.admission?.idle === true,
    nativeFiles: b.native?.dev === a.native?.dev && b.native?.ino === a.native?.ino && b.native?.uid === a.native?.uid
      && equal(b.native?.files, a.native?.files) && b.native?.totalBytes === a.native?.totalBytes, invariantState: b.invariantStateSha256 === a.invariantStateSha256 && a.lastError === null,
    lockAbsent: a.lock === 'absent', owned: Object.values(a.processes).every(p => p.identity === 'running') && Object.values(a.listeners).every(Boolean),
    singleKnownRunner: db.runners.length === 1 && a.runnerEntrypoints.length === 1 && a.runnerEntrypoints[0].owned,
    zeroWork: db.unfinished.length === 0 && db.uncertain.length === 0 && db.pendingTasks.length === 0,
    queue: equal(b.database.queue, db.queue) && db.queue.every(q => q.state !== 'queued' || q.count === 0),
    migrations: equal(b.database.migrations, db.migrations) && equal(db.migrations.map(r => r.version), Array.from({ length: 27 }, (_, i) => i + 1)),
    maintenance: !!oldRunner && !!runner && oldRunner.maintenance_state === 'accepting' && oldRunner.maintenance_operation_id === null && oldRunner.maintenance_version === 15 && !runner.revoked
      && runner.maintenance_state === expectedState && runner.maintenance_version === oldRunner.maintenance_version + actions.length
      && (expectedState === 'accepting' ? runner.maintenance_operation_id === null : runner.maintenance_operation_id === a.operation.operationId),
    dependencies: a.dependencies.length === b.dependencies.length && equal(a.dependencies, b.dependencies),
  };
  const tables = {};
  checks.tableNames = equal(Object.keys(b.database.tables), Object.keys(db.tables));
  for (const [name, old] of Object.entries(b.database.tables)) {
    const now = db.tables[name]; const audit = name === 'runner_maintenance_audit';
    tables[name] = { omitted: old.omitted, omittedRunnerId: old.omittedRunnerId,
      columnsEqual: !!now && equal(old.columns, now.columns) && equal(old.omitted, now.omitted) && old.omittedRunnerId === now.omittedRunnerId, rawEqual: !!now && equal(old.raw, now.raw),
      oldProtectedRowsPreserved: !!now && (audit ? contains(now.protected, old.protected) : equal(now.protected, old.protected)),
      countExpected: !!now && now.count === old.count + (audit ? actions.length : 0) };
  }
  checks.tables = Object.values(tables).every(t => t.columnsEqual && t.oldProtectedRowsPreserved && t.countExpected);
  const oldAuditIds = new Set(b.database.audit.map(x => x.id)); const fresh = db.audit.filter(x => !oldAuditIds.has(x.id));
  checks.oldAudit = b.database.audit.every(old => db.audit.some(x => x.id === old.id && equal(x, old)));
  checks.newAudit = equal(fresh.map(x => x.audit.action), actions) && fresh.every((x, n) => x.audit.operationId === a.operation.operationId
    && x.audit.runnerId === b.identity.runnerId && x.audit.source === 'trusted-host' && x.audit.before.version === oldRunner.maintenance_version + n
    && x.audit.after.version === oldRunner.maintenance_version + n + 1
    && x.audit.before.state === ['accepting', 'draining', 'maintenance'][n] && x.audit.after.state === ['draining', 'maintenance', 'accepting'][n] && x.request_id === a.operation[actions[n] + 'Key']);
  checks.operation = actions.length === 0 ? equal(b.operation, a.operation) : a.operation.operationId !== b.operation.operationId
    && a.operation.initialVersion === oldRunner.maintenance_version && (phase === 'drained' ? a.operation.phase === 'drain-requested'
      : a.operation.target === target && a.operation.phase === (phase === 'paused' ? 'ready-paused' : 'resumed'));
  const oldReports = proposal.reports.slice(0, 2);
  const beforeMaterial = phase === 'preflight';
  checks.retained = oldReports.every(expected => a.reports.some(x => equal(x.artifact, expected.artifact)
    && (beforeMaterial || x.compatibilityId === expected.compatibilityId)))
    && b.reports.every(old => a.reports.some(x => equal(x.artifact, old.artifact) && equal(x.files, old.files) && x.totalBytes === old.totalBytes));
  checks.materials = beforeMaterial || a.candidate.present && a.candidate.compatibilityId === proposal.webPublishRequestCandidate.compatibilityId;
  if (phase !== 'published') {
    checks.pointer = equal(b.files['web-release.json'], a.files['web-release.json']) && equal(b.release, a.release)
      && a.release.version === 2 && a.release.current === oldReports[1].artifact.artifactId && a.release.artifacts.length === 2;
  } else {
    const request = proposal.webPublishRequestCandidate;
    checks.pointer = a.release.version === 3 && a.release.current === request.artifact.artifactId && a.release.backendHead === target
      && equal(a.release.artifacts, [...b.release.artifacts, request.artifact])
      && proposal.reports.every(x => a.release.compatibilityIds[x.artifact.artifactId] === x.compatibilityId);
    checks.webOperation = a.webReleaseOperation?.action === 'publish' && a.webReleaseOperation.version === 3 && a.webReleaseOperation.outcome === 'ready';
  }
  return { at: new Date().toISOString(), phase, checks, tables, runner, operation: a.operation, addedAudit: fresh,
    passed: Object.values(checks).every(Boolean), limits: ['Raw MD5 row summaries are preserved change detectors, not semantic or cryptographic authenticity proof.',
      'Only queue_checked_at and this runner four maintenance fields are projected out, checked separately; old audits remain exact.',
      'No new migration expected; user concurrent activity requires separate causal review rather than widening this allowlist.',
      'Filesystem/process and RR DB snapshots are observations, not admission locks; admission must be observed idle at both ends.',
      'Native sample retry metadata may differ; every persistent file remains byte/hash compared, including admission and historical results.'] };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [beforePath, afterPath, phase, output] = process.argv.slice(2);
  if (process.argv.length !== 6 || !output.endsWith('.json')) throw Error('FOUR_FIXED_ARGUMENTS_REQUIRED');
  const report = compare(await read(beforePath), await read(afterPath), phase, await read(fileURLToPath(new URL('./proposal.json', import.meta.url))));
  await durable(output, report); console.log(JSON.stringify({ phase, passed: report.passed, checks: report.checks, output }));
  if (!report.passed) process.exitCode = 1;
}
