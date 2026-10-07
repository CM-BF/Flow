import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
/** Runner-reported material identity, checked against center binding and phase receipts.
 * This association is not an independent attestation of package execution. */
export const pluginArtifactSourceSchema = z.strictObject({
  protocol: z.literal('flow.plugin-artifact.v1'),
  bindingId: z.uuid(), invocationId: z.uuid(), taskId: z.uuid(), attemptId: z.uuid(),
  ownerVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  installationId: digest, artifactId: z.uuid(), artifactSha256: digest, treeDigest: digest,
  hostApiMajor: z.literal(1),
});
export type PluginArtifactSource = z.infer<typeof pluginArtifactSourceSchema>;
