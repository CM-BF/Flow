import { mkdir, readFile, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { root, repository, target, bounded, durable, sha, snapshot, source } from './facts.mjs';

// One installation, one fixed version, one center spawn. This is an operator procedure, not a product launcher.
const evidence = dirname(fileURLToPath(import.meta.url));
const authorizationPath = join(evidence, 'authorization.json');
if (process.argv.length !== 3 || process.argv[2] !== '--execute-center-once') throw Error('EXPLICIT_OPERATION_REQUIRED');
const authorization = JSON.parse((await bounded(authorizationPath)).bytes);
if (authorization.kind !== 'svc05h-center-only-once' || authorization.target !== target
  || authorization.directory !== root || !/^svc05h-center-[a-z0-9-]+$/.test(authorization.approvalId)
  || !Number.isFinite(Date.parse(authorization.expiresAt)) || Date.now() >= Date.parse(authorization.expiresAt)) throw Error('AUTHORIZATION_MISMATCH');
const run = join(evidence, 'run-' + authorization.approvalId);
await mkdir(run, { mode: 0o700 }); // EEXIST permanently rejects another invocation with this approval.
await durable(join(run, 'reservation.json'), { at: new Date().toISOString(), authorization, authorizationSha256: sha((await bounded(authorizationPath)).bytes), outcome: 'unknown-until-result', providerQueries: 0 });
const result = { at: new Date().toISOString(), target, outcome: 'unknown', spawnCalls: 0, providerQueries: 0, taskCommands: 0 };
let phase = 'source-gates';
function requireTrue(value, code) { if (!value) throw Error(code); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function databasePreserved(a, b) {
  const normalized = value => { const copy = structuredClone(value); for (const table of copy.tables) if (table.name === 'conversations') delete table.raw_digest; return copy; };
  return same(normalized(a), normalized(b));
}
function errorCode(e) { return /^[A-Z0-9_]+$/.test(e.code ?? e.message) ? e.code ?? e.message : 'OPERATION_UNCONFIRMED'; }
async function fixedSource() {
  requireTrue(same(await source(), { head: target, dirty: false }), 'SOURCE_NOT_FIXED');
  const bindingBytes = (await bounded(join(evidence, 'runtime-bindings.json'))).bytes;
  requireTrue(sha(bindingBytes) === authorization.runtimeBindingsSha256, 'RUNTIME_BINDING_CHANGED');
  const bindings = JSON.parse(bindingBytes);
  for (const item of bindings.files) {
    const bytes = await readFile(item.path);
    requireTrue(bytes.length === item.bytes && sha(bytes) === item.sha256, 'RUNTIME_FILE_CHANGED');
    if (item.realpath) requireTrue(await realpath(item.path) === item.realpath, 'RUNTIME_PATH_CHANGED');
  }
  requireTrue(process.version === bindings.nodeVersion && await realpath(process.execPath) === bindings.nodeRealpath, 'NODE_CHANGED');
}
function safeToStart(f, baseline) {
  requireTrue(f.runtimeSource.head === target && f.runtimeSource.dirty === false && f.lock === 'present', 'INSTALLATION_SOURCE_OR_LOCK');
  requireTrue(f.processes.center.identity === 'stopped' && f.centerPortAbsent && f.oldCenterExit.nonceMatches, 'OLD_CENTER_NOT_STOPPED');
  requireTrue(f.processes.runner.identity === 'running' && f.processes.web.identity === 'running' && f.listeners.web, 'OTHER_ROLES_UNKNOWN');
  requireTrue(f.database.markerMatched && f.database.runnerIdentityMatched, 'DATABASE_IDENTITY');
  requireTrue(f.database.runner.length === 1 && f.database.runner[0].maintenance_state === 'accepting' && f.database.runner[0].maintenance_version === 18, 'MAINTENANCE_CHANGED');
  requireTrue(f.database.unfinished.length === 0 && f.database.uncertain.length === 0
    && f.database.tasks.every(t => ['succeeded', 'failed', 'cancelled'].includes(t.status))
    && f.database.queue.every(q => q.state !== 'queued' || q.count === 0), 'NEW_WORK_OBSERVED');
  requireTrue(same(f.identity, baseline.identity) && same(f.rootIdentity, baseline.rootIdentity), 'INSTALLATION_CHANGED');
  requireTrue(same(f.files, baseline.files) && same(f.retained, baseline.retained) && same(f.release, baseline.release), 'PRESERVATION_INPUT_CHANGED');
  requireTrue(databasePreserved(f.database, baseline.database), 'DATABASE_BASELINE_CHANGED');
}
try {
  await fixedSource();
  const baselineBytes = (await bounded(join(evidence, 'facts-before.json'))).bytes;
  requireTrue(sha(baselineBytes) === authorization.baselineSha256, 'BASELINE_CHANGED');
  const baseline = JSON.parse(baselineBytes).facts;
  const host = await import(pathToFileURL(join(repository, 'tools/personal-preview/preview.mjs')));
  const owned = await import(pathToFileURL(join(repository, 'tools/personal-preview/process.mjs')));
  const environment = await import(pathToFileURL(join(repository, 'tools/personal-preview/environment.mjs')));
  const config = await host.loadPreviewConfiguration(root);
  await host.withPreviewLock(config, async () => {
    try {
    phase = 'fresh-under-lock';
    await host.assertPreviewMarker(config);
    const before = await snapshot(); await durable(join(run, 'before.json'), before);
    safeToStart(before, baseline); await fixedSource();
    const statePath = join(root, 'state.json');
    const state = await host.readPreviewJson(statePath);
    requireTrue(sha((await bounded(statePath)).bytes) === before.files['state.json'].sha256, 'STATE_CHANGED');
    phase = 'spawn';
    await durable(join(run, 'spawn-intent.json'), { at: new Date().toISOString(), role: 'center', target });
    result.spawnCalls = 1;
    const record = await owned.spawnOwnedProcess({ args: [join(repository, 'tools/personal-preview/cli.mjs'), 'internal-service', root, 'center'], cwd: repository, env: environment.baseServiceEnvironment('center'),
      onSpawn: async pending => { state.processes.center = pending; await host.savePreviewJson(statePath, state); } });
    state.processes.center = record; await host.savePreviewJson(statePath, state);
    result.newCenter = { pid: record.pid, group: record.group };
    await durable(join(run, 'spawn-checkpoint.json'), { ...result, phase, at: new Date().toISOString() });
    phase = 'health'; let ready = false; const deadline = Date.now() + 10_000;
    do {
      requireTrue(await owned.inspectOwnedProcess(record) === 'running', 'NEW_CENTER_NOT_RUNNING');
      if (await owned.ownsListener(record, config.centerPort)) {
        try { const r = await fetch(`http://127.0.0.1:${config.centerPort}/api/health`, { signal: AbortSignal.timeout(700) }); ready = r.ok; await r.body?.cancel(); } catch { /* Unknown until the fixed deadline. */ }
      }
      if (!ready) await sleep(50);
    } while (!ready && Date.now() < deadline);
    requireTrue(ready, 'CENTER_HEALTH_UNCONFIRMED');
    phase = 'after-preservation';
    const after = await snapshot(); await durable(join(run, 'after.json'), after);
    const checks = {
      source: same(after.source, { head: target, dirty: false }) && same(after.runtimeSource, before.runtimeSource),
      identity: same(before.identity, after.identity) && same(before.rootIdentity, after.rootIdentity),
      privateFiles: ['config.json','claude.json','maintenance.json','web-release.json'].every(n => same(before.files[n], after.files[n])),
      stateExceptCenter: before.stateExceptCenterSha256 === after.stateExceptCenterSha256,
      runnerAndWeb: ['runner','web'].every(r => same(before.processes[r], after.processes[r])) && after.listeners.web,
      retained: same(before.retained, after.retained) && same(before.release, after.release),
      database: databasePreserved(before.database, after.database),
      newCenter: after.processes.center.identity === 'running' && after.listeners.center,
    };
    result.checks = checks;
    await durable(join(run, 'preservation-checkpoint.json'), { ...result, checks, at: new Date().toISOString() });
    requireTrue(Object.values(checks).every(Boolean), 'PRESERVATION_UNCONFIRMED');
    result.outcome = 'ready';
    } catch (e) {
      let currentCenter = { identity: 'unknown' };
      try {
        const current = (await host.readPreviewJson(join(root, 'state.json'))).processes.center;
        currentCenter = { pid: current.pid, group: current.group, identity: await owned.inspectOwnedProcess(current), recordSha256: sha(JSON.stringify(current)) };
      } catch { /* Preserve unknown; never infer no spawn. */ }
      await durable(join(run, 'failure-checkpoint.json'), { ...result, phase, code: errorCode(e), currentCenter, at: new Date().toISOString() });
      throw e;
    }
  });
} catch (e) {
  result.code = errorCode(e); result.phase = phase;
  // Preserve all captured ownership, including a pending spawn. No retry, rollback, cancellation, or other-role stop.
} finally {
  await durable(join(run, 'result.json'), { ...result, endedAt: new Date().toISOString() });
}
console.log(JSON.stringify({ ...result, evidence: run }));
if (result.outcome !== 'ready') process.exitCode = 1;
