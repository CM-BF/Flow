import { Artifact, Message, TaskState, type Task } from '@a2a-js/sdk';
import type { FlowClient } from '@flow/client';
import type { TaskSnapshot, TaskSummary, TaskStatus, TimelineEntry } from '@flow/contracts';

export type FlowProtocolPort = Pick<FlowClient, 'submit' | 'show' | 'detail' | 'events' | 'decide' | 'cancel' | 'queryTasks'>;
const states: Record<TaskStatus, TaskState> = {
  queued: TaskState.TASK_STATE_SUBMITTED, running: TaskState.TASK_STATE_WORKING,
  waiting: TaskState.TASK_STATE_INPUT_REQUIRED, cancel_requested: TaskState.TASK_STATE_WORKING,
  succeeded: TaskState.TASK_STATE_COMPLETED, failed: TaskState.TASK_STATE_FAILED,
  cancelled: TaskState.TASK_STATE_CANCELED, uncertain: TaskState.TASK_STATE_UNSPECIFIED,
};
export function flowStatus(snapshot: TaskSnapshot) {
  return { state: states[snapshot.status], timestamp: snapshot.updatedAt, message: snapshot.pendingDecision ? Message.fromJSON({
    messageId: `decision:${snapshot.pendingDecision.id}`, contextId: snapshot.id, taskId: snapshot.id, role: 'ROLE_AGENT',
    parts: [{ text: snapshot.pendingDecision.prompt }, { data: { flowDecisionId: snapshot.pendingDecision.id, answers: ['approve', 'reject'] } }],
  }) : undefined };
}
export function settled(status: TaskStatus): boolean { return ['succeeded', 'failed', 'cancelled', 'waiting', 'uncertain'].includes(status); }

/** Flow remains the authority. All associations can be reconstructed after restart. */
export async function toA2ATask(flow: FlowProtocolPort, snapshot: TaskSnapshot, options: { historyLength?: number; includeArtifacts?: boolean; signal?: AbortSignal } = {}): Promise<Task> {
  const { historyLength = 20, includeArtifacts = true } = options;
  const timeout = AbortSignal.timeout(15_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  function read<T>(operation: () => Promise<T>): Promise<T> {
    signal.throwIfAborted();
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      operation().then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
    });
  }
  if (!Number.isSafeInteger(historyLength) || historyLength < 0) throw new Error('historyLength must be a nonnegative integer.');
  const entries: TimelineEntry[] = [];
  let cursor = 0;
  while (includeArtifacts || historyLength > 0) {
    const page = await read(() => flow.events(snapshot.id, cursor));
    entries.push(...page.entries.filter(entry => entry.cursor <= snapshot.watermark));
    if (entries.length > 10_000) throw new Error('Task exceeds the protocol event budget; use the Flow API.');
    if (!page.hasMore || page.nextCursor >= snapshot.watermark) break;
    if (page.nextCursor <= cursor) throw new Error('Center returned a non-advancing cursor.');
    cursor = page.nextCursor;
  }
  const references = includeArtifacts ? entries.filter(entry => entry.kind === 'reference') : [];
  if (references.length > 200) throw new Error('Task exceeds the protocol detail budget; use the Flow API.');
  const artifacts: Artifact[] = [];
  let artifactBytes = 0;
  for (const entry of references) {
    const detail = await read(() => flow.detail(entry.reference.id));
    if (detail.kind !== 'artifact') continue;
    artifactBytes += Buffer.byteLength(detail.content);
    if (artifactBytes > 2 * 1024 * 1024) throw new Error('Task artifacts exceed the inline protocol budget; use the Flow API.');
    artifacts.push(Artifact.fromJSON({ artifactId: detail.id, name: detail.title, parts: [{ text: detail.content, mediaType: detail.mediaType }], metadata: { version: detail.artifactVersion } }));
  }
  const history = historyLength === 0 ? [] : entries.slice(-Math.min(historyLength, 100)).map(entry => Message.fromJSON({
    messageId: entry.id, contextId: snapshot.id, taskId: snapshot.id, role: 'ROLE_AGENT',
    parts: entry.kind === 'text' ? [{ text: entry.text }] : [{ data: { id: entry.reference.id, title: entry.reference.title } }],
  }));
  return { id: snapshot.id, contextId: snapshot.id, status: flowStatus(snapshot), history, artifacts,
    metadata: { flow: { status: snapshot.status, verificationStatus: snapshot.verificationStatus, watermark: snapshot.watermark, usage: snapshot.usage,
      cancellationPending: snapshot.status === 'cancel_requested', outcomeUncertain: snapshot.status === 'uncertain' } } };
}

export function flowStatuses(state: TaskState): TaskStatus[] | undefined {
  if (state === TaskState.TASK_STATE_UNSPECIFIED) return undefined;
  return (Object.entries(states) as [TaskStatus, TaskState][]).filter(([, mapped]) => mapped === state).map(([status]) => status);
}

export function summaryToA2ATask(summary: TaskSummary): Task {
  return { id: summary.id, contextId: summary.id, status: { state: states[summary.status], timestamp: summary.updatedAt, message: undefined },
    artifacts: [], history: [], metadata: { flow: { status: summary.status, verificationStatus: summary.verificationStatus } } };
}
