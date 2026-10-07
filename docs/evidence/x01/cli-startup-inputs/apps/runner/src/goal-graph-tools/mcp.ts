import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { goalGraphCommandSchema, type GoalGraphCapability } from '../../../../packages/contracts/src/goal-graph-runs.js';
import { GOAL_INPUT_PROPOSAL_PROTOCOL } from '../../../../packages/contracts/src/goal-graph-proposals.js';
import { failure, result } from '../goal-tools-mcp/result.js';
import { GoalToolError } from '../goal-tools/index.js';

const readSchema = z.discriminatedUnion('view', [
  z.strictObject({ view: z.literal('graph'), after: z.string().min(1).max(2_000).optional(), limit: z.number().int().min(1).max(50).default(20) }),
  z.strictObject({ view: z.literal('proposal'), proposalId: idSchema }),
]);
/** Two tools for one host-bound grant. SDK construction does not start a query or authenticate. */
export function createGraphToolsMcp(capability: GoalGraphCapability) {
  return createSdkMcpServer({ name: 'flow-graph', version: '1.0.0', tools: [
    tool('graph_read', 'Read the fixed base graph in bounded pages, or fetch this grant\'s saved proposal text by id. Nodes are id/title/version; currentRevision and stale describe freshness without replacing the base. No history is appended. Whole-base graph is readable; existing-node write references remain scoped.', { request: readSchema }, async ({ request }) => {
      try { return result(request.view === 'graph' ? await capability.port.readGraph({ after: request.after, limit: request.limit }) : await capability.port.readProposal(request.proposalId)); }
      catch (error) { return failure(error); }
    }, { annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false } }),
    tool('graph_command', 'Propose or apply a bounded graph within the fixed grant. Retain the same idempotencyKey for the same intent after an unknown outcome. Apply names the returned proposal id, digest and baseRevision. No child execution or engineering writes are supported. The center validates quota, current authority and versions.', { command: goalGraphCommandSchema, idempotencyKey: z.string().min(1).max(200) }, async ({ command, idempotencyKey }) => {
      try {
        if (command.kind === 'propose' && command.proposal.inputProposal && capability.scope.inputProposalProtocol !== GOAL_INPUT_PROPOSAL_PROTOCOL) {
          throw new GoalToolError('scope_denied', 'The owner did not grant complete input proposals.');
        }
        return result(await capability.port.commandGraph(command, idempotencyKey));
      } catch (error) { return failure(error); }
    }, { annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } }),
  ] });
}
