import type { PoolClient } from 'pg';
import type { GoalArtifactBinding } from '../../../../packages/contracts/src/goals.js';
import { HttpError, sha256 } from '../database.js';

export async function dependencyContent(client: PoolClient, bindings: GoalArtifactBinding[]) {
  const context: (GoalArtifactBinding & { content: string })[] = [];
  let size = 0;
  for (const binding of bindings) {
    const artifact = (await client.query<{ content: string }>(`SELECT d.content FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id
      WHERE a.task_id=$1 AND a.artifact_id=$2 AND a.version=$3 AND a.detail_id=$4`, [binding.taskId, binding.artifactId, binding.artifactVersion, binding.detailId])).rows[0];
    if (!artifact || sha256(artifact.content) !== binding.artifactVersion) throw new HttpError(409, 'dependency_artifact', 'The exact dependency artifact is unavailable.');
    size += artifact.content.length;
    if (size > 16_000) throw new HttpError(409, 'input_too_large', 'Dependency content exceeds the bounded execution context.');
    context.push({ ...binding, content: artifact.content });
  }
  return context;
}
