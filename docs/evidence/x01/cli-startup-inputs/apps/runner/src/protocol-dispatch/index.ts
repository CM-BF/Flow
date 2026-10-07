import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { SendMessageRequest, TaskState, type Task } from '@a2a-js/sdk';
import { FlowClient, FlowApiError } from '@flow/client';
import type { ClaimedTask, ProtocolCommand, ProtocolState } from '@flow/contracts';
import { connectA2A, type A2APeer } from '@flow/protocols';
import { EventOutbox, EventStorageError, replayPending, reportBatch } from '../outbox.js';
import { textDigest } from '../verifier.js';
import { ProtocolLease } from './lease.js';
import { importArtifacts } from './materials.js';
import { configuredEndpoint, ProtocolConfigurationError, type ProtocolEndpoints } from './configuration.js';
export { loadProtocolEndpoints, type ProtocolEndpoints } from './configuration.js';


export interface ProtocolRunnerOptions {
  baseUrl: string; token: string; workingDirectory: string; signal: AbortSignal; endpoints: ProtocolEndpoints;
  pollIntervalMs?: number; heartbeatIntervalMs?: number; requestTimeoutMs?: number;
  onNotice?: (notice: { type: 'protocol-uncertain' | 'connection-lost' | 'events-retained'; attemptId?: string }) => void;
}
export async function runProtocolRunner(options: ProtocolRunnerOptions): Promise<void> {
  for (const value of [options.pollIntervalMs ?? 500, options.heartbeatIntervalMs ?? 1000, options.requestTimeoutMs ?? 1500]) if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) throw new Error('Protocol runner intervals must be positive integers.');
  if ((options.heartbeatIntervalMs ?? 1000) > 2000 || !options.token || !options.workingDirectory) throw new Error('Invalid protocol runner configuration.');
  const client = new FlowClient(options);
  const root = join(options.workingDirectory, textDigest(options.baseUrl.replace(/\/$/, '')));
  await prepareDirectory(root);
  const signal = () => AbortSignal.any([options.signal, AbortSignal.timeout(options.requestTimeoutMs ?? 1500)]);
  while (!options.signal.aborted) {
    try {
      await replayPending(root, batch => reportBatch(client, batch, signal()), attemptId => options.onNotice?.({ type: 'events-retained', attemptId }));
      const recovered = await client.protocolRecover(signal());
      const assignment = recovered.assignments[0]?.assignment ?? (await client.claim(signal())).assignment;
      if (assignment) await execute(assignment, client, root, options);
    } catch (error) {
      if (options.signal.aborted) break;
      if (error instanceof EventStorageError || error instanceof ProtocolConfigurationError) throw error;
      if (error instanceof FlowApiError && [401, 403].includes(error.status)) throw new Error('Protocol runner authentication was rejected.');
      options.onNotice?.({ type: 'connection-lost' });
    }
    await sleep(options.pollIntervalMs ?? 500, undefined, { signal: options.signal }).catch(() => undefined);
  }
}
async function execute(assignment: ClaimedTask, client: FlowClient, root: string, options: ProtocolRunnerOptions) {
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const endpoint = configuredEndpoint(options.endpoints, assignment.task.protocol?.endpointRef ?? '');
  const directory = join(root, textDigest(assignment.attempt.id));
  await prepareDirectory(directory);
  const lease = new ProtocolLease(client, ownership, options.signal, options.requestTimeoutMs ?? 1500, options.heartbeatIntervalMs ?? 1000);
  let state: ProtocolState | undefined;
  let command: ProtocolCommand | undefined;
  let outbox: EventOutbox | undefined;
  let sendingMayHaveStarted = false;
  try {
    await lease.check();
    const prepareInput = { ...ownership, endpointDigest: textDigest(new URL(endpoint.url).href) };
    state = await client.protocolPrepare(prepareInput, lease.requestSignal());
    command = { ...ownership, commandId: state.intent.commandId };
    outbox = new EventOutbox(directory, ownership, async batch => {
      try { await reportBatch(client, batch, lease.requestSignal()); }
      catch (error) { lease.interrupt(); throw error; }
    }, state.lastSequence);
    const peer = await connectA2A(endpoint);
    if (state.intent.phase === 'prepared') {
      await lease.check();
      if (lease.cancelRequested) {
        state = await client.protocolPrepare(prepareInput, lease.requestSignal());
        if (state.intent.phase !== 'prepared') throw new Error('A cancellation raced with remote dispatch.');
        await outbox.emit({ type: 'completed', outcome: 'cancelled' }); return;
      }
      sendingMayHaveStarted = true;
      const permit = await client.protocolBegin(command, lease.requestSignal());
      state = permit.state;
      if (!permit.maySend) throw new Error('Dispatch permission was already consumed.');
      const response = await peer.send(SendMessageRequest.fromJSON({ message: { messageId: state.intent.commandId, role: 'ROLE_USER', parts: [{ text: assignment.task.prompt }] }, configuration: { returnImmediately: true, historyLength: 0 } }), { signal: lease.signal });
      if (!('id' in response) || !response.id) throw new Error('The remote agent did not return a durable Task.');
      state = await client.protocolBind({ ...command, remoteTaskId: response.id }, lease.requestSignal());
    }
    if (state.intent.phase !== 'bound' || !state.intent.remoteTaskId) throw new Error('Remote outcome is unresolved.');
    await observe(peer, state, command, client, lease, outbox, assignment, directory, options);
  } catch (error) {
    if (error instanceof EventStorageError || error instanceof ProtocolConfigurationError) throw error;
    if (!lease.signal.aborted && command && state) {
      if (state.intent.phase === 'prepared' && !sendingMayHaveStarted) await outbox?.emit({ type: 'completed', outcome: 'failed', error: 'Remote dispatch could not be prepared.' });
      else {
        await client.protocolUncertain({ ...command, reason: state.intent.remoteTaskId ? 'remote-read-failed' : 'send-result-unknown' }, lease.requestSignal());
        options.onNotice?.({ type: 'protocol-uncertain', attemptId: ownership.attemptId });
      }
    }
  } finally { lease.close(); await outbox?.settle(); }
}
async function observe(peer: A2APeer, state: ProtocolState, command: ProtocolCommand, client: FlowClient, lease: ProtocolLease, outbox: EventOutbox, assignment: ClaimedTask, directory: string, options: ProtocolRunnerOptions) {
  let previousStatus: TaskState | undefined;
  while (!lease.signal.aborted) {
    await lease.check();
    if (lease.cancelRequested && !state.intent.cancelStarted) {
      const permission = await client.protocolStartCancel(command, lease.requestSignal());
      state = permission.state;
      if (permission.maySend) {
        try { await peer.cancel(state.intent.remoteTaskId!, { signal: lease.signal }); }
        catch { lease.signal.throwIfAborted(); /* GetTask reconciles cancellation; never retry CancelTask. */ }
      }
    }
    const snapshot: Task = await peer.snapshot({ id: state.intent.remoteTaskId!, historyLength: 0 }, { signal: lease.signal });
    if (snapshot.id !== state.intent.remoteTaskId) throw new Error('The peer returned a different task.');
    await importArtifacts(snapshot, state, directory, outbox, assignment.task.verification);
    const status = snapshot.status?.state;
    if (status !== previousStatus) { await outbox.emit({ type: 'message', text: `Remote task state: ${status ?? 'unknown'}.` }); previousStatus = status; }
    if (status === TaskState.TASK_STATE_COMPLETED || status === TaskState.TASK_STATE_FAILED || status === TaskState.TASK_STATE_REJECTED || status === TaskState.TASK_STATE_CANCELED) {
      await outbox.emit({ type: 'completed', outcome: status === TaskState.TASK_STATE_COMPLETED ? 'succeeded' : status === TaskState.TASK_STATE_CANCELED ? 'cancelled' : 'failed' });
      return;
    }
    if (![TaskState.TASK_STATE_SUBMITTED, TaskState.TASK_STATE_WORKING].includes(status ?? TaskState.TASK_STATE_UNSPECIFIED)) throw new Error('Remote state requires unsupported interaction or reconciliation.');
    await sleep(options.pollIntervalMs ?? 500, undefined, { signal: lease.signal });
  }
}

async function prepareDirectory(directory: string): Promise<void> {
  try { await mkdir(directory, { recursive: true, mode: 0o700 }); }
  catch { throw new EventStorageError(); }
}
