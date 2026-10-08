import type { PoolClient } from 'pg';
import type { GoalArtifactBinding } from '../../../../packages/contracts/src/goals.js';
import { HttpError, sha256 } from '../database.js';

/** Caller owns the transaction, project lock and ordered, validated bindings. */
export async function dependencyContent(client: PoolClient, bindings: GoalArtifactBinding[]) {
  if (bindings.length === 0) return [];
  // UTF8 uses at most three bytes per UTF16 code unit. Include the first row
  // crossing 48000 bytes so its full hash is checked before the original limit.
  // Only identities/lengths are materialized; legal artifacts are <=1MiB each.
  const { rows } = await client.query<{ ordinal: number; content: string | null }>(`
    WITH requested AS (
      SELECT ordinal::integer, task_id, artifact_id, version, detail_id
      FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
        WITH ORDINALITY AS input(task_id, artifact_id, version, detail_id, ordinal)
    ), resolved AS MATERIALIZED (
      SELECT input.ordinal, detail.id AS detail_id, octet_length(detail.content) AS byte_length
      FROM requested input
      LEFT JOIN flow.artifacts artifact ON artifact.task_id=input.task_id
        AND artifact.artifact_id=input.artifact_id AND artifact.version=input.version
        AND artifact.detail_id=input.detail_id
      LEFT JOIN flow.details detail ON detail.id=artifact.detail_id
    ), sized AS (
      SELECT ordinal, detail_id, COALESCE(sum(byte_length) OVER (
        ORDER BY ordinal ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0) AS preceding_bytes FROM resolved
    )
    SELECT sized.ordinal, detail.content FROM sized
    LEFT JOIN flow.details detail ON detail.id=sized.detail_id
    WHERE sized.preceding_bytes <= 48000 ORDER BY sized.ordinal`, [
    bindings.map(binding => binding.taskId), bindings.map(binding => binding.artifactId),
    bindings.map(binding => binding.artifactVersion), bindings.map(binding => binding.detailId),
  ]);
  const context: (GoalArtifactBinding & { content: string })[] = [];
  let size = 0;
  for (const [index, binding] of bindings.entries()) {
    const artifact = rows[index];
    if (!artifact || artifact.ordinal !== index + 1 || artifact.content === null || sha256(artifact.content) !== binding.artifactVersion) {
      throw new HttpError(409, 'dependency_artifact', 'The exact dependency artifact is unavailable.');
    }
    size += artifact.content.length;
    if (size > 16_000) throw new HttpError(409, 'input_too_large', 'Dependency content exceeds the bounded execution context.');
    context.push({ ...binding, content: artifact.content });
  }
  return context;
}
