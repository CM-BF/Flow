import type { TaskUsageReadout, UsageBreakdown, UsageQuantity, UsageSourceReadout } from '../../../../packages/contracts/src/usage-readout.js';
import { USAGE_READOUT_SAMPLE_LIMIT, USAGE_READOUT_SOURCE_LIMIT } from '../../../../packages/contracts/src/usage-readout.js';
import type { UsageTotals } from '../../../../packages/contracts/src/tasks.js';
import { projectUsageContribution, type UsageSample } from '../usage.js';

export interface UsageRow {
  sample: UsageSample;
  authoritative: boolean;
  input_tokens: string | null;
  output_tokens: string | null;
  cost_usd: number | null;
  cost_kind: UsageSample['costKind'];
  previous: { sample: UsageSample; sample_id: string } | null;
}
type Values = { [Key in keyof UsageBreakdown]: number | null };
const empty = (): UsageQuantity => ({ value: null, knownSubtotal: 0, knownSamples: 0, unknownSamples: 0 });
function breakdown(): UsageBreakdown {
  return { uncachedInputTokens: empty(), cacheReadTokens: empty(), cacheWriteTokens: empty(), outputTokens: empty(), sdkEstimateUsd: empty(), providerActualUsd: empty() };
}
function integer(value: string | null): number | null {
  return value !== null && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
function add(target: UsageBreakdown, values: Values): void {
  for (const key of Object.keys(target) as (keyof UsageBreakdown)[]) {
    const metric = target[key]; const value = values[key];
    if (value === null) { metric.unknownSamples++; continue; }
    metric.knownSamples++;
    if (metric.knownSubtotal === null) continue;
    const sum = metric.knownSubtotal + value;
    const total = key.endsWith('Usd') ? Math.round(sum * 1e12) / 1e12 : sum;
    metric.knownSubtotal = (key.endsWith('Usd') ? Number.isFinite(total) : Number.isSafeInteger(total)) ? total : null;
  }
}
function finish(target: UsageBreakdown, complete: boolean): void {
  for (const metric of Object.values(target)) metric.value = complete && metric.knownSamples > 0 && metric.unknownSamples === 0 ? metric.knownSubtotal : null;
}
function isClaude(harness: string, sample: UsageSample): boolean {
  return harness === 'claude' && sample.source === 'claude.modelUsage' && sample.scope === 'session';
}
function values(row: UsageRow, harness: string, resumed: boolean): Values {
  const cache = row.authoritative ? projectUsageContribution(row.sample, row.previous, resumed) : null;
  const claude = row.authoritative && isClaude(harness, row.sample);
  return {
    uncachedInputTokens: claude ? integer(row.input_tokens) : null,
    cacheReadTokens: claude ? cache!.cacheRead : null,
    cacheWriteTokens: claude ? cache!.cacheWrite : null,
    outputTokens: row.authoritative ? integer(row.output_tokens) : null,
    sdkEstimateUsd: row.authoritative && row.cost_kind === 'sdk_estimate' ? row.cost_usd : null,
    providerActualUsd: row.authoritative && row.cost_kind === 'provider_actual' ? row.cost_usd : null,
  };
}
function source(row: UsageRow, harness: string): UsageSourceReadout {
  const claude = isClaude(harness, row.sample);
  return { source: row.sample.source, model: row.sample.model ?? null, accounting: row.authoritative ? 'authoritative' : 'informational', samples: 0,
    producerVersion: null, inputMeaning: claude ? 'uncached' : 'source-defined', coverage: 'unverified', phaseAttribution: 'unavailable',
    reference: claude ? { package: '@anthropic-ai/claude-agent-sdk', version: '0.3.290', coverage: 'query-pipeline-excludes-outside-helpers' } : null,
    breakdown: breakdown() };
}

export function projectReadout(task: { id: string; usage: UsageTotals; harness: string; resumed: boolean }, rows: UsageRow[]): TaskUsageReadout {
  const hasMore = rows.length > USAGE_READOUT_SAMPLE_LIMIT;
  const selected = rows.slice(0, USAGE_READOUT_SAMPLE_LIMIT);
  const groups = new Map<string, UsageSourceReadout>(); const total = breakdown();
  let authoritativeRead = 0;
  for (const row of selected) {
    const key = JSON.stringify([row.sample.source, row.sample.model ?? null, row.authoritative]);
    let group = groups.get(key);
    if (!group) { group = source(row, task.harness); groups.set(key, group); }
    group.samples++;
    const contribution = values(row, task.harness, task.resumed);
    add(group.breakdown, contribution);
    if (row.authoritative) { authoritativeRead++; add(total, contribution); }
  }
  finish(total, !hasMore);
  for (const group of groups.values()) finish(group.breakdown, !hasMore);
  const caveats: TaskUsageReadout['caveats'] = ['producer-version-unrecorded', 'phase-attribution-unavailable', 'sdk-estimate-not-billing', 'input-semantics-source-specific'];
  if (hasMore) caveats.push('bounded-prefix');
  if (!authoritativeRead) caveats.push('no-authoritative-samples');
  return { kind: 'task-usage-readout', version: 1, taskId: task.id, legacy: task.usage, breakdown: total,
    coverage: { sampleLimit: USAGE_READOUT_SAMPLE_LIMIT, samplesRead: selected.length, authoritativeRead, informationalRead: selected.length - authoritativeRead,
      hasMore, sourceLimit: USAGE_READOUT_SOURCE_LIMIT, sourcesOmitted: Math.max(0, groups.size - USAGE_READOUT_SOURCE_LIMIT) },
    sources: [...groups.values()].slice(0, USAGE_READOUT_SOURCE_LIMIT), caveats };
}
