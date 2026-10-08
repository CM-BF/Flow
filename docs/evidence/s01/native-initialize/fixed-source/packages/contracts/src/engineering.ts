import { z } from 'zod';
import { engineeringCheckerReferenceSchema } from './engineering-profile.js';
import { executionProfileReferenceSchema } from './execution-profiles.js';

const id = z.string().min(1).max(128);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const bytes = (maximum: number) => z.string().max(maximum).refine(value => new TextEncoder().encode(value).byteLength <= maximum);
export const ENGINEERING_MAX_FILES = 128;
export const ENGINEERING_MAX_FILE_BYTES = 65_536;
export const ENGINEERING_MAX_WORKSPACE_BYTES = 524_288;

/** Intent selects a trusted local registry entry; it contains no executable paths, arguments or grants. */
export const engineeringIntentSchema = z.strictObject({
  protocol: z.literal('flow.engineering.v1'), targetRunnerId: z.uuid(), projectId: id, baseCommit: commit,
  checker: engineeringCheckerReferenceSchema,
  // Old stored receipts remain readable; current admission requires a configured engineering pin.
  profile: executionProfileReferenceSchema.optional(),
});
export type EngineeringIntent = z.infer<typeof engineeringIntentSchema>;

export const engineeringPathSchema = bytes(512).refine(path => path.length > 0 && !path.includes('\\') && !path.includes('\0')
  && !path.startsWith('/') && path.split('/').every(part => part !== '' && part !== '.' && part !== '..' && part !== '.git'));
const gitFile = z.strictObject({ oid: commit, mode: z.enum(['100644', '100755']) });
const worktreeFile = z.strictObject({ digest, bytes: z.number().int().min(0).max(ENGINEERING_MAX_FILE_BYTES), mode: z.enum(['100644', '100755']) });
export const engineeringFileSchema = z.strictObject({ path: engineeringPathSchema, base: gitFile.nullable(), index: gitFile.nullable(), worktree: worktreeFile.nullable() })
  .refine(entry => entry.base !== null || entry.index !== null || entry.worktree !== null);
export type EngineeringFile = z.infer<typeof engineeringFileSchema>;
const files = z.array(engineeringFileSchema).max(ENGINEERING_MAX_FILES).refine(entries => entries.every((entry, index) => index === 0 || entries[index - 1]!.path < entry.path))
  .refine(entries => entries.reduce((total, entry) => total + (entry.worktree?.bytes ?? 0), 0) <= ENGINEERING_MAX_WORKSPACE_BYTES);

export const engineeringReceiptSchema = z.strictObject({
  protocol: z.literal('flow.engineering.receipt.v1'), intent: engineeringIntentSchema,
  workspace: z.strictObject({ leaseId: z.uuid(), baseCommit: commit, headCommit: commit, beforeDigest: digest, afterDigest: digest, files }),
  checker: z.strictObject({ id, version: z.literal('1'), baselineBeforeDigest: digest, baselineAfterDigest: digest, commandDigest: digest,
    expectedChecks: z.array(id).min(1).max(32).refine(values => new Set(values).size === values.length),
    checks: z.array(z.strictObject({ id, passed: z.boolean() })).max(32) }),
  command: z.strictObject({ exitCode: z.number().int().nullable(), signal: z.string().min(1).max(64).nullable(), timedOut: z.boolean(),
    outputTruncated: z.boolean(), childExited: z.boolean(), elapsedMs: z.number().int().nonnegative().max(120_000),
    stdout: bytes(65_536), stderr: bytes(65_536) }),
  diff: z.strictObject({ content: bytes(262_144), digest }),
  result: z.enum(['passed', 'failed', 'unknown']),
});
export type EngineeringReceipt = z.infer<typeof engineeringReceiptSchema>;

export function engineeringSnapshotJson(snapshot: Pick<EngineeringReceipt['workspace'], 'baseCommit' | 'headCommit' | 'files'>): string {
  return JSON.stringify({ baseCommit: commit.parse(snapshot.baseCommit), headCommit: commit.parse(snapshot.headCommit), files: files.parse(snapshot.files) });
}

/** Interprets a trusted host receipt. This is not execution or remote attestation by the center. */
export function engineeringReceiptResult(receipt: EngineeringReceipt): EngineeringReceipt['result'] {
  if (!receipt.command.childExited) return 'unknown';
  const { checker, command, workspace } = receipt;
  const complete = checker.checks.length === checker.expectedChecks.length
    && checker.checks.every((check, index) => check.id === checker.expectedChecks[index] && check.passed);
  return command.exitCode === 0 && command.signal === null && !command.timedOut && !command.outputTruncated && complete
    && workspace.beforeDigest === workspace.afterDigest && workspace.baseCommit === receipt.intent.baseCommit
    && checker.id === receipt.intent.checker.id && checker.version === receipt.intent.checker.version
    && checker.baselineBeforeDigest === receipt.intent.checker.baselineDigest && checker.baselineAfterDigest === checker.baselineBeforeDigest
    ? 'passed' : 'failed';
}

export function engineeringReceiptJson(receipt: EngineeringReceipt): string { return JSON.stringify(engineeringReceiptSchema.parse(receipt)); }
export function engineeringVerificationInput(artifactVersion: string, intent: EngineeringIntent): string {
  return JSON.stringify({ artifactVersion: digest.parse(artifactVersion), intent: engineeringIntentSchema.parse(intent) });
}

export const engineeringVerificationDataSchema = z.strictObject({ type: z.literal('verification'), artifactId: id, artifactVersion: digest,
  verifierId: z.literal('flow.engineering'), verifierVersion: z.literal('1'), inputDigest: digest,
  result: z.enum(['passed', 'failed']), evidence: z.string().min(1).max(4000) });
