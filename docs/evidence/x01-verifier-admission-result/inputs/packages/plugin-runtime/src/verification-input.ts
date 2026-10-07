import { createHash } from 'node:crypto';
import { pluginVerificationRequestSchema, PLUGIN_VERIFICATION_LIMITS, type PluginVerificationRequest } from '../../contracts/src/plugin-verification.js';
import type { PackageArtifactIdentity } from './package-store.js';

/** The same frozen invocation is consumed by the package host and the independent center verifier. */
export interface VerificationInvocation {
  bindingId: string; invocationId: string; taskId: string; attemptId: string; ownerVersion: number;
  material: { installationId: string; storeId: string; treeDigest: string; artifact: PackageArtifactIdentity };
  configuration: Record<string, string>;
}
/** Digest has a fixed 64-byte representation; admission can validate the envelope before an attempt exists. */
export function assertVerificationInputFits(verification: PluginVerificationRequest): void {
  const serialized = JSON.stringify({ schemaVersion: 1, ...verification, inputDigest: '0'.repeat(64) });
  if (serialized.length > PLUGIN_VERIFICATION_LIMITS.inputCodeUnits || Buffer.byteLength(serialized) > PLUGIN_VERIFICATION_LIMITS.inputBytes) throw new Error('VERIFICATION_INPUT_TOO_LARGE');
}
export function verificationInput(binding: VerificationInvocation, input: PluginVerificationRequest): { inputDigest: string; serialized: string } {
  const verification = pluginVerificationRequestSchema.parse(input);
  assertVerificationInputFits(verification);
  const identity = { domain: 'flow.plugin-verification.input.v1', source: verification.source, rule: verification.rule,
    invocation: { bindingId: binding.bindingId, invocationId: binding.invocationId, taskId: binding.taskId, attemptId: binding.attemptId, ownerVersion: binding.ownerVersion },
    material: { installationId: binding.material.installationId, storeId: binding.material.storeId, treeDigest: binding.material.treeDigest,
      artifact: { artifactId: binding.material.artifact.artifactId, name: binding.material.artifact.name, version: binding.material.artifact.version,
        bytes: binding.material.artifact.bytes, sha256: binding.material.artifact.sha256, integrity: binding.material.artifact.integrity } },
    configuration: Object.fromEntries(Object.entries(binding.configuration).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) };
  const inputDigest = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  const serialized = JSON.stringify({ schemaVersion: 1, ...verification, inputDigest });
  return { inputDigest, serialized };
}
