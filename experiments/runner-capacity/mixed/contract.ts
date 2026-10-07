export interface RunContract {
  queueProbe?: Readonly<{ activityTailMs: number; emitTailMs: number; lightReadLimit: number; ownerHttpLimit: number; runnerHttpLimit: number }>;
  version: number; base: string; tasks: number; maximumTasks: number; totalMs: number; workMs: number;
  caseMs: number; cancelMs: number; eventsPerSecond: number; messageBytes: number; heartbeatMs: number;
  pollMs: number; requestMs: number; leaseMs: number; readIntervalMs: number; maxReads: number; observationMs: number;
  softBytes: number; totalBytes: number; responseBytes: number; ipcPendingBytes: number; maxRecords: number;
  settlementMs: number; gateMs: number; minimumCaseBudgetMs: number; cancelCount: number; persistentSessions: boolean;
  reserveObservations: boolean; ownedStreams: number; journalFiles: number; memoryIntervalMs: number;
  archiveReserveBytes: number; finalCliBytes: number;
  cleanup: Readonly<{ child: number; drain: number; observer: number; exists: number; connections: number;
    drop: number; absent: number; admin: number; journal: number; observations: number; result: number }>;
  cases: readonly Readonly<{ id: string; runners: number; slots: number }>[];
}
export const CONTRACT: RunContract = Object.freeze({
  version: 1, base: '4391bbf9f1785212d098ef6aa1c01a0320a003d3', tasks: 32, maximumTasks: 40,
  totalMs: 60_000, workMs: 45_000, caseMs: 6_000, cancelMs: 3_000,
  eventsPerSecond: 5, messageBytes: 256, heartbeatMs: 1_000, pollMs: 500,
  requestMs: 1_500, leaseMs: 10_000, readIntervalMs: 100, maxReads: 2, observationMs: 100,
  softBytes: 48 * 1024 * 1024, totalBytes: 64 * 1024 * 1024, responseBytes: 256 * 1024,
  ipcPendingBytes: 1024 * 1024, maxRecords: 60_000,
  settlementMs: 1500, gateMs: 10000, minimumCaseBudgetMs: 12000, cancelCount: 4, persistentSessions: false,
  reserveObservations: false, ownedStreams: 256, journalFiles: 300, memoryIntervalMs: 1000,
  archiveReserveBytes: 0, finalCliBytes: 4096,
  cleanup: { child: 52000, drain: 53500, observer: 54000, exists: 55500, connections: 57000, drop: 58000, absent: 58000,
    admin: 58500, journal: 59000, observations: 59500, result: 59900 },
  cases: [{ id: 'one-by-sixteen', runners: 1, slots: 16 }, { id: 'four-by-four', runners: 4, slots: 4 }],
});
export const LARGE_CONTRACT: RunContract = Object.freeze({ ...CONTRACT,
  version: 2, base: '1c4968354dabce1e6748f3301a2e6eecd33e77d4', tasks: 128, maximumTasks: 128,
  totalMs: 180000, workMs: 150000, eventsPerSecond: 2, requestMs: 3000, observationMs: 200,
  softBytes: 192 * 1024 * 1024, totalBytes: 256 * 1024 * 1024, maxRecords: 160000,
  settlementMs: 5000, gateMs: 45000, minimumCaseBudgetMs: 55000, cancelCount: 0, persistentSessions: true,
  reserveObservations: true, ownedStreams: 1024, journalFiles: 2048, archiveReserveBytes: 1024 * 1024, finalCliBytes: 32768,
  cleanup: Object.freeze({ child: 162000, drain: 165000, observer: 166000, exists: 168000, connections: 170000,
    drop: 173000, absent: 175000, admin: 176000, journal: 177000, observations: 178500, result: 179500 }),
  cases: Object.freeze([{ id: 'eight-by-sixteen', runners: 8, slots: 16 }]),
});

export interface BudgetObserver {
  charge(category: string, bytes: number): void;
  work(): void;
  submit(): void;
}
export class Budget {
  readonly categories: Record<string, number> = {};
  usedBytes = 0;
  tasks = 0;
  constructor(readonly started: number, private readonly now: () => number = performance.now.bind(performance), readonly contract: RunContract = CONTRACT, private readonly observer?: BudgetObserver) {}
  get remainingWorkMs() { return Math.max(0, this.started + this.contract.workMs - this.now()); }
  get remainingTotalMs() { return Math.max(0, this.started + this.contract.totalMs - this.now()); }
  work() {
    this.observer?.work();
    if (!this.remainingWorkMs || this.usedBytes >= this.contract.softBytes) throw new Error('mixed_work_budget_exhausted');
  }
  charge(category: string, bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('invalid_byte_measurement');
    this.usedBytes += bytes; this.categories[category] = (this.categories[category] ?? 0) + bytes;
    this.observer?.charge(category, bytes);
    if (this.usedBytes > this.contract.totalBytes) throw new Error('mixed_total_byte_budget_exhausted');
  }
  submit() { this.work(); if (this.tasks >= this.contract.tasks) throw new Error('mixed_task_budget_exhausted'); this.observer?.submit(); this.tasks++; }
}
export function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
