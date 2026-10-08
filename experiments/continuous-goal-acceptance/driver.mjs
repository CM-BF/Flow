import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlowClient } from '../../packages/client/src/index.ts';
import { createGoalEntry, createGoalSession } from '../../packages/interaction/src/goal/index.ts';
import { createClaudeAdapter } from '../../apps/runner/src/claude.ts';
import { describeExecutionProfile } from '../../apps/runner/src/execution-profiles.ts';
import { adapterOptions, REQUIREMENT, MATERIAL, graphScope, planningInstruction } from './config.mjs';
import { readRecord, writeRecord, goalJournal } from './records.mjs';
import { sourceIdentity, RESERVATIONS } from './identity.mjs';
import { readPermitFile, validatePermit, reservePhase } from './permit.mjs';
import { privateCenter, settleDecision } from './resources.mjs';
import { runPhase, experimentStop } from './phase-host.mjs';
import { confirmationDraft, validateConfirmation, expectedChildren } from './proposal.mjs';
import { acceptObservedArtifact } from './decision.mjs';
import { assertNativeReady, settleStage } from './stage-policy.mjs';
import { nativeEnvironmentPolicy } from './native-environment.mjs';
import { recordQueryCount } from './query-policy.mjs';
import { readContinuation, reserveContinuation } from './continuation.mjs';

const RUNS = fileURLToPath(new URL('../../docs/evidence/o16/runs/', import.meta.url));
const signal = () => AbortSignal.timeout(5000);
function output(run) { assert(/^[a-z0-9][a-z0-9-]{3,63}$/.test(run)); return join(RUNS, run); }
function session(center, state) { return createGoalSession({ client: center.client, goalId: state.goalId,
  connectionId: state.connectionId, intents: goalJournal(join(center.root, 'intents')) }); }
async function permitFor(mode, path, source, phase, confirmation) {
  if (mode === 'rehearsal') { assert(!path); return undefined; }
  assert(mode === 'native' && path, 'No real phase without a new explicit permit.');
  const permit = validatePermit(await readPermitFile(path), { identity: source, phase, confirmation, environmentDigest: nativeEnvironmentPolicy.digest });
  assertNativeReady(mode, permit, nativeEnvironmentPolicy.digest);
  await reservePhase(RESERVATIONS, permit); return permit;
}
async function stateOf(center) { return readRecord(join(center.root, 'journey.json')); }
async function saveState(center, state) { await writeRecord(join(center.root, 'journey.json'), state); }
async function register(center, phase, mode, materialFile) {
  const registered = await center.client.registerRunner({ name: `O16 ${mode} ${phase}`, harnesses: ['claude'], capacity: 1 });
  const options = adapterOptions(mode, phase, materialFile), configuration = describeExecutionProfile(options, createClaudeAdapter(options));
  const profile = (await new FlowClient({ baseUrl: center.origin, token: registered.token }).publishExecutionProfile({ configuration }, signal())).profile;
  return { token: registered.token, profile };
}
async function ensureCompleted(task) {
  if (['failed', 'cancelled', 'uncertain', 'waiting'].includes(task.status)) throw new Error('Task did not reach definite successful completion.');
  if (task.status !== 'succeeded') return null;
  assert.equal(task.verificationStatus, 'passed'); return task;
}

/** Plan permission is distinct from later actual-proposal confirmation and child permission. */
export async function plan(run, mode, permitPath) {
  experimentStop.signal.throwIfAborted();
  assert(['native', 'rehearsal'].includes(mode));
  if (mode === 'native') await readPermitFile(permitPath); // Refuse missing material before source loading or allocation.
  const source = await sourceIdentity(), permit = await permitFor(mode, permitPath, source, 'plan');
  const directory = output(run); await mkdir(RUNS, { recursive: true, mode: 0o700 }); await mkdir(directory, { mode: 0o700 });
  const report = { stage: 'plan', mode, sourceDigest: source.digest, outcome: 'unknown', nativeQueryCalls: 'unknown', workerStopped: true };
  await writeRecord(join(directory, 'plan.json'), report, { exclusive: true });
  // The driver's import TMPDIR is in evidence; runtime must keep its separate 8MiB namespace.
  const center = await privateCenter(directory, source, mode === 'native' ? { temporaryParent: '/private/tmp' } : {}); let controller, primaryError;
  try {
    await center.start(false);
    const project = (await center.client.createProject({ title: 'O16 合成连续目标验收', workspaceId: 'personal' }, randomUUID(), signal())).snapshot.project;
    const store = goalJournal(join(center.root, 'intents')), connectionId = `o16-${run}`;
    const entry = createGoalEntry({ connectionId, entryId: 'release-note', store, client: center.client });
    await entry.initialize(); const bound = await entry.submit({ projectId: project.id, ...REQUIREMENT }); entry.disconnect();
    assert.equal(bound.state, 'bound');
    const knowledge = await center.client.createKnowledgeSource(project.id, { expectedVersion: 0, title: '固定纸鸢材料', text: MATERIAL }, randomUUID(), signal());
    const citation = { projectId: project.id, sourceId: knowledge.source.id, version: knowledge.version.version, contentDigest: knowledge.version.contentDigest,
      locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(MATERIAL) } };
    assert.equal((await center.client.resolveKnowledge(project.id, citation, signal())).text, MATERIAL);
    const materialFile = join(center.root, 'material.txt'); await writeFile(materialFile, MATERIAL, { mode: 0o400, flag: 'wx' });
    const state = { mode, stage: 'planning', sourceDigest: source.digest, connectionId, projectId: project.id, goalId: bound.goalId,
      citation, materialFile, runners: { plan: await register(center, 'plan', mode, materialFile), children: await register(center, 'children', mode, materialFile) } };
    await saveState(center, state); controller = session(center, state); await controller.initialize();
    const admitted = await controller.command({ kind: 'graph-plan', input: { scope: graphScope(project.revision), prompt: planningInstruction(citation),
      execution: { harness: 'claude', executionProfile: state.runners.plan.profile.reference } } });
    assert.equal(admitted.state, 'acknowledged');
    state.admitted = { goalId: state.goalId, runId: admitted.receipt.run.id, taskId: admitted.receipt.task.id, executionProfile: state.runners.plan.profile.reference };
    await saveState(center, state); await controller.dispose(); controller = undefined; // Exit does not cancel the admitted planner.
    await runPhase(center, state, 'plan', { source, permit, report, done: async () => ensureCompleted(await center.client.show(state.admitted.taskId, signal())) });
    const audit = await center.client.goalGraphRunCalls(state.admitted.runId, { limit: 2 }, signal());
    assert(audit.calls.length === 1 && audit.calls[0].kind === 'propose' && audit.run.usedProposals === 1 && audit.run.usedApplications === 0);
    assert(audit.run.taskId === state.admitted.taskId && audit.calls[0].runnerId === state.runners.plan.profile.reference.runnerId && audit.calls[0].attemptId === report.publicCompletion.attempt.id
      && audit.calls[0].ownerVersion === report.publicCompletion.attempt.ownerVersion);
    const proposal = await center.client.goalGraphProposal(audit.calls[0].proposalId, signal());
    const draft = confirmationDraft(proposal, state); state.proposal = proposal; state.stage = 'planned'; await saveState(center, state);
    controller = session(center, state); await controller.initialize(); const planning = await controller.planning({ limit: 2 });
    assert(planning.runs.length === 1 && planning.runs[0].task.id === state.admitted.taskId);
    assert.equal((await controller.plan()).totalNodes, 0);
    Object.assign(report, { outcome: 'actual-proposal-awaiting-owner', goalId: state.goalId, projectId: state.projectId, proposal, audit, planning,
      nativeQueryCalls: report.worker.nativeQueryCalls, semanticAcceptance: 'not-evaluated', childQueries: 0 });
    await writeRecord(join(directory, 'confirmation-draft.json'), draft, { exclusive: true });
  } catch (error) { primaryError = error; report.failure = 'plan-or-observation-unconfirmed'; }
  finally {
    recordQueryCount(report);
    await settleStage(report, { primaryError, dispose: () => controller?.dispose(),
      persist: value => writeRecord(join(directory, 'plan.json'), value), finish: options => center.finish(options),
      pause: value => center.pause('plan', value) });
  }
  return report;
}

/** Explicit owner action; no runner starts here and production automatic scanning remains off. */
export async function confirm(run, body) {
  experimentStop.signal.throwIfAborted();
  const source = await sourceIdentity(), directory = output(run), center = await privateCenter(directory, source, { resume: true, stage: 'confirm' });
  return confirmAt(center, directory, body, 'confirm');
}
/** Post-expiry adoption has its own grant, output, private state and origin-based one-shot reservation. */
export async function renew(run, grant) {
  experimentStop.signal.throwIfAborted();
  const source = await sourceIdentity();
  return continueSavedPlan({ source, run, grant, runs: RUNS, reservations: RESERVATIONS, createCenter: privateCenter });
}
/** Trusted composition seam: callers cannot select these ports through the grant/CLI JSON. */
export async function continueSavedPlan({ source, run, grant, runs, reservations, createCenter }) {
  const directory = join(runs, run);
  const continuation = await readContinuation(grant, { runs, source, run, environmentDigest: nativeEnvironmentPolicy.digest });
  await reserveContinuation(reservations, continuation, source, runs);
  await mkdir(directory, { mode: 0o700 });
  const center = await createCenter(directory, source, { stage: 'renew', continuation, temporaryParent: '/private/tmp' });
  return confirmAt(center, directory, grant.confirmation, 'renew');
}
async function confirmAt(center, directory, body, phase) {
  const report = { stage: 'confirm', outcome: 'unknown', nativeQueryCalls: 0 }; let primaryError;
  try {
    const state = await stateOf(center); assert(['planned', 'confirmation-unknown', 'confirmed'].includes(state.stage));
    const parsed = validateConfirmation(body, state.proposal, state);
    await center.start(false);
    const fresh = await center.client.goalGraphProposal(state.proposal.id, signal()); assert.equal(fresh.proposalDigest, state.proposal.proposalDigest);
    if (state.confirmationIntent) assert.deepEqual(state.confirmationIntent.body, parsed);
    else state.confirmationIntent = { key: randomUUID(), body: parsed };
    state.stage = 'confirmation-unknown'; await saveState(center, state); // Same key/body remains durable if ACK is lost.
    const accepted = await center.client.confirmGoalPlan(state.proposal.id, state.confirmationIntent.body, state.confirmationIntent.key, signal());
    assert.equal(accepted.confirmation.proposalDigest, state.proposal.proposalDigest); assert.equal(accepted.progression.admissions, 0);
    state.confirmation = accepted.confirmation; state.expected = expectedChildren(accepted.confirmation, parsed, state);
    state.confirmationBinding = { goalId: state.goalId, proposalId: state.proposal.id, proposalDigest: state.proposal.proposalDigest,
      confirmationDigest: accepted.confirmation.confirmationDigest, progressionId: accepted.confirmation.progressionId };
    state.stage = 'confirmed'; await saveState(center, state);
    Object.assign(report, { outcome: 'confirmed-awaiting-separate-children-permit', mode: state.mode, actualConfirmation: accepted.confirmation,
      confirmationBinding: state.confirmationBinding, originalKey: state.confirmationIntent.key, replayed: accepted.replayed, admissions: 0,
      semanticAcceptance: 'not-evaluated' });
  } catch (error) { primaryError = error; }
  finally {
    await settleStage(report, { primaryError, persist: value => writeRecord(join(directory, 'confirmation.json'), value),
      finish: options => center.finish(options), pause: value => center.pause(phase, value) });
  }
  return report;
}

export async function children(run, permitPath) {
  experimentStop.signal.throwIfAborted();
  const source = await sourceIdentity(), directory = output(run), confirmation = await readRecord(join(directory, 'confirmation.json'));
  assert.equal(confirmation.outcome, 'confirmed-awaiting-separate-children-permit');
  const permit = await permitFor(confirmation.mode, permitPath, source, 'children', confirmation.confirmationBinding);
  const center = await privateCenter(directory, source, { resume: true, stage: 'children' }), report = { stage: 'children', outcome: 'unknown', workerStopped: true, nativeQueryCalls: 'unknown' };
  let controller, primaryError;
  try {
    const state = await stateOf(center); assert.equal(state.stage, 'confirmed');
    assert.deepEqual(state.confirmationBinding, confirmation.confirmationBinding);
    state.stage = 'children-started-unknown'; await saveState(center, state);
    await center.start(true); // The existing single production scan owns both dependent admissions.
    controller = session(center, state); await controller.initialize(); await controller.dispose(); controller = undefined;
    await runPhase(center, state, 'children', { source, permit, report, done: async () => {
      const progression = await center.client.goalProgression(state.goalId, state.expected.progressionId, signal());
      if (['paused', 'revoked', 'expired', 'blocked'].includes(progression.state)) throw new Error('Progression stopped before completion.');
      if (progression.nodes.some(n => n.task && ['failed', 'cancelled', 'uncertain', 'waiting'].includes(n.task.status))) throw new Error('Child task stopped before completion.');
      return progression.state === 'finished' ? progression : null;
    } });
    assert.equal(report.publicCompletion.admissions, 2); controller = session(center, state); await controller.initialize();
    const current = await controller.observe(state.expected.nodes.map(n => n.nodeId));
    assert(current.nodes.every(n => !n.accepted && !n.deliveryCurrent && n.execution?.task.status === 'succeeded' && n.execution.task.verificationStatus === 'passed'));
    const artifacts = [];
    for (const node of state.expected.nodes) {
      const execution = current.nodes.find(n => n.nodeId === node.nodeId).execution; assert(execution.artifact);
      const detail = await controller.read({ kind: 'artifact', binding: execution.artifact });
      assert(Buffer.byteLength(detail.content) <= 8192); artifacts.push({ binding: execution.artifact, executionId: execution.id, content: detail.content });
    }
    const history = await controller.history({ limit: 20 }); assert(!history.nextCursor);
    state.artifacts = artifacts; state.stage = 'awaiting-independent-review'; await saveState(center, state);
    Object.assign(report, { outcome: 'artifacts-awaiting-independent-review', mode: state.mode, goalId: state.goalId,
      nativeQueryCalls: report.worker.nativeQueryCalls, artifacts, current, history, semanticAcceptance: 'not-evaluated', clientExitDidNotCancel: true });
  } catch (error) { primaryError = error; }
  finally {
    recordQueryCount(report);
    await settleStage(report, { primaryError, dispose: () => controller?.dispose(),
      persist: value => writeRecord(join(directory, 'children.json'), value), finish: options => center.finish(options),
      pause: value => center.pause('children', value) });
  }
  return report;
}

/** The independent actor names exact observed artifact digests. Mechanical verification cannot supply this decision. */
export async function decide(run, decision) {
  experimentStop.signal.throwIfAborted();
  const source = await sourceIdentity(), directory = output(run), center = await privateCenter(directory, source, { resume: true, stage: 'decide' });
  const report = { stage: 'independent-decision', outcome: 'unknown', nativeQueryCalls: 0 }; let controller, primaryError, destroy = false;
  try {
    const state = await stateOf(center); assert.equal(state.stage, 'awaiting-independent-review');
    assert(decision && Object.keys(decision).sort().join() === 'actor,artifacts,decision,reason' && ['accept', 'reject'].includes(decision.decision)
      && typeof decision.actor === 'string' && decision.actor.length >= 3 && decision.actor.length <= 160
      && typeof decision.reason === 'string' && decision.reason.trim().length >= 10 && decision.reason.length <= 1000
      && (state.mode === 'rehearsal' || decision.actor !== 'synthetic-test-actor'));
    assert.deepEqual(decision.artifacts, state.artifacts.map(a => a.binding));
    await center.start(false); controller = session(center, state); await controller.initialize();
    const before = await controller.observe(state.expected.nodes.map(n => n.nodeId));
    assert(before.nodes.every(n => !n.accepted));
    Object.assign(report, { decision, before, acceptanceCommands: [] });
    for (const artifact of state.artifacts) await controller.read({ kind: 'artifact', binding: artifact.binding });
    await writeRecord(join(directory, 'independent-decision-intent.json'), decision, { exclusive: true });
    if (decision.decision === 'accept') for (const artifact of state.artifacts) {
      await acceptObservedArtifact({ controller, artifact, observed: before.nodes.find(node => node.nodeId === artifact.binding.nodeId),
        reason: decision.reason, checkpoint: async value => {
          report.acceptanceCommands.push(value); await writeRecord(join(directory, 'decision.json'), report);
        } });
    }
    const current = await controller.observe(state.expected.nodes.map(n => n.nodeId)), history = await controller.history({ limit: 20 });
    assert(current.nodes.every(n => decision.decision === 'accept' ? n.deliveryCurrent && n.accepted : !n.accepted));
    Object.assign(report, { outcome: decision.decision === 'accept' ? 'independently-accepted' : 'independently-rejected', decision,
      current, history, rejectionReasonPersistence: decision.decision === 'reject' ? 'experiment-record-only-no-product-rejection-command' : null,
      mode: state.mode, nativeStageConclusion: state.mode === 'native' ? 'bounded-observed-journey-only' : 'not-run' });
    state.stage = 'reviewed'; await saveState(center, state); destroy = !state.origin;
    if (state.origin) report.retention = 'keep-origin-database-and-both-directories';
  } catch (error) {
    primaryError = error; report.decisionFailure = { state: 'unconfirmed', name: error.name, code: error.code ?? null };
  } finally {
    await settleDecision(center, report, value => writeRecord(join(directory, 'decision.json'), value), destroy, primaryError,
      () => controller?.dispose());
  }
  return report;
}
export async function rehearse(run) {
  await plan(run, 'rehearsal'); const draft = await readRecord(join(output(run), 'confirmation-draft.json'));
  draft.reason = 'Synthetic test actor confirms only zero-query wiring, not native planning quality.';
  await confirm(run, draft); const completed = await children(run);
  return decide(run, { actor: 'synthetic-test-actor', decision: 'accept', reason: 'Synthetic fixture text matches fixed material; only public acceptance wiring is tested.',
    artifacts: completed.artifacts.map(a => a.binding) });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stop = () => { process.env.FLOW_O16_STOPPED = '1'; experimentStop.abort(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  try {
    const [command, run, file] = process.argv.slice(2); assert(process.argv.length <= 5);
    let result;
    if (command === 'rehearse' && !file) result = await rehearse(run);
    else if (command === 'plan' && file) result = await plan(run, 'native', file);
    else if (command === 'confirm' && file) result = await confirm(run, await readRecord(file));
    else if (command === 'renew' && file) result = await renew(run, await readRecord(file));
    else if (command === 'children' && file) result = await children(run, file);
    else if (command === 'decide' && file) result = await decide(run, await readRecord(file));
    else throw new Error('Unknown finite stage.');
    process.stdout.write(JSON.stringify({ stage: result.stage, outcome: result.outcome, mode: result.mode }) + '\n');
  } catch { process.stderr.write('O16 refused or retained an unknown outcome; inspect fixed stage evidence. No automatic retry.\n'); process.exitCode = 1; }
}
