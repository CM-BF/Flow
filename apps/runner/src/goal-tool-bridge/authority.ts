import type { ClaimedTask } from '@flow/contracts';

export interface HostAuthority {
  assignment: ClaimedTask; signal: AbortSignal; assertOwnership(): Promise<void>;
}
/** Local lease checks bound network calls; only the center decides grant/fence authority. */
export function ownedCalls({ signal, assertOwnership }: HostAuthority) {
  return async function invoke<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    signal.throwIfAborted(); await assertOwnership();
    const result = await operation(AbortSignal.any([signal, AbortSignal.timeout(5000)]));
    signal.throwIfAborted(); await assertOwnership();
    return result;
  };
}
export function assertNativeGrant(assignment: ClaimedTask, reference: { id: string; version: number } | undefined,
  run: { id: string; version: number; taskId: string; mode: string; revokedAt: string | null }) {
  if (!reference || assignment.task.harness !== 'claude' || !assignment.task.executionProfile
    || assignment.task.executionProfile.runnerId !== assignment.attempt.runnerId
    || run.id !== reference.id || run.version !== reference.version || run.taskId !== assignment.task.id
    || run.mode !== 'claude' || run.revokedAt !== null) throw new Error('Native tool authority does not match the assignment.');
}
