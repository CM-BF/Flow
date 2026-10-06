export const CONTRACT = Object.freeze({
  version: 1, base: '4391bbf9f1785212d098ef6aa1c01a0320a003d3', tasks: 32, maximumTasks: 40,
  totalMs: 60_000, workMs: 45_000, caseMs: 6_000, cancelMs: 3_000,
  eventsPerSecond: 5, messageBytes: 256, heartbeatMs: 1_000, pollMs: 500,
  requestMs: 1_500, leaseMs: 10_000, readIntervalMs: 100, maxReads: 2, observationMs: 100,
  softBytes: 48 * 1024 * 1024, totalBytes: 64 * 1024 * 1024, responseBytes: 256 * 1024,
  ipcPendingBytes: 1024 * 1024, maxRecords: 60_000,
  cases: [{ id: 'one-by-sixteen', runners: 1, slots: 16 }, { id: 'four-by-four', runners: 4, slots: 4 }],
});
export class Budget {
  readonly categories: Record<string, number> = {};
  usedBytes = 0;
  tasks = 0;
  constructor(readonly started: number, private readonly now: () => number = performance.now.bind(performance)) {}
  get remainingWorkMs() { return Math.max(0, this.started + CONTRACT.workMs - this.now()); }
  get remainingTotalMs() { return Math.max(0, this.started + CONTRACT.totalMs - this.now()); }
  work() {
    if (!this.remainingWorkMs || this.usedBytes >= CONTRACT.softBytes) throw new Error('mixed_work_budget_exhausted');
  }
  charge(category: string, bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('invalid_byte_measurement');
    this.usedBytes += bytes; this.categories[category] = (this.categories[category] ?? 0) + bytes;
    if (this.usedBytes > CONTRACT.totalBytes) throw new Error('mixed_total_byte_budget_exhausted');
  }
  submit() { this.work(); if (this.tasks >= CONTRACT.tasks) throw new Error('mixed_task_budget_exhausted'); this.tasks++; }
}
export function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
