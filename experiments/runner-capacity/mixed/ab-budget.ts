import { LARGE_CONTRACT, type RunContract } from './contract.js';

const MiB = 1024 * 1024;
export const COMPARISON = Object.freeze({ windowId: 's01-event-state-ab-once', totalMs: 300000, preparationMs: 15000,
  totalBytes: 512 * MiB, softBytes: 384 * MiB, commonBytes: 32 * MiB, finalReserveBytes: 4 * MiB,
  sideMs: 135000, sideBytes: 240 * MiB, startRemainingMs: 150000, maximumTasks: 256,
  output: 'docs/evidence/s01/mixed-ab-run', preparation: 'docs/evidence/s01/mixed-ab-preparation',
  revisions: { A: 'a3e670b906c1b65d586b7730ca19da83109f1dcc', B: 'aae1eb1054d75e78273e7c91ed048aeac80195da' },
});
export type Side = 'A' | 'B';
export function sideContract(side: Side): RunContract {
  return Object.freeze({ ...LARGE_CONTRACT, version: 3, base: COMPARISON.revisions[side], totalMs: COMPARISON.sideMs,
    workMs: 105000, totalBytes: COMPARISON.sideBytes,
    cleanup: Object.freeze({ child: 117000, drain: 120000, observer: 121000, exists: 123000, connections: 125000,
      drop: 128000, absent: 130000, admin: 131000, journal: 132000, observations: 133500, result: 134500 }) });
}
export type SideReceipt = { success: boolean; resourcesClosed: boolean; finalMeasuredBytes: number; finalElapsedMs: number; tasksSentOrUnknown: number };
export class ComparisonBudget {
  readonly categories: Record<string, number> = {};
  usedBytes = 0; commonBytes = 0; tasks = 0;
  private active: Side | undefined;
  private readonly startedSides = new Set<Side>();
  private sideStarted = 0;
  private sideBytes = 0;
  private sideTasks = 0;
  private stopped = false;
  constructor(readonly started: number, private readonly now: () => number = performance.now.bind(performance)) {
    this.chargeCommon('final-evidence-cli-reserve', COMPARISON.finalReserveBytes);
  }
  get sideStartedMs() { if (!this.active) throw new Error('comparison_side_missing'); return this.sideStarted; }
  get sideDeadlineMs() { return Math.min(this.started + COMPARISON.totalMs, this.sideStartedMs + COMPARISON.sideMs); }
  get remainingMs() { return Math.max(0, this.started + COMPARISON.totalMs - this.now()); }
  chargeCommon(category: string, bytes: number) {
    this.charge('common:' + category, bytes); this.commonBytes += bytes;
    if (this.commonBytes > COMPARISON.commonBytes) throw new Error('comparison_common_bytes_exhausted');
  }
  private charge(category: string, bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('comparison_invalid_bytes');
    this.usedBytes += bytes; this.categories[category] = (this.categories[category] ?? 0) + bytes;
    if (this.usedBytes > COMPARISON.totalBytes) throw new Error('comparison_total_bytes_exhausted');
  }
  begin(side: Side, previous?: SideReceipt) {
    this.work();
    if (this.active || this.startedSides.has(side) || (side === 'A' && this.startedSides.size)) throw new Error('comparison_side_replay');
    if (side === 'B' && (!this.startedSides.has('A') || !previous?.success || !previous.resourcesClosed)) throw new Error('comparison_previous_unknown');
    if (this.remainingMs < COMPARISON.startRemainingMs || COMPARISON.totalBytes - this.usedBytes < COMPARISON.sideBytes) throw new Error('comparison_start_reserve');
    this.active = side; this.startedSides.add(side); this.sideStarted = this.now(); this.sideBytes = 0; this.sideTasks = 0;
  }
  stop() { this.stopped = true; }
  work() {
    if (this.stopped) throw new Error('comparison_resource_unknown');
    if (!this.startedSides.size && this.now() - this.started >= COMPARISON.preparationMs) throw new Error('comparison_preparation_exhausted');
    if (!this.remainingMs || this.usedBytes >= COMPARISON.softBytes) throw new Error('comparison_work_exhausted');
    if (this.active && this.now() - this.sideStarted >= 105000) throw new Error('comparison_side_work_exhausted');
  }
  chargeSide(category: string, bytes: number) {
    if (!this.active) throw new Error('comparison_side_missing');
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('comparison_invalid_bytes');
    this.sideBytes += bytes; this.charge(this.active + ':' + category, bytes);
    if (this.sideBytes > COMPARISON.sideBytes) throw new Error('comparison_side_bytes_exhausted');
  }
  submit() {
    this.work();
    if (!this.active || this.sideTasks >= 128 || this.tasks >= COMPARISON.maximumTasks) throw new Error('comparison_tasks_exhausted');
    this.sideTasks++; this.tasks++;
  }
  finish(receipt: SideReceipt) {
    if (!this.active || receipt.tasksSentOrUnknown !== this.sideTasks || receipt.finalMeasuredBytes !== this.sideBytes
      || this.now() - this.sideStarted > COMPARISON.sideMs || receipt.finalElapsedMs > COMPARISON.sideMs) throw new Error('comparison_side_accounting_unknown');
    this.active = undefined;
  }
}
