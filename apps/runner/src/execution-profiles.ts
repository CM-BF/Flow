import type { HarnessAdapter } from '@flow/contracts';
import { FlowClient } from '@flow/client';
import {
  executionProfileConfigurationJson, executionProfileConfigurationSchema, executionProfileReferenceSchema,
  type ExecutionProfileConfiguration, type ExecutionProfileReference,
} from '../../../packages/contracts/src/execution-profiles.js';
import type { ClaudeAdapterOptions } from './claude.js';
import { textDigest } from './verifier.js';

/** Describe the fixed adapter settings without exposing its private authorized material paths. */
export function describeExecutionProfile(options: ClaudeAdapterOptions, adapter: HarnessAdapter): ExecutionProfileConfiguration {
  const files = options.allowRead === false ? [] : [...options.materialFiles];
  return executionProfileConfigurationSchema.parse({
    harness: adapter.name, adapterVersion: adapter.version, model: options.model ?? 'sonnet',
    thinking: 'disabled', permissionMode: 'dontAsk', access: options.goalTools ? 'goal-tools' : options.goalGraphTools ? 'goal-graph-tools' : files.length ? 'configured-readonly' : 'none',
    requireReadApproval: options.requireReadApproval ?? false, materialScopeDigest: textDigest(JSON.stringify(files)),
    limits: { maxTurns: options.maxTurns ?? 4, maxBudgetUsd: options.maxBudgetUsd ?? 1, timeoutMs: options.timeoutMs ?? 90_000 },
  });
}

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
      context.signal.throwIfAborted();
      await context.assertOwnership();
      await adapter.run(context);
    },
  };
}
