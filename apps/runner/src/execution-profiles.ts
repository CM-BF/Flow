import { checkClaudeTurnSettingsAllowed } from '../../../packages/contracts/src/claude-turn-settings.js';
import type { HarnessAdapter } from '@flow/contracts';
import { FlowClient } from '@flow/client';
import {
  executionProfileConfigurationSchema, executionProfileReferenceSchema,
  type ExecutionProfileConfiguration, type ExecutionProfileReference,
  nativeExecutionProfileConfigurationJson, nativeExecutionProfileConfigurationSchema, type NativeExecutionProfileConfiguration,
} from '../../../packages/contracts/src/execution-profiles.js';
import { textDigest } from './verifier.js';

export { describeClaudeExecutionProfile as describeExecutionProfile } from './native-harness/claude.js';

export async function publishExecutionProfile(options: {
  baseUrl: string; token: string; signal?: AbortSignal; configuration: ExecutionProfileConfiguration;
}): Promise<ExecutionProfileReference> {
  return publishNativeExecutionProfile({ ...options, configuration: executionProfileConfigurationSchema.parse(options.configuration) });
}

export async function publishNativeExecutionProfile(options: {
  baseUrl: string; token: string; signal?: AbortSignal; configuration: NativeExecutionProfileConfiguration;
}): Promise<ExecutionProfileReference> {
  const configuration = nativeExecutionProfileConfigurationSchema.parse(options.configuration);
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000);
  const client = new FlowClient(options);
  const publication = await (configuration.harness === 'claude'
    ? client.publishExecutionProfile({ configuration }, signal)
    : client.publishNativeExecutionProfile({ configuration }, signal));
  const reference = executionProfileReferenceSchema.parse(publication.profile?.reference);
  const accepted = nativeExecutionProfileConfigurationSchema.parse(publication.profile?.configuration);
  if (nativeExecutionProfileConfigurationJson(accepted) !== nativeExecutionProfileConfigurationJson(configuration)
    || reference.configDigest !== textDigest(nativeExecutionProfileConfigurationJson(configuration))) {
    throw new Error('The center did not confirm the local execution configuration.');
  }
  return reference;
}

/** The runtime still owns cancellation, ordering and completion; this gate only fences configuration. */
export function guardExecutionProfile(adapter: HarnessAdapter, reference: ExecutionProfileReference, configuration: NativeExecutionProfileConfiguration): HarnessAdapter {
  const expected = executionProfileReferenceSchema.parse(reference);
  const local = nativeExecutionProfileConfigurationSchema.parse(configuration);
  if (adapter.name !== local.harness || adapter.version !== local.adapterVersion
    || expected.configDigest !== textDigest(nativeExecutionProfileConfigurationJson(local))) throw new Error('Local adapter does not match its published execution profile.');
  return {
    name: adapter.name, version: adapter.version,
    async run(context) {
      const selected = context.task.executionProfile;
      if (local.harness === 'codex' && !selected) throw new Error('A native task requires its published execution profile.');
      if (local.access === 'goal-tools' && (!selected || !context.goalTools) || local.access !== 'goal-tools' && context.goalTools) throw new Error('The configured goal tool purpose does not match this assignment.');
      if (local.access === 'goal-graph-tools' && (!selected || !context.goalGraphTools) || local.access !== 'goal-graph-tools' && context.goalGraphTools) throw new Error('The configured graph tool purpose does not match this assignment.');
      if (selected && (context.task.harness !== local.harness || selected.id !== expected.id
        || selected.runnerId !== expected.runnerId || selected.configDigest !== expected.configDigest)) {
        throw new Error('The task execution profile does not match this runner configuration.');
      }
      if (selected && Boolean(local.harness === 'claude' && local.activeSteering) !== Boolean(context.steering)) {
        throw new Error('The active steering port does not match the pinned execution configuration.');
      }
      if (local.harness === 'claude' && local.turnSettings) {
        const settings = context.task.messageSettings;
        if (!selected || !settings || context.steering || context.goalTools || context.goalGraphTools || context.task.fixture || context.task.protocol || context.task.engineering
          || checkClaudeTurnSettingsAllowed(settings, { profile: expected, choices: local.turnSettings.choices }).decision !== 'allowed'
          || context.task.resumeSessionId && settings.requested.effort.kind === 'not-requested') throw new Error('The task message settings cannot be executed by this configured runner.');
      } else if (context.task.messageSettings) throw new Error('This configured runner does not accept message settings.');
      context.signal.throwIfAborted();
      await context.assertOwnership();
      // Legacy unpinned work never inherits a newly configured interactive control port.
      await adapter.run(selected ? context : { ...context, steering: undefined });
    },
  };
}
