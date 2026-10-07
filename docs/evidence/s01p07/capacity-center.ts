import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { FlowClient } from '@flow/client';
import type { HarnessAdapter } from '@flow/contracts';
import { runRunner } from '../../../apps/runner/src/runtime.js';
import { ClaimCenterFixture } from './pg-fixture.js';

const centers: ReturnType<typeof createCapacityCenter>[] = [];
const caseResults: Array<{ name: string; state: string }> = [];
let submitted = 0;
let aggregatePath = '';
const mainDatabaseSha = '277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653';

/** Four sequential databases reuse the reviewed fixture; each retains its own ownership receipts. */
export function createCapacityCenter(capacity: number) {
  if (process.env.FLOW_S01P07_PG_INPUT !== 'pg-capacity-slot-request.json' || centers.length >= 4) {
    throw new Error('The four-case capacity window is not selected.');
  }
  aggregatePath ||= process.env.FLOW_S01P07_PG_RECEIPT ?? '';
  if (!aggregatePath) throw new Error('Aggregate receipt path is required.');
  const receiptPath = `${aggregatePath}.case-${centers.length + 1}`;
  const center = new ClaimCenterFixture(300000);
  const executions: Array<{ shutdown: AbortController; promise: Promise<void> }> = [];
  let identity: Awaited<ReturnType<FlowClient['registerRunner']>>;
  let runner: FlowClient;
  let processSettled = false;
  const api = {
    receiptPath,
    get owner() { return center.owner; },
    get pool() { return center.pool; },
    get identity() { return identity; },
    get runner() { return runner; },
    get processSettled() { return processSettled; },
    async startCenter() {
      process.env.FLOW_S01P07_PG_RECEIPT = receiptPath;
      await center.start();
      identity = await center.owner.registerRunner({ name: 'bounded functional runner', harnesses: ['fixture'], capacity });
      runner = center.client(identity.token);
    },
    async submit(prompt: string, resumeSessionId?: string) {
      if (++submitted > 13) throw new Error('Capacity task budget exhausted.');
      return center.submit({ title: prompt, prompt, ...(resumeSessionId ? { resumeSessionId } : {}) });
    },
    start(implementation: HarnessAdapter, maxConcurrentAttempts = 4) {
      const shutdown = new AbortController();
      const promise = runRunner({ baseUrl: center.baseUrl, token: identity.token, workingDirectory: center.directory,
        signal: shutdown.signal, adapters: [implementation], maxConcurrentAttempts,
        pollIntervalMs: 10, heartbeatIntervalMs: 40, requestTimeoutMs: 1500 });
      void promise.catch(() => undefined);
      const execution = { shutdown, promise }; executions.push(execution); return execution;
    },
    async close() {
      for (const execution of executions) execution.shutdown.abort();
      let timer: NodeJS.Timeout | undefined;
      try {
        const remaining = Math.max(0, Math.min(8000, Number(process.env.FLOW_S01P07_PG_CLEANUP_UNTIL) - Date.now()));
        const results = await Promise.race([Promise.allSettled(executions.map(item => item.promise)),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Runner settlement unknown; retain owned database and root.')), remaining); })]);
        processSettled = true;
        const rejected = results.find(item => item.status === 'rejected');
        await center.withCleanup('CAPACITY_RUNNER', async () => { if (rejected?.status === 'rejected') throw rejected.reason; }, () => center.close());
      } finally { clearTimeout(timer); }
    },
  };
  centers.push(api);
  return api;
}

export function recordCapacityCase(name: string, state: string) {
  if (name.startsWith('real PG/HTTP ')) caseResults.push({ name, state });
}

export async function finishCapacityCenters() {
  if (!centers.length) return;
  const errors: string[] = [];
  const receipts: Array<Record<string, unknown>> = [];
  for (const center of centers) {
    try {
      const file = await open(center.receiptPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const info = await file.stat();
        if (!info.isFile() || info.size > 32768) throw new Error('Invalid bounded case receipt.');
        const receipt = JSON.parse(await file.readFile('utf8')) as Record<string, unknown>;
        if (receipt.window !== process.env.FLOW_S01P07_PG_WINDOW || receipt.sourceHead !== process.env.FLOW_S01P07_EXECUTION_HEAD) {
          throw new Error('Case receipt identity mismatch.');
        }
        receipts.push(receipt);
        if (!center.processSettled || !Array.isArray(receipt.errors) || receipt.errors.length) errors.push('CASE_CLEANUP_UNKNOWN');
      } finally { await file.close(); }
    } catch { errors.push('CASE_RECEIPT_UNKNOWN'); }
  }
  const mainDatabaseLoaded = process.env.FLOW_S01P07_MAIN_DATABASE_LOADED_SHA === mainDatabaseSha;
  if (!mainDatabaseLoaded) errors.push('MAIN_DATABASE_LOAD_NOT_CONFIRMED');
  if (caseResults.length !== 4 || centers.length !== 4) errors.push('FOUR_CASES_NOT_OBSERVED');
  const cleanup = Object.fromEntries(['startupSettled', 'appClosed', 'poolClosed', 'adminClosed', 'databaseAbsent', 'rootAbsent']
    .map(key => [key, receipts.length === centers.length && receipts.every(row => {
      const value = row.cleanup as Record<string, unknown> | undefined;
      return value?.[key] === true;
    })]));
  const receipt = { window: process.env.FLOW_S01P07_PG_WINDOW, sourceHead: process.env.FLOW_S01P07_EXECUTION_HEAD,
    mainDatabase: { source: '15847da4b4aa00d42bd3e25b9bf88ea046bb19a8', sha256: mainDatabaseSha, loaded: mainDatabaseLoaded },
    caseResults, tasks: submitted, http: receipts.reduce((sum, row) => sum + Number(row.http ?? 0), 0),
    cleanup, errors, cases: receipts, providerCalls: 0 };
  const encoded = JSON.stringify(receipt, null, 2) + '\n';
  if (Buffer.byteLength(encoded) > 32768) throw new Error('Aggregate receipt exceeds the reviewed reader bound.');
  const file = await open(aggregatePath, 'wx', 0o600);
  try { await file.writeFile(encoded); await file.sync(); }
  finally { await file.close(); }
  console.log(JSON.stringify(receipt));
  if (errors.length || Object.values(cleanup).some(value => !value)) throw new Error('Capacity cleanup or evidence incomplete; retain exact identities.');
}
