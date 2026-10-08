import { FlowClient, FlowApiError } from '@flow/client';
import type { EventPage, TaskSnapshot, TaskSummary } from '@flow/contracts';
import type { CliIO } from './index.js';

export interface WatchOptions { json: boolean; timeoutMs?: number; signal?: AbortSignal }
export function terminalExit(task: TaskSummary): number | undefined {
  if (task.status === 'failed') return 10;
  if (task.status === 'cancelled') return 11;
  if (task.status === 'uncertain') return 13;
  if (task.status === 'succeeded') return task.verificationStatus === 'passed' ? 0 : 12;
  return undefined;
}

export function taskLine(task: TaskSummary): string {
  return `${task.id} · ${task.status} · verification ${task.verificationStatus} · ${task.title}`;
}

export async function watchTask(client: FlowClient, id: string, options: WatchOptions, io: CliIO): Promise<number> {
  const deadline = options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined;
  const signal = AbortSignal.any([options.signal, deadline].filter((value): value is AbortSignal => Boolean(value)));
  try {
    const snapshot = await client.show(id, signal);
    printUpdate(snapshot, options.json, io);
    const finished = terminalExit(snapshot);
    if (finished !== undefined) return finished;
    return await followUpdates(client, id, snapshot.watermark, { ...options, signal }, io);
  } catch (error) {
    if (!signal.aborted) throw error;
    io.err('Observation ended. The task continues; use cancel to request a stop.');
    return deadline?.aborted ? 124 : 130;
  }
}

async function followUpdates(client: FlowClient, id: string, initialCursor: number, options: WatchOptions & { signal: AbortSignal }, io: CliIO): Promise<number> {
  let cursor = initialCursor;
  while (!options.signal.aborted) {
    try {
      for await (const page of client.watch(id, cursor, options.signal)) {
        if (page.reset) {
          const snapshot = await client.show(id, options.signal);
          cursor = snapshot.watermark;
          printUpdate(snapshot, options.json, io);
          const finished = terminalExit(snapshot);
          if (finished !== undefined) return finished;
          break;
        }
        cursor = page.nextCursor;
        printUpdate(page, options.json, io);
        const finished = terminalExit(page.task);
        if (finished !== undefined && !page.hasMore) return finished;
      }
    } catch (error) {
      if (options.signal.aborted || (error instanceof FlowApiError && error.status >= 400 && error.status < 500)) throw error;
      io.err('Connection lost. Reconnecting from the last received event.');
    }
    await pause(400, options.signal);
  }
  throw options.signal.reason;
}

function printUpdate(value: TaskSnapshot | EventPage, json: boolean, io: CliIO): void {
  if (json) { io.out(JSON.stringify(value)); return; }
  io.out(taskLine('task' in value ? value.task : value));
  for (const entry of value.entries) io.out(entry.kind === 'text' ? entry.text : `[${entry.reference.title}] ${entry.reference.id}`);
  if (value.pendingDecision) io.out(`Decision ${value.pendingDecision.id}: ${value.pendingDecision.prompt}`);
}

async function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const done = () => { signal.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(done, milliseconds);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
  });
}
