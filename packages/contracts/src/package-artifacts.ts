import { z } from 'zod';

export const packageArtifactRequestSchema = z.object({
  name: z.string().min(1).max(214),
  version: z.string().min(1).max(128),
  // Exactly one canonical SHA512 SRI. No weaker-algorithm fallback.
  integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]{86}==$/),
}).strict();
export type PackageArtifactRequest = z.infer<typeof packageArtifactRequestSchema>;

export const packageArtifactSchema = packageArtifactRequestSchema.extend({
  artifactId: z.uuid(),
  format: z.literal('npm-tarball'),
  bytes: z.number().int().positive().max(8 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  verifiedAt: z.iso.datetime(),
  source: z.object({ registry: z.url().max(1024), tarball: z.url().max(1024) }).strict(),
}).strict();
export type PackageArtifact = z.infer<typeof packageArtifactSchema>;
