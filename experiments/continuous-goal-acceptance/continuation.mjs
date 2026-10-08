import assert from 'node:assert/strict';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonical, sha256 } from '../../apps/server/src/database.ts';
import { digest, readRecord, writeRecord } from './records.mjs';
import { pauseReceipt, recordDigest } from './stage-policy.mjs';
import { validateConfirmation } from './proposal.mjs';

const verified = new WeakSet();
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const runName = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{3,63}$/.test(value);
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

/** A reviewed experiment-only delta must reconstruct the entire original identity, including dependencies. */
export function verifySourceDelta(source, oldDigest, delta) {
  assert(hex(oldDigest) && Array.isArray(delta) && delta.length > 0 && delta.length <= 16);
  const files = new Map(source.files.map(row => [row.path, row])); assert.equal(files.size, source.files.length);
  const seen = new Set();
  for (const row of delta) {
    keys(row, ['path', 'before', 'after']);
    assert(/^experiments\/continuous-goal-acceptance\/[a-z0-9-]+(?:\.test)?\.mjs$/.test(row.path) && !seen.has(row.path)); seen.add(row.path);
    assert.deepEqual(files.get(row.path), row.after, 'Current source differs from the reviewed delta.');
    if (row.before === null) files.delete(row.path);
    else { keys(row.before, ['path', 'bytes', 'sha256']); assert(row.before.path === row.path && hex(row.before.sha256)
      && Number.isSafeInteger(row.before.bytes) && row.before.bytes > 0); files.set(row.path, row.before); }
  }
  const oldFiles = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(digest(JSON.stringify({ files: oldFiles, dependencies: source.dependencies })), oldDigest, 'Unlisted source or dependency change.');
}

/** New authorization, not an extension of the old pause. Only an expired, successful planner may be adopted. */
export function validateContinuation(grant, packet, { source, run, environmentDigest, now = Date.now() }) {
  keys(grant, ['kind', 'authorizedBy', 'approvalId', 'authorizationReference', 'approvedAt', 'expiresAt', 'run', 'sourceDigest',
    'environmentDigest', 'origin', 'sourceDelta', 'confirmation', 'nativeQueries', 'retention']);
  assert(grant.kind === 'flow.o16.expired-plan-continuation.v1' && grant.authorizedBy === 'Goal Owner'
    && /^[A-Za-z0-9-]{8,100}$/.test(grant.approvalId) && typeof grant.authorizationReference === 'string'
    && grant.authorizationReference.trim().length >= 10 && grant.authorizationReference.length <= 1000);
  assert(runName(run) && grant.run === run && run !== packet.pause.run && grant.sourceDigest === source.digest
    && grant.environmentDigest === environmentDigest && hex(environmentDigest) && grant.nativeQueries === 0
    && grant.retention === 'keep-origin-database-and-both-directories');
  const approved = Date.parse(grant.approvedAt), expires = Date.parse(grant.expiresAt);
  assert(Number.isFinite(now) && approved <= now && now < expires && expires - approved <= 3600000, 'Fresh continuation authorization required.');
  const { pause, state, report, resources } = packet;
  assert(pause.phase === 'plan' && pause.next === 'confirm' && now >= Date.parse(pause.reviewUntil)
    && approved >= Date.parse(pause.closedAt) && state.mode === 'native' && !state.origin && !state.confirmationIntent);
  // Regenerate the archived receipt at its recorded close, without asking validatePause to accept expiry.
  assert.deepEqual(pause, pauseReceipt({ run: pause.run, phase: 'plan', sourceDigest: pause.sourceDigest,
    state, report, resources, now: Date.parse(pause.closedAt) }));
  assert.deepEqual(grant.origin, { run: pause.run, pauseDigest: recordDigest(pause), stateDigest: pause.stateDigest,
    reportDigest: pause.reportDigest, resourcesDigest: pause.resourcesDigest, sourceDigest: pause.sourceDigest,
    database: pause.database, marker: pause.marker, directory: pause.directory });
  verifySourceDelta(source, pause.sourceDigest, grant.sourceDelta);
  validateConfirmation(grant.confirmation, state.proposal, state);
  assert.equal(report.nativeQueryCalls, 1); assert.equal(report.childQueries, 0);
  assert(report.publicCompletion?.attempt?.id && report.publicCompletion.attempt.ownerVersion >= 1);
  const result = freeze(structuredClone({ grant, packet })); verified.add(result); return result;
}
export function assertContinuation(value, source) {
  assert(verified.has(value) && value.grant.sourceDigest === source.digest
    && Date.now() < Date.parse(value.grant.expiresAt), 'Unknown or expired continuation.');
}

export async function readContinuation(grant, { runs, ...options }) {
  assert(runName(grant?.origin?.run)); const old = join(runs, grant.origin.run);
  assert.equal(await realpath(old), old);
  const resources = await readRecord(join(old, 'resources.json'));
  const directory = resources.directory, info = await lstat(directory.path);
  assert(info.isDirectory() && !info.isSymbolicLink() && await realpath(directory.path) === directory.path
    && info.dev === directory.dev && info.ino === directory.ino && info.uid === process.getuid() && (info.mode & 0o777) === 0o700);
  for (const name of ['pause-consumed-plan.json']) await assert.rejects(lstat(join(old, name)), { code: 'ENOENT' });
  const packet = { resources, pause: await readRecord(join(old, 'pause.json')),
    report: await readRecord(join(old, 'plan.json'), 262144), state: await readRecord(join(directory.path, 'journey.json')) };
  assert.equal(packet.state.materialFile, join(directory.path, 'material.txt'));
  const file = await open(packet.state.materialFile, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { const info = await file.stat(); assert(info.isFile() && info.size <= 4096 && (info.mode & 0o222) === 0);
    const bytes = Buffer.alloc(4097), read = await file.read(bytes, 0, bytes.length, 0);
    assert(read.bytesRead === info.size && digest(bytes.subarray(0, read.bytesRead)) === packet.state.citation.contentDigest); }
  finally { await file.close(); }
  return validateContinuation(grant, packet, options);
}

/** Origin-based wx prevents a different grant/run from claiming the same pause. Failed writes stay consumed. */
export async function reserveContinuation(root, value, source, runs) {
  assertContinuation(value, source); await mkdir(root, { recursive: true, mode: 0o700 });
  assert.equal(await realpath(root), resolve(root)); assert((await lstat(root)).isDirectory());
  const old = join(runs, value.grant.origin.run); assert.equal(await realpath(old), old);
  // The exact existing legacy wx gate is shared, even with a previously built old entry.
  // This is a new consumption record; no archived state, pause, report or resources are replaced.
  await writeRecord(join(old, 'pause-consumed-plan.json'), { receipt: value.packet.pause,
    continuedAt: new Date().toISOString(), newRun: value.grant.run, continuationGrantDigest: recordDigest(value.grant) }, { exclusive: true });
  await writeRecord(join(root, `continuation-${value.grant.origin.pauseDigest}.json`), {
    kind: 'flow.o16.continuation-reservation.v1', grant: value.grant, at: new Date().toISOString(), outcome: 'unknown',
  }, { exclusive: true });
}

/** Only the new state changes identity; original material path, profiles, input and tokens are preserved. */
export function continuationState(value, source) {
  assertContinuation(value, source);
  return { ...structuredClone(value.packet.state), sourceDigest: source.digest,
    connectionId: `o16-${value.grant.run}`, origin: structuredClone(value.grant.origin) };
}

/** Real database consumer; one consistent read-only snapshot, no center/worker starts and no body is logged. */
export async function verifyContinuationDatabase(pool, value) {
  assert(verified.has(value), 'Fresh observation requires a validated continuation.');
  const { state, report } = value.packet, p = state.proposal, c = state.citation;
  const db = await pool.connect(); let first;
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const context = (await db.query(`SELECT g.id,g.project_id,g.original,p.revision FROM flow.goals g
      JOIN flow.projects p ON p.id=g.project_id WHERE g.id=$1`, [state.goalId])).rows;
    assert(context.length === 1 && context[0].project_id === state.projectId && context[0].revision === p.baseRevision);
    assert.equal(sha256(canonical({ goalId: state.goalId, projectId: state.projectId, original: context[0].original })), p.goalDigest);
    const proposals = (await db.query(`SELECT id,goal_id,project_id,base_revision,goal_digest,proposal_digest,input,source
      FROM flow.goal_graph_proposals WHERE goal_id=$1`, [state.goalId])).rows;
    assert.equal(proposals.length, 1); const row = proposals[0];
    assert(row.id === p.id && row.project_id === p.projectId && row.base_revision === p.baseRevision
      && row.goal_digest === p.goalDigest && row.proposal_digest === p.proposalDigest);
    assert.deepEqual(row.input, p.input); assert.deepEqual(JSON.parse(row.source), p.source);
    for (const table of ['goal_graph_applications', 'goal_plan_confirmations', 'goal_progressions', 'goal_executions']) {
      assert.deepEqual((await db.query(`SELECT 1 FROM flow.${table} LIMIT 1`)).rows, [], 'Existing application/authority/execution refuses adoption.');
    }
    const tasks = (await db.query('SELECT id,status,verification_status,current_attempt_id,owner_version,pending_decision FROM flow.tasks LIMIT 2')).rows;
    assert(tasks.length === 1 && tasks[0].id === state.admitted.taskId && tasks[0].status === 'succeeded'
      && tasks[0].verification_status === 'passed' && tasks[0].current_attempt_id === report.publicCompletion.attempt.id
      && tasks[0].owner_version === report.publicCompletion.attempt.ownerVersion && tasks[0].pending_decision === null);
    const attempts = (await db.query('SELECT id,task_id,runner_id,owner_version,completed_at FROM flow.attempts LIMIT 2')).rows;
    assert(attempts.length === 1 && attempts[0].id === report.publicCompletion.attempt.id && attempts[0].task_id === state.admitted.taskId
      && attempts[0].runner_id === state.runners.plan.profile.reference.runnerId && attempts[0].owner_version === report.publicCompletion.attempt.ownerVersion
      && attempts[0].completed_at != null && Number.isFinite(new Date(attempts[0].completed_at).getTime()));
    for (const phase of ['plan', 'children']) {
      const profile = state.runners[phase].profile;
      const rows = (await db.query(`SELECT p.id,p.runner_id,p.config_digest,p.configuration,r.revoked,r.capacity,r.maintenance_state
        FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id WHERE p.id=$1`, [profile.reference.id])).rows;
      assert(rows.length === 1 && rows[0].runner_id === profile.reference.runnerId && rows[0].config_digest === profile.reference.configDigest
        && rows[0].revoked === false && rows[0].capacity === 1 && rows[0].maintenance_state === 'accepting'); assert.deepEqual(rows[0].configuration, profile.configuration);
    }
    const material = (await db.query(`SELECT v.content_digest,v.byte_length FROM flow.knowledge_versions v
      JOIN flow.knowledge_sources s ON s.id=v.source_id WHERE s.project_id=$1 AND v.source_id=$2 AND v.version=$3`,
    [state.projectId, c.sourceId, c.version])).rows;
    assert(material.length === 1 && material[0].content_digest === c.contentDigest && material[0].byte_length === c.locator.end);
    await db.query('COMMIT');
    return { kind: 'flow.o16.continuation-fresh.v1', projectRevision: p.baseRevision, proposalDigest: p.proposalDigest,
      activeOrUnknownTasks: 0, incompleteAttempts: 0, priorConfirmationOrProgression: false, profilesMatched: 2, materialMatched: true };
  } catch (error) { first = error; try { await db.query('ROLLBACK'); } catch {} throw error; }
  finally { try { db.release(); } catch (error) { if (!first) throw error; } }
}
