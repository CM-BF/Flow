import assert from 'node:assert/strict';

/** CAS refers to the observed accepted delivery; the candidate artifact is a separate exact binding. */
export async function acceptObservedArtifact({ controller, artifact, observed, reason, checkpoint }) {
  assert.equal(observed?.nodeId, artifact.binding.nodeId);
  assert.equal(observed.execution?.id, artifact.executionId);
  assert.deepEqual(observed.execution.artifact, artifact.binding);
  const command = { kind: 'goal', input: { kind: 'accept-delivery', nodeId: artifact.binding.nodeId,
    executionId: artifact.executionId, expectedCurrentExecutionId: observed.accepted?.executionId ?? null, reason } };
  const outcome = await controller.command(command);
  await checkpoint({ command, outcome }); // Preserve the actual key/code/receipt before any assertion can throw.
  assert.equal(outcome.state, 'acknowledged');
  return outcome;
}
