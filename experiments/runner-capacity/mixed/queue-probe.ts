import { COMPARISON, sideContract, type Side } from './ab-budget.js';
import { DELIVERY_BASELINE } from './pg-delivery-bridge.js';
import type { RunContract } from './contract.js';
export const QUEUE_PROBE = Object.freeze({ ...COMPARISON, windowId: 's01-pool-wait-delivery-once',
  output: 'docs/evidence/s01/pool-wait-run', maximumTasks: 258, sideTasks: 129,
  revisions: { A: DELIVERY_BASELINE, B: DELIVERY_BASELINE } });
export const BUFFERED_QUEUE = Object.freeze({ ...QUEUE_PROBE, windowId: 's01-queue-buffered-diagnostic-once',
  output: QUEUE_PROBE.output + '/buffered-diagnostic-v1', maximumTasks: 129 });
export const BUFFERED_IDENTITY = 'queue-probe-buffered-v1';
export const isQueueIdentity = (identity: string) => identity === 'queue-probe-O1-v1' || identity === 'queue-probe-O2-v1' || identity === BUFFERED_IDENTITY;
export function selectQueueRecipe(kind: unknown) {
  if (kind === 'queue-delivery') return { limits: QUEUE_PROBE, single: false } as const;
  if (kind === 'queue-buffered-single') return { limits: BUFFERED_QUEUE, single: true } as const;
  throw new Error('queue_recipe_unknown');
}
export function queueArm(kind: unknown, side: Side) {
  const recipe = selectQueueRecipe(kind);
  if (recipe.single) {
    if (side !== 'A') throw new Error('queue_single_second_arm_forbidden');
    return { identity: BUFFERED_IDENTITY, mode: 'buffered' as const };
  }
  if (side !== 'A' && side !== 'B') throw new Error('queue_side_unknown');
  return { identity: 'queue-probe-' + (side === 'A' ? 'O1' : 'O2') + '-v1', mode: side === 'A' ? 'per-query' as const : 'buffered' as const };
}
export function queueContract(side: Side): RunContract {
  return Object.freeze({ ...sideContract(side), version: 4, base: DELIVERY_BASELINE, tasks: 129, maximumTasks: 129,
    cancelCount: 4, cancelMs: 6000, queueProbe: Object.freeze({ activityTailMs: 5000, emitTailMs: 4000, lightReadLimit: 200,
      ownerHttpLimit: 512, runnerHttpLimit: 7680 }) });
}
