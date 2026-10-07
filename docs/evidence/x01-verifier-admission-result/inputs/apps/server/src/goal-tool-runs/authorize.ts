import { withRunnerAuthority } from '../goal-run-authority/runner-project-fence.js';
import type { Pool, PoolClient } from 'pg';
import type { Ownership } from '../../../../packages/contracts/src/runner.js';
import type { GoalToolRunReference } from '../../../../packages/contracts/src/goal-tool-runs.js';
import { HttpError } from '../database.js';
import { type GoalState } from '../goals/state.js';
import { nodeAuthorityStore, type RunRow } from './store.js';

/** Shared node/graph authority owns the transaction, lock order and current fence. */
export function authorized<T>(pool: Pool, runnerId: string, ownership: Ownership, expected: GoalToolRunReference | undefined,
  action: (client: PoolClient, run: RunRow, state: GoalState) => Promise<T>): Promise<T> {
  return withRunnerAuthority(pool, nodeAuthorityStore, runnerId, ownership, expected, action);
}
export function requireGrantedNode(run: RunRow, nodeId: string) {
  if (!run.scope.allowedNodeIds.includes(nodeId)) throw new HttpError(403, 'goal_tool_scope', 'The node is outside this grant.');
}
