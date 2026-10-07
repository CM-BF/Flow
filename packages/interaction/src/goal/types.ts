import type { FlowClient } from '@flow/client';
import type { GoalCommand, GoalCommandResult, GoalArtifactBinding } from '../../../contracts/src/goals.js';
import type { ProjectCommand, ProjectMutationResult } from '../../../contracts/src/projects.js';
import type { DecisionAnswer, Detail, TaskSummary } from '../../../contracts/src/tasks.js';
import type { GoalDeliveryPlan, GoalDeliveryState, GoalDeliveryExplanations, GoalDeliveryRead } from '../../../contracts/src/goal-delivery.js';
import type { GoalGraphRunAdmission, GoalGraphRunAccepted, GoalGraphRunPage } from '../../../contracts/src/goal-graph-runs.js';
import type { GoalNativeExecution, GoalNativeExecutionResult } from '../../../contracts/src/goal-native-executions.js';
import type { ExecutionProfileReference } from '../../../contracts/src/execution-profiles.js';

export type GoalPlanningInput = Omit<GoalGraphRunAdmission, 'execution'> & { execution: { harness: 'claude'; executionProfile: ExecutionProfileReference } };

export type GoalSessionCommand =
  | { kind: 'goal'; input: GoalCommand }
  | { kind: 'project'; input: ProjectCommand }
  | { kind: 'graph-plan'; input: GoalPlanningInput }
  | { kind: 'native-execute'; input: GoalNativeExecution }
  | { kind: 'decision'; nodeId: string; taskId: string; input: DecisionAnswer }
  | { kind: 'cancel'; nodeId: string; taskId: string };
export type GoalBodyReference =
  | { kind: 'goal' }
  | { kind: 'input'; nodeId: string; version: number }
  | { kind: 'explanation'; version: number }
  | { kind: 'decision'; nodeId: string; taskId: string; decisionId: string }
  | { kind: 'artifact'; binding: GoalArtifactBinding };
export interface GoalIntent {
  version: 1; connectionId: string; goalId: string; projectId: string; key: string; command: GoalSessionCommand;
}
/** Host-owned durable atomic store. One controller owns a namespace at a time. No credentials. */
export interface GoalIntentStore {
  load(namespace: string): Promise<unknown | null>;
  save(namespace: string, value: GoalIntent | null): Promise<void>;
}
export type GoalSessionPort = Pick<FlowClient, 'goalDelivery' | 'commandGoal' | 'changeProject' | 'decide' | 'cancel' | 'detail'>
  & Partial<Pick<FlowClient, 'admitGoalGraphRun' | 'executeGoalNative' | 'goalGraphRuns'>>;
export interface GoalSessionOptions {
  client: GoalSessionPort; goalId: string; connectionId: string; intents: GoalIntentStore; makeKey?: () => string;
}
export type GoalCommandReceipt = GoalCommandResult | ProjectMutationResult | TaskSummary | GoalGraphRunAccepted | GoalNativeExecutionResult;
export type GoalCommandOutcome =
  | { state: 'acknowledged'; key: string; receipt: GoalCommandReceipt }
  | { state: 'rejected'; key: string; code: string }
  | { state: 'unknown'; key: string };
export interface GoalSessionSnapshot {
  connected: boolean; initialized: boolean;
  plan: GoalDeliveryPlan | null; state: GoalDeliveryState | null; history: GoalDeliveryExplanations | null;
  body: GoalDeliveryRead | Detail | null;
  intent: GoalIntent | null; commandState: 'idle' | 'sending' | 'unknown';
  lastOutcome: { state: GoalCommandOutcome['state']; key: string; code?: string } | null;
  planning?: GoalGraphRunPage;
}
