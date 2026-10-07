import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Detail, RunnerEvent } from '@flow/contracts';
import { HttpError, sha256 } from './database.js';
import type { TaskRecord } from './tasks.js';
import { assertEngineeringVerification } from './engineering/verification.js';

export async function saveDetail(client: PoolClient, taskId: string, attemptId: string, detail: Omit<Detail, 'id'>): Promise<{ id: string; title: string }> {
  const id = randomUUID();
  await client.query('INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type,artifact_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, taskId, attemptId, detail.title, detail.kind, detail.content, detail.mediaType, detail.artifactVersion ?? null]);
  return { id, title: detail.title };
}
export async function saveArtifact(client: PoolClient, task: TaskRecord, attemptId: string, event: Extract<RunnerEvent, { type: 'artifact' }>) {
  if (sha256(event.content) !== event.version) throw new HttpError(409, 'artifact_digest', 'Artifact content does not match its version.');
  const existing = (await client.query<{ detail_id: string }>('SELECT detail_id FROM flow.artifacts WHERE task_id=$1 AND artifact_id=$2 AND version=$3', [task.id, event.artifactId, event.version])).rows[0];
  const reference = existing ? { id: existing.detail_id, title: event.title } : await saveDetail(client, task.id, attemptId, { kind: 'artifact', title: event.title, content: event.content, mediaType: event.mediaType, artifactVersion: event.version });
  if (!existing) await client.query('INSERT INTO flow.artifacts(task_id,artifact_id,version,attempt_id,detail_id) VALUES($1,$2,$3,$4,$5)', [task.id, event.artifactId, event.version, attemptId, reference.id]);
  task.latest_artifact_id = event.artifactId;
  task.latest_artifact_version = event.version;
  task.verification_status = 'pending';
  return reference;
}
export async function verifyArtifact(client: PoolClient, task: TaskRecord, attemptId: string, event: Extract<RunnerEvent, { type: 'verification' }>) {
  const artifact = (await client.query<{ content: string }>('SELECT d.content FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id WHERE a.task_id=$1 AND a.artifact_id=$2 AND a.version=$3 AND a.attempt_id=$4', [task.id, event.artifactId, event.artifactVersion, attemptId])).rows[0];
  if (!artifact || sha256(artifact.content) !== event.artifactVersion) throw new HttpError(409, 'artifact_not_found', 'The exact artifact version was not submitted by this attempt.');
  if (task.submission.engineering || event.verifierId === 'flow.engineering' || event.verifierId === 'flow.engineering.native') {
    await assertEngineeringVerification(client, task, attemptId, event, artifact.content);
    if (task.latest_artifact_id === event.artifactId && task.latest_artifact_version === event.artifactVersion) task.verification_status = event.result;
    return saveDetail(client, task.id, attemptId, { title: `Engineering verification ${event.result}`, kind: 'verification', content: JSON.stringify(event), mediaType: 'application/json', artifactVersion: event.artifactVersion });
  }
  const requested = task.submission.verification;
  const rule = requested?.kind === 'contains' ? { kind: 'contains' as const, expected: requested.expected } : { kind: 'nonempty' as const };
  const inputDigest = sha256(JSON.stringify({ artifactVersion: event.artifactVersion, rule }));
  const passed = rule.kind === 'contains' ? artifact.content.includes(rule.expected) : artifact.content.trim().length > 0;
  if (inputDigest !== event.inputDigest || event.result !== (passed ? 'passed' : 'failed')) throw new HttpError(409, 'verification_conflict', 'Verification does not match the designated rule and artifact.');
  if (task.latest_artifact_id === event.artifactId && task.latest_artifact_version === event.artifactVersion) task.verification_status = event.result;
  return saveDetail(client, task.id, attemptId, { title: `Verification ${event.result}`, kind: 'verification', content: JSON.stringify(event), mediaType: 'application/json', artifactVersion: event.artifactVersion });
}
