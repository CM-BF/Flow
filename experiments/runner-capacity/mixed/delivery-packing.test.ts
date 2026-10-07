import { expect, it } from 'vitest';
import { packingPlan } from './delivery-packing.js';
const result = () => ({ success: true, receipt: { known: true, inputRows: 2048, samples: 506, sqlGroups: 4, messages: 4 } });
it('keeps exact ABBA order and one serial arm at a time', async () => {
  const order: string[] = []; let running = false;
  const value = await packingPlan(async variant => { expect(running).toBe(false); running = true; order.push(variant); await Promise.resolve(); running = false; return result(); }, () => 0);
  expect(order).toEqual(['old', 'new', 'new', 'old']); expect(value.success).toBe(true);
});
it.each(['failure', 'unknown', 'deadline'] as const)('does not start another worker after %s', async reason => {
  let calls = 0; let time = 0;
  const value = await packingPlan(async () => { calls++; const value = result(); if (reason === 'failure') value.success = false;
    if (reason === 'unknown') value.receipt.known = false; if (reason === 'deadline') time = 25000; return value; }, () => time);
  expect(calls).toBe(1); expect(value.success).toBe(false);
});
it('rejects changed delivery policy despite individual arm success', async () => {
  let count = 0;
  await expect(packingPlan(async () => { const value = result(); if (++count === 2) value.receipt.messages++; return value; }, () => 0)).rejects.toThrow('packing_delivery_policy_changed');
});
