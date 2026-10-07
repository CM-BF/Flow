import type { PoolClient } from 'pg';
import type { RunnerEvent } from '@flow/contracts';
import { pluginVerificationEventDataSchema } from '../../../../packages/contracts/src/plugin-verification-event.js';
import { pluginVerificationOutputSchema, pluginVerificationRequestSchema, JSON_OBJECT_ALGORITHM } from '../../../../packages/contracts/src/plugin-verification.js';
import { verifyJsonObject } from '../../../../packages/plugin-runtime/src/json-object-verifier.js';
import { verificationInput } from '../../../../packages/plugin-runtime/src/verification-input.js';
import { canonical, HttpError, sha256 } from '../database.js';
import { saveDetail } from '../evidence.js';
import { appendTimeline } from '../timeline.js';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
import { assertTrustedVerifier, type TrustedPluginVerifierPolicy } from '../plugin-verification-configuration.js';
import { validatePluginSource } from './artifact.js';
import { claimVerificationReference, verifierBinding } from './verification.js';

const conflict = () => new HttpError(409, 'plugin_verification_conflict', 'The exact source, invocation and independently computed verdict must agree.');
/** The center reuses the frozen source reader and algorithm, never imports installed package code. */
async function checkResult(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, raw: unknown, policy?: TrustedPluginVerifierPolicy) {
  const event = pluginVerificationEventDataSchema.parse(raw);
  const binding = await verifierBinding(client, task.id);
  if (!binding || binding.targetRunnerId !== attempt.runner_id || attempt.task_id !== task.id) throw conflict();
  await validatePluginSource(client, task, attempt, event.pluginSource);
  const qualified = await claimVerificationReference(client, task, binding, { bindingProtocol: 'flow.plugin-verification.v1', storeId: binding.storeId,
    hostApiMajor: 1, algorithms: [JSON_OBJECT_ALGORITHM] });
  assertTrustedVerifier(policy, { artifactSha256: binding.artifact.sha256, treeDigest: binding.treeDigest, hostApiMajor: 1,
    algorithmId: qualified.verification.rule.algorithmId, algorithmVersion: qualified.verification.rule.algorithmVersion });
  const request = pluginVerificationRequestSchema.parse(JSON.parse(task.submission.prompt));
  const expected = verifyJsonObject(request.source.content, qualified.verification.rule);
  const { inputDigest } = verificationInput({ bindingId: binding.bindingId, invocationId: binding.invocationId, taskId: task.id,
    attemptId: attempt.id, ownerVersion: attempt.owner_version,
    material: { installationId: binding.materialId, storeId: binding.storeId, treeDigest: binding.treeDigest, artifact: binding.artifact },
    configuration: Object.fromEntries(Object.entries(binding.configuration).map(([key, value]) => [key, String(value)])) }, request);
  if (event.inputDigest !== inputDigest || event.result !== expected.result || canonical(event.verdict) !== canonical(expected)) throw conflict();
  const artifact = (await client.query<{ content: string }>(`SELECT d.content FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id
    WHERE a.task_id=$1 AND a.attempt_id=$2 AND a.artifact_id=$3 AND a.version=$4 AND d.task_id=a.task_id
      AND d.attempt_id=a.attempt_id AND d.artifact_version=a.version AND octet_length(d.content)<=16384 LIMIT 1`,
  [task.id, attempt.id, event.artifactId, event.artifactVersion])).rows[0];
  if (!artifact || sha256(artifact.content) !== event.artifactVersion) throw conflict();
  let output: unknown; try { output = JSON.parse(artifact.content); } catch { throw conflict(); }
  const decoded = pluginVerificationOutputSchema.safeParse(output);
  if (!decoded.success || decoded.data.inputDigest !== inputDigest || canonical(decoded.data.verdict) !== canonical(expected)) throw conflict();
  return event;
}

/** Runs inside the existing reportEvents transaction, after exact-replay and live-owner checks. */
export async function guardVerificationEvent(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: RunnerEvent,
  policy?: TrustedPluginVerifierPolicy): Promise<boolean> {
  if (!['artifact', 'verification', 'completed'].includes(event.type)) return false;
  const binding = await verifierBinding(client, task.id);
  if (!binding) {
    if (event.type === 'verification' && event.verifierId === 'flow.plugin-json-object') throw conflict();
    return false;
  }
  if (event.type === 'artifact') {
    await validatePluginSource(client, task, attempt, event.pluginSource);
    return false;
  }
  if (event.type === 'verification') {
    if (event.verifierId !== 'flow.plugin-json-object') throw conflict();
    const { id: _id, sequence: _sequence, ...data } = event;
    const checked = await checkResult(client, task, attempt, data, policy);
    if (task.latest_artifact_id !== checked.artifactId || task.latest_artifact_version !== checked.artifactVersion) throw conflict();
    task.verification_status = checked.result;
    const reference = await saveDetail(client, task.id, attempt.id, { title: `Plugin verification ${checked.result}`, kind: 'verification',
      content: JSON.stringify(checked), mediaType: 'application/json', artifactVersion: checked.artifactVersion });
    await appendTimeline(client, task, { kind: 'reference', reference });
    return true;
  }
  if (event.type === 'completed') {
    if (event.pluginCompletion?.state !== 'settled') throw new HttpError(409, 'plugin_execution_unsettled', 'Unknown execution or resource state cannot complete a verifier task.');
    if (event.outcome === 'succeeded' && task.verification_status !== 'passed') throw conflict();
    if (task.verification_status === 'passed' || task.verification_status === 'failed') {
      const rows = (await client.query<{ content: string }>(`SELECT content FROM flow.details WHERE task_id=$1 AND attempt_id=$2
        AND kind='verification' AND artifact_version=$3 ORDER BY id LIMIT 2`, [task.id, attempt.id, task.latest_artifact_version])).rows;
      if (rows.length !== 1) throw conflict();
      const checked = await checkResult(client, task, attempt, JSON.parse(rows[0]!.content), policy);
      if (checked.result !== task.verification_status || checked.artifactId !== task.latest_artifact_id) throw conflict();
    }
    // A settled pre-result failure/cancel stays pending; no fabricated failed verdict or source mutation.
  }
  return false;
}
