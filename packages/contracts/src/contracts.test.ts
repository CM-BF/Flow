import { describe, expect, it } from 'vitest';
import { taskSubmissionSchema, referenceSchema } from './index.js';

describe('public contract limits', () => {
  it('accepts a user task while keeping folded references free of payloads', () => {
    const input = taskSubmissionSchema.parse({ title: 'Review notes', prompt: 'Read the notes', harness: 'fixture' });
    expect(input.title).toBe('Review notes');
    expect(referenceSchema.safeParse({ id: 'detail-1', title: 'Evidence', content: 'hidden payload' }).success).toBe(false);
  });
});

it('rejects unbounded detail uploads and accepts explicit unknown usage', async () => {
  const { runnerEventSchema } = await import('./index.js');
  expect(runnerEventSchema.safeParse({ id: 'event-1', sequence: 1, type: 'detail', title: 'Large', content: 'x'.repeat(1_048_577), mediaType: 'text/plain' }).success).toBe(false);
  const usage = runnerEventSchema.parse({ id: 'event-2', sequence: 2, type: 'usage', source: 'fixture', scope: 'session', scopeId: 'session-1', sampleId: 'sample-1', cumulative: true, baseline: { kind: 'unknown' }, accounting: 'authoritative', costKind: 'unknown', inputTokens: null, outputTokens: 3, costUsd: null });
  expect(usage.type === 'usage' && usage.inputTokens).toBe(null);
});
