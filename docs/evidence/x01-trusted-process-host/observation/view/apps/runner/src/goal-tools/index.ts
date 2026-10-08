import { goalToolCommandSchema, goalToolReadSchema, type GoalCommand, type GoalToolPort } from '../../../../packages/contracts/src/goals.js';

export class GoalToolError extends Error {
  constructor(readonly code: 'invalid_input' | 'scope_denied', message: string) { super(message); }
}
export interface GoalToolOptions {
  goalId: string;
  /** Full input reads and mutations only; read({}) grants the entire fixed goal overview. */
  allowedNodeIds: readonly string[];
  allowedCommands: readonly GoalCommand['kind'][];
  port: GoalToolPort;
}
/** Host-side capability restriction. This does not grant credentials or sandbox an agent. */
export function createGoalTools(options: GoalToolOptions): {
  read(input: unknown): Promise<unknown>;
  command(input: unknown): Promise<unknown>;
} {
  const goalId = options.goalId;
  const nodes = new Set(options.allowedNodeIds);
  const commands = new Set(options.allowedCommands);
  const port = options.port;
  function requireNode(nodeId: string) {
    if (!nodes.has(nodeId)) throw new GoalToolError('scope_denied', 'This node is outside the granted tool scope.');
  }
  return {
    async read(input) {
      const parsed = goalToolReadSchema.safeParse(input);
      if (!parsed.success || parsed.data.version !== undefined && parsed.data.nodeId === undefined) throw new GoalToolError('invalid_input', 'Invalid goal read arguments.');
      if (parsed.data.nodeId !== undefined) {
        requireNode(parsed.data.nodeId);
        return port.readGoalInput(goalId, parsed.data.nodeId, parsed.data.version);
      }
      return port.readGoal(goalId);
    },
    async command(input) {
      const parsed = goalToolCommandSchema.safeParse(input);
      if (!parsed.success) throw new GoalToolError('invalid_input', 'Invalid goal command arguments.');
      requireNode(parsed.data.command.nodeId);
      if (!commands.has(parsed.data.command.kind)) throw new GoalToolError('scope_denied', 'This command is not granted to the tool.');
      return port.commandGoal(goalId, parsed.data.command, parsed.data.idempotencyKey);
    },
  };
}
