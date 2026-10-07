import { z } from 'zod';
import { goalCommandSchema } from '../../../contracts/src/goals.js';
import { projectCommandSchema } from '../../../contracts/src/projects.js';
import { harnessSchema } from '../../../contracts/src/harnesses.js';
import { decisionSchema, idSchema } from '../../../contracts/src/tasks.js';
import { goalGraphRunAdmissionSchema, goalGraphScopeSchema } from '../../../contracts/src/goal-graph-runs.js';
import { executionProfileReferenceSchema } from '../../../contracts/src/execution-profiles.js';
import { goalNativeExecutionSchema } from '../../../contracts/src/goal-native-executions.js';
import type { GoalIntent, GoalSessionCommand, GoalSessionPort, GoalCommandReceipt } from './types.js';

export const sessionCommandSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('goal'), input: goalCommandSchema }),
  z.strictObject({ kind: z.literal('project'), input: projectCommandSchema }),
  z.strictObject({ kind: z.literal('graph-plan'), input: goalGraphRunAdmissionSchema.extend({ execution: z.strictObject({ harness: z.literal('claude'), executionProfile: executionProfileReferenceSchema }) }) }),
  z.strictObject({ kind: z.literal('native-execute'), input: goalNativeExecutionSchema }),
  z.strictObject({ kind: z.literal('decision'), nodeId: idSchema, taskId: idSchema, input: decisionSchema }),
  z.strictObject({ kind: z.literal('cancel'), nodeId: idSchema, taskId: idSchema }),
]);
const intentSchema = z.strictObject({ version: z.literal(1), connectionId: z.string().min(1).max(256), goalId: idSchema, projectId: idSchema, key: z.string().min(1).max(200), command: sessionCommandSchema });
export function parseIntent(value: unknown): GoalIntent {
  const parsed = intentSchema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > 65_536) throw Error('Goal command exceeds the 64 KiB local intent bound.');
  return parsed;
}
export function dispatch(client: GoalSessionPort, intent: GoalIntent, signal: AbortSignal): Promise<GoalCommandReceipt> {
  const c = intent.command;
  switch (c.kind) {
    case 'goal': return client.commandGoal(intent.goalId, c.input, intent.key, signal);
    case 'project': return client.changeProject(intent.projectId, c.input, intent.key, signal);
    case 'graph-plan':
      if (!client.admitGoalGraphRun) throw Error('Goal planning is not available on this client.');
      return client.admitGoalGraphRun(intent.goalId, c.input, intent.key, signal);
    case 'native-execute':
      if (!client.executeGoalNative) throw Error('Native goal execution is not available on this client.');
      return client.executeGoalNative(intent.goalId, c.input, intent.key, signal);
    case 'decision': return client.decide(c.taskId, c.input, intent.key, signal);
    case 'cancel': return client.cancel(c.taskId, intent.key, signal);
  }
}
const id = z.string().min(1).max(128);
const taskReceipt = z.object({ id, title: z.string(), harness: harnessSchema, status: z.enum(['queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'uncertain']), verificationStatus: z.enum(['pending', 'passed', 'failed']), createdAt: z.string(), updatedAt: z.string() });
const goalReceipt = z.object({ goalId: id, nodeId: id, changed: z.boolean(), replayed: z.boolean(), inputVersion: z.number().int().positive().optional(), executionId: id.optional(), task: taskReceipt.optional(), delivery: z.object({ nodeId: id, executionId: id }).passthrough().optional(), explanation: z.object({ version: z.number().int().positive(), kind: z.string(), text: z.string(), createdAt: z.string(), source: z.object({ nodeId: id.optional(), inputVersion: z.number().int().positive().optional(), executionId: id.optional() }) }) });
/** Receipt validation is deliberately separate from server validity/authorization: it checks transport identity only. */
export function checkReceipt(intent: GoalIntent, value: unknown): void {
  const c = intent.command;
  if (c.kind === 'graph-plan') {
    const r = z.object({ run: z.object({ id, version: z.literal(1), goalId: id, projectId: id, taskId: id, mode: z.literal('claude'), goalDigest: z.string().regex(/^[a-f0-9]{64}$/), scope: goalGraphScopeSchema }), task: taskReceipt, replayed: z.boolean() }).parse(value);
    if (r.run.goalId !== intent.goalId || r.run.projectId !== intent.projectId || r.run.taskId !== r.task.id || r.task.harness !== 'claude' || JSON.stringify(r.run.scope) !== JSON.stringify(c.input.scope)) throw Error('Planning receipt identity mismatch.');
  } else if (c.kind === 'native-execute') {
    const r = goalReceipt.extend({ executionProfile: executionProfileReferenceSchema }).parse(value), input = c.input;
    if (r.goalId !== intent.goalId || r.nodeId !== input.nodeId || !r.executionId || r.task?.harness !== 'claude' || r.inputVersion !== input.expectedInputVersion || r.explanation.kind !== 'execute' || r.explanation.source.nodeId !== input.nodeId || r.explanation.source.executionId !== r.executionId || r.explanation.source.inputVersion !== input.expectedInputVersion || JSON.stringify(r.executionProfile) !== JSON.stringify(input.executionProfile)) throw Error('Native execution receipt identity mismatch.');
  } else if (c.kind === 'goal') {
    const r = goalReceipt.parse(value), input = c.input;
    if (r.goalId !== intent.goalId || r.nodeId !== input.nodeId || r.explanation.kind !== input.kind || r.explanation.source.nodeId !== input.nodeId) throw Error('Goal receipt identity mismatch.');
    if (input.kind === 'define-input' && (r.inputVersion !== input.expectedInputVersion + (r.changed ? 1 : 0) || r.explanation.source.inputVersion !== r.inputVersion)) throw Error('Input receipt version mismatch.');
    if (input.kind === 'execute' && (!r.executionId || !r.task || r.task.harness !== 'fixture' || r.explanation.source.executionId !== r.executionId || r.explanation.source.inputVersion !== input.expectedInputVersion)) throw Error('Execution receipt identity mismatch.');
    if (input.kind === 'accept-delivery' && (r.delivery?.executionId !== input.executionId || r.delivery?.nodeId !== input.nodeId || r.explanation.source.executionId !== input.executionId)) throw Error('Delivery receipt identity mismatch.');
  } else if (c.kind === 'project') {
    const r = z.object({ snapshot: z.object({ project: z.object({ id, revision: z.number().int().positive() }), graph: z.object({ revision: z.number().int().positive(), nodes: z.array(z.object({ id })).max(200) }) }), changedNodeId: id.nullable(), replayed: z.boolean() }).parse(value);
    if (r.snapshot.project.id !== intent.projectId || r.snapshot.graph.revision !== r.snapshot.project.revision || r.snapshot.project.revision !== c.input.expectedRevision + 1) throw Error('Project receipt identity mismatch.');
    const change = c.input.change;
    if (!r.changedNodeId || (change.kind !== 'add-node' && r.changedNodeId !== change.nodeId)) throw Error('Project mutation identity mismatch.');
    const present = r.snapshot.graph.nodes.some(node => node.id === r.changedNodeId);
    if (present !== (change.kind !== 'remove-node')) throw Error('Project mutation result mismatch.');
  } else if (taskReceipt.parse(value).id !== c.taskId) throw Error('Task receipt identity mismatch.');
}
export function parseCommand(command: GoalSessionCommand) { return sessionCommandSchema.parse(command); }
