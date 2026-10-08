import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { goalToolCommandSchema, type GoalCommandResult } from '../../../../packages/contracts/src/goals.js';
import { createGoalTools, type GoalToolOptions } from '../goal-tools/index.js';
import { read, readRequestSchema, taskSummary } from './read.js';
import { failure, result } from './result.js';

/** A fresh instance belongs to one host-bound goal; it never starts an SDK query. */
export function createGoalToolsMcp(options: GoalToolOptions) {
  const tools = createGoalTools(options);
  return createSdkMcpServer({
    name: 'flow-goal', version: '1.0.0',
    tools: [
      tool('goal_read', 'Read the fixed goal. Start with overview (default 5, maximum 10 nodes); follow returned refs for exact text. Snapshot refs must still match; refresh overview on stale_snapshot. Whole-goal overview is visible; full input reads require granted nodes. No history is silently appended.', { request: readRequestSchema }, async ({ request }) => {
        try { return result(await read(tools, request)); } catch (error) { return failure(error); }
      }, { annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false } }),
      tool('goal_command', 'Apply an explicitly granted command to the fixed goal. Keep idempotencyKey unchanged for the same intent, including uncertain outcomes. Center versions and evidence govern admission; this tool does not claim execution success.', goalToolCommandSchema.shape, async args => {
        try {
          const command = await tools.command(args) as GoalCommandResult;
          return result({ ...command, task: command.task ? taskSummary(command.task) : undefined, omitted: command.task ? ['task prompt; use task id and versioned input refs'] : [] });
        } catch (error) { return failure(error); }
      }, { annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } }),
    ],
  });
}
