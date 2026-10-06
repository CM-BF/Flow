import type { HarnessAdapter } from '@flow/contracts';
import { FlowClient } from '@flow/client';
import {
  executionProfileConfigurationJson, executionProfileConfigurationSchema, executionProfileReferenceSchema,
  type ExecutionProfileConfiguration, type ExecutionProfileReference,
} from '../../../packages/contracts/src/execution-profiles.js';
import { textDigest } from './verifier.js';

export { describeClaudeExecutionProfile as describeExecutionProfile } from './native-harness/claude.js';

export async function publishExecutionProfile(options: {
  baseUrl: string; token: string; signal?: AbortSignal; configuration: ExecutionProfileConfiguration;
}): Promise<ExecutionProfileReference> {
  const configuration = executionProfileConfigurationSchema.parse(options.configuration);
  const timeout = AbortSignal.timeout(5000);
  const publication = await new FlowClient(options).publishExecutionProfile({ configuration },
    options.signal ? AbortSignal.any([options.signal, timeout]) : timeout);
  const reference = executionProfileReferenceSchema.parse(publication.profile?.reference);
  const accepted = executionProfileConfigurationSchema.parse(publication.profile?.configuration);
  if (executionProfileConfigurationJson(accepted) !== executionProfileConfigurationJson(configuration)
    || reference.configDigest !== textDigest(executionProfileConfigurationJson(configuration))) {
    throw new Error('The center did not confirm the local execution configuration.');
  }
  return reference;
}

/** The runtime still owns cancellation, ordering and completion; this gate only fences configuration. */
export function guardExecutionProfile(adapter: HarnessAdapter, reference: ExecutionProfileReference, configuration: ExecutionProfileConfiguration): HarnessAdapter {
  const expected = executionProfileReferenceSchema.parse(reference);
  const local = executionProfileConfigurationSchema.parse(configuration);
  if (adapter.name !== local.harness || adapter.version !== local.adapterVersion
    || expected.configDigest !== textDigest(executionProfileConfigurationJson(local))) throw new Error('Local adapter does not match its published execution profile.');
  return {
    name: adapter.name, version: adapter.version,
    async run(context) {
      const selected = context.task.executionProfile;
      if (local.access === 'goal-tools' && (!selected || !context.goalTools) || local.access !== 'goal-tools' && context.goalTools) throw new Error('The configured goal tool purpose does not match this assignment.');
      if (local.access === 'goal-graph-tools' && (!selected || !context.goalGraphTools) || local.access !== 'goal-graph-tools' && context.goalGraphTools) throw new Error('The configured graph tool purpose does not match this assignment.');
      if (selected && (context.task.harness !== local.harness || selected.id !== expected.id
        || selected.runnerId !== expected.runnerId || selected.configDigest !== expected.configDigest)) {
        throw new Error('The task execution profile does not match this runner configuration.');
      }
      if (selected && Boolean(local.activeSteering) !== Boolean(context.steering)) {
        throw new Error('The active steering port does not match the pinned execution configuration.');
      }
      context.signal.throwIfAborted();
      await context.assertOwnership();
      // Legacy unpinned work never inherits a newly configured interactive control port.
      await adapter.run(selected ? context : { ...context, steering: undefined });
    },
  };
}
