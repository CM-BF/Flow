import type { PoolClient } from 'pg';
import { isAuthoritativeUsageAllowed, type RunnerEvent, type UsageTotals } from '@flow/contracts';
import { canonical, HttpError, sha256 } from './database.js';
import type { AttemptRecord } from './runners.js';
import type { TaskRecord } from './tasks.js';

type UsageEvent = Extract<RunnerEvent, { type: 'usage' }>;
export type UsageSample = Omit<UsageEvent, 'id' | 'sequence'>;
type Sample = UsageSample;
interface StoredSample { digest: string; sample: Sample; sample_id: string }
function isAuthoritative(task: TaskRecord, sample: Sample): boolean {
  if (sample.accounting !== 'authoritative') return false;
  const supported = isAuthoritativeUsageAllowed(task.submission.harness, sample);
  if (!supported) throw new HttpError(400, 'unsupported_usage_source', 'This source cannot contribute authoritative usage.');
  return true;
}
function difference(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || current < baseline) return null;
  return current - baseline;
}
async function contributions(client: PoolClient, task: TaskRecord, stream: string, sample: Sample) {
  const previous = (await client.query<StoredSample>('SELECT sample,sample_id FROM flow.usage_samples WHERE stream=$1 AND authoritative ORDER BY ordinal DESC LIMIT 1', [stream])).rows[0];
  return projectUsageContribution(sample, previous ?? null, Boolean(task.submission.resumeSessionId));
}
/** Both ingestion and historical reads supply the strict previous authoritative stream sample. */
export function projectUsageContribution(sample: Sample, previous: Pick<StoredSample, 'sample' | 'sample_id'> | null, resumed: boolean) {
  if (previous && previous.sample.cumulative !== sample.cumulative) throw new HttpError(409, 'usage_overlap', 'Delta and cumulative samples cannot share an authoritative stream.');
  if (!sample.cumulative) return { input: sample.inputTokens, output: sample.outputTokens, cost: sample.costUsd, cacheRead: sample.cacheReadTokens ?? null, cacheWrite: sample.cacheWriteTokens ?? null };
  let baseline: Pick<Sample, 'inputTokens' | 'outputTokens' | 'costUsd' | 'cacheReadTokens' | 'cacheWriteTokens'> = { inputTokens: null, outputTokens: null, costUsd: null };
  if (sample.baseline?.kind === 'new-session' && !previous && !resumed) baseline = { inputTokens: 0, outputTokens: 0, costUsd: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  if (sample.baseline?.kind === 'sample' && previous?.sample_id === sample.baseline.sampleId) baseline = previous.sample;
  return { input: difference(sample.inputTokens, baseline.inputTokens), output: difference(sample.outputTokens, baseline.outputTokens), cost: difference(sample.costUsd, baseline.costUsd),
    cacheRead: difference(sample.cacheReadTokens ?? null, baseline.cacheReadTokens ?? null), cacheWrite: difference(sample.cacheWriteTokens ?? null, baseline.cacheWriteTokens ?? null) };
}
async function totals(client: PoolClient, taskId: string): Promise<UsageTotals> {
  const result = await client.query<{ count: number; input: string | null; output: string | null; cost: number | null; kinds: string[] }>(`
    SELECT count(*)::integer AS count,
      CASE WHEN count(input_tokens)=count(*) THEN sum(input_tokens)::text END AS input,
      CASE WHEN count(output_tokens)=count(*) THEN sum(output_tokens)::text END AS output,
      CASE WHEN count(cost_usd)=count(*) THEN sum(cost_usd) END AS cost,
      array_agg(DISTINCT cost_kind) AS kinds
    FROM flow.usage_samples WHERE task_id=$1 AND authoritative`, [taskId]);
  const row = result.rows[0]!;
  const inputTokens = row.input === null || !Number.isSafeInteger(Number(row.input)) ? null : Number(row.input);
  const outputTokens = row.output === null || !Number.isSafeInteger(Number(row.output)) ? null : Number(row.output);
  const costUsd = row.cost === null || !Number.isFinite(row.cost) ? null : Math.round(row.cost * 1e12) / 1e12;
  const costKind = !row.count || costUsd === null ? 'unknown' : row.kinds.length > 1 ? 'mixed' : row.kinds[0] as UsageTotals['costKind'];
  return { inputTokens, outputTokens, costUsd, costKind, incomplete: !row.count || inputTokens === null || outputTokens === null || costUsd === null };
}
export async function recordUsage(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: UsageEvent): Promise<void> {
  const { id: _id, sequence: _sequence, ...sample } = event;
  const authoritative = isAuthoritative(task, sample);
  if (authoritative && sample.scopeId !== attempt.native_session_id) throw new HttpError(409, 'usage_session_mismatch', 'Authoritative usage must belong to the recorded native session.');
  const stream = canonical([attempt.runner_id, task.submission.harness, sample.source, sample.scope, sample.scopeId, sample.model ?? '']);
  const digest = sha256(canonical(sample));
  const existing = (await client.query<StoredSample>('SELECT digest,sample,sample_id FROM flow.usage_samples WHERE stream=$1 AND sample_id=$2', [stream, sample.sampleId])).rows[0];
  if (existing) {
    if (existing.digest !== digest) throw new HttpError(409, 'usage_conflict', 'A usage sample ID was reused with different content.');
    return;
  }
  const delta = authoritative ? await contributions(client, task, stream, sample) : { input: null, output: null, cost: null };
  if (sample.costKind === 'unknown') delta.cost = null;
  await client.query('INSERT INTO flow.usage_samples(task_id,stream,sample_id,digest,sample,authoritative,input_tokens,output_tokens,cost_usd,cost_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [task.id, stream, sample.sampleId, digest, JSON.stringify(sample), authoritative, delta.input, delta.output, delta.cost, sample.costKind]);
  task.usage = await totals(client, task.id);
}
