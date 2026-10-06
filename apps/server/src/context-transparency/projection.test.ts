import { describe, expect, it } from 'vitest';
import type { ContextIdentity, ContextMeasurement, ContextObservation } from '../../../../packages/contracts/src/context-transparency.js';
import { projectContextSnapshot } from './projection.js';

const digest = 'a'.repeat(64);
const identity = (): ContextIdentity => ({ subject: { kind: 'attempt', taskId: 'task', attemptId: 'attempt', ownerVersion: 1, nativeSessionId: 'session' }, harness: 'claude', requestedModel: 'model', resolvedModel: 'model-v1', profile: { id: '11111111-1111-4111-8111-111111111111', runnerId: '22222222-2222-4222-8222-222222222222', configDigest: digest }, executionInputDigest: digest, materialRevisionDigest: digest, historyEpoch: 'epoch-1' });
const time = '2026-10-06T09:00:00.000Z';
const measured = (value: number, estimate = false): ContextMeasurement => ({ kind: estimate ? 'estimate' : 'provider', value, source: { name: estimate ? 'claude-sdk-context' : 'provider-window', version: estimate ? '0.3.290' : '1' }, measurementMethod: estimate ? 'sdk-summary-estimate' : 'provider-report', tokenBasis: 'model-v1', coverage: 'full', evidenceRef: { id: `evidence-${value}`, title: 'Context observation' } });
const observation = (): ContextObservation => ({ id: 'observation-1', identity: identity(), observedAt: time, modelCapacity: measured(1000), compactionWindow: measured(800, true), used: measured(600, true), categories: [], compression: { state: 'not-observed' } });
const project = (sample: ContextObservation | null = observation(), current = identity(), asOf = time) => projectContextSnapshot({ identity: current, asOf, materials: [], observation: sample });
const source = () => ({ citation: { projectId: '33333333-3333-4333-8333-333333333333', sourceId: '44444444-4444-4444-8444-444444444444', version: 1, contentDigest: digest, locator: { kind: 'utf8-bytes' as const, start: 0, end: 12 } }, byteLength: 12, currentVersionAtFreeze: 1, isCurrentAtFreeze: true });

describe('public context projection', () => {
  it('reports unknown without fabricating a provider observation', () => {
    const result = project(null);
    expect(result.freshness.state).toBe('unknown');
    expect(result.used).toEqual({ kind: 'unknown', value: null, reason: 'not-observed' });
    expect(result.windows.modelHardLimit.remaining.value).toBeNull();
    expect(result.windows.modelHardLimit.overflow.state).toBe('unknown');
  });
  it('separates hard capacity, policy window and SDK estimates', () => {
    const result = project();
    expect(result.windows.modelHardLimit.limit.value).toBe(1000);
    expect(result.windows.compactionPolicy.limit.value).toBe(800);
    expect(result.windows.modelHardLimit.remaining.value).toBe(400);
    expect(result.windows.compactionPolicy.remaining.value).toBe(200);
    expect(result.used.kind).toBe('estimate');
    expect(result.windows.modelHardLimit.remaining).toMatchObject({ kind: 'estimate', measurementMethod: 'derived', derivedFrom: [{ role: 'limit', value: 1000 }, { role: 'used', value: 600 }] });
  });
  it('keeps unclamped over-limit usage and tells which window exceeded', () => {
    const sample = observation(); sample.used = measured(900, true);
    const result = project(sample);
    expect(result.used.value).toBe(900);
    expect(result.windows.compactionPolicy.remaining.value).toBe(0);
    expect(result.windows.compactionPolicy.overflow).toEqual({ state: 'exceeded', tokensOver: 100, kind: 'estimate' });
    expect(result.windows.modelHardLimit.overflow.state).toBe('within');
    sample.used = measured(1200);
    expect(project(sample).windows.modelHardLimit.overflow.tokensOver).toBe(200);
  });
  it('does not relabel the SDK autocompact window as model hard capacity', () => {
    const sample = observation(); sample.modelCapacity = measured(800, true);
    expect(() => project(sample)).toThrow('autocompact window');
  });
  it('marks comparable provider arithmetic as derived with both sources', () => {
    const sample = observation(); sample.used = measured(600);
    expect(project(sample).windows.modelHardLimit.remaining).toMatchObject({ kind: 'provider', measurementMethod: 'derived', evidenceRef: null,
      derivedFrom: [{ role: 'limit', kind: 'provider', evidenceRef: { id: 'evidence-1000' } }, { role: 'used', kind: 'provider', evidenceRef: { id: 'evidence-600' } }] });
  });
  it('does not derive remaining or safe status from partial usage', () => {
    const sample = observation(); if (sample.used.kind !== 'unknown') sample.used.coverage = 'partial';
    const result = project(sample);
    expect(result.used.value).toBe(600);
    expect(result.windows.modelHardLimit.remaining).toMatchObject({ value: null, reason: 'partial' });
    expect(result.windows.modelHardLimit.overflow.state).toBe('unknown');
  });
  it('does not compare different token bases or infer hard capacity from policy', () => {
    const sample = observation(); if (sample.modelCapacity.kind !== 'unknown') sample.modelCapacity.tokenBasis = 'different-tokenizer';
    expect(project(sample).windows.modelHardLimit.remaining.value).toBeNull();
    sample.modelCapacity = { kind: 'unknown', value: null, reason: 'not-observed' };
    expect(project(sample).windows.modelHardLimit.limit.value).toBeNull();
    expect(project(sample).windows.compactionPolicy.remaining.value).toBe(200);
  });
  it.each(['requestedModel', 'resolvedModel', 'executionInputDigest', 'materialRevisionDigest', 'historyEpoch', 'profile', 'subject'] as const)('invalidates stale %s identity', field => {
    const current = identity();
    if (field === 'profile') current.profile = { ...current.profile!, configDigest: 'b'.repeat(64) };
    else if (field === 'subject') current.subject = { ...current.subject as Extract<ContextIdentity['subject'], { kind: 'attempt' }>, ownerVersion: 2 };
    else current[field] = field.includes('Digest') ? 'b'.repeat(64) : 'changed';
    const result = project(observation(), current);
    expect(result.freshness).toEqual({ state: 'stale', reason: 'identity-changed' });
    expect(result.used.value).toBeNull();
    expect(result.windows.modelHardLimit.overflow.state).toBe('unknown');
  });
  it('expires old observations and does not accept observations from the future', () => {
    expect(project(observation(), identity(), '2026-10-06T09:00:31.000Z').freshness.reason).toBe('expired');
    expect(project(observation(), identity(), '2026-10-06T08:59:59.000Z').freshness.reason).toBe('future-observation');
    expect(project(observation(), identity(), '2026-10-06T09:00:30.000Z').freshness.state).toBe('current');
  });
  it('invalidates next-turn settings without rewriting queued or running configurations', () => {
    const queued = identity(); queued.subject = { kind: 'queued', queueItemId: 'queue-1', settingsRevision: 'settings-1' };
    const queuedSample = observation(); queuedSample.identity = queued;
    const queuedSnapshot = project(queuedSample, queued);
    const runningSnapshot = project();
    const draft = identity(); draft.subject = { kind: 'draft', draftId: 'draft-1', settingsRevision: 'settings-1' };
    const draftSample = observation(); draftSample.identity = structuredClone(draft);
    draft.subject.settingsRevision = 'settings-2'; // effort/fast may change even with the same model name.
    expect(project(draftSample, draft).freshness.state).toBe('stale');
    expect(queuedSnapshot.identity).toEqual(queued);
    expect(runningSnapshot.identity).toEqual(identity());
    expect(project(queuedSample, queued).freshness.state).toBe('current');
  });
  it('never carries an observation across harnesses based on native session alone', () => {
    const other = identity(); other.harness = 'fixture';
    expect(project(observation(), other).freshness.reason).toBe('identity-changed');
  });
  it('does not assert actual model usage while resolved identity is unknown', () => {
    const current = identity(); current.resolvedModel = null;
    const sample = observation(); sample.identity = current;
    expect(project(sample, current).used).toMatchObject({ value: null, reason: 'identity-incomplete' });
  });
  it('preserves exact selected bytes without turning them into tokens or copying private text', () => {
    const material = source();
    const result = projectContextSnapshot({ identity: identity(), asOf: time, materials: [material], observation: null });
    expect(result.materials[0]).toMatchObject({ citation: material.citation, byteLength: 12, role: 'included', tokens: { kind: 'unknown', value: null } });
    expect(() => projectContextSnapshot({ identity: identity(), asOf: time, materials: [{ ...material, text: 'private body', path: '/private/material' }], observation: null } as never)).toThrow();
    material.citation.locator.end = 13;
    expect(result.materials[0]!.citation.locator.end).toBe(12);
  });
  it('rejects mismatched material byte receipts and duplicate citations', () => {
    expect(() => projectContextSnapshot({ identity: identity(), asOf: time, materials: [{ ...source(), byteLength: 13 }], observation: null })).toThrow();
    expect(() => projectContextSnapshot({ identity: identity(), asOf: time, materials: [source(), source()], observation: null })).toThrow();
  });
  it('does not count deferred/free/buffer category rows again', () => {
    const sample = observation(); sample.categories = [{ id: 'tools', kind: 'deferred', tokens: 9000 }, { id: 'reserve', kind: 'buffer', tokens: 50 }, { id: 'messages', kind: 'used', tokens: 600 }, { id: 'room', kind: 'free', tokens: 150 }];
    expect(project(sample).used.value).toBe(600);
    expect(project(sample).windows.compactionPolicy.remaining.value).toBe(200);
  });
  it('does not infer compaction from declining usage; absent summary remains unavailable', () => {
    const sample = observation(); sample.used = measured(10, true);
    expect(project(sample).compression.state).toBe('not-observed');
    sample.compression = { state: 'observed', id: 'compact-1', summaryRef: null, coveredSources: [] };
    expect(project(sample).compression).toEqual(sample.compression);
  });
  it('rejects session billing and keeps the snapshot bounded', () => {
    expect(() => projectContextSnapshot({ identity: identity(), asOf: time, materials: [], observation: null, usage: { inputTokens: 1000000 } } as never)).toThrow();
    const sample = observation(); sample.categories = Array.from({ length: 33 }, (_, i) => ({ id: `cat-${i}`, kind: 'used', tokens: 1 }));
    expect(() => project(sample)).toThrow();
    expect(Buffer.byteLength(JSON.stringify(project()))).toBeLessThan(65536);
  });
});
