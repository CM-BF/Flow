import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { OwnedDatabase, durableJson, errorFact } from './owned-database.js';
import { StorageBudget } from './budget.js';
import { measure } from './measurement.js';
import { DiagnosticProgress } from './diagnostic.js';
// Only the reviewed operator may open this mode after an actual PG window is granted.
if (process.env.FLOW_K01_QUERY_PG_OPEN !== 'reviewed') throw new Error('PG_NOT_OPEN');
const namespace = process.env.FLOW_K01_QUERY_NAMESPACE ?? '';
const start = Number(process.env.FLOW_K01_QUERY_START_MS);
if (!isAbsolute(namespace) || await realpath(namespace) !== namespace || !(await lstat(namespace)).isDirectory()
  || !Number.isSafeInteger(start) || start > Date.now() || Date.now() - start > 10_000 || !process.env.FLOW_K01_QUERY_WINDOW) throw new Error('WINDOW_INVALID');
const databaseUrl = process.env.FLOW_K01_QUERY_ADMIN_URL;
if (!databaseUrl) throw new Error('ADMIN_CONFIGURATION_MISSING');
const result: Record<string, unknown> = { startedAt: new Date(start).toISOString(), window: process.env.FLOW_K01_QUERY_WINDOW,
  fixedProduct: '3c9345df4aec85a37e8a2a155e079db260d515b1', modelCalls: 0, tasks: 0, runners: 0,
  configuration: { automaticQueueScan: false, leaseMs: 300000, background: 'lease sweep and pg-boss remain enabled',
    diagnosticStatementMs: 1500, diagnosticLockMs: 500, factoryBusinessStatementMs: 10000, pgBossStatementMs: 'unchanged factory/default; no shared override' },
  budget: { totalMs: 120000, workMs: 70000, cleanupMs: 40000, receiptMs: 10000 } };
const record = process.env.FLOW_K01_QUERY_RECORD_DIRECTORY ?? '';
const baseBytes = Number(process.env.FLOW_K01_QUERY_BASE_BYTES);
if (!isAbsolute(record) || await realpath(record) !== record || !Number.isSafeInteger(baseBytes) || baseBytes < 0) throw new Error('BUDGET_INPUT');
const budget = new StorageBudget(namespace, record, baseBytes, () => Buffer.byteLength(JSON.stringify(result, null, 2) + "\n"));
const progress = new DiagnosticProgress(join(namespace, 'progress.jsonl'), budget);
const database = new OwnedDatabase(databaseUrl, join(namespace, 'owned'), start, budget, (phase, value) => progress.record(phase, value));
let failed = false;
const measurement: Record<string, unknown> = {}; result.measurement = measurement;
try { await progress.record('started'); await measure(database, await database.open(), measurement); }
catch (error) {
  failed = true; result.failure = errorFact(error);
  try { await progress.failure(result.failure); } catch (recordError) { result.progressFailure = errorFact(recordError); }
}
finally {
  try { await progress.record('cleanup-starting'); } catch (error) { failed = true; result.progressFailure ??= errorFact(error); }
  result.cleanup = await database.close(); result.resourceFacts = database.facts;
  try { await progress.record('cleanup-result', result.cleanup); } catch (error) { failed = true; result.progressFailure ??= errorFact(error); }
}
const cleanup = result.cleanup as Awaited<ReturnType<OwnedDatabase['close']>>;
result.endedAt = new Date().toISOString(); result.elapsedMs = Date.now() - start;
result.passed = !failed && cleanup.absent && cleanup.adminClosed && cleanup.errors.length === 0;
try {
  result.storage = budget.snapshot();
  await durableJson(join(namespace, 'result.json'), result, 2 * 1024 * 1024, budget);
} catch (error) {
  // The reserved bounded parent capture keeps the original failure and cleanup facts when a receipt cannot be persisted.
  result.passed = false;
  console.error(JSON.stringify({ passed: false, receiptFailure: errorFact(error), failure: result.failure ?? null,
    cleanup, resourceFacts: database.facts, measurementRetained: false }));
}
if (!result.passed) process.exitCode = 1;
