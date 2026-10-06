import assert from 'node:assert/strict';
import { digest, INPUT } from './config.mjs';

export function checkFacts(report) {
  const { task, worker, goal, history, final, profile } = report;
  assert.equal(task.status, 'succeeded'); assert.equal(task.verificationStatus, 'passed');
  assert.equal(worker.queryAdapterCalls, 1); assert.equal(worker.nativeQueryCalls, report.mode === 'native' ? 1 : 0); assert.equal(worker.queryClosed, true);
  assert.equal(report.totalTasks, 1); assert.equal(goal.nodes.length, 1); assert.equal(goal.nodes[0].accepted, null); assert.equal(goal.nodes[0].deliveryCurrent, false);
  assert.equal(history.executions.length, 1); assert.equal(history.nextCursor, null);
  const execution = history.executions[0];
  assert.equal(execution.id, report.admission.executionId); assert.equal(execution.task.id, task.id); assert.equal(execution.inputVersion, 1); assert.equal(execution.inputCurrent, true);
  assert.deepEqual(execution.input, INPUT); assert.deepEqual(execution.dependencies, []);
  assert.equal(task.attempt.runnerId, profile.reference.runnerId);
  assert.deepEqual(report.admission.executionProfile, profile.reference);
  assert.equal(final.taskId, task.id); assert.equal(final.attemptId, task.attempt.id); assert.equal(final.source, 'claude.sdk.result');
  assert.equal(final.nativeSessionId, worker.effective.nativeSessionId); assert.equal(final.nativeSessionId, worker.result.nativeSessionId);
  assert.equal(final.nativeSessionId, task.attempt.nativeSessionId); assert.equal(final.sourceMessageId, worker.result.sourceMessageId);
  assert.equal(worker.result.subtype, 'success'); assert.equal(worker.result.isError, false);
  assert.equal(worker.permissionDenials.state, 'reported'); assert.equal(worker.permissionDenials.total, 0);
  assert(worker.hostToolDecisions.length > 0); assert(worker.hostToolDecisions.every(row => row.toolName === 'Read' && row.decision === 'allowed'));
  assert(worker.readObservations.some(row => row.state === 'reported-success' && row.containsSyntheticMaterial));
  assert(worker.readObservations.every(row => row.state === 'reported-success'));
  const artifacts = report.details.filter(d => d.kind === 'artifact'); assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].content, final.content); assert.equal(artifacts[0].artifactVersion, digest(final.content));
  assert(report.details.some(d => d.kind === 'verification'));
  report.mechanical = { verifier: 'flow.text', rule: INPUT.verification, status: 'passed', finalDigest: digest(final.content) };
  report.semanticAcceptance = { state: 'not-evaluated', acceptedDelivery: false, required: 'Goal Owner reads the actual final against the fixed material; no regex semantic oracle.' };
}
