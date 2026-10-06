import { expect, it } from 'vitest';
import { reconciliationObservationSchema, reconciliationResolutionSchema, reconciliationRetrySchema } from './reconciliation.js';

const ownership = { attemptId: 'attempt-old', ownerVersion: 4 };
const evidence = { explanation: 'Runner process exited; local output directory inspected.', references: [{ id: 'detail-1', title: 'Inspection record' }] };

it('requires an explicit stop confirmation and reviewed side effects before resolving uncertainty', () => {
  const input = { ...ownership, stoppedConfirmed: true, stopEvidence: evidence, sideEffects: 'reviewed', effectsEvidence: evidence, outcome: 'cancelled' };
  expect(reconciliationResolutionSchema.parse(input)).toEqual(input);
  expect(reconciliationResolutionSchema.safeParse({ ...input, stoppedConfirmed: false }).success).toBe(false);
  expect(reconciliationResolutionSchema.safeParse({ ...input, sideEffects: 'unknown' }).success).toBe(false);
  expect(reconciliationResolutionSchema.safeParse({ ...input, stopEvidence: { explanation: ' ' } }).success).toBe(false);
  expect(reconciliationResolutionSchema.safeParse({ ...input, actor: 'another-owner' }).success).toBe(false);
});

it('keeps observation separate from resolution and retry separate from native session resume', () => {
  expect(reconciliationObservationSchema.parse({ ...ownership, evidence }).evidence).toEqual(evidence);
  expect(reconciliationObservationSchema.safeParse({ ...ownership, evidence, outcome: 'failed' }).success).toBe(false);
  expect(reconciliationRetrySchema.parse({ ...ownership, resolutionId: 'resolution-1' }).resolutionId).toBe('resolution-1');
  expect(reconciliationRetrySchema.safeParse({ ...ownership, resolutionId: 'resolution-1', resumeSessionId: 'old-session' }).success).toBe(false);
  expect(reconciliationRetrySchema.safeParse({ ...ownership, resolutionId: 'resolution-1', ownerVersion: 0 }).success).toBe(false);
});

it('bounds operator explanations and keeps audit references free of inline payloads', () => {
  expect(reconciliationObservationSchema.safeParse({ ...ownership, evidence: { explanation: 'x'.repeat(4001) } }).success).toBe(false);
  expect(reconciliationObservationSchema.safeParse({ ...ownership, evidence: { ...evidence, references: [{ id: 'e', title: 'E', content: 'secret payload' }] } }).success).toBe(false);
  expect(reconciliationObservationSchema.safeParse({ ...ownership, evidence: { ...evidence, references: Array.from({ length: 33 }, (_, i) => ({ id: `e-${i}`, title: 'Evidence' })) } }).success).toBe(false);
});
