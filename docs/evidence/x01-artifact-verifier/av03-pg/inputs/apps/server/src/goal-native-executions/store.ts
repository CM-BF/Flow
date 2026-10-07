import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { GoalNativeExecution, GoalNativeExecutionResult } from '../../../../packages/contracts/src/goal-native-executions.js';
import { HttpError } from '../database.js';
import { requireExecutionProfile } from '../execution-profiles/store.js';
import { executeGoalNode } from '../goals/commands.js';
import { loadState } from '../goals/state.js';
import { command } from '../tasks.js';

export async function admitGoalNativeExecution(pool: Pool, boss: PgBoss, goalId: string, input: GoalNativeExecution, key: string): Promise<GoalNativeExecutionResult> {
  const accepted = await command(pool, `goal:native-execute:${goalId}`, key, input, async client => {
    const state = await loadState(client, goalId, true);
    const profile = await requireExecutionProfile(client, input.executionProfile, 'ordinary');
    if (profile.configuration.access !== 'configured-readonly') throw new HttpError(409, 'goal_readonly_profile_required', 'Native node execution requires an explicitly configured readonly profile.');
    const result = await executeGoalNode(client, boss, state, { ...input, kind: 'execute' }, { harness: 'claude', executionProfile: profile.reference });
    return { ...result, executionProfile: profile.reference };
  });
  // An already committed owner receipt does not launch new work or revive a revoked runner.
  return { ...accepted.value, replayed: accepted.replayed };
}
