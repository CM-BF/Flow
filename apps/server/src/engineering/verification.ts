import { assertNativeEngineeringVerification } from './native-verification.js';
import type { PoolClient } from 'pg';
import { runnerEventSchema, type RunnerEventData } from '@flow/contracts';
import { engineeringIntentSchema, engineeringReceiptSchema, engineeringReceiptResult, engineeringSnapshotJson, engineeringVerificationInput } from '../../../../packages/contracts/src/engineering.js';
import { HttpError, sha256 } from '../database.js';
import type { TaskRecord } from '../tasks.js';

type Verification = Extract<RunnerEventData, { type: 'verification' }>;

/** Checks receipt linkage and declared host results; the center does not run a remote checker. */
export async function assertEngineeringVerification(client: PoolClient, task: TaskRecord, attemptId: string, event: Verification, content: string): Promise<void> {
  if (task.submission.engineering?.protocol === 'flow.engineering.v2') {
    await assertNativeEngineeringVerification(client, task, attemptId, event, content); return;
  }
  if (!task.submission.engineering || event.verifierId !== 'flow.engineering') {
    throw new HttpError(409, 'engineering_verifier_mismatch', 'Engineering tasks require their designated host checker.');
  }
  const runner = (await client.query<{ runner_id: string }>('SELECT runner_id FROM flow.attempts WHERE id=$1 AND task_id=$2', [attemptId, task.id])).rows[0];
  const intent = engineeringIntentSchema.parse(task.submission.engineering);
  if (runner?.runner_id !== intent.targetRunnerId) throw new HttpError(409, 'engineering_runner_mismatch', 'The engineering receipt belongs to another runner.');
  let receipt;
  try { receipt = engineeringReceiptSchema.parse(JSON.parse(content)); }
  catch { throw new HttpError(409, 'engineering_receipt_invalid', 'The artifact is not a bounded engineering receipt.'); }
  if (JSON.stringify(receipt.intent) !== JSON.stringify(intent)
    || receipt.workspace.beforeDigest !== sha256(engineeringSnapshotJson(receipt.workspace))
    || receipt.diff.digest !== sha256(receipt.diff.content)
    || receipt.result !== engineeringReceiptResult(receipt) || receipt.result !== event.result
    || event.inputDigest !== sha256(engineeringVerificationInput(event.artifactVersion, intent))) {
    throw new HttpError(409, 'engineering_verification_conflict', 'The receipt, intent, snapshot and host result do not agree.');
  }
}

/** Engineering success requires a passed receipt for the latest artifact of this exact attempt. */
export async function assertEngineeringCompletion(client: PoolClient, task: TaskRecord, attempt: { id: string }): Promise<void> {
  if (!task.submission.engineering) return;
  const artifact = (await client.query<{ content: string }>(`SELECT d.content FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id
    WHERE a.task_id=$1 AND a.attempt_id=$2 AND a.artifact_id=$3 AND a.version=$4`,
  [task.id, attempt.id, task.latest_artifact_id, task.latest_artifact_version])).rows[0];
  if (task.verification_status !== 'passed' || !artifact || sha256(artifact.content) !== task.latest_artifact_version) {
    throw new HttpError(409, 'engineering_completion_unverified', 'The latest engineering artifact has no passed check for this attempt.');
  }
  const verifierId = task.submission.engineering.protocol === 'flow.engineering.v2' ? 'flow.engineering.native' : 'flow.engineering';
  const rows = (await client.query<{ content: string }>(`SELECT content FROM flow.details WHERE task_id=$1 AND attempt_id=$2
    AND kind='verification' AND artifact_version=$3 AND content::jsonb->>'artifactId'=$4
    AND content::jsonb->>'verifierId'=$5 AND content::jsonb->>'result'='passed' LIMIT 1`,
  [task.id, attempt.id, task.latest_artifact_version, task.latest_artifact_id, verifierId])).rows;
  for (const row of rows) {
    const saved = runnerEventSchema.safeParse(JSON.parse(row.content));
    if (!saved.success || saved.data.type !== 'verification' || saved.data.verifierId !== verifierId || saved.data.result !== 'passed') continue;
    await assertEngineeringVerification(client, task, attempt.id, saved.data, artifact.content);
    return;
  }
  throw new HttpError(409, 'engineering_completion_unverified', 'The latest engineering artifact has no matching passed receipt.');
}
