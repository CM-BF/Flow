import { createHash } from 'node:crypto';
import type { GoalIntent, GoalIntentStore } from '@flow/interaction/goal';
import { openPrivateJournal } from '../private-journal.js';

/** Only the public goal controller validates intent/command semantics; this codec binds its private slot. */
export async function openGoalIntentStore(directory: string, connectionId: string, goalId: string): Promise<GoalIntentStore & { close(): Promise<void> }> {
  const namespace = JSON.stringify(['flow.goal-session.v1', connectionId, goalId]);
  const slot = 'goal-' + createHash('sha256').update(namespace).digest('hex');
  const journal = await openPrivateJournal<GoalIntent>(directory, slot, value => {
    if (!value || typeof value !== 'object' || !('connectionId' in value) || value.connectionId !== connectionId || !('goalId' in value) || value.goalId !== goalId) throw Error('Goal intent namespace mismatch');
    return value as GoalIntent;
  });
  const check = (actual: string) => { if (actual !== namespace) throw Error('Goal intent namespace mismatch'); };
  return {
    async load(actual) { check(actual); return journal.load(); },
    async save(actual, value) { check(actual); if (value === null) await journal.clear(); else await journal.save(value); },
    close: journal.close,
  };
}
