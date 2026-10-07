import { z } from 'zod';

export const harnessSchema = z.enum(['fixture', 'claude', 'codex', 'a2a']);
export type HarnessName = z.infer<typeof harnessSchema>;

const authoritativeSources: Record<HarnessName, readonly { source: string; requiresModel: boolean }[]> = {
  fixture: [{ source: 'fixture', requiresModel: false }],
  claude: [{ source: 'claude.modelUsage', requiresModel: true }],
  codex: [],
  a2a: [],
};

/** Unconfigured provider usage remains unknown; remote claims do not inherit a native policy. */
export function isAuthoritativeUsageAllowed(harness: HarnessName, sample: { source: string; scope: string; model?: string }): boolean {
  return sample.scope === 'session' && authoritativeSources[harness].some(policy =>
    policy.source === sample.source && (!policy.requiresModel || Boolean(sample.model?.trim())));
}
