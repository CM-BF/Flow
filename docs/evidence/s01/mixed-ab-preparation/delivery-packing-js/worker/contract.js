export const CONTRACT = Object.freeze({
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
export const LARGE_CONTRACT = Object.freeze({ ...CONTRACT,
    version: 2, base: '1c4968354dabce1e6748f3301a2e6eecd33e77d4', tasks: 128, maximumTasks: 128,
    totalMs: 180000, workMs: 150000, eventsPerSecond: 2, requestMs: 3000, observationMs: 200,
    softBytes: 192 * 1024 * 1024, totalBytes: 256 * 1024 * 1024, maxRecords: 160000,
    settlementMs: 5000, gateMs: 45000, minimumCaseBudgetMs: 55000, cancelCount: 0, persistentSessions: true,
    reserveObservations: true, ownedStreams: 1024, journalFiles: 2048, archiveReserveBytes: 1024 * 1024, finalCliBytes: 32768,
    cleanup: Object.freeze({ child: 162000, drain: 165000, observer: 166000, exists: 168000, connections: 170000,
        drop: 173000, absent: 175000, admin: 176000, journal: 177000, observations: 178500, result: 179500 }),
    cases: Object.freeze([{ id: 'eight-by-sixteen', runners: 8, slots: 16 }]),
});
export class Budget {
    started;
    now;
    contract;
    observer;
    categories = {};
    usedBytes = 0;
    tasks = 0;
    constructor(started, now = performance.now.bind(performance), contract = CONTRACT, observer) {
        this.started = started;
        this.now = now;
        this.contract = contract;
        this.observer = observer;
    }
    get remainingWorkMs() { return Math.max(0, this.started + this.contract.workMs - this.now()); }
    get remainingTotalMs() { return Math.max(0, this.started + this.contract.totalMs - this.now()); }
    work() {
        this.observer?.work();
        if (!this.remainingWorkMs || this.usedBytes >= this.contract.softBytes)
            throw new Error('mixed_work_budget_exhausted');
    }
    charge(category, bytes) {
        if (!Number.isSafeInteger(bytes) || bytes < 0)
            throw new Error('invalid_byte_measurement');
        this.usedBytes += bytes;
        this.categories[category] = (this.categories[category] ?? 0) + bytes;
        this.observer?.charge(category, bytes);
        if (this.usedBytes > this.contract.totalBytes)
            throw new Error('mixed_total_byte_budget_exhausted');
    }
    submit() { this.work(); if (this.tasks >= this.contract.tasks)
        throw new Error('mixed_task_budget_exhausted'); this.observer?.submit(); this.tasks++; }
}
export function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
