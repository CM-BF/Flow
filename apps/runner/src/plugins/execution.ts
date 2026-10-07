import type { TrustedPackageStore } from '@flow/plugin-runtime';
import type { Ownership, TaskSubmission, RunnerEventData } from '@flow/contracts';
import { isPersistablePluginText, pluginToolBindingSchema, pluginGrantReceiptSchema, type PluginToolBinding, type PluginGrantRequest, type PluginGrantReceipt } from '../../../../packages/contracts/src/plugin-runtime.js';
import { invokeInstalledTool, PluginToolError, type PluginToolResult } from './host.js';
import { textDigest, verifyText } from '../verifier.js';

/** Transport supplies this only when an authorization request may have committed without an ACK. */
export class PluginAuthorizationUnknown extends Error {
  constructor() { super('Plugin authorization acknowledgement is unknown.'); this.name = 'PluginAuthorizationUnknown'; }
}
/** The shared runtime must retain the original assignment/journal; this module does not recover or retry it. */
export class PluginExecutionUnsettled extends Error {
  constructor(readonly bindingId: string, readonly invocationId: string, options?: ErrorOptions) {
    super('Plugin execution outcome is unknown; retain its original binding.', options); this.name = 'PluginExecutionUnsettled';
  }
}
export interface PluginExecutionInput {
  binding: PluginToolBinding;
  task: TaskSubmission & { id: string };
  ownership: Ownership;
  runnerId: string;
  store: TrustedPackageStore;
  signal: AbortSignal;
  assertOwnership(): void | Promise<void>;
  /** One request per phase, with a stable key supplied by the existing runtime transport. No retry here. */
  authorize(request: PluginGrantRequest): Promise<PluginGrantReceipt>;
}
export interface PluginExecutionResult {
  artifact: Extract<RunnerEventData, { type: 'artifact' }>;
  verification: RunnerEventData;
  provenance: PluginToolResult['provenance'];
}
/** Actual installed-package invocation; event sequencing, durable ACKs and completion stay in the existing runtime. */
export async function executePluginTool(input: PluginExecutionInput): Promise<PluginExecutionResult> {
  const binding = pluginToolBindingSchema.parse(input.binding);
  const task = input.task; const ownership = { ...input.ownership }; const prompt = task.prompt;
  const taskId = task.id; const runnerId = input.runnerId; const authorize = input.authorize;
  if (taskId !== binding.taskId || runnerId !== binding.targetRunnerId || input.store.storeId !== binding.storeId
    || !isPersistablePluginText(prompt) || textDigest(prompt) !== binding.inputDigest || task.harness !== 'fixture' || task.fixture || task.protocol || task.executionProfile
    || task.engineering || task.resumeSessionId || task.messageSettings) throw new PluginToolError('BINDING_MISMATCH');
  const verification = task.verification ? { ...task.verification } : undefined;
  try {
    const result = await invokeInstalledTool({ store: input.store, input: prompt, signal: input.signal, assertOwnership: input.assertOwnership,
      binding: { bindingId: binding.bindingId, invocationId: binding.invocationId, taskId: binding.taskId, ...ownership,
        material: { installationId: binding.materialId, storeId: binding.storeId, artifact: binding.artifact, treeDigest: binding.treeDigest },
        configuration: Object.fromEntries(Object.entries(binding.configuration).map(([key, value]) => [key, String(value)])) },
      authorize: async (_, phase) => {
        const request = { ...ownership, bindingId: binding.bindingId, invocationId: binding.invocationId, phase };
        const response = pluginGrantReceiptSchema.safeParse(await authorize(request));
        if (!response.success) throw new PluginAuthorizationUnknown();
        const receipt = response.data;
        if (receipt.bindingId !== binding.bindingId || receipt.invocationId !== binding.invocationId || receipt.taskId !== taskId
          || receipt.runnerId !== runnerId || receipt.attemptId !== ownership.attemptId || receipt.ownerVersion !== ownership.ownerVersion
          || receipt.phase !== phase || receipt.replayed) throw new PluginAuthorizationUnknown();
      } });
    if (!isPersistablePluginText(result.content)) throw new PluginToolError('OUTPUT_REJECTED');
    const artifactId = `plugin-${binding.invocationId}`;
    return { artifact: { type: 'artifact', artifactId, title: 'Plugin tool output', content: result.content,
      mediaType: 'text/plain', version: textDigest(result.content), pluginSource: { protocol: 'flow.plugin-artifact.v1', ...result.provenance } }, verification: verifyText(artifactId, result.content, verification), provenance: result.provenance };
  } catch (error) {
    if (error instanceof PluginAuthorizationUnknown || error instanceof PluginToolError && error.code === 'OUTCOME_UNKNOWN') {
      throw new PluginExecutionUnsettled(binding.bindingId, binding.invocationId, { cause: error });
    }
    throw error;
  }
}
