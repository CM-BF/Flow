import { expect, it } from 'vitest';
import { CLAUDE_CONTEXT_SOURCE, contextObservationEventSchema } from './context-observation-event.js';

const event = () => ({ id: 'event-1', sequence: 1, type: 'context-observation', observation: {
  source: { ...CLAUDE_CONTEXT_SOURCE }, observationId: 'observation-1', observedAt: '2026-10-06T10:00:00.000Z', nativeSessionId: 'session-1',
  resolvedModel: 'claude-test', used: 0, compactionWindow: 100, categories: [{ kind: 'used', tokens: 0 }],
} });
it('preserves zero and over-window estimates without clamping or claiming a hard limit', () => {
  expect(contextObservationEventSchema.parse(event()).observation.used).toBe(0);
  const input = event(); input.observation.used = 120;
  expect(contextObservationEventSchema.parse(input).observation).toMatchObject({ used: 120, compactionWindow: 100 });
});
it.each([-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid tokens %s', used => {
  const input = event(); input.observation.used = used;
  expect(contextObservationEventSchema.safeParse(input).success).toBe(false);
});
it.each(['provider', 'full', '0.3.291'])('rejects unsupported provenance %s', invalid => {
  const input = event(); const key = invalid === 'provider' ? 'kind' : invalid === 'full' ? 'requestDetail' : 'version';
  expect(contextObservationEventSchema.safeParse({ ...input, observation: { ...input.observation, source: { ...input.observation.source, [key]: invalid } } }).success).toBe(false);
});
it.each(['text', 'path', 'evidenceRef', 'identity', 'modelCapacity', 'usage'])('rejects untrusted field %s', key => {
  const input = event();
  expect(contextObservationEventSchema.safeParse({ ...input, observation: { ...input.observation, [key]: 'private' } }).success).toBe(false);
});
it('rejects duplicate, named or overflowing categories instead of truncating them', () => {
  for (const categories of [[{ kind: 'used', tokens: 1 }, { kind: 'used', tokens: 2 }], [{ kind: 'used', tokens: 1, label: '/private' }], [{ kind: 'used', tokens: Number.MAX_SAFE_INTEGER }, { kind: 'buffer', tokens: 1 }]]) {
    const input = event(); expect(contextObservationEventSchema.safeParse({ ...input, observation: { ...input.observation, categories } }).success).toBe(false);
  }
});
it('keeps unknown model measurements wholly unknown', () => {
  const input = event();
  expect(contextObservationEventSchema.safeParse({ ...input, observation: { ...input.observation, resolvedModel: null } }).success).toBe(false);
  expect(contextObservationEventSchema.parse({ ...input, observation: { ...input.observation, resolvedModel: null, used: null, compactionWindow: null, categories: [] } }).observation.used).toBeNull();
});
it('rejects paths in identifiers, zero windows and out-of-range event sequence', () => {
  const input = event();
  for (const observation of [{ ...input.observation, nativeSessionId: '/private/session' }, { ...input.observation, compactionWindow: 0 }]) expect(contextObservationEventSchema.safeParse({ ...input, observation }).success).toBe(false);
  expect(contextObservationEventSchema.safeParse({ ...input, sequence: 2_147_483_648 }).success).toBe(false);
});
