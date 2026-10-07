import type { UsageTotals } from './tasks.js';

/** No request knobs: one bounded, owner-authorized task projection. */
export const USAGE_READOUT_SAMPLE_LIMIT = 1000;
export const USAGE_READOUT_SOURCE_LIMIT = 32;

/** value is null if any contribution is unknown or the bounded read is incomplete. */
export interface UsageQuantity {
  value: number | null;
  /** null also represents a sum outside the safe numeric range. */
  knownSubtotal: number | null;
  knownSamples: number;
  unknownSamples: number;
}
export interface UsageBreakdown {
  uncachedInputTokens: UsageQuantity;
  cacheReadTokens: UsageQuantity;
  cacheWriteTokens: UsageQuantity;
  outputTokens: UsageQuantity;
  sdkEstimateUsd: UsageQuantity;
  providerActualUsd: UsageQuantity;
}
export interface UsageSourceReadout {
  source: string;
  model: string | null;
  accounting: 'authoritative' | 'informational';
  samples: number;
  /** The existing usage ledger does not persist an SDK/producer version. */
  producerVersion: null;
  inputMeaning: 'uncached' | 'source-defined';
  coverage: 'unverified';
  phaseAttribution: 'unavailable';
  /** Documentation context, not an attestation about these stored samples. */
  reference: { package: '@anthropic-ai/claude-agent-sdk'; version: '0.3.290'; coverage: 'query-pipeline-excludes-outside-helpers' } | null;
  breakdown: UsageBreakdown;
}
export interface TaskUsageReadout {
  kind: 'task-usage-readout';
  version: 1;
  taskId: string;
  /** Existing persisted UsageTotals, unchanged; input is not renamed or recomputed. */
  legacy: UsageTotals;
  breakdown: UsageBreakdown;
  coverage: {
    sampleLimit: 1000;
    samplesRead: number;
    authoritativeRead: number;
    informationalRead: number;
    hasMore: boolean;
    sourceLimit: 32;
    /** Omitted groups within samplesRead; further samples may contain more sources. */
    sourcesOmitted: number;
  };
  sources: UsageSourceReadout[];
  /** Stable codes: UI wording must not imply full provider billing or phase attribution. */
  caveats: Array<'producer-version-unrecorded' | 'phase-attribution-unavailable' | 'sdk-estimate-not-billing' | 'bounded-prefix' | 'no-authoritative-samples' | 'input-semantics-source-specific'>;
}
