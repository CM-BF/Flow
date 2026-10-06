import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import type { RunnerEventData } from '@flow/contracts';
import { nativeEngineeringReceiptSchema, nativeEngineeringVerificationInput, NATIVE_ENGINEERING_RECEIPT_MAX_BYTES,
  type NativeEngineeringReceipt } from '../../../../packages/contracts/src/engineering-native.js';
import { engineeringSnapshotJson } from '../../../../packages/contracts/src/engineering.js';
import { HttpError, sha256 } from '../database.js';
import type { TaskRecord } from '../tasks.js';
import { assertNativeEngineeringProfile } from './native-profile.js';

type Verification = Extract<RunnerEventData, { type: 'verification' }>;
function conflict(): never { throw new HttpError(409, 'native_engineering_verification_conflict', 'The current native engineering declaration and receipt do not agree.'); }
/** Validates declared checker data and content linkage only. It does not interpret model source. */
function checkEvidence(receipt: NativeEngineeringReceipt): boolean {
  const { check } = receipt, { workspace, report } = check;
  if (workspace.baseCommit !== receipt.intent.baseCommit || workspace.headCommit !== workspace.baseCommit
    || workspace.beforeDigest !== workspace.afterDigest || workspace.beforeDigest !== sha256(engineeringSnapshotJson(workspace))
    || check.diff.digest !== sha256(check.diff.content)) return false;
  if (report.result === 'rejected') return receipt.result === 'failed';
  const file = workspace.files[0];
  if (workspace.files.length !== 1 || file?.path !== 'calculator.mjs' || file.base?.mode !== '100644'
    || file.index?.mode !== '100644' || file.worktree?.mode !== '100644' || check.source === null) return false;
  if (file.worktree.digest !== sha256(check.source) || file.worktree.bytes !== Buffer.byteLength(check.source)
    || report.sourceDigest !== file.worktree.digest || !isDeepStrictEqual(report.checker, receipt.intent.checker)
    || !isDeepStrictEqual(report.binding, { leaseId: workspace.leaseId, baseCommit: workspace.baseCommit, headCommit: workspace.headCommit, snapshotDigest: workspace.beforeDigest })) return false;
  const result = report.checks.every(check => check.passed) ? 'passed' : 'failed';
  return report.result === result && receipt.result === result;
}

export async function assertNativeEngineeringVerification(client: PoolClient, task: TaskRecord, attemptId: string, event: Verification, content: string): Promise<void> {
  if (event.verifierId !== 'flow.engineering.native' || task.submission.engineering?.protocol !== 'flow.engineering.v2') conflict();
  const profile = await assertNativeEngineeringProfile(client, task.submission);
  const attempt = (await client.query<{ runner_id: string; owner_version: number }>('SELECT runner_id,owner_version FROM flow.attempts WHERE id=$1 AND task_id=$2', [attemptId, task.id])).rows[0];
  if (!attempt || task.current_attempt_id !== attemptId || task.owner_version !== attempt.owner_version) conflict();
  let receipt: NativeEngineeringReceipt;
  try {
    if (Buffer.byteLength(content) > NATIVE_ENGINEERING_RECEIPT_MAX_BYTES) conflict();
    receipt = nativeEngineeringReceiptSchema.parse(JSON.parse(content));
    if (!checkEvidence(receipt)) conflict();
  } catch { conflict(); }
  const identity = { taskId: task.id, attemptId, ownerVersion: attempt.owner_version, runnerId: attempt.runner_id };
  if (attempt.runner_id !== receipt.intent.targetRunnerId || !isDeepStrictEqual(receipt.intent, task.submission.engineering)
    || !isDeepStrictEqual(receipt.check.identity, identity) || !isDeepStrictEqual(receipt.writer.identity, identity)
    || !isDeepStrictEqual(receipt.writer.profile, receipt.intent.profile) || receipt.writer.leaseId !== receipt.check.workspace.leaseId
    || receipt.writer.baseCommit !== receipt.intent.baseCommit || receipt.writer.model !== profile.configuration.model
    || receipt.writer.policy !== profile.configuration.authority.policy || receipt.writer.qualificationDigest !== profile.configuration.authority.qualificationDigest
    || receipt.result !== event.result || event.inputDigest !== sha256(nativeEngineeringVerificationInput(event.artifactVersion, receipt.intent))) conflict();
}
