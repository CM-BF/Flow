import { z } from 'zod';
import { engineeringProjectReferenceSchema } from './engineering-profile.js';
import { executionProfileReferenceSchema } from './execution-profiles.js';
import { ENGINEERING_MAX_FILES, engineeringFileSchema } from './engineering.js';

const id = z.string().min(1).max(128), hash = z.string().regex(/^[a-f0-9]{64}$/), commit = z.string().regex(/^[a-f0-9]{40}$/);
const bytes = (limit: number) => z.string().max(limit).refine(value => new TextEncoder().encode(value).byteLength <= limit);
export const NATIVE_ENGINEERING_RECEIPT_MAX_BYTES = 524_288;
export const nativeEngineeringCheckerSchema = z.strictObject({ id: z.literal('calculator-arithmetic'), version: z.literal('1'), sourcePolicy: z.literal('flow.calculator-source.v1') });
export const nativeEngineeringModelSchema = z.enum(['gpt-5.6-sol', 'gpt-6-astra']);
/** A declared configuration and evidence reference, never an OS or provider attestation. */
export const nativeEngineeringProfileConfigurationSchema = z.strictObject({
  protocol: z.literal('flow.engineering-profile.v2'), harness: z.literal('codex'), adapterVersion: z.literal('engineering-codex-1'),
  purpose: z.literal('engineering-native'), recipe: z.literal('calculator-arithmetic-v1'), project: engineeringProjectReferenceSchema,
  checker: nativeEngineeringCheckerSchema, model: nativeEngineeringModelSchema,
  authority: z.strictObject({ policy: z.literal('calculator-file-only-v1'), qualificationDigest: hash }),
  limits: z.strictObject({ writerTimeoutMs: z.number().int().min(1).max(60_000) }),
});
export type NativeEngineeringProfileConfiguration = z.infer<typeof nativeEngineeringProfileConfigurationSchema>;
export function nativeEngineeringProfileConfigurationJson(value: NativeEngineeringProfileConfiguration): string {
  return JSON.stringify(nativeEngineeringProfileConfigurationSchema.parse(value));
}
export const nativeEngineeringProfilePublicationSchema = z.strictObject({ configuration: nativeEngineeringProfileConfigurationSchema });
export const nativeEngineeringProfileSchema = z.strictObject({ reference: executionProfileReferenceSchema, configuration: nativeEngineeringProfileConfigurationSchema,
  source: z.literal('runner-declared-native-setup'), availability: z.literal('host-qualification-required'), createdAt: z.iso.datetime() });
export type NativeEngineeringProfile = z.infer<typeof nativeEngineeringProfileSchema>;
export const nativeEngineeringProfilePublishedSchema = z.strictObject({ profile: nativeEngineeringProfileSchema, replayed: z.boolean() });
export type NativeEngineeringProfilePublished = z.infer<typeof nativeEngineeringProfilePublishedSchema>;
export const nativeEngineeringProfilePageSchema = z.strictObject({ protocol: z.literal('flow.native-engineering-profile-catalog.v1'), profiles: z.array(nativeEngineeringProfileSchema).max(100), nextCursor: z.uuid().nullable() });
export type NativeEngineeringProfilePage = z.infer<typeof nativeEngineeringProfilePageSchema>;
export const nativeEngineeringIntentSchema = z.strictObject({ protocol: z.literal('flow.engineering.v2'), targetRunnerId: z.uuid(), projectId: id,
  baseCommit: commit, checker: nativeEngineeringCheckerSchema, profile: executionProfileReferenceSchema });
export type NativeEngineeringIntent = z.infer<typeof nativeEngineeringIntentSchema>;

const identity = z.strictObject({ taskId: id, attemptId: id, ownerVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), runnerId: id });
const binding = z.strictObject({ leaseId: z.uuid(), baseCommit: commit, headCommit: commit, snapshotDigest: hash });
const checks = z.tuple([z.strictObject({ id: z.literal('sum'), passed: z.boolean() }), z.strictObject({ id: z.literal('difference'), passed: z.boolean() })]);
const report = z.union([
  z.strictObject({ protocol: z.literal('flow.calculator-check.v1'), result: z.literal('rejected'), reason: z.enum(['invalid-input', 'binding-mismatch', 'content-set-mismatch', 'unsupported-files', 'content-mismatch', 'invalid-source']) }),
  z.strictObject({ protocol: z.literal('flow.calculator-check.v1'), result: z.enum(['passed', 'failed']), checker: nativeEngineeringCheckerSchema,
    binding, sourceDigest: hash, checks }),
]);
/** Wire shape of ENG01F evidence. The host remains the only calculator interpreter. */
export const nativeEngineeringCheckEvidenceSchema = z.strictObject({
  protocol: z.literal('flow.calculator-workspace-check.v1'), writerSettlement: z.literal('not-attested'), identity,
  workspace: z.strictObject({ leaseId: z.uuid(), baseCommit: commit, headCommit: commit, files: z.array(engineeringFileSchema).max(ENGINEERING_MAX_FILES), beforeDigest: hash, afterDigest: hash }),
  source: bytes(2048).nullable(), diff: z.strictObject({ content: bytes(262_144), digest: hash }), report,
});
export const nativeEngineeringReceiptSchema = z.strictObject({
  protocol: z.literal('flow.engineering.native-receipt.v1'), intent: nativeEngineeringIntentSchema,
  check: nativeEngineeringCheckEvidenceSchema,
  writer: z.strictObject({ identity, leaseId: z.uuid(), baseCommit: commit, profile: executionProfileReferenceSchema,
    policy: z.literal('calculator-file-only-v1'), qualificationDigest: hash, model: nativeEngineeringModelSchema, writeAccess: z.literal('revoked') }),
  result: z.enum(['passed', 'failed']),
});
export type NativeEngineeringReceipt = z.infer<typeof nativeEngineeringReceiptSchema>;
export function nativeEngineeringReceiptJson(value: NativeEngineeringReceipt): string {
  const text = JSON.stringify(nativeEngineeringReceiptSchema.parse(value));
  if (new TextEncoder().encode(text).byteLength > NATIVE_ENGINEERING_RECEIPT_MAX_BYTES) throw new Error('Native engineering receipt exceeds its byte boundary.');
  return text;
}
export function nativeEngineeringVerificationInput(artifactVersion: string, intent: NativeEngineeringIntent): string {
  return JSON.stringify({ artifactVersion: hash.parse(artifactVersion), intent: nativeEngineeringIntentSchema.parse(intent) });
}
export const nativeEngineeringVerificationDataSchema = z.strictObject({ type: z.literal('verification'), artifactId: id, artifactVersion: hash,
  verifierId: z.literal('flow.engineering.native'), verifierVersion: z.literal('1'), inputDigest: hash,
  result: z.enum(['passed', 'failed']), evidence: z.string().min(1).max(4000) });
