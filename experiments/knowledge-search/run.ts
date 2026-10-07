import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { OwnedDatabase, durableJson, errorFact } from './owned-database.js';
import { measure } from './measurement.js';
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
const database = new OwnedDatabase(databaseUrl, join(namespace, 'owned'), start);
let failed = false;
const measurement: Record<string, unknown> = {}; result.measurement = measurement;
try { await measure(database, await database.open(), measurement); }
catch (error) { failed = true; result.failure = errorFact(error); }
finally { result.cleanup = await database.close(); result.resourceFacts = database.facts; }
const cleanup = result.cleanup as Awaited<ReturnType<OwnedDatabase['close']>>;
result.endedAt = new Date().toISOString(); result.elapsedMs = Date.now() - start;
result.passed = !failed && cleanup.absent && cleanup.adminClosed && cleanup.errors.length === 0;
await durableJson(join(namespace, 'result.json'), result);
if (!result.passed) process.exitCode = 1;
