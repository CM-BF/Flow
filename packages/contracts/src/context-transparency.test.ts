import { describe, expect, it } from 'vitest';
import { contextMeasurementSchema, contextObservationSchema } from './context-transparency.js';

const reported = { kind: 'provider', value: 100, source: { name: 'provider-window', version: '1' }, measurementMethod: 'provider-report', tokenBasis: 'model-v1', coverage: 'full', evidenceRef: { id: 'report-1', title: 'Window report' } };

describe('context measurement contract', () => {
  it('keeps unknown distinct from zero', () => {
    expect(contextMeasurementSchema.parse({ kind: 'unknown', value: null, reason: 'not-observed' }).value).toBeNull();
    expect(contextMeasurementSchema.safeParse({ kind: 'unknown', value: 0, reason: 'not-observed' }).success).toBe(false);
    expect(contextMeasurementSchema.parse({ ...reported, value: 0 }).value).toBe(0);
  });
  it('does not turn an official SDK estimate into a provider measurement', () => {
    const sample = { ...reported, source: { name: 'claude-sdk-context', version: '0.3.290' }, measurementMethod: 'sdk-summary-estimate' };
    expect(contextMeasurementSchema.safeParse(sample).success).toBe(false);
    expect(contextMeasurementSchema.parse({ ...sample, kind: 'estimate' }).kind).toBe('estimate');
  });
  it('requires a source, version, token basis and evidence for known values', () => {
    for (const field of ['source', 'tokenBasis', 'evidenceRef'] as const) {
      const sample: Record<string, unknown> = { ...reported }; delete sample[field];
      expect(contextMeasurementSchema.safeParse(sample).success).toBe(false);
    }
    expect(contextMeasurementSchema.safeParse({ ...reported, source: { name: 'provider-window', version: '' } }).success).toBe(false);
  });
  it('rejects a billing source and unsafe numeric values', () => {
    expect(contextMeasurementSchema.safeParse({ ...reported, source: { name: 'claude.modelUsage', version: '1' } }).success).toBe(false);
    for (const value of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(contextMeasurementSchema.safeParse({ ...reported, value }).success).toBe(false);
  });
  it('requires explicit operands for a derived result', () => {
    expect(contextMeasurementSchema.safeParse({ ...reported, source: { name: 'flow-projection', version: '1' }, measurementMethod: 'derived', evidenceRef: null }).success).toBe(false);
  });
  it('does not upgrade an estimated operand through derivation', () => {
    const derived = { ...reported, value: 80, source: { name: 'flow-projection', version: '1' }, measurementMethod: 'derived', evidenceRef: null,
      derivedFrom: [{ role: 'limit', value: 100, kind: 'provider', evidenceRef: reported.evidenceRef }, { role: 'used', value: 20, kind: 'estimate', evidenceRef: reported.evidenceRef }] };
    expect(contextMeasurementSchema.safeParse(derived).success).toBe(false);
    expect(contextMeasurementSchema.parse({ ...derived, kind: 'estimate' }).value).toBe(80);
  });
  it('rejects raw provider/full-text fields rather than passing them through', () => {
    expect(contextMeasurementSchema.safeParse({ ...reported, content: 'private body', path: '/private/file' }).success).toBe(false);
    expect(contextObservationSchema.safeParse({ usage: { scope: 'session', inputTokens: 5000 } }).success).toBe(false);
  });
});
