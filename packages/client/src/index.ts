import { pluginRemovalQuerySchema, pluginRemovalPageSchema, type PluginRemovalQuery, type PluginRemovalPage } from '../../contracts/src/plugin-removal.js';
import { pluginCommandSchema } from '../../contracts/src/plugins.js';
import { pluginHostCandidatesQuerySchema, pluginHostCandidatesPageSchema, type PluginHostCandidatesQuery, type PluginHostCandidatesPage } from '../../contracts/src/plugin-runtime-hosts.js';
import { PLUGIN_RUNTIME_LIMITS, pluginRuntimeCommandSchema, pluginToolTaskRequestSchema, type PluginRuntimeCommand, type PluginRuntimeView, type PluginToolTaskRequest, type PluginToolBinding } from '../../contracts/src/plugin-runtime.js';
import { pluginRequestIdentity, decodePluginRemovalReferences, decodePluginHostCandidates, decodePluginRegistryChanged, decodePluginRuntime, decodePluginRuntimeChanged, decodePluginTaskAccepted, decodePluginBinding, UnknownPluginAcknowledgementError, type PluginRequestIdentity } from './plugin-management.js';
export { UnknownPluginAcknowledgementError } from './plugin-management.js';
import { readBoundedJson } from './response-json.js';
import { PluginRunnerClient } from './plugin-runner.js';
import { ASSISTANT_SELECTION_PROTOCOL, assistantStreamSelectionSchema, assistantStreamDataSchema, type AssistantStreamProtocol, type AssistantStreamSelection, type AssistantStreamSelectedPage, type AssistantStreamSelectedPatchPage } from '../../contracts/src/assistant-stream.js';
import { CONVERSATION_HEADER, NATIVE_CONVERSATION_VERSION, NATIVE_EXECUTION_PROFILE_V2, nativeExecutionProfileCatalogV2PageSchema, type NativeExecutionProfileCatalogV2Page } from '@flow/contracts';
import type { NativeActivityBodyDescriptor, NativeActivityBodySupport } from '@flow/contracts';
import { NativeActivityBodyReader, readNativeActivityBody, readNativeActivityBodySupport, readBoundedNativeBodyJson, type NativeBodyRequest } from './native-activity-body.js';
export { NativeActivityBodyReader, type VerifiedNativeActivityBodyPage } from './native-activity-body.js';
import type { GoalPlanConfirmation, GoalPlanConfirmationResult } from '@flow/contracts';
import { runnerIdentitySchema, runnerClaimRequestSchema, decodeRunnerClaimResponse, type RunnerIdentity, type RunnerClaimRequest, type RunnerClaimResponse } from '@flow/contracts';
import type { PluginInstallRequest, PluginInstallCommand, PluginInstallAccepted, PluginMaterialInstall, PluginInstallList, PluginInstallHistory } from '@flow/contracts';
import type { GoalProgressionAuthorization, GoalProgressionRevocation, GoalProgressionResult, GoalProgressionSnapshot } from '@flow/contracts';
import type { TaskUsageReadout } from '@flow/contracts';
import { BROWSER_SESSION_CSRF_HEADER, browserSessionReadySchema, browserSessionReadSchema, type BrowserSessionReady, type BrowserSessionRead } from '@flow/contracts';
import { nativeEngineeringProfilePageSchema, nativeEngineeringProfilePublishedSchema, type NativeEngineeringProfileConfiguration, type NativeEngineeringProfilePage, type NativeEngineeringProfilePublished } from '@flow/contracts';
import { decodeConversationCreated, decodeConversationTurnAccepted, decodeConversationQueueAccepted, UnknownConversationAcknowledgementError } from './conversation-acknowledgement.js';
import { CLAUDE_TURN_SETTINGS_PROTOCOL, claudeMessageSettingsCatalogPageSchema, type ClaudeMessageSettingsCatalogPage } from '@flow/contracts';
import { EXECUTION_PROFILE_HEADER, NATIVE_EXECUTION_PROFILE_VERSION, nativeExecutionProfileCatalogPageSchema, type NativeExecutionProfileCatalogPage } from '@flow/contracts';
import { engineeringProfilePageSchema, engineeringProfilePublishedSchema, type EngineeringProfileConfiguration, type EngineeringProfilePage, type EngineeringProfilePublished } from '@flow/contracts';
import { contextHistoryResponseSchema, type ContextHistoryResponse } from '@flow/contracts';
export { decodeConversationCreated, decodeConversationTurnAccepted, decodeConversationQueueAccepted, assertConversationCreationMatches, assertConversationContextMatches, UnknownConversationAcknowledgementError } from './conversation-acknowledgement.js';
import type { SteeringAdmission, SteeringCommandInput, SteeringCommandResult, SteeringReceiptInput, SteeringState, SteeringText, SteeringAuditPage, SteeringMailbox, SteeringFinalizationInput, SteeringFinalizationResult, SteeringProposalLookup, SteeringProposalStatus } from '@flow/contracts';
import type { PackageFetchRequest, PackageFetchCommand, PackageFetchAccepted, PackageFetchOperation, PackageFetchList, PackageFetchHistory } from '@flow/contracts';
import type { AssistantStreamPage, AssistantStreamPatchPage, AssistantStreamBlock } from '@flow/contracts';
import type { NativeActivityPage, NativeActivity } from '@flow/contracts';
import type { GoalGraphRunAdmission, GoalGraphRunAccepted, GoalGraphRun, GoalGraphRunPage, GoalGraphRunRevoked, GoalGraphAuditPage, GoalGraphReadCall, GoalGraphReadPage, GoalGraphDetailCall, GoalGraphDetailResult, GoalGraphCommandCall, GoalGraphCommandResult } from '@flow/contracts';
import type { KnowledgeCreation, KnowledgePublication, KnowledgeAccepted, KnowledgeSourceList, KnowledgeVersionSnapshot, KnowledgeCitation, KnowledgeResolved, KnowledgeSearchResult } from '@flow/contracts';
import type { RunnerMaintenanceView, RunnerMaintenanceHistory, RunnerMaintenanceCommand, RunnerMaintenanceResult } from '@flow/contracts';
import type { GoalGraphProposalInput, GoalGraphProposalApply, GoalGraphProposalCreated, GoalGraphProposalPage, GoalGraphProposal, GoalGraphProposalApplied } from '@flow/contracts';
import type { ExecutionProfilePublication, ExecutionProfilePublished, ExecutionProfilePage, NativeExecutionProfileConfiguration, NativeExecutionProfilePublished } from '@flow/contracts';
import type { GoalToolRunAdmission, GoalToolRunAccepted, GoalToolRun, GoalToolRunRevoked, GoalToolAuditPage, GoalToolRunReference, GoalToolInputCall, GoalToolCommandCall, GoalToolSnapshotResult, GoalToolInputResult, GoalToolCommandResult } from '@flow/contracts';
import type { ConversationQueueEnqueue, ConversationQueueCancel, ConversationQueuePause, ConversationQueueResume, ConversationQueueAccepted, ConversationQueueCancelled, ConversationQueuePaused, ConversationQueueResumed, ConversationQueuePage, ConversationQueueItemDetail } from '@flow/contracts';
import type { PluginRegistration, PluginCommand, PluginMutationResult, PluginSnapshot, PluginList, PluginVersions, PluginOperations, PluginOperation } from '@flow/contracts';
import type { ConversationCreation, ConversationCreated, ConversationList, ConversationSnapshot, ConversationTurnAdmission, ConversationTurnAccepted, ConversationTurnPage } from '@flow/contracts';
import type { ConversationContextDetail } from '@flow/contracts';
import type { AttachmentCapabilities, AttachmentUpload, AttachmentAccepted, AttachmentList, AttachmentMetadata, AttachmentContent, AttachmentReceiptLookup } from '@flow/contracts';
import type { AcceptedTask, ClaimResponse, DecisionAnswer, Detail, EventAcknowledgement, EventBatch, EventPage, HeartbeatResponse, Ownership, RegisterRunner, RunnerRegistration, TaskList, TaskSnapshot, TaskSubmission, TaskSummary } from '@flow/contracts';
import type { ReconciliationObservation, ReconciliationResolution, ReconciliationResult, ReconciliationRetry, ReconciliationRetryResult, ReconciliationView } from '@flow/contracts';
import type { ProtocolPrepare, ProtocolCommand, ProtocolBind, ProtocolUncertain, ProtocolState, ProtocolDispatchPermit, ProtocolRecoverResponse } from '@flow/contracts';
import type { TaskIndexPage, TaskIndexQuery, WorkspacePage, WorkspaceQuery } from '@flow/contracts';

import type { GoalCreation, CreatedGoal, GoalSnapshot, GoalCommand, GoalCommandResult, GoalDefinition, GoalExecutionPage, GoalContextDetail, GoalNativeExecution, GoalNativeExecutionResult } from '@flow/contracts';
import type { GoalDeliveryQuery, GoalDeliveryRead } from '@flow/contracts';

import type { WorkspaceList, ProjectCreation, ProjectCommand, ProjectList, ProjectSnapshot, ProjectMutationResult } from '@flow/contracts';

export class FlowApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'FlowApiError';
  }
}

interface ClientConnectionOptions {
  baseUrl: string;
  /** Opt-in to the read protocol only; no promise that a runner/provider emits partial text. */
  conversationProtocol?: typeof NATIVE_CONVERSATION_VERSION;
  assistantStreamProtocol?: AssistantStreamProtocol;
}

/** Cookie authentication is explicit; the browser owns the HttpOnly session cookie. */
export type ClientOptions = ClientConnectionOptions & (
  | { token: string; browserSession?: never }
  | { token?: never; browserSession: { csrfToken: () => string | undefined } }
);

type JsonResponseBudget = Readonly<{ success: number; error: number }>;
// Compact, valid center JSON fits these bounds, including escaping and identity envelopes.
// Excess whitespace and arbitrary proxy errors are subject to the receive policy too.
const SELECTED_RESPONSE_BYTES = Object.freeze({
  metadata: { success: 576 * 1024, error: 4096 },
  patches: { success: 448 * 1024, error: 4096 },
  block: { success: 6 * 1024 * 1024 + 8192, error: 4096 },
});

export class FlowClient {
  /** All plugin requests share this client's existing authentication, cancellation and error handling. */
  readonly pluginRunner = new PluginRunnerClient((path, init, maximumBytes) => this.request(path, init, undefined, maximumBytes));
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly csrfToken: (() => string | undefined) | undefined;
  private readonly conversationProtocol: typeof NATIVE_CONVERSATION_VERSION | undefined;
  private readonly assistantStreamProtocol: AssistantStreamProtocol | undefined;

  constructor(options: ClientOptions) {
    if ((options.token !== undefined) === (options.browserSession !== undefined)) throw new Error('Select exactly one authentication mode.');
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.csrfToken = options.browserSession?.csrfToken;
    this.assistantStreamProtocol = options.assistantStreamProtocol;
    this.conversationProtocol = options.conversationProtocol;
  }

  async browserSession(signal?: AbortSignal): Promise<BrowserSessionRead> {
    return browserSessionReadSchema.parse(await this.request<unknown>('/api/browser-session', { signal }));
  }
  /** One explicit login attempt. A lost acknowledgement is recovered by reading the current session. */
  async connectBrowserSession(ownerToken: string, signal?: AbortSignal): Promise<BrowserSessionReady> {
    if (!this.csrfToken) throw new Error('Connecting a browser session requires cookie authentication mode.');
    return browserSessionReadySchema.parse(await this.request<unknown>('/api/browser-session/connect', { method: 'POST', body: '{}', signal }, ownerToken));
  }
  /** Revokes this browser session only; it does not cancel tasks. */
  async logoutBrowserSession(signal?: AbortSignal): Promise<Extract<BrowserSessionRead, { state: 'unauthenticated' }>> {
    if (!this.csrfToken) throw new Error('Logging out a browser session requires cookie authentication mode.');
    const receipt = browserSessionReadSchema.parse(await this.request<unknown>('/api/browser-session/logout', { method: 'POST', body: '{}', signal }));
    if (receipt.state !== 'unauthenticated') throw new Error('Unconfirmed browser session logout.');
    return receipt;
  }

  async contextHistory(taskId: string, signal?: AbortSignal): Promise<ContextHistoryResponse> {
    const raw = await this.request<unknown>(`/api/tasks/${encodeURIComponent(taskId)}/context/history`, { signal });
    const history = contextHistoryResponseSchema.parse(raw);
    if (history.taskId !== taskId) throw new Error('Context history task identity mismatch');
    return history;
  }

  async assistantStream(taskId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<AssistantStreamPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    const selected = this.assistantStreamProtocol === ASSISTANT_SELECTION_PROTOCOL;
    const limit = options.limit ?? 20, after = options.after;
    if (selected) signal?.throwIfAborted();
    const page = await this.request<AssistantStreamSelectedPage>(`/api/tasks/${encodeURIComponent(taskId)}/assistant-stream${query.size ? `?${query}` : ''}`, { signal, headers: this.streamHeaders() }, undefined, selected ? SELECTED_RESPONSE_BYTES.metadata : undefined);
    if (selected) {
      signal?.throwIfAborted();
      if (page.protocol !== ASSISTANT_SELECTION_PROTOCOL || page.taskId !== taskId || (page.attemptId !== null && (typeof page.attemptId !== 'string' || !page.attemptId)) || !Array.isArray(page.blocks)
        || page.blocks.length > limit || page.blocks.some(block => block.taskId !== taskId || block.attemptId !== page.attemptId || block.id !== block.streamId)
        || page.nextCursor !== null && (page.nextCursor !== page.blocks.at(-1)?.id || page.nextCursor === after)) throw Error('Unconfirmed selected stream metadata.');
    }
    return page;
  }
  /** Every call verifies this page's explicit ACK; no capability is inferred from route existence. */
  async assistantStreamSelectedMetadata(taskId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<AssistantStreamSelectedPage> {
    if (this.assistantStreamProtocol !== ASSISTANT_SELECTION_PROTOCOL) throw Error('Selected stream reads require explicit opt-in.');
    return await this.assistantStream(taskId, options, signal) as AssistantStreamSelectedPage;
  }
  assistantStreamPatches(taskId: string, options: { attemptId: string; after?: number; limit?: number }, signal?: AbortSignal): Promise<AssistantStreamPatchPage> {
    if (this.assistantStreamProtocol === ASSISTANT_SELECTION_PROTOCOL) return this.assistantStreamSelectedPatches(taskId, { ...options, selection: { kind: 'text' } }, signal);
    const query = new URLSearchParams({ attemptId: options.attemptId });
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/assistant-stream/patches?${query}`, { signal, headers: this.streamHeaders() });
  }
  /** Wire validation only. The shared projection owns metadata-first negotiation, source/hash
   * verification, generation cancellation and independent text/disclosure cursors. No retry. */
  async assistantStreamSelectedPatches(taskId: string, options: { attemptId: string; after?: number; limit?: number; selection: AssistantStreamSelection }, signal?: AbortSignal): Promise<AssistantStreamSelectedPatchPage> {
    if (this.assistantStreamProtocol !== ASSISTANT_SELECTION_PROTOCOL) throw Error('Selected stream reads require explicit opt-in.');
    signal?.throwIfAborted();
    const selection = Object.freeze(assistantStreamSelectionSchema.parse(options.selection));
    const attemptId = options.attemptId, after = options.after ?? 0, limit = options.limit ?? 8;
    if (!Number.isSafeInteger(after) || after < 0 || after > 2147483647 || !Number.isSafeInteger(limit) || limit < 1 || limit > 8) throw Error('Invalid selected stream cursor or limit.');
    const query = new URLSearchParams({ attemptId, after: String(after), limit: String(limit), selection: selection.kind });
    if (selection.kind === 'block') query.set('streamId', selection.streamId);
    const page = await this.request<AssistantStreamSelectedPatchPage>(`/api/tasks/${encodeURIComponent(taskId)}/assistant-stream/patches?${query}`, { signal, headers: this.streamHeaders() }, undefined, SELECTED_RESPONSE_BYTES.patches);
    signal?.throwIfAborted();
    const echoed = assistantStreamSelectionSchema.parse(page.selection);
    if (page.protocol !== ASSISTANT_SELECTION_PROTOCOL || page.taskId !== taskId || page.attemptId !== attemptId
      || echoed.kind !== selection.kind || echoed.kind === 'block' && selection.kind === 'block' && echoed.streamId !== selection.streamId
      || !Array.isArray(page.patches) || page.patches.length > limit || typeof page.hasMore !== 'boolean') throw Error('Unconfirmed selected stream acknowledgement.');
    let cursor = after;
    for (const patch of page.patches) {
      const { taskId: patchTask, attemptId: patchAttempt, eventId, sequence, createdAt, ...data } = patch;
      assistantStreamDataSchema.parse(data);
      if (patchTask !== taskId || patchAttempt !== attemptId || typeof eventId !== 'string' || !eventId || typeof createdAt !== 'string'
        || !Number.isSafeInteger(sequence) || sequence <= cursor || sequence > 2147483647
        || (selection.kind === 'block' ? patch.streamId !== selection.streamId : patch.source !== 'claude.sdk.stream' && patch.channel !== 'text')) throw Error('Selected patch identity or cursor mismatch.');
      cursor = sequence;
    }
    if (page.nextCursor !== cursor || page.hasMore && page.patches.length !== limit) throw Error('Selected patch cursor did not match the page.');
    return page;
  }
  async assistantStreamBlock(taskId: string, blockId: string, signal?: AbortSignal): Promise<AssistantStreamBlock> {
    const selected = this.assistantStreamProtocol === ASSISTANT_SELECTION_PROTOCOL;
    if (selected) signal?.throwIfAborted();
    const block = await this.request<AssistantStreamBlock>(`/api/tasks/${encodeURIComponent(taskId)}/assistant-stream/${encodeURIComponent(blockId)}`, { signal, headers: this.streamHeaders() }, undefined, selected ? SELECTED_RESPONSE_BYTES.block : undefined);
    if (selected) signal?.throwIfAborted();
    if (selected && (block.taskId !== taskId || block.id !== blockId || block.streamId !== blockId || typeof block.content !== 'string')) throw Error('Stream block identity mismatch.');
    return block;
  }
  private streamHeaders(): HeadersInit {
    return this.assistantStreamProtocol === 'patch-v2' || this.assistantStreamProtocol === ASSISTANT_SELECTION_PROTOCOL
      ? { 'X-Flow-Assistant-Stream': this.assistantStreamProtocol } : {};
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

  acceptSteering(taskId: string, input: SteeringCommandInput, key: string, signal?: AbortSignal): Promise<SteeringCommandResult> {
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/steering`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  steering(taskId: string, options: { attemptId?: string; after?: number; limit?: number } = {}, signal?: AbortSignal): Promise<SteeringState> {
    const query = new URLSearchParams();
    for (const name of ['attemptId', 'after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/steering${query.size ? `?${query}` : ''}`, { signal });
  }
  steeringAdmission(taskId: string, options: { attemptId?: string } = {}, signal?: AbortSignal): Promise<SteeringAdmission> {
    const query = new URLSearchParams();
    if (options.attemptId !== undefined) query.set('attemptId', options.attemptId);
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/steering/admission${query.size ? `?${query}` : ''}`, { signal });
  }
  steeringText(taskId: string, commandId: string, signal?: AbortSignal): Promise<SteeringText> {
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/steering/${encodeURIComponent(commandId)}/text`, { signal });
  }
  steeringAudit(taskId: string, options: { after?: number; limit?: number } = {}, signal?: AbortSignal): Promise<SteeringAuditPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/steering/audit${query.size ? `?${query}` : ''}`, { signal });
  }
  reportSteeringReceipt(input: SteeringReceiptInput, signal?: AbortSignal): Promise<SteeringCommandResult> {
    return this.request('/api/runner/steering/receipts', { method: 'POST', body: JSON.stringify(input), signal });
  }
  steeringMailbox(input: Ownership, signal?: AbortSignal): Promise<SteeringMailbox> {
    return this.request('/api/runner/steering/mailbox', { method: 'POST', body: JSON.stringify(input), signal });
  }
  finalizeSteering(input: SteeringFinalizationInput, signal?: AbortSignal): Promise<SteeringFinalizationResult> {
    return this.request('/api/runner/steering/finalize', { method: 'POST', body: JSON.stringify(input), signal });
  }
  steeringProposalStatus(input: SteeringProposalLookup, signal?: AbortSignal): Promise<SteeringProposalStatus> {
    return this.request('/api/runner/steering/proposals/status', { method: 'POST', body: JSON.stringify(input), signal });
  }

  taskUsage(taskId: string, signal?: AbortSignal): Promise<TaskUsageReadout> {
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/usage-readout`, { signal });
  }

  nativeActivities(taskId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<NativeActivityPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/native-activities${query.size ? `?${query}` : ''}`, { signal });
  }
  nativeActivity(id: string, signal?: AbortSignal): Promise<NativeActivity> {
    return this.request(`/api/native-activities/${encodeURIComponent(id)}`, { signal });
  }
  nativeActivityBody(taskId: string, activityId: string, signal?: AbortSignal): Promise<NativeActivityBodyDescriptor> {
    return readNativeActivityBody(this.bodyRequest, taskId, activityId, signal);
  }
  nativeActivityBodyPages(descriptor: NativeActivityBodyDescriptor): NativeActivityBodyReader {
    return new NativeActivityBodyReader(this.bodyRequest, descriptor);
  }
  nativeActivityBodySupport(signal?: AbortSignal): Promise<NativeActivityBodySupport> {
    return readNativeActivityBodySupport(this.bodyRequest, signal);
  }
  private readonly bodyRequest: NativeBodyRequest = (path, options) => this.request(path, { signal: options.signal }, undefined, options.maxBytes);

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
  goalDelivery(id: string, input: GoalDeliveryQuery, signal?: AbortSignal): Promise<GoalDeliveryRead> {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(input)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) query.append(name, String(item));
    }
    return this.request(`/api/goals/${encodeURIComponent(id)}/delivery?${query}`, { signal });
  }
  commandGoal(id: string, input: GoalCommand, key: string, signal?: AbortSignal): Promise<GoalCommandResult> {
    return this.request(`/api/goals/${encodeURIComponent(id)}/commands`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  executeGoalNative(id: string, input: GoalNativeExecution, key: string, signal?: AbortSignal): Promise<GoalNativeExecutionResult> {
    return this.request(`/api/goals/${encodeURIComponent(id)}/native-executions`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
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

  authorizeGoalProgression(goalId: string, input: GoalProgressionAuthorization, key: string, signal?: AbortSignal): Promise<GoalProgressionResult> {
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/progressions`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  goalProgression(goalId: string, progressionId: string, signal?: AbortSignal): Promise<GoalProgressionSnapshot> {
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/progressions/${encodeURIComponent(progressionId)}`, { signal });
  }
  revokeGoalProgression(goalId: string, progressionId: string, input: GoalProgressionRevocation, key: string, signal?: AbortSignal): Promise<GoalProgressionResult> {
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/progressions/${encodeURIComponent(progressionId)}/revoke`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  createGoalGraphProposal(goalId: string, input: GoalGraphProposalInput, key: string, signal?: AbortSignal): Promise<GoalGraphProposalCreated> {
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/graph-proposals`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  goalGraphProposals(goalId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<GoalGraphProposalPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/graph-proposals${query.size ? `?${query}` : ''}`, { signal });
  }
  confirmGoalPlan(proposalId: string, input: GoalPlanConfirmation, key: string, signal?: AbortSignal): Promise<GoalPlanConfirmationResult> {
    return this.request(`/api/goal-graph-proposals/${encodeURIComponent(proposalId)}/confirm-inputs`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
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
  goalGraphRuns(goalId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<GoalGraphRunPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/goals/${encodeURIComponent(goalId)}/graph-runs${query.size ? `?${query}` : ''}`, { signal });
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

  executionProfiles(options: { after?: string; limit?: number; profileProtocol?: 'steering-v1' } = {}, signal?: AbortSignal): Promise<ExecutionProfilePage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/execution-profiles${query.size ? `?${query}` : ''}`, { signal,
      ...(options.profileProtocol === 'steering-v1' ? { headers: { 'X-Flow-Execution-Profile': 'steering-v1' } } : {}),
    });
  }
  async nativeExecutionProfiles(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<NativeExecutionProfileCatalogPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return nativeExecutionProfileCatalogPageSchema.parse(await this.request<unknown>(`/api/execution-profiles${query.size ? `?${query}` : ''}`, {
      signal, headers: { [EXECUTION_PROFILE_HEADER]: NATIVE_EXECUTION_PROFILE_VERSION },
    }));
  }
  async nativeConversationProfiles(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<NativeExecutionProfileCatalogV2Page> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return nativeExecutionProfileCatalogV2PageSchema.parse(await this.request<unknown>(`/api/execution-profiles${query.size ? `?${query}` : ''}`, {
      signal, headers: { [EXECUTION_PROFILE_HEADER]: NATIVE_EXECUTION_PROFILE_V2 },
    }));
  }
  publishExecutionProfile(input: ExecutionProfilePublication, signal?: AbortSignal): Promise<ExecutionProfilePublished> {
    return this.request('/api/runner/execution-profile', { method: 'POST', body: JSON.stringify(input), signal });
  }
  async claudeMessageSettingsProfiles(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<ClaudeMessageSettingsCatalogPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return claudeMessageSettingsCatalogPageSchema.parse(await this.request<unknown>(`/api/execution-profiles${query.size ? `?${query}` : ''}`, {
      signal, headers: { [EXECUTION_PROFILE_HEADER]: CLAUDE_TURN_SETTINGS_PROTOCOL },
    }));
  }
  async publishEngineeringProfile(input: { configuration: EngineeringProfileConfiguration }, signal?: AbortSignal): Promise<EngineeringProfilePublished> {
    return engineeringProfilePublishedSchema.parse(await this.request<unknown>('/api/runner/engineering-profile', {
      method: 'POST', body: JSON.stringify(input), signal,
    }));
  }
  async listEngineeringProfiles(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<EngineeringProfilePage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return engineeringProfilePageSchema.parse(await this.request<unknown>(`/api/engineering-profiles${query.size ? `?${query}` : ''}`, { signal }));
  }
  async publishNativeEngineeringProfile(input: { configuration: NativeEngineeringProfileConfiguration }, signal?: AbortSignal): Promise<NativeEngineeringProfilePublished> {
    return nativeEngineeringProfilePublishedSchema.parse(await this.request<unknown>('/api/runner/native-engineering-profile', {
      method: 'POST', body: JSON.stringify(input), signal,
    }));
  }
  async listNativeEngineeringProfiles(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<NativeEngineeringProfilePage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return nativeEngineeringProfilePageSchema.parse(await this.request<unknown>(`/api/native-engineering-profiles${query.size ? `?${query}` : ''}`, { signal }));
  }
  publishNativeExecutionProfile(input: { configuration: NativeExecutionProfileConfiguration }, signal?: AbortSignal): Promise<NativeExecutionProfilePublished> {
    return this.request('/api/runner/execution-profile', { method: 'POST', body: JSON.stringify(input), signal });
  }

  /** Returns acceptance only; read the operation separately for its current material state. */
  installPluginVersion(pluginId: string, versionId: string, input: PluginInstallRequest, key: string, signal?: AbortSignal): Promise<PluginInstallAccepted> {
    return this.request(`/api/plugins/${encodeURIComponent(pluginId)}/versions/${encodeURIComponent(versionId)}/install`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  pluginMaterialInstall(id: string, signal?: AbortSignal): Promise<PluginMaterialInstall> {
    return this.request(`/api/plugin-installs/${encodeURIComponent(id)}`, { signal });
  }
  pluginMaterialInstalls(pluginId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<PluginInstallList> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/plugins/${encodeURIComponent(pluginId)}/material-installs${query.size ? `?${query}` : ''}`, { signal });
  }
  pluginMaterialInstallHistory(id: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<PluginInstallHistory> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/plugin-installs/${encodeURIComponent(id)}/history${query.size ? `?${query}` : ''}`, { signal });
  }
  commandPluginMaterialInstall(id: string, input: PluginInstallCommand, key: string, signal?: AbortSignal): Promise<PluginInstallAccepted> {
    return this.request(`/api/plugin-installs/${encodeURIComponent(id)}/commands`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }

  /** One registration-only observation page; neither an empty page nor history authorizes deletion. */
  pluginRemovalReferences(id: string, input: PluginRemovalQuery, signal?: AbortSignal): Promise<PluginRemovalPage> {
    const registrationId = pluginRemovalPageSchema.shape.registrationId.parse(id);
    const frozen = pluginRemovalQuerySchema.parse(input);
    const query = new URLSearchParams({ materialInstallOperationId: frozen.materialInstallOperationId });
    if (frozen.cursor !== undefined) query.set('cursor', frozen.cursor);
    return this.pluginAcknowledgement(pluginRequestIdentity(`/api/plugins/${encodeURIComponent(registrationId)}/removal-references?${query}`),
      value => decodePluginRemovalReferences(value, registrationId, frozen), signal);
  }
  /** Advisory candidates only; each call reads one page and never authorizes enable. */
  pluginHostCandidates(id: string, input: PluginHostCandidatesQuery, signal?: AbortSignal): Promise<PluginHostCandidatesPage> {
    const registrationId = pluginHostCandidatesPageSchema.shape.registrationId.parse(id);
    const frozen = pluginHostCandidatesQuerySchema.parse(input);
    const query = new URLSearchParams({ materialInstallOperationId: frozen.materialInstallOperationId });
    if (frozen.cursor !== undefined) query.set('cursor', frozen.cursor);
    return this.pluginAcknowledgement(pluginRequestIdentity(`/api/plugins/${encodeURIComponent(registrationId)}/runtime/hosts?${query}`),
      value => decodePluginHostCandidates(value, registrationId, frozen), signal);
  }
  pluginRuntime(id: string, signal?: AbortSignal): Promise<PluginRuntimeView> {
    return this.pluginAcknowledgement(pluginRequestIdentity(`/api/plugins/${encodeURIComponent(id)}/runtime`),
      value => decodePluginRuntime(value, id), signal);
  }
  commandPluginRuntime(id: string, input: PluginRuntimeCommand, key: string, signal?: AbortSignal): Promise<PluginMutationResult & { runtime: PluginRuntimeView }> {
    const frozen = pluginRuntimeCommandSchema.parse(input);
    const request = pluginRequestIdentity(`/api/plugins/${encodeURIComponent(id)}/runtime/commands`, key, frozen);
    return this.pluginAcknowledgement(request, value => decodePluginRuntimeChanged(value, id, frozen), signal);
  }
  admitPluginToolTask(id: string, input: PluginToolTaskRequest, key: string, signal?: AbortSignal): Promise<AcceptedTask & { binding: PluginToolBinding }> {
    const frozen = pluginToolTaskRequestSchema.parse(input);
    const request = pluginRequestIdentity(`/api/plugins/${encodeURIComponent(id)}/tool-tasks`, key, frozen);
    return this.pluginAcknowledgement(request, value => decodePluginTaskAccepted(value, id, frozen), signal);
  }
  pluginToolBinding(taskId: string, signal?: AbortSignal): Promise<PluginToolBinding> {
    return this.pluginAcknowledgement(pluginRequestIdentity(`/api/tasks/${encodeURIComponent(taskId)}/plugin-binding`),
      value => decodePluginBinding(value, taskId), signal);
  }

  private async pluginAcknowledgement<T>(identity: PluginRequestIdentity, decode: (value: unknown) => T | Promise<T>, signal?: AbortSignal): Promise<T> {
    try {
      const value = await this.request<unknown>(identity.path, identity.key === undefined ? { signal } : {
        method: 'POST', signal, headers: { 'content-type': 'application/json', 'idempotency-key': identity.key }, body: identity.body,
      }, undefined, { success: PLUGIN_RUNTIME_LIMITS.responseBytes, error: 4096 });
      return await decode(value);
    } catch (error) {
      // A typed center rejection is distinct from a malformed/proxy response or lost ACK.
      if (error instanceof FlowApiError && error.status >= 400 && error.status < 500
        && typeof error.code === 'string' && error.code !== 'http_error' && error.code.length > 0) throw error;
      throw new UnknownPluginAcknowledgementError(identity);
    }
  }

  registerPlugin(input: PluginRegistration, key: string, signal?: AbortSignal): Promise<PluginMutationResult> {
    return this.request('/api/plugins', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  commandPlugin(id: string, input: PluginCommand, key: string, signal?: AbortSignal): Promise<PluginMutationResult> {
    if (input.change.kind === 'configure' || input.change.kind === 'set-grants') {
      const parsed = pluginCommandSchema.parse(input);
      // Parsing detaches nested values and normalizes the exact body the center also parses.
      if (parsed.change.kind === 'configure' || parsed.change.kind === 'set-grants') {
        const frozen = { ...parsed, change: parsed.change };
        const identity = pluginRequestIdentity(`/api/plugins/${encodeURIComponent(id)}/commands`, key, frozen);
        return this.pluginAcknowledgement(identity, value => decodePluginRegistryChanged(value, id, frozen), signal);
      }
    }
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

  async createConversation(input: ConversationCreation, key: string, signal?: AbortSignal): Promise<ConversationCreated> {
    const body = JSON.stringify(input); const frozen = JSON.parse(body) as ConversationCreation;
    return decodeConversationCreated(await this.conversationAcknowledgement('/api/conversations', body, key, signal), frozen);
  }
  conversations(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<ConversationList> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/conversations${query.size ? `?${query}` : ''}`, { signal });
  }
  conversation(id: string, signal?: AbortSignal): Promise<ConversationSnapshot> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}`, {
      signal, ...(this.assistantStreamProtocol ? { headers: { 'X-Flow-Assistant-Stream': this.assistantStreamProtocol === ASSISTANT_SELECTION_PROTOCOL ? 'patch-v2' : this.assistantStreamProtocol } } : {}),
    });
  }
  conversationTurns(id: string, options: { after?: number; limit?: number } = {}, signal?: AbortSignal): Promise<ConversationTurnPage> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/conversations/${encodeURIComponent(id)}/turns${query.size ? `?${query}` : ''}`, { signal });
  }
  async submitConversationTurn(id: string, input: ConversationTurnAdmission, key: string, signal?: AbortSignal): Promise<ConversationTurnAccepted> {
    const body = JSON.stringify(input); const frozen = JSON.parse(body) as ConversationTurnAdmission;
    return decodeConversationTurnAccepted(await this.conversationAcknowledgement(`/api/conversations/${encodeURIComponent(id)}/turns`, body, key, signal), id, frozen);
  }
  conversationDetail(id: string, turnId: string, detailId: string, signal?: AbortSignal): Promise<Detail> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/turns/${encodeURIComponent(turnId)}/details/${encodeURIComponent(detailId)}`, { signal });
  }
  conversationContext(id: string, contextId: string, signal?: AbortSignal): Promise<ConversationContextDetail> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}/contexts/${encodeURIComponent(contextId)}`, { signal });
  }

  attachmentCapabilities(projectId: string, signal?: AbortSignal): Promise<AttachmentCapabilities> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/attachments/capabilities`, { signal });
  }
  uploadAttachment(projectId: string, input: AttachmentUpload, key: string, signal?: AbortSignal): Promise<AttachmentAccepted> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/attachments`, { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key }, signal });
  }
  attachments(projectId: string, options: { after?: string; limit?: number; q?: string } = {}, signal?: AbortSignal): Promise<AttachmentList> {
    const query = new URLSearchParams();
    for (const name of ['after', 'limit', 'q'] as const) if (options[name] !== undefined) query.set(name, String(options[name]));
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/attachments${query.size ? `?${query}` : ''}`, { signal });
  }
  attachment(projectId: string, resourceId: string, signal?: AbortSignal): Promise<AttachmentMetadata> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(resourceId)}`, { signal });
  }
  attachmentContent(projectId: string, resourceId: string, version: number, digest: string, signal?: AbortSignal): Promise<AttachmentContent> {
    const query = new URLSearchParams({ digest });
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(resourceId)}/versions/${encodeURIComponent(version)}/content?${query}`, { signal });
  }
  /** A missing receipt leaves a previous upload unresolved; no automatic retry or new key. */
  attachmentUploadReceipt(projectId: string, input: { scope: string; key: string }, signal?: AbortSignal): Promise<AttachmentReceiptLookup> {
    const query = new URLSearchParams(input);
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/attachments/upload-receipt?${query}`, { signal });
  }

  async enqueueConversationTurn(id: string, input: ConversationQueueEnqueue, key: string, signal?: AbortSignal): Promise<ConversationQueueAccepted> {
    const body = JSON.stringify(input); const frozen = JSON.parse(body) as ConversationQueueEnqueue;
    const path = `/api/conversations/${encodeURIComponent(id)}/queue`;
    if (frozen.messageSettings === undefined && !this.conversationProtocol) return this.request(path, { method: 'POST', body, headers: { 'Idempotency-Key': key }, signal });
    return decodeConversationQueueAccepted(await this.conversationAcknowledgement(path, body, key, signal), id, frozen, this.conversationProtocol === NATIVE_CONVERSATION_VERSION);
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
  detail(id: string, signal?: AbortSignal): Promise<Detail> { return this.request(`/api/details/${encodeURIComponent(id)}`, { signal }); }
  events(id: string, after = 0): Promise<EventPage> { return this.request(`/api/tasks/${encodeURIComponent(id)}/events?after=${after}`); }

  decide(id: string, answer: DecisionAnswer, key: string, signal?: AbortSignal): Promise<TaskSummary> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify(answer), headers: { 'Idempotency-Key': key }, signal });
  }

  cancel(id: string, key: string, signal?: AbortSignal): Promise<TaskSummary> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}', headers: { 'Idempotency-Key': key }, signal });
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
  async runnerIdentity(signal?: AbortSignal): Promise<RunnerIdentity> {
    return runnerIdentitySchema.parse(await this.request('/api/runner/identity', { method: 'GET', signal }));
  }
  async claimOpportunity(input: RunnerClaimRequest, signal?: AbortSignal): Promise<RunnerClaimResponse> {
    const expected = runnerClaimRequestSchema.parse(input);
    const response = await this.request('/api/runner/claim-opportunity', { method: 'POST', body: JSON.stringify(expected), signal });
    return decodeRunnerClaimResponse(response, expected, 'claim');
  }
  async claimOpportunityStatus(input: RunnerClaimRequest, signal?: AbortSignal): Promise<RunnerClaimResponse> {
    const expected = runnerClaimRequestSchema.parse(input);
    const response = await this.request('/api/runner/claim-opportunity/status', { method: 'POST', body: JSON.stringify(expected), signal });
    return decodeRunnerClaimResponse(response, expected, 'status');
  }
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
    const response = await fetch(`${this.baseUrl}/api/tasks/${encodeURIComponent(id)}/stream?after=${after}`, this.transportInit({ headers: { Accept: 'text/event-stream' }, signal }));
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

  private async conversationAcknowledgement(path: string, body: string, key: string, signal?: AbortSignal): Promise<unknown> {
    try { return await this.request(path, { method: 'POST', body, headers: { 'Idempotency-Key': key }, signal }); }
    catch (error) { if (error instanceof SyntaxError) throw new UnknownConversationAcknowledgementError(); throw error; }
  }

  /** HTTP and SSE share authentication; no fallback, token persistence, or retry policy lives here. */
  private transportInit(init: RequestInit, loginToken?: string): RequestInit {
    const headers = new Headers(init.headers);
    const bearer = loginToken ?? this.token;
    if (bearer !== undefined) headers.set('Authorization', `Bearer ${bearer}`);
    else if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) {
      const csrf = this.csrfToken?.();
      if (!csrf || !/^[a-f0-9]{64}$/.test(csrf)) throw new Error('A current browser session CSRF token is required before writing.');
      headers.set(BROWSER_SESSION_CSRF_HEADER, csrf);
    }
    if (init.body) headers.set('Content-Type', 'application/json');
    return { ...init, headers, credentials: this.csrfToken ? 'include' : 'omit' };
  }

  private async request<T>(path: string, init: RequestInit = {}, loginToken?: string, budget?: number | JsonResponseBudget): Promise<T> {
    if (this.conversationProtocol && (path === '/api/conversations' || path.startsWith('/api/conversations/') || path.startsWith('/api/conversations?'))) {
      const headers = new Headers(init.headers); headers.set(CONVERSATION_HEADER, this.conversationProtocol); init = { ...init, headers };
    }
    const signal = budget === undefined ? init.signal ?? AbortSignal.timeout(15_000)
      : init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000);
    const response = await fetch(`${this.baseUrl}${path}`, this.transportInit({ ...init, signal }, loginToken));
    const boundedJson = budget === undefined ? undefined : typeof budget === 'number'
      ? () => readBoundedNativeBodyJson(response, budget, signal)
      : () => readBoundedJson(response, response.ok ? budget.success : budget.error, signal);
    await assertResponse(response, boundedJson, budget === undefined ? undefined : signal);
    if (boundedJson) return await boundedJson() as T;
    return response.json() as Promise<T>;
  }
}

async function assertResponse(response: Response, read = () => response.json(), signal?: AbortSignal): Promise<void> {
  if (response.ok) return;
  const body = await read().catch(() => ({})) as { error?: { code?: string; message?: string } };
  signal?.throwIfAborted();
  throw new FlowApiError(response.status, body?.error?.code ?? 'http_error', body?.error?.message ?? `The center returned HTTP ${response.status}.`);
}
