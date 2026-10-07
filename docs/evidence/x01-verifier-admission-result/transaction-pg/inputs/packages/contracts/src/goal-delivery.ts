import { z } from 'zod';
import { idSchema, type TaskStatus, type VerificationStatus } from './tasks.js';
import { MAX_PROJECT_NODES } from './projects.js';
import type { GoalArtifactBinding, GoalDefinition, GoalView, GoalExplanation } from './goals.js';

export const GOAL_DELIVERY_MAX_NODES = MAX_PROJECT_NODES;
export const GOAL_DELIVERY_PAGE_SIZE = 50;
const version = z.coerce.number().int().min(1).max(2_147_483_647);
const nodeIds = z.preprocess(value => typeof value === 'string' ? [value] : value,
  z.array(idSchema).min(1).max(GOAL_DELIVERY_PAGE_SIZE).refine(ids => new Set(ids).size === ids.length));
export const goalDeliveryQuerySchema = z.discriminatedUnion('view', [
  z.strictObject({ view: z.literal('plan'), after: z.string().min(1).max(1024).optional(), limit: z.coerce.number().int().min(1).max(GOAL_DELIVERY_PAGE_SIZE).default(20) }),
  z.strictObject({ view: z.literal('state'), nodeIds }),
  z.strictObject({ view: z.literal('input'), nodeId: idSchema, version }),
  z.strictObject({ view: z.literal('goal') }),
  z.strictObject({ view: z.literal('explanations'), after: z.string().min(1).max(1024).optional(), limit: z.coerce.number().int().min(1).max(GOAL_DELIVERY_PAGE_SIZE).default(20) }),
  z.strictObject({ view: z.literal('explanation'), version }),
  z.strictObject({ view: z.literal('decision'), nodeId: idSchema, taskId: idSchema, decisionId: idSchema }),
]);
/** GET query: state serializes nodeIds as repeated nodeIds parameters. */
export type GoalDeliveryQuery =
  | { view: 'plan'; after?: string; limit?: number }
  | { view: 'state'; nodeIds: string[] }
  | { view: 'input'; nodeId: string; version: number }
  | { view: 'goal' }
  | { view: 'explanations'; after?: string; limit?: number }
  | { view: 'explanation'; version: number }
  | { view: 'decision'; nodeId: string; taskId: string; decisionId: string };
export interface GoalInputReference { goalId: string; nodeId: string; version: number }
export interface GoalPlanNode {
  id: string; title: string; version: number; parentId: string | null; dependsOn: string[];
  inputRef: GoalInputReference | null;
}
export interface GoalDeliveryPlan {
  view: 'plan'; goalId: string; projectId: string; projectRevision: number;
  /** Identity of current graph/input metadata only; not a persisted pagination snapshot. */
  planRef: string; goalRef: { goalId: string }; totalNodes: number; nodes: GoalPlanNode[]; nextCursor: string | null;
}
export interface GoalDecisionReference { goalId: string; nodeId: string; taskId: string; decisionId: string }
export interface GoalDeliveryExecution {
  id: string; inputRef: GoalInputReference; inputCurrent: boolean; dependencyCount: number;
  task: { id: string; status: TaskStatus; verificationStatus: VerificationStatus; updatedAt: string; attemptId: string | null; ownerVersion: number };
  pendingDecision: GoalDecisionReference | null;
  /** Exact candidate, not proof of acceptance or semantic correctness. */
  artifact: GoalArtifactBinding | null;
}
export interface GoalDeliveryNodeState {
  nodeId: string; inputRef: GoalInputReference | null; knowledgeCurrent: boolean; dependenciesReady: boolean;
  execution: GoalDeliveryExecution | null; accepted: GoalArtifactBinding | null; deliveryCurrent: boolean;
  reason: 'input-undefined' | 'knowledge-stale' | 'dependencies-unavailable' | 'execution-uncertain' | 'execution-stale' | 'accepted-current' | 'accepted-stale' | 'not-accepted';
}
export interface GoalDeliveryState {
  view: 'state'; goalId: string; projectId: string; observedAt: string;
  /** Fresh bounded projection. No event cursor and no immutable-state promise. */
  nodes: GoalDeliveryNodeState[];
}
export interface GoalDeliveryInput {
  view: 'input'; reference: GoalInputReference; definition: GoalDefinition;
  /** Historical input stays readable even when its node was removed. */
  currentVersion: number | null; stale: boolean;
}
export interface GoalDeliveryGoal { view: 'goal'; goal: GoalView }
export interface GoalDeliveryDecision {
  view: 'decision'; reference: GoalDecisionReference; prompt: string; pending: boolean; answer: 'approve' | 'reject' | null;
}
export interface GoalExplanationReference { goalId: string; version: number }
export interface GoalExplanationItem {
  reference: GoalExplanationReference; kind: GoalExplanation['kind']; createdAt: string; source: GoalExplanation['source'];
}
export interface GoalDeliveryExplanations {
  view: 'explanations'; goalId: string;
  /** Immutable history upper bound, not proof that these facts are currently valid. */
  throughVersion: number; items: GoalExplanationItem[]; nextCursor: string | null;
}
export interface GoalDeliveryExplanation {
  view: 'explanation'; reference: GoalExplanationReference; explanation: GoalExplanation; historical: true;
}
export type GoalDeliveryRead = GoalDeliveryExplanations | GoalDeliveryExplanation | GoalDeliveryPlan | GoalDeliveryState | GoalDeliveryInput | GoalDeliveryGoal | GoalDeliveryDecision;
