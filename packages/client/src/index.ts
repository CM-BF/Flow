import type { PackageFetchRequest, PackageFetchCommand, PackageFetchAccepted, PackageFetchOperation, PackageFetchList, PackageFetchHistory } from '@flow/contracts';
import type { AssistantStreamPage, AssistantStreamPatchPage, AssistantStreamBlock } from '@flow/contracts';
import type { NativeActivityPage, NativeActivity } from '@flow/contracts';
import type { GoalGraphRunAdmission, GoalGraphRunAccepted, GoalGraphRun, GoalGraphRunRevoked, GoalGraphAuditPage, GoalGraphReadCall, GoalGraphReadPage, GoalGraphDetailCall, GoalGraphDetailResult, GoalGraphCommandCall, GoalGraphCommandResult } from '@flow/contracts';
import type { KnowledgeCreation, KnowledgePublication, KnowledgeAccepted, KnowledgeSourceList, KnowledgeVersionSnapshot, KnowledgeCitation, KnowledgeResolved, KnowledgeSearchResult } from '@flow/contracts';
import type { RunnerMaintenanceView, RunnerMaintenanceHistory, RunnerMaintenanceCommand, RunnerMaintenanceResult } from '@flow/contracts';
import type { GoalGraphProposalInput, GoalGraphProposalApply, GoalGraphProposalCreated, GoalGraphProposalPage, GoalGraphProposal, GoalGraphProposalApplied } from '@flow/contracts';
import type { ExecutionProfilePublication, ExecutionProfilePublished, ExecutionProfilePage } from '@flow/contracts';
import type { GoalToolRunAdmission, GoalToolRunAccepted, GoalToolRun, GoalToolRunRevoked, GoalToolAuditPage, GoalToolRunReference, GoalToolInputCall, GoalToolCommandCall, GoalToolSnapshotResult, GoalToolInputResult, GoalToolCommandResult } from '@flow/contracts';
import type { ConversationQueueEnqueue, ConversationQueueCancel, ConversationQueuePause, ConversationQueueResume, ConversationQueueAccepted, ConversationQueueCancelled, ConversationQueuePaused, ConversationQueueResumed, ConversationQueuePage, ConversationQueueItemDetail } from '@flow/contracts';
import type { PluginRegistration, PluginCommand, PluginMutationResult, PluginSnapshot, PluginList, PluginVersions, PluginOperations, PluginOperation } from '@flow/contracts';
import type { ConversationCreation, ConversationCreated, ConversationList, ConversationSnapshot, ConversationTurnAdmission, ConversationTurnAccepted, ConversationTurnPage } from '@flow/contracts';
import type { ConversationContextDetail } from '@flow/contracts';
import type { AcceptedTask, ClaimResponse, DecisionAnswer, Detail, EventAcknowledgement, EventBatch, EventPage, HeartbeatResponse, Ownership, RegisterRunner, RunnerRegistration, TaskList, TaskSnapshot, TaskSubmission, TaskSummary } from '@flow/contracts';
import type { ReconciliationObservation, ReconciliationResolution, ReconciliationResult, ReconciliationRetry, ReconciliationRetryResult, ReconciliationView } from '@flow/contracts';
import type { ProtocolPrepare, ProtocolCommand, ProtocolBind, ProtocolUncertain, ProtocolState, ProtocolDispatchPermit, ProtocolRecoverResponse } from '@flow/contracts';
import type { TaskIndexPage, TaskIndexQuery, WorkspacePage, WorkspaceQuery } from '@flow/contracts';

import type { GoalCreation, CreatedGoal, GoalSnapshot, GoalCommand, GoalCommandResult, GoalDefinition, GoalExecutionPage, GoalContextDetail } from '@flow/contracts';

import type { WorkspaceList, ProjectCreation, ProjectCommand, ProjectList, ProjectSnapshot, ProjectMutationResult } from '@flow/contracts';

export class FlowApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'FlowApiError';
  }
}

export interface ClientOptions {
  baseUrl: string;
  token: string;
  /** Opt-in to the read protocol only; no promise that a runner/provider emits partial text. */
  assistantStreamProtocol?: 'patch-v1';
}

export class FlowClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly assistantStreamProtocol: 'patch-v1' | undefined;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.assistantStreamProtocol = options.assistantStreamProtocol;
  }

  assistantStream(taskId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<AssistantStreamPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/assistant-stream${query.size ? `?${query}` : ''}`, { signal });
  }
  assistantStreamPatches(taskId: string, options: { attemptId: string; after?: number; limit?: number }, signal?: AbortSignal): Promise<AssistantStreamPatchPage> {
    const query = new URLSearchParams({ attemptId: options.attemptId });
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/assistant-stream/patches?${query}`, { signal });
  }
  assistantStreamBlock(taskId: string, blockId: string, signal?: AbortSignal): Promise<AssistantStreamBlock> {
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/assistant-stream/${encodeURIComponent(blockId)}`, { signal });
  }

  fetchPluginPackage(pluginId: string, versionId: string, input: PackageFetchRequest, key: string, signal?: AbortSignal): Promise<PackageFetchAccepted> {
    return this.request(`/api/plugins/${encodeURIComponent(pluginId)}/versions/${encodeURIComponent(versionId)}/fetch`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  packageFetch(id: string, signal?: AbortSignal): Promise<PackageFetchOperation> {
    return this.request(`/api/package-fetches/${encodeURIComponent(id)}`, { signal });
  }
  pluginPackageFetches(pluginId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<PackageFetchList> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/plugins/${encodeURIComponent(pluginId)}/package-fetches${query.size ? `?${query}` : ''}`, { signal });
  }
  packageFetchHistory(id: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<PackageFetchHistory> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/package-fetches/${encodeURIComponent(id)}/history${query.size ? `?${query}` : ''}`, { signal });
  }
  commandPackageFetch(id: string, input: PackageFetchCommand, key: string, signal?: AbortSignal): Promise<PackageFetchAccepted> {
    return this.request(`/api/package-fetches/${encodeURIComponent(id)}/commands`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  nativeActivities(taskId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<NativeActivityPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/native-activities${query.size ? `?${query}` : ''}`, { signal });
  }
  nativeActivity(id: string, signal?: AbortSignal): Promise<NativeActivity> {
    return this.request(`/api/native-activities/${encodeURIComponent(id)}`, { signal });
  }

  runnerMaintenance(runnerId: string, signal?: AbortSignal): Promise<RunnerMaintenanceView> {
    return this.request(`/api/runners/${encodeURIComponent(runnerId)}/maintenance`, { signal });
  }
  runnerMaintenanceHistory(runnerId: string, options: { after?: string } = {}, signal?: AbortSignal): Promise<RunnerMaintenanceHistory> {
    const query = new URLSearchParams();
    if (options.after) query.set('after', options.after);
    return this.request(`/api/runners/${encodeURIComponent(runnerId)}/maintenance/history${query.size ? `?${query}` : ''}`, { signal });
  }
  drainRunner(runnerId: string, input: RunnerMaintenanceCommand, key: string, signal?: AbortSignal): Promise<RunnerMaintenanceResult> {
    return this.request(`/api/runners/${encodeURIComponent(runnerId)}/maintenance/drain`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  resumeRunner(runnerId: string, input: RunnerMaintenanceCommand, key: string, signal?: AbortSignal): Promise<RunnerMaintenanceResult> {
    return this.request(`/api/runners/${encodeURIComponent(runnerId)}/maintenance/resume`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  createKnowledgeSource(projectId: string, input: KnowledgeCreation, key: string, signal?: AbortSignal): Promise<KnowledgeAccepted> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/knowledge/sources`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  knowledgeSources(projectId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<KnowledgeSourceList> {
    const query = new URLSearchParams();
    if (options.after) query.set('after', options.after);
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/knowledge/sources${query.size ? `?${query}` : ''}`, { signal });
  }
  knowledgeSource(projectId: string, sourceId: string, signal?: AbortSignal): Promise<KnowledgeVersionSnapshot> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/knowledge/sources/${encodeURIComponent(sourceId)}`, { signal });
  }
  publishKnowledgeVersion(projectId: string, sourceId: string, input: KnowledgePublication, key: string, signal?: AbortSignal): Promise<KnowledgeAccepted> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/knowledge/sources/${encodeURIComponent(sourceId)}/versions`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  knowledgeVersion(projectId: string, sourceId: string, version: number, signal?: AbortSignal): Promise<KnowledgeVersionSnapshot> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/knowledge/sources/${encodeURIComponent(sourceId)}/versions/${version}`, { signal });
  }
  searchKnowledge(projectId: string, input: { q: string; limit?: number }, signal?: AbortSignal): Promise<KnowledgeSearchResult> {
    const query = new URLSearchParams({ q: input.q });
    if (input.limit !== undefined) query.set('limit', String(input.limit));
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/knowledge/search?${query}`, { signal });
  }
  resolveKnowledge(projectId: string, citation: KnowledgeCitation, signal?: AbortSignal): Promise<KnowledgeResolved> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/knowledge/resolve`, { method: 'POST', body: JSON.stringify({ citation }), signal });
  }

  submit(input: TaskSubmission, key: string): Promise<AcceptedTask> {
    return this.request('/api/tasks', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key } });
  }

  list(options: { limit?: number; before?: string } = {}): Promise<TaskList> {
    const query = new URLSearchParams({ limit: String(options.limit ?? 40) });
    if (options.before) query.set('before', options.before);
    return this.request(`/api/tasks?${query}`);
  }

  workspace(options: WorkspaceQuery = {}, signal?: AbortSignal): Promise<WorkspacePage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'before', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/workspace${query.size ? `?${query}` : ''}`, { signal });
  }

  workspaces(signal?: AbortSignal): Promise<WorkspaceList> { return this.request('/api/workspaces', { signal }); }
  projects(options: { workspaceId?: string; after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<ProjectList> {
    const query = new URLSearchParams();
    for (const name of ['workspaceId', 'after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/projects${query.size ? `?${query}` : ''}`, { signal });
  }
  createProject(input: ProjectCreation, key: string, signal?: AbortSignal): Promise<ProjectMutationResult> {
    return this.request('/api/projects', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  project(id: string, revision?: number, signal?: AbortSignal): Promise<ProjectSnapshot> {
    return this.request(`/api/projects/${encodeURIComponent(id)}${revision === undefined ? '' : `?revision=${revision}`}`, { signal });
  }
  changeProject(id: string, input: ProjectCommand, key: string, signal?: AbortSignal): Promise<ProjectMutationResult> {
    return this.request(`/api/projects/${encodeURIComponent(id)}/commands`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  createGoal(input: GoalCreation, key: string, signal?: AbortSignal): Promise<CreatedGoal> {
    return this.request('/api/goals', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  readGoal(id: string, signal?: AbortSignal): Promise<GoalSnapshot> {
    return this.request(`/api/goals/${encodeURIComponent(id)}`, { signal });
  }
  commandGoal(id: string, input: GoalCommand, key: string, signal?: AbortSignal): Promise<GoalCommandResult> {
    return this.request(`/api/goals/${encodeURIComponent(id)}/commands`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  readGoalInput(id: string, nodeId: string, version?: number, signal?: AbortSignal): Promise<GoalDefinition> {
    return this.request(`/api/goals/${encodeURIComponent(id)}/inputs/${encodeURIComponent(nodeId)}${version === undefined ? '' : `?version=${version}`}`, { signal });
  }
  goalContext(id: string, nodeId: string, version: number, signal?: AbortSignal): Promise<GoalContextDetail> {
    return this.request(`/api/goals/${encodeURIComponent(id)}/nodes/${encodeURIComponent(nodeId)}/inputs/${version}/context`, { signal });
  }
  goalExecutions(id: string, options: { nodeId: string; after?: string; limit?: number }, signal?: AbortSignal): Promise<GoalExecutionPage> {
    const query = new URLSearchParams({ nodeId: options.nodeId });
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/goals/${encodeURIComponent(id)}/executions?${query}`, { signal });
  }

  createGoalGraphProposal(goalId: string, input: GoalGraphProposalInput, key: string, signal?: AbortSignal): Promise<GoalGraphProposalCreated> {
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/graph-proposals`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  goalGraphProposals(goalId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<GoalGraphProposalPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/graph-proposals${query.size ? `?${query}` : ''}`, { signal });
  }
  goalGraphProposal(id: string, signal?: AbortSignal): Promise<GoalGraphProposal> {
    return this.request(`/api/goal-graph-proposals/${encodeURIComponent(id)}`, { signal });
  }
  applyGoalGraphProposal(id: string, input: GoalGraphProposalApply, key: string, signal?: AbortSignal): Promise<GoalGraphProposalApplied> {
    return this.request(`/api/goal-graph-proposals/${encodeURIComponent(id)}/apply`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  admitGoalGraphRun(goalId: string, input: GoalGraphRunAdmission, key: string, signal?: AbortSignal): Promise<GoalGraphRunAccepted> {
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/graph-runs`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  goalGraphRun(id: string, signal?: AbortSignal): Promise<GoalGraphRun> {
    return this.request(`/api/goal-graph-runs/${encodeURIComponent(id)}`, { signal });
  }
  revokeGoalGraphRun(id: string, input: { reason: string }, key: string, signal?: AbortSignal): Promise<GoalGraphRunRevoked> {
    return this.request(`/api/goal-graph-runs/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  goalGraphRunCalls(id: string, options: { after?: number; limit?: number } = {}, signal?: AbortSignal): Promise<GoalGraphAuditPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/goal-graph-runs/${encodeURIComponent(id)}/calls${query.size ? `?${query}` : ''}`, { signal });
  }
  goalGraphGrant(input: Ownership, signal?: AbortSignal): Promise<GoalGraphRun> {
    return this.request('/api/runner/goal-graph/grant', { method: 'POST', body: JSON.stringify(input), signal });
  }
  goalGraphRead(input: GoalGraphReadCall, signal?: AbortSignal): Promise<GoalGraphReadPage> {
    return this.request('/api/runner/goal-graph/read', { method: 'POST', body: JSON.stringify(input), signal });
  }
  goalGraphDetail(input: GoalGraphDetailCall, signal?: AbortSignal): Promise<GoalGraphDetailResult> {
    return this.request('/api/runner/goal-graph/proposal', { method: 'POST', body: JSON.stringify(input), signal });
  }
  goalGraphCommand(input: GoalGraphCommandCall, key: string, signal?: AbortSignal): Promise<GoalGraphCommandResult> {
    return this.request('/api/runner/goal-graph/command', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  admitGoalToolRun(goalId: string, input: GoalToolRunAdmission, key: string, signal?: AbortSignal): Promise<GoalToolRunAccepted> {
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/tool-runs`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  goalToolRun(id: string, signal?: AbortSignal): Promise<GoalToolRun> {
    return this.request(`/api/goal-tool-runs/${encodeURIComponent(id)}`, { signal });
  }
  revokeGoalToolRun(id: string, input: { reason: string }, key: string, signal?: AbortSignal): Promise<GoalToolRunRevoked> {
    return this.request(`/api/goal-tool-runs/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  goalToolRunCalls(id: string, options: { after?: number; limit?: number } = {}, signal?: AbortSignal): Promise<GoalToolAuditPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/goal-tool-runs/${encodeURIComponent(id)}/calls${query.size ? `?${query}` : ''}`, { signal });
  }
  goalToolGrant(input: Ownership, signal?: AbortSignal): Promise<GoalToolRun> {
    return this.request('/api/runner/goal-tools/grant', { method: 'POST', body: JSON.stringify(input), signal });
  }
  goalToolSnapshot(input: Ownership & { grant: GoalToolRunReference }, signal?: AbortSignal): Promise<GoalToolSnapshotResult> {
    return this.request('/api/runner/goal-tools/snapshot', { method: 'POST', body: JSON.stringify(input), signal });
  }
  goalToolInput(input: GoalToolInputCall, signal?: AbortSignal): Promise<GoalToolInputResult> {
    return this.request('/api/runner/goal-tools/input', { method: 'POST', body: JSON.stringify(input), signal });
  }
  goalToolCommand(input: GoalToolCommandCall, key: string, signal?: AbortSignal): Promise<GoalToolCommandResult> {
    return this.request('/api/runner/goal-tools/command', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  executionProfiles(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<ExecutionProfilePage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/execution-profiles${query.size ? `?${query}` : ''}`, { signal });
  }
  publishExecutionProfile(input: ExecutionProfilePublication, signal?: AbortSignal): Promise<ExecutionProfilePublished> {
    return this.request('/api/runner/execution-profile', { method: 'POST', body: JSON.stringify(input), signal });
  }

  registerPlugin(input: PluginRegistration, key: string, signal?: AbortSignal): Promise<PluginMutationResult> {
    return this.request('/api/plugins', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  commandPlugin(id: string, input: PluginCommand, key: string, signal?: AbortSignal): Promise<PluginMutationResult> {
    return this.request(`/api/plugins/${encodeURIComponent(id)}/commands`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  plugins(options: { projectId?: string; after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<PluginList> {
    const query = new URLSearchParams();
    for (const name of ['projectId', 'after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/plugins${query.size ? `?${query}` : ''}`, { signal });
  }
  plugin(id: string, revision?: number, signal?: AbortSignal): Promise<PluginSnapshot> {
    return this.request(`/api/plugins/${encodeURIComponent(id)}${revision === undefined ? '' : `?revision=${revision}`}`, { signal });
  }
  pluginVersions(id: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<PluginVersions> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/plugins/${encodeURIComponent(id)}/versions${query.size ? `?${query}` : ''}`, { signal });
  }
  pluginOperations(id: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<PluginOperations> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/plugins/${encodeURIComponent(id)}/operations${query.size ? `?${query}` : ''}`, { signal });
  }
  pluginOperation(id: string, operationId: string, signal?: AbortSignal): Promise<PluginOperation> {
    return this.request(`/api/plugins/${encodeURIComponent(id)}/operations/${encodeURIComponent(operationId)}`, { signal });
  }

  createConversation(input: ConversationCreation, key: string, signal?: AbortSignal): Promise<ConversationCreated> {
    return this.request('/api/conversations', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  conversations(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<ConversationList> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/conversations${query.size ? `?${query}` : ''}`, { signal });
  }
  conversation(id: string, signal?: AbortSignal): Promise<ConversationSnapshot> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}`, {
      signal, ...(this.assistantStreamProtocol === 'patch-v1' ? { headers: { 'X-Flow-Assistant-Stream': 'patch-v1' } } : {}),
    });
  }
  conversationTurns(id: string, options: { after?: number; limit?: number } = {}, signal?: AbortSignal): Promise<ConversationTurnPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/conversations/${encodeURIComponent(id)}/turns${query.size ? `?${query}` : ''}`, { signal });
  }
  submitConversationTurn(id: string, input: ConversationTurnAdmission, key: string, signal?: AbortSignal): Promise<ConversationTurnAccepted> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/turns`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  conversationDetail(id: string, turnId: string, detailId: string, signal?: AbortSignal): Promise<Detail> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/turns/${encodeURIComponent(turnId)}/details/${encodeURIComponent(detailId)}`, { signal });
  }
  conversationContext(id: string, contextId: string, signal?: AbortSignal): Promise<ConversationContextDetail> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/contexts/${encodeURIComponent(contextId)}`, { signal });
  }

  enqueueConversationTurn(id: string, input: ConversationQueueEnqueue, key: string, signal?: AbortSignal): Promise<ConversationQueueAccepted> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/queue`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  conversationQueue(id: string, options: { after?: number; limit?: number } = {}, signal?: AbortSignal): Promise<ConversationQueuePage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/conversations/${encodeURIComponent(id)}/queue${query.size ? `?${query}` : ''}`, { signal });
  }
  conversationQueueItem(id: string, itemId: string, signal?: AbortSignal): Promise<ConversationQueueItemDetail> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/queue/${encodeURIComponent(itemId)}`, { signal });
  }
  cancelConversationQueueItem(id: string, itemId: string, input: ConversationQueueCancel, key: string, signal?: AbortSignal): Promise<ConversationQueueCancelled> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/queue/${encodeURIComponent(itemId)}/cancel`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  pauseConversationQueue(id: string, input: ConversationQueuePause, key: string, signal?: AbortSignal): Promise<ConversationQueuePaused> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/queue/pause`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  resumeConversationQueue(id: string, input: ConversationQueueResume, key: string, signal?: AbortSignal): Promise<ConversationQueueResumed> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/queue/resume`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  queryTasks(options: TaskIndexQuery = {}, signal?: AbortSignal): Promise<TaskIndexPage> {
    const query = new URLSearchParams();
    for (const name of ['limit', 'cursor', 'contextId', 'updatedAfter'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    if (options.statuses) query.set('statuses', options.statuses.join(','));
    return this.request(`/api/task-index${query.size ? `?${query}` : ''}`, { signal });
  }

  show(id: string, signal?: AbortSignal): Promise<TaskSnapshot> { return this.request(`/api/tasks/${encodeURIComponent(id)}`, { signal }); }
  detail(id: string): Promise<Detail> { return this.request(`/api/details/${encodeURIComponent(id)}`); }
  events(id: string, after = 0): Promise<EventPage> { return this.request(`/api/tasks/${encodeURIComponent(id)}/events?after=${after}`); }

  decide(id: string, answer: DecisionAnswer, key: string): Promise<TaskSummary> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify(answer), headers: { 'Idempotency-Key': key } });
  }

  cancel(id: string, key: string): Promise<TaskSummary> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}', headers: { 'Idempotency-Key': key } });
  }

  reconciliation(id: string, after = 0): Promise<ReconciliationView> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/reconciliation?after=${after}`);
  }

  recordReconciliation(id: string, input: ReconciliationObservation, key: string): Promise<ReconciliationResult> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/reconciliation/observations`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key } });
  }

  resolveReconciliation(id: string, input: ReconciliationResolution, key: string): Promise<ReconciliationResult> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/reconciliation/resolve`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key } });
  }

  retryReconciledTask(id: string, input: ReconciliationRetry, key: string): Promise<ReconciliationRetryResult> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/reconciliation/retry`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key } });
  }

  registerRunner(input: RegisterRunner): Promise<RunnerRegistration> {
    return this.request('/api/runners', { method: 'POST', body: JSON.stringify(input) });
  }

  revokeRunner(id: string): Promise<{ revoked: boolean }> {
    return this.request(`/api/runners/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' });
  }

  claim(signal?: AbortSignal): Promise<ClaimResponse> { return this.request('/api/runner/claim', { method: 'POST', body: '{}', signal }); }
  heartbeat(ownership: Ownership, signal?: AbortSignal): Promise<HeartbeatResponse> { return this.request('/api/runner/heartbeat', { method: 'POST', body: JSON.stringify(ownership), signal }); }
  report(batch: EventBatch, signal?: AbortSignal): Promise<EventAcknowledgement> { return this.request('/api/runner/events', { method: 'POST', body: JSON.stringify(batch), signal }); }

  protocolPrepare(input: ProtocolPrepare, signal?: AbortSignal): Promise<ProtocolState> {
    return this.request('/api/runner/protocol/prepare', { method: 'POST', body: JSON.stringify(input), signal });
  }
  protocolBegin(input: ProtocolCommand, signal?: AbortSignal): Promise<ProtocolDispatchPermit> {
    return this.request('/api/runner/protocol/begin', { method: 'POST', body: JSON.stringify(input), signal });
  }
  protocolBind(input: ProtocolBind, signal?: AbortSignal): Promise<ProtocolState> {
    return this.request('/api/runner/protocol/bind', { method: 'POST', body: JSON.stringify(input), signal });
  }
  protocolUncertain(input: ProtocolUncertain, signal?: AbortSignal): Promise<ProtocolState> {
    return this.request('/api/runner/protocol/uncertain', { method: 'POST', body: JSON.stringify(input), signal });
  }
  protocolStartCancel(input: ProtocolCommand, signal?: AbortSignal): Promise<ProtocolDispatchPermit> {
    return this.request('/api/runner/protocol/cancel-start', { method: 'POST', body: JSON.stringify(input), signal });
  }
  protocolRecover(signal?: AbortSignal): Promise<ProtocolRecoverResponse> { return this.request('/api/runner/protocol/recover', { method: 'POST', body: '{}', signal }); }
  protocolState(taskId: string, signal?: AbortSignal): Promise<ProtocolState | null> { return this.request(`/api/tasks/${encodeURIComponent(taskId)}/protocol`, { signal }); }

  async *watch(id: string, after = 0, signal?: AbortSignal): AsyncGenerator<EventPage> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${encodeURIComponent(id)}/stream?after=${after}`, { headers: { Authorization: `Bearer ${this.token}`, Accept: 'text/event-stream' }, signal });
    await assertResponse(response);
    if (!response.body) throw new Error('The center returned an empty event stream.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) return;
        pending = (pending + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n');
        if (pending.length > 2_000_000) throw new Error('Event stream exceeded the page limit.');
        const frames = pending.split('\n\n');
        pending = frames.pop() ?? '';
        for (const frame of frames) {
          const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (data) yield JSON.parse(data) as EventPage;
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.token}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(15_000) });
    await assertResponse(response);
    return response.json() as Promise<T>;
  }
}

async function assertResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
  throw new FlowApiError(response.status, body.error?.code ?? 'http_error', body.error?.message ?? `The center returned HTTP ${response.status}.`);
}
