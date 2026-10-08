import { z } from 'zod';
import { executionProfileReferenceSchema } from './execution-profiles.js';

const id = z.string().min(1).max(128);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const engineeringProjectReferenceSchema = z.strictObject({ id, baseCommit: z.string().regex(/^[a-f0-9]{40}$/) });
export const engineeringCheckerReferenceSchema = z.strictObject({ id, version: z.literal('1'), baselineDigest: digest });
/** A finite fixture purpose, not a native-provider permission or an arbitrary local command registration. */
export const engineeringProfileConfigurationSchema = z.strictObject({
  protocol: z.literal('flow.engineering-profile.v1'), harness: z.literal('fixture'), adapterVersion: z.literal('engineering-1'),
  purpose: z.literal('engineering-fixture'), recipe: z.literal('calculator-v1'),
  project: engineeringProjectReferenceSchema, checker: engineeringCheckerReferenceSchema,
  limits: z.strictObject({ checkerTimeoutMs: z.number().int().min(1).max(30_000) }),
});
export type EngineeringProfileConfiguration = z.infer<typeof engineeringProfileConfigurationSchema>;
export function engineeringProfileConfigurationJson(value: EngineeringProfileConfiguration): string {
  return JSON.stringify(engineeringProfileConfigurationSchema.parse(value));
}
export const engineeringProfilePublicationSchema = z.strictObject({ configuration: engineeringProfileConfigurationSchema });
export const engineeringProfileSchema = z.strictObject({ reference: executionProfileReferenceSchema, configuration: engineeringProfileConfigurationSchema,
  source: z.literal('trusted-fixture-setup'), availability: z.literal('not-probed'), createdAt: z.iso.datetime() });
export type EngineeringProfile = z.infer<typeof engineeringProfileSchema>;
export const engineeringProfilePublishedSchema = z.strictObject({ profile: engineeringProfileSchema, replayed: z.boolean() });
export type EngineeringProfilePublished = z.infer<typeof engineeringProfilePublishedSchema>;
export const engineeringProfilePageSchema = z.strictObject({ protocol: z.literal('flow.engineering-profile-catalog.v1'), profiles: z.array(engineeringProfileSchema).max(100), nextCursor: z.uuid().nullable() });
export type EngineeringProfilePage = z.infer<typeof engineeringProfilePageSchema>;
