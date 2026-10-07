import { pluginVerificationRequestSchema, pluginVerificationOutputSchema, JSON_OBJECT_ALGORITHM,
  PLUGIN_VERIFICATION_LIMITS, type PluginVerificationRequest, type PluginVerificationOutput } from '../../../../packages/contracts/src/plugin-verification.js';
import { verifyJsonObject } from '../../../../packages/plugin-runtime/src/json-object-verifier.js';
import type { TrustedPackageStore } from '@flow/plugin-runtime';
import type { Ownership, TaskSubmission, RunnerEventData } from '@flow/contracts';
import { isPersistablePluginText, pluginToolBindingSchema, pluginGrantReceiptSchema, type PluginToolBinding, type PluginGrantRequest, type PluginGrantReceipt } from '../../../../packages/contracts/src/plugin-runtime.js';
import { invokeInstalledTool, invokeInstalledVerifier, PluginToolError, type PluginToolResult, type PluginToolInput } from './host.js';
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
  /** Trusted local execution seam; omitted preserves the in-process host. */
  invokeTool?(input: PluginToolInput): Promise<PluginToolResult>;
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
    const result = await (input.invokeTool ?? invokeInstalledTool)({ store: input.store, input: prompt, signal: input.signal, assertOwnership: input.assertOwnership,
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

export interface TrustedVerifierAlgorithm {
  artifactSha256: string; treeDigest: string; hostApiMajor: 1;
  algorithmId: typeof JSON_OBJECT_ALGORITHM.id; algorithmVersion: 1;
}
export interface PluginVerifierExecutionInput extends Omit<PluginToolInput, 'input'> {
  verification: PluginVerificationRequest;
  /** Operator-owned exact material association; never supplied by a task or package. */
  trustedAlgorithms: readonly TrustedVerifierAlgorithm[];
}
export interface PluginVerifierExecutionResult {
  output: PluginVerificationOutput;
  provenance: PluginToolResult['provenance'];
}
/** Direct installed-package capability. Public admission/claim and center approval remain separate. */
export async function executePluginVerifier(input: PluginVerifierExecutionInput): Promise<PluginVerifierExecutionResult> {
  const verification = pluginVerificationRequestSchema.parse(input.verification);
  const binding = structuredClone(input.binding);
  const store = { ...input.store, allowedDigests: [...input.store.allowedDigests] };
  const trusted = input.trustedAlgorithms;
  if (!Array.isArray(trusted) || trusted.length > 1024 || !trusted.some(item => item.artifactSha256 === binding.material.artifact.sha256
    && item.treeDigest === binding.material.treeDigest && item.hostApiMajor === 1
    && item.algorithmId === verification.rule.algorithmId && item.algorithmVersion === verification.rule.algorithmVersion)) {
    throw new PluginToolError('VERIFIER_ALGORITHM_UNTRUSTED');
  }
  if (textDigest(verification.source.content) !== verification.source.version) throw new PluginToolError('SOURCE_VERSION_MISMATCH');
  const identity = { domain: 'flow.plugin-verification.input.v1', source: verification.source, rule: verification.rule,
    invocation: { bindingId: binding.bindingId, invocationId: binding.invocationId, taskId: binding.taskId, attemptId: binding.attemptId, ownerVersion: binding.ownerVersion },
    material: { installationId: binding.material.installationId, storeId: binding.material.storeId, treeDigest: binding.material.treeDigest,
      artifact: { artifactId: binding.material.artifact.artifactId, name: binding.material.artifact.name, version: binding.material.artifact.version,
        bytes: binding.material.artifact.bytes, sha256: binding.material.artifact.sha256, integrity: binding.material.artifact.integrity } },
    configuration: Object.fromEntries(Object.entries(binding.configuration).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) };
  const inputDigest = textDigest(JSON.stringify(identity));
  const serialized = JSON.stringify({ schemaVersion: 1, ...verification, inputDigest });
  if (serialized.length > PLUGIN_VERIFICATION_LIMITS.inputCodeUnits || Buffer.byteLength(serialized) > PLUGIN_VERIFICATION_LIMITS.inputBytes) {
    throw new PluginToolError('VERIFICATION_INPUT_TOO_LARGE');
  }
  try {
    const result = await invokeInstalledVerifier({ ...input, store, binding, input: serialized });
    let parsed: unknown;
    try { parsed = JSON.parse(result.content); } catch { throw new PluginToolError('VERIFIER_OUTPUT_REJECTED'); }
    const decoded = pluginVerificationOutputSchema.safeParse(parsed);
    if (!decoded.success || decoded.data.inputDigest !== inputDigest) throw new PluginToolError('VERIFIER_OUTPUT_REJECTED');
    const expected = verifyJsonObject(verification.source.content, verification.rule);
    if (JSON.stringify(decoded.data.verdict) !== JSON.stringify(expected)) throw new PluginToolError('VERIFIER_VERDICT_MISMATCH');
    return { output: decoded.data, provenance: result.provenance };
  } catch (error) {
    if (error instanceof PluginAuthorizationUnknown || error instanceof PluginToolError && error.code === 'OUTCOME_UNKNOWN') {
      throw new PluginExecutionUnsettled(binding.bindingId, binding.invocationId, { cause: error });
    }
    throw error;
  }
}
