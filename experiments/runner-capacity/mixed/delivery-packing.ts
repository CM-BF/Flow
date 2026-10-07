import assert from 'node:assert/strict';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arm, loadTrace } from './delivery-replay-main.js';

export const PACKING_ORDER = ['old', 'new', 'new', 'old'] as const;
export const PACKING_WINDOW = 's01-buffered-packing-abba-once';
type Variant = typeof PACKING_ORDER[number];
type ArmResult = { success: boolean; receipt: { known: boolean; inputRows: number; samples: number; sqlGroups: number; messages: number } };
/** One finite plan. Child lifecycle, semantic receipt and transport remain the existing arm's responsibility. */
export async function packingPlan<T extends ArmResult>(run: (variant: Variant) => Promise<T>, now = performance.now.bind(performance)) {
  const started = now(); const arms: (T & { variant: Variant })[] = [];
  for (const variant of PACKING_ORDER) {
    // An arm has the existing 20s close boundary; never start one without that remaining margin.
    if (now() - started >= 25000 || arms.some(value => !value.success || !value.receipt.known)) break;
    const value = await run(variant); arms.push({ ...value, variant });
    if (value.success && value.receipt.known && arms.length > 1) {
      const expected = arms[0]!.receipt;
      for (const key of ['inputRows', 'samples', 'sqlGroups', 'messages'] as const) assert.equal(value.receipt[key], expected[key], 'packing_delivery_policy_changed');
    }
  }
  return { arms, success: arms.length === 4 && arms.every(value => value.success && value.receipt.known) && now() - started < 45000,
    parentPlanToClosedMs: now() - started };
}

async function main(tracePath: string, traceSha: string, oldWorker: string, newWorker: string) {
  assert.equal(process.env.FLOW_S01_REPLAY_OPEN, PACKING_WINDOW, 'explicit_packing_open_required');
  assert(import.meta.url.endsWith('.js'), 'precompiled_js_required');
  assert(oldWorker !== newWorker && [oldWorker, newWorker].every(value => isAbsolute(value) && value.endsWith('/delivery-replay-main.js')), 'fixed_worker_entries_required');
  const trace = loadTrace(tracePath, traceSha);
  const result = await packingPlan(variant => arm('buffered', tracePath, traceSha, trace, variant === 'old' ? oldWorker : newWorker));
  const text = JSON.stringify({ window: PACKING_WINDOW, traceSha, order: PACKING_ORDER, inputRows: trace.rows.length, ...result,
    policy: 'same buffered records, aggregation, pacing and receiver; fixed ABBA, not randomized', pgConnections: 0, providerCalls: 0 }) + '\n';
  assert(Buffer.byteLength(text) <= 32768, 'packing_result_limit');
  const beforeWrite = performance.now();
  await new Promise<void>((accept, reject) => process.stdout.write(text, error => error ? reject(error) : accept()));
  if (!result.success || result.parentPlanToClosedMs + performance.now() - beforeWrite >= 45000) process.exitCode = 1;
}
const file = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === file) {
  const [flag, trace, sha, oldWorker, newWorker, extra] = process.argv.slice(2);
  const operation = flag === '--authorized-packing-once' && trace && sha && oldWorker && newWorker && !extra
    ? main(trace, sha, oldWorker, newWorker) : Promise.reject(new Error('fixed_packing_arguments_required'));
  void operation.catch(error => { process.stderr.write(JSON.stringify({ failure: error instanceof Error ? error.message.slice(0, 160) : 'unknown' }) + '\n'); process.exitCode = 1; });
}
