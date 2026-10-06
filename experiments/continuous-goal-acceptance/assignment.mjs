import { isDeepStrictEqual } from 'node:util';

function check(condition) { if (!condition) throw new Error('Public assignment identity or current confirmation does not match.'); }
function identity(value) {
  check(value && ['taskId', 'attemptId', 'runnerId'].every(key => typeof value[key] === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value[key]))
    && Number.isSafeInteger(value.ownerVersion) && value.ownerVersion >= 1);
}
function profileMatches(selected, expected, actual) {
  return selected && expected && selected.runnerId === actual.runnerId && isDeepStrictEqual(selected, expected);
}

/** Caller supplies the immutable admission receipt; lease authority remains context.assertOwnership. */
export function bindPlannerAssignment(admitted, actual, capability, selectedProfile) {
  identity(actual);
  check(admitted && admitted.taskId === actual.taskId && capability?.goalId === admitted.goalId && capability?.runId === admitted.runId
    && profileMatches(selectedProfile, admitted.executionProfile, actual));
  return Object.freeze({ slot: 'planner', assignment: Object.freeze(structuredClone(actual)) });
}

/** expected.nodes is the owner-confirmed two-node dependency order, not runtime claim order.
 * current contains bounded public progression and delivery snapshots fetched by the parent host.
 * This observation cannot extend lease ownership and never replaces the original runtime fence.
 */
export function bindChildAssignment(expected, current, actual, selectedProfile) {
  identity(actual);
  check(expected && Array.isArray(expected.nodes) && expected.nodes.length === 2
    && new Set(expected.nodes.map(node => node.nodeId)).size === 2);
  check(Buffer.byteLength(JSON.stringify(current) ?? '') <= 65_536);
  const progression = current?.progression, delivery = current?.delivery;
  check(progression?.id === expected.progressionId && progression.goalId === expected.goalId
    && progression.authorizationDigest === expected.authorizationDigest && progression.state === 'active'
    && Array.isArray(progression.nodes) && progression.nodes.length === 2
    && new Set(progression.nodes.map(node => node.nodeId)).size === 2
    && progression.nodes.every(node => expected.nodes.some(item => item.nodeId === node.nodeId))
    && delivery?.goalId === expected.goalId && delivery.projectId === expected.projectId
    && Array.isArray(delivery.nodes) && delivery.nodes.length >= 1 && delivery.nodes.length <= 2);
  const admitted = progression.nodes.filter(node => node.task?.id === actual.taskId);
  check(admitted.length === 1 && admitted[0].task.status === 'running');
  const index = expected.nodes.findIndex(node => node.nodeId === admitted[0].nodeId), fixed = expected.nodes[index];
  const observed = delivery.nodes.filter(node => node.nodeId === fixed.nodeId);
  check(observed.length === 1 && profileMatches(selectedProfile, fixed.executionProfile, actual));
  const state = observed[0], execution = state.execution;
  const inputRef = { goalId: expected.goalId, nodeId: fixed.nodeId, version: fixed.inputVersion };
  check(state.knowledgeCurrent === true && isDeepStrictEqual(state.inputRef, inputRef)
    && execution?.id === admitted[0].executionId && execution.inputCurrent === true && isDeepStrictEqual(execution.inputRef, inputRef)
    && execution.task?.id === actual.taskId && execution.task.status === 'running'
    && execution.task.attemptId === actual.attemptId && execution.task.ownerVersion === actual.ownerVersion);
  // dependenciesReady is the public acceptance view, not O14's explicitly authorized mechanical dependency rule.
  return Object.freeze({ slot: `child-${index + 1}`, nodeId: fixed.nodeId, executionId: execution.id,
    assignment: Object.freeze(structuredClone(actual)) });
}
