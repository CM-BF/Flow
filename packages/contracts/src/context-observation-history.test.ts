import { expect, it } from 'vitest';
import { CONTEXT_DETAIL_TITLE, CONTEXT_HISTORY_PROTOCOL, contextHistoryResponseSchema, contextHistoryMaterialsSchema } from './context-observation-history.js';

const unknown = { kind: 'unknown', value: null, reason: 'not-observed' } as const;
function response() {
  const detailRef = { id: 'detail-1', title: CONTEXT_DETAIL_TITLE };
  const reading = { kind: 'estimate', value: 120, source: { name: 'claude-sdk-context', version: '0.3.290' }, measurementMethod: 'sdk-summary-estimate', tokenBasis: 'claude-context-summary-0.3.290', coverage: 'full', evidenceRef: detailRef };
  return { protocol: CONTEXT_HISTORY_PROTOCOL, taskId: 'task-1', attemptId: 'attempt-1', current: { kind: 'unknown', value: null, reason: 'history-only' }, remaining: { kind: 'unknown', value: null, reason: 'history-only' }, latest: {
    eventSequence: 1, receivedAt: '2026-10-06T10:00:01.000Z', detailRef,
    materials: { state: 'unknown', reason: 'metadata-unavailable' }, observation: {
      id: 'observation-1', observedAt: '2026-10-06T10:00:00.000Z', identity: { subject: { kind: 'attempt', taskId: 'task-1', attemptId: 'attempt-1', ownerVersion: 1, nativeSessionId: 'session-1' },
        harness: 'claude', requestedModel: 'claude-test', resolvedModel: 'claude-test', profile: { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) }, executionInputDigest: null, materialRevisionDigest: null, historyEpoch: null },
      used: reading, compactionWindow: { ...reading, value: 100 }, modelCapacity: unknown, categories: [], compression: { state: 'not-observed' },
    },
  } };
}
it('exposes bounded historical estimates with distinct reception time and no computed current/remaining', () => {
  const parsed = contextHistoryResponseSchema.parse(response());
  expect(parsed.latest?.observation.used).toMatchObject({ kind: 'estimate', value: 120 });
  expect(parsed.remaining).toEqual({ kind: 'unknown', value: null, reason: 'history-only' });
  expect(parsed.latest?.receivedAt).not.toBe(parsed.latest?.observation.observedAt);
});
it('allows no history without pretending there are zero tokens', () => {
  expect(contextHistoryResponseSchema.parse({ ...response(), attemptId: null, latest: null }).latest).toBeNull();
});
it('rejects identities for a different task or attempt', () => {
  for (const change of [{ taskId: 'other' }, { attemptId: 'other' }]) expect(contextHistoryResponseSchema.safeParse({ ...response(), ...change }).success).toBe(false);
});
it('does not upgrade historical estimates to current, remaining, provider or a hard capacity', () => {
  const input = response();
  expect(contextHistoryResponseSchema.safeParse({ ...input, current: { kind: 'current', value: 120 } }).success).toBe(false);
  expect(contextHistoryResponseSchema.safeParse({ ...input, remaining: { kind: 'estimate', value: 0 } }).success).toBe(false);
  input.latest.observation.used.kind = 'provider'; expect(contextHistoryResponseSchema.safeParse(input).success).toBe(false);
  const capacity = response(); capacity.latest.observation.modelCapacity = capacity.latest.observation.used as never;
  expect(contextHistoryResponseSchema.safeParse(capacity).success).toBe(false);
});
it('rejects forged refs, full text, draft identity and missing profile', () => {
  const ref = response(); ref.latest.detailRef = { ...ref.latest.detailRef, id: 'different' }; expect(contextHistoryResponseSchema.safeParse(ref).success).toBe(false);
  const body = response(); expect(contextHistoryResponseSchema.safeParse({ ...body, latest: { ...body.latest, text: 'private' } }).success).toBe(false);
  const draft = response(); draft.latest.observation.identity.subject = { kind: 'draft', draftId: 'd', settingsRevision: 'r' } as never; expect(contextHistoryResponseSchema.safeParse(draft).success).toBe(false);
  const missing = response(); missing.latest.observation.identity.profile = null as never; expect(contextHistoryResponseSchema.safeParse(missing).success).toBe(false);
});
it('keeps exact material bytes distinct from tokens and rejects invented byte coverage', () => {
  const source = { citation: { projectId: 'project', sourceId: '00000000-0000-4000-8000-000000000003', version: 1, contentDigest: 'a'.repeat(64), locator: { kind: 'utf8-bytes', start: 3, end: 9 } }, byteLength: 6, tokens: null };
  expect(contextHistoryMaterialsSchema.parse({ state: 'known', sources: [source] })).toMatchObject({ sources: [{ byteLength: 6, tokens: null }] });
  for (const changed of [{ ...source, byteLength: 7 }, { ...source, tokens: 6 }, { ...source, text: 'private' }]) expect(contextHistoryMaterialsSchema.safeParse({ state: 'known', sources: [changed] }).success).toBe(false);
});
