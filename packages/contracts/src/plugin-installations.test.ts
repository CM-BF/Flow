import { expect, test } from 'vitest';
import { pluginInstallRequestSchema, pluginInstallCommandSchema } from './plugin-installations.js';
const request = { expectedRevision: 1, fetchOperationId: '00000000-0000-4000-8000-000000000001', fetchAttemptId: '00000000-0000-4000-8000-000000000002', reason: 'Install the selected verified package' };
test('accepts only exact operation and attempt identities, never caller material or paths', () => {
  expect(pluginInstallRequestSchema.safeParse(request).success).toBe(true);
  for (const extra of [{ root: '/tmp/package' }, { artifact: {} }, { installed: true }]) expect(pluginInstallRequestSchema.safeParse({ ...request, ...extra }).success).toBe(false);
});

test('requires a positive bounded revision, two exact UUIDs and a bounded nonblank reason', () => {
  for (const patch of [{ expectedRevision: 0 }, { expectedRevision: 2_147_483_648 }, { fetchOperationId: '../other' }, { fetchAttemptId: 'latest' }, { reason: ' ' }, { reason: 'x'.repeat(513) }]) expect(pluginInstallRequestSchema.safeParse({ ...request, ...patch }).success).toBe(false);
});

test('separates first start from read reconciliation and rejects retry and caller lifecycle evidence', () => {
  for (const action of ['start', 'reconcile']) expect(pluginInstallCommandSchema.safeParse({ action, reason: 'Observe the exact operation' }).success).toBe(true);
  for (const input of [{ action: 'retry', reason: 'again' }, { action: 'reconcile', reason: 'read', executionSettled: true }]) expect(pluginInstallCommandSchema.safeParse(input).success).toBe(false);
});
