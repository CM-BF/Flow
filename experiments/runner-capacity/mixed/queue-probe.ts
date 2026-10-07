import { COMPARISON, sideContract, type Side } from './ab-budget.js';
import { DELIVERY_BASELINE } from './pg-delivery-bridge.js';
import type { RunContract } from './contract.js';
export const QUEUE_PROBE = Object.freeze({ ...COMPARISON, windowId: 's01-pool-wait-delivery-once',
  output: 'docs/evidence/s01/pool-wait-run', maximumTasks: 258, sideTasks: 129,
  revisions: { A: DELIVERY_BASELINE, B: DELIVERY_BASELINE } });
export const isQueueIdentity = (identity: string) => identity === 'queue-probe-O1-v1' || identity === 'queue-probe-O2-v1';
export function queueContract(side: Side): RunContract {
  return Object.freeze({ ...sideContract(side), version: 4, base: DELIVERY_BASELINE, tasks: 129, maximumTasks: 129,
    cancelCount: 4, cancelMs: 6000, queueProbe: Object.freeze({ activityTailMs: 5000, emitTailMs: 4000, lightReadLimit: 200,
      ownerHttpLimit: 512, runnerHttpLimit: 7680 }) });
}
