import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { FlowApiError, FlowClient } from '@flow/client';
import type { ClaimedTask, DecisionAnswer, HarnessAdapter, HarnessContext, RunnerEventData } from '@flow/contracts';
import { createFixtureAdapter } from './fixture.js';
import { textDigest } from './verifier.js';
import { AttemptControl, type LeaseGrant } from './attempt-control.js';
import { EventOutbox, EventStorageError, replayPending, reportBatch } from './outbox.js';

export interface RunnerNotice { type: 'connection-lost' | 'ownership-lost' | 'adapter-failed' | 'events-retained'; attemptId?: string }
export interface RunnerOptions {
  baseUrl: string;
  token: string;
  workingDirectory: string;
  signal: AbortSignal;
  adapters?: HarnessAdapter[];
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  requestTimeoutMs?: number;
  onNotice?: (notice: RunnerNotice) => void;
}

export async function runRunner(options: RunnerOptions): Promise<void> {
  validateOptions(options);
  const client = new FlowClient(options);
  const adapters = options.adapters ?? [createFixtureAdapter()];
  const stateDirectory = join(options.workingDirectory, textDigest(options.baseUrl.replace(/\/$/, '')));
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  let disconnected = false;
  while (!options.signal.aborted) {
    try {
      await replayPending(stateDirectory, batch => reportBatch(client, batch, requestSignal(options)), attemptId => options.onNotice?.({ type: 'events-retained', attemptId }));
      const requestedAt = performance.now();
      const { assignment, remainingLeaseMs } = await client.claim(requestSignal(options));
      disconnected = false;
      if (assignment && !options.signal.aborted) await execute(assignment, client, adapters, options, stateDirectory, { requestedAt, remainingLeaseMs });
    } catch (error) {
      if (options.signal.aborted) return;
      if (error instanceof EventStorageError) throw error;
      if (error instanceof FlowApiError && [401, 403].includes(error.status)) throw new Error('Runner authentication was rejected by the center.');
      if (!disconnected) options.onNotice?.({ type: 'connection-lost' });
      disconnected = true;
    }
    await sleep(options.pollIntervalMs ?? 500, undefined, { signal: options.signal }).catch(() => undefined);
  }
}

async function execute(assignment: ClaimedTask, client: FlowClient, adapters: HarnessAdapter[], options: RunnerOptions, stateDirectory: string, initialLease: LeaseGrant) {
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const directory = join(stateDirectory, textDigest(assignment.attempt.id));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const control = new AttemptControl(assignment, client, options, initialLease);
  const outbox = new EventOutbox(directory, ownership, async batch => {
    try { await reportBatch(client, batch, requestSignal(options)); }
    catch (error) { control.interrupt('lost'); throw error; }
  });
  const emit = (data: RunnerEventData) => outbox.emit(data);
  const decisions = new Map<string, { prompt: string; answer: Promise<DecisionAnswer['answer']> }>();
  let pendingDecision: string | undefined;
  const context: HarnessContext = {
    task: assignment.task, workingDirectory: directory, signal: control.signal,
    emit(data) {
      if (data.type === 'completed' || data.type === 'decision') throw new Error('Lifecycle events belong to the runner runtime.');
      return emit(data);
    },
    assertOwnership: () => control.assertOwnership(),
    async waitForDecision(request) {
      const existing = decisions.get(request.id);
      if (existing) {
        if (existing.prompt !== request.prompt) throw new Error('Decision IDs cannot be reused with different prompts.');
        const answer = await existing.answer;
        await control.assertOwnership();
        return answer;
      }
      if (pendingDecision) throw new Error('Only one decision can be pending per attempt.');
      pendingDecision = request.id;
      const answer = emit({ type: 'decision', decisionId: request.id, prompt: request.prompt })
        .then(() => control.answer(request.id)).finally(() => { pendingDecision = undefined; });
      decisions.set(request.id, { prompt: request.prompt, answer });
      return answer;
    },
  };
  const adapter = adapters.find(adapter => adapter.name === assignment.task.harness);
  let outcome: 'succeeded' | 'failed' | 'cancelled' = 'succeeded';
  try {
    if (!adapter) throw new Error('The assigned harness is unavailable.');
    await control.assertOwnership();
    await adapter.run(context);
  } catch (error) {
    if (error instanceof EventStorageError) throw error;
    if (!options.signal.aborted && control.reason !== 'lost') {
      if (control.reason !== 'cancel') options.onNotice?.({ type: 'adapter-failed', attemptId: assignment.attempt.id });
      outcome = control.reason === 'cancel' ? 'cancelled' : 'failed';
    }
  } finally { control.close(); await outbox.settle(); }
  if (!options.signal.aborted && control.reason !== 'lost') {
    await emit({ type: 'completed', outcome, ...(outcome === 'failed' ? { error: 'Harness execution did not complete.' } : {}) });
  }
}

function requestSignal(options: RunnerOptions) {
  return AbortSignal.any([options.signal, AbortSignal.timeout(options.requestTimeoutMs ?? 1500)]);
}

function validateOptions(options: RunnerOptions) {
  for (const duration of [options.pollIntervalMs ?? 500, options.heartbeatIntervalMs ?? 2000, options.requestTimeoutMs ?? 1500]) {
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 2_147_483_647) throw new Error('Runner intervals must be positive 32-bit integers.');
  }
  if ((options.heartbeatIntervalMs ?? 2000) > 2000) throw new Error('Runner heartbeats must be at most two seconds apart.');
  if (!options.token || !options.workingDirectory) throw new Error('Runner token and working directory are required.');
}
