import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { Ownership } from '../../../../packages/contracts/src/runner.js';
import type { GoalToolCommandCall, GoalToolInputCall, GoalToolRunReference } from '../../../../packages/contracts/src/goal-tool-runs.js';
import { canonical, HttpError, sha256 } from '../database.js';
import { commandInTransaction } from '../tasks.js';
import { applyGoalCommand } from '../goals/commands.js';
import { definition, executionRows, snapshot } from '../goals/state.js';
import { authorized, requireGrantedNode } from './authorize.js';
import { runView } from './store.js';

export async function runnerGrant(pool: Pool, runnerId: string, ownership: Ownership) {
  return authorized(pool, runnerId, ownership, undefined, async (_client, run) => runView(run));
}
export async function runnerSnapshot(pool: Pool, runnerId: string, ownership: Ownership, grant: GoalToolRunReference) {
  return authorized(pool, runnerId, ownership, grant, (client, _run, state) => snapshot(client, state));
}
export async function runnerInput(pool: Pool, runnerId: string, input: GoalToolInputCall) {
  return authorized(pool, runnerId, input, input.grant, async (client, run) => {
    requireGrantedNode(run, input.nodeId);
    const row = (await client.query('SELECT * FROM flow.goal_inputs WHERE goal_id=$1 AND node_id=$2 AND version=$3', [run.goal_id, input.nodeId, input.version])).rows[0];
    if (!row) throw new HttpError(404, 'goal_input_not_found', 'Actual input version not found.');
    return definition(row);
  });
}
export async function runnerCommand(pool: Pool, boss: PgBoss, runnerId: string, input: GoalToolCommandCall, key: string) {
  return authorized(pool, runnerId, input, input.grant, async (client, run, state) => {
    requireGrantedNode(run, input.command.nodeId);
    if (!run.scope.allowedCommands.includes(input.command.kind)) throw new HttpError(403, 'goal_tool_scope', 'The command is outside this grant.');
    if (input.command.kind === 'accept-delivery') {
      const execution = (await executionRows(client, run.goal_id, [input.command.executionId]))[0];
      if (execution && execution.task.harness !== 'fixture') throw new HttpError(403, 'native_delivery_owner_required', 'Only the owner may accept a native node delivery.');
    }
    const accepted = await commandInTransaction(client, `goal-tool-command:${run.id}`, key, input.command, async () => {
      const existing = state.inputs.get(input.command.nodeId)?.input.knowledge ?? [];
      if (input.command.kind === 'define-input' && canonical(existing) !== canonical(input.command.input.knowledge ?? [])) throw new HttpError(403, 'goal_knowledge_owner_required', 'Only the owner may add, remove or reorder knowledge references.');
      if (input.command.kind === 'execute' && existing.length) throw new HttpError(403, 'goal_knowledge_owner_required', 'Knowledge-bound execution requires the owner.');
      if (run.used_commands >= run.scope.maxCommands) throw new HttpError(409, 'goal_tool_limit', 'This grant has reached its command limit.');
      const result = await applyGoalCommand(client, boss, run.goal_id, input.command, state);
      const summary = { inputVersion: result.inputVersion, executionId: result.executionId, taskId: result.task?.id, explanationVersion: result.explanation.version, changed: result.changed };
      await client.query(`INSERT INTO flow.goal_tool_calls(run_id,sequence,attempt_id,owner_version,command_key,digest,kind,node_id,result)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [run.id, run.used_commands + 1, input.attemptId, input.ownerVersion, key, sha256(canonical(input.command)), input.command.kind, input.command.nodeId, summary]);
      await client.query('UPDATE flow.goal_tool_runs SET used_commands=used_commands+1 WHERE id=$1', [run.id]);
      return result;
    });
    return { ...accepted.value, replayed: accepted.replayed };
  });
}
