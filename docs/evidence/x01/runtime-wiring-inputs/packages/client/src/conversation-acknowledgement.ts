import { conversationHarness } from '../../contracts/src/conversation-harness.js';
import { codexAssistantSettingsSchema, codexSourceIdentitySchema } from '../../contracts/src/assistant.js';
import {
  CONVERSATION_CONTEXT_LIMITS, KNOWLEDGE_LIMITS, conversationCreationSchema, conversationTurnSchema,
  conversationContextSelectionSchema, parseAttachmentContextReceipt, executionProfileReferenceSchema, idSchema, knowledgeCitationSchema,
  CLAUDE_TURN_SETTINGS_PROTOCOL, CONVERSATION_QUEUE_PREVIEW_BYTES, claudeTurnSettingsSchema, claudeMessageSettingsFinalSchema,
  assertClaudeTurnSettingsMatch, conversationQueueEnqueueSchema,
  type ClaudeTurnSettings, type ConversationQueueEnqueue, type ConversationQueueAccepted,
  type ConversationCreated, type ConversationCreation, type ConversationTurnAccepted, type ConversationTurnAdmission, type KnowledgeCitation, type AttachmentReference, type AttachmentDescriptor,
} from '@flow/contracts';

/** A successful HTTP response did not prove acceptance of the caller's frozen request. */
export class UnknownConversationAcknowledgementError extends Error {
  readonly code = 'conversation_ack_unknown';
  constructor() {
    super('The conversation acknowledgement is unconfirmed. Keep the original request identity.');
    this.name = 'UnknownConversationAcknowledgementError';
  }
}
function requireValue(condition: unknown): asserts condition { if (!condition) throw new UnknownConversationAcknowledgementError(); }
function record(value: unknown): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
const text = (value: unknown, max: number, min = 1) => typeof value === 'string' && value.length >= min && value.length <= max;
const id = (value: unknown) => idSchema.safeParse(value).success;
const uuid = (value: unknown) => executionProfileReferenceSchema.shape.id.safeParse(value).success;
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = (value: unknown, min = 0, max = 2_147_483_647) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const timestamp = (value: unknown) => text(value, 80) && Number.isFinite(Date.parse(value as string));
const oneOf = (value: unknown, values: readonly unknown[]) => values.includes(value);

/** Select known fields before parsing; additive response metadata must not alter identity. */
function creationFields(value: unknown): ConversationCreation {
  const summary = record(value); const requested = record(summary.requested);
  requireValue(text(summary.title, 180) && typeof summary.harness === 'string' && conversationHarness(summary.harness) !== null && text(requested.model, 180)
    && oneOf(requested.thinking, ['disabled', 'enabled', 'adaptive', 'unknown']) && oneOf(requested.tools, ['configured-readonly', 'none']));
  let executionProfile;
  if (summary.executionProfile !== undefined) {
    const pin = record(summary.executionProfile);
    const parsed = executionProfileReferenceSchema.safeParse({ id: pin.id, runnerId: pin.runnerId, configDigest: pin.configDigest });
    requireValue(parsed.success); executionProfile = parsed.data;
  }
  const parsed = conversationCreationSchema.safeParse({ title: summary.title, harness: summary.harness,
    requested: { model: requested.model, thinking: requested.thinking, tools: requested.tools },
    ...(executionProfile === undefined ? {} : { executionProfile }), ...(summary.projectId === undefined ? {} : { projectId: summary.projectId }) });
  requireValue(parsed.success && parsed.data.title === summary.title && parsed.data.requested.model === requested.model);
  return parsed.data;
}
export function assertConversationCreationMatches(expected: ConversationCreation, actual: unknown): void {
  const parsed = conversationCreationSchema.safeParse(expected); requireValue(parsed.success);
  requireValue(JSON.stringify(parsed.data) === JSON.stringify(creationFields(actual)));
}
function summary(value: unknown): Record<string, unknown> {
  const result = record(value); creationFields(result);
  requireValue(id(result.id) && integer(result.revision) && timestamp(result.createdAt) && timestamp(result.updatedAt));
  return result;
}
function citation(value: unknown): KnowledgeCitation {
  const ref = record(value); const locator = record(ref.locator);
  const parsed = knowledgeCitationSchema.safeParse({ projectId: ref.projectId, sourceId: ref.sourceId, version: ref.version,
    contentDigest: ref.contentDigest, locator: { kind: locator.kind, start: locator.start, end: locator.end } });
  requireValue(parsed.success); return parsed.data;
}
const citationKey = (ref: KnowledgeCitation) => JSON.stringify([ref.projectId, ref.sourceId, ref.version, ref.contentDigest, ref.locator.kind, ref.locator.start, ref.locator.end]);

/** Metadata-only matcher; nonempty attachments explicitly select the reviewed v2 contract.
 * Legacy callers remain v1. A malformed response always retains unknown admission. */
export function assertConversationContextMatches(knowledge: readonly KnowledgeCitation[] | undefined, value: unknown,
  attachmentInput?: { projectId: string; attachments: readonly AttachmentReference[]; descriptors?: readonly AttachmentDescriptor[] }): void {
  if (attachmentInput?.attachments.length) {
    try { parseAttachmentContextReceipt({ ...attachmentInput, knowledge }, value); }
    catch { throw new UnknownConversationAcknowledgementError(); }
    return;
  }
  const parsed = conversationContextSelectionSchema.safeParse(knowledge ?? []); requireValue(parsed.success);
  const expected = parsed.data;
  requireValue(expected.every(ref => ref.projectId === expected[0]?.projectId));
  requireValue(expected.reduce((sum, ref) => sum + ref.locator.end - ref.locator.start, 0) <= CONVERSATION_CONTEXT_LIMITS.rawBytes);
  if (value === undefined && expected.length === 0) return;
  const context = record(value);
  requireValue(id(context.id) && id(context.executionInputId) && digest(context.contextDigest) && digest(context.executionInputDigest)
    && context.templateVersion === 1 && Array.isArray(context.sources) && context.sources.length === expected.length);
  for (let index = 0; index < expected.length; index++) {
    const source = record(context.sources[index]); const ref = citation(source.citation); const current = source.currentVersionAtFreeze;
    requireValue(citationKey(ref) === citationKey(expected[index]!) && source.byteLength === ref.locator.end - ref.locator.start
      && integer(current, ref.version, KNOWLEDGE_LIMITS.versionsPerSource) && source.isCurrentAtFreeze === (current === ref.version));
  }
}
function capabilities(value: unknown) {
  const result = record(value);
  requireValue(result.followUp === true && typeof result.queue === 'boolean'
    && ['steer', 'perTurnModel', 'perTurnThinking', 'perTurnTools'].every(key => result[key] === false)
    && ['liveAssistantText', 'knowledgeContext', 'attachmentContext'].every(key => result[key] === undefined || typeof result[key] === 'boolean'));
  if (result.messageSettings !== undefined) {
    const settings = record(result.messageSettings);
    requireValue(settings.protocol === CLAUDE_TURN_SETTINGS_PROTOCOL && settings.choices === 'execution-profile'
      && executionProfileReferenceSchema.safeParse(settings.profile).success);
  }
}
function messageSettings(value: unknown, expected?: ClaudeTurnSettings): ClaudeTurnSettings | undefined {
  if (value === undefined && expected === undefined) return undefined;
  const parsed = claudeTurnSettingsSchema.safeParse(value); requireValue(parsed.success);
  if (expected !== undefined) {
    try { assertClaudeTurnSettingsMatch(expected, parsed.data); }
    catch { throw new UnknownConversationAcknowledgementError(); }
  }
  return parsed.data;
}
function effective(value: unknown, taskId: unknown, snapshot?: ClaudeTurnSettings, harness?: unknown) {
  const result = record(value);
  requireValue((result.model === null || text(result.model, 180)) && oneOf(result.thinking, ['disabled', 'unknown'])
    && (oneOf(result.tools, [null, 'unknown', 'configured-readonly']) || Array.isArray(result.tools) && result.tools.length <= 100 && result.tools.every(tool => text(tool, 200)))
    && (result.permissionMode === undefined || result.permissionMode === null || text(result.permissionMode, 180)));
  if (result.source !== null) {
    const source = record(result.source);
    requireValue(source.taskId === taskId && id(source.attemptId) && id(source.detailId));
    requireValue(source.kind === 'assistant-final' ? id(source.messageId) : source.kind === 'recorded-adapter-session' && text(source.adapterVersion, 180));
  }
  if (harness === 'codex') {
    requireValue(snapshot === undefined && result.runnerRequested === undefined && result.messageSettings === undefined && result.model === null && result.thinking === 'unknown' && result.tools === 'unknown' && result.permissionMode === undefined);
    if (result.source !== null) requireValue(record(result.source).kind === 'assistant-final' && codexAssistantSettingsSchema.safeParse(result.codex).success);
    else requireValue(result.codex === undefined);
  } else requireValue(result.codex === undefined);
  if (result.runnerRequested !== undefined) {
    requireValue(snapshot === undefined);
    const requested = record(result.runnerRequested);
    requireValue(text(requested.model, 180) && requested.permissionMode === 'dontAsk' && requested.thinking === 'disabled');
  }
  if (result.messageSettings !== undefined) {
    const parsed = claudeMessageSettingsFinalSchema.safeParse(result.messageSettings);
    requireValue(parsed.success && snapshot !== undefined && result.thinking === 'unknown');
    messageSettings(parsed.data.snapshot, snapshot);
    requireValue(result.model === (parsed.data.observed?.model ?? null));
  }
}
function assistant(value: unknown, taskId: unknown, harness: string) {
  const result = record(value);
  if (result.state !== 'available') {
    requireValue(oneOf(result.state, ['pending', 'unavailable']) && oneOf(result.reason, ['execution-pending', 'execution-not-succeeded', 'unknown-adapter', 'missing-session', 'missing-result', 'ambiguous-result', 'invalid-result']));
    return;
  }
  requireValue(result.role === 'assistant' && id(result.messageId) && text(result.text, 4000, 0) && typeof result.truncated === 'boolean');
  const ref = record(result.contentRef); const source = record(result.source);
  requireValue(id(ref.id) && text(ref.title, 180) && id(ref.attemptId) && ref.taskId === taskId
    && source.taskId === taskId && source.attemptId === ref.attemptId && source.detailId === ref.id);
  if (source.kind === 'assistant-final') {
    requireValue(ref.kind === 'detail' && source.source === conversationHarness(harness)?.source && source.messageId === result.messageId && digest(source.contentDigest)
      && id(source.nativeSessionId) && id(source.eventId) && id(source.sourceMessageId));
    if (harness === 'codex') requireValue(codexSourceIdentitySchema.safeParse(source.nativeSourceIdentity).success);
    else requireValue(source.nativeSourceIdentity === undefined);
  } else {
    requireValue(harness === 'claude' && source.kind === 'adapter-final-artifact' && source.adapterVersion === 'claude-sdk-0.3.290-v1' && ref.kind === 'artifact'
      && id(source.artifactId) && digest(source.artifactVersion));
  }
}
function turn(value: unknown, conversationId: string, input: ConversationTurnAdmission, projectId: unknown, harness: string) {
  const result = record(value); const user = record(result.user); const task = record(result.task); const telemetry = record(result.telemetry);
  requireValue(id(result.id) && result.conversationId === conversationId && integer(result.number, 1) && result.number === input.expectedRevision + 1
    && timestamp(result.createdAt) && user.role === 'user' && user.text === input.text);
  requireValue(id(task.id) && text(task.title, 180) && task.harness === harness && timestamp(task.createdAt) && timestamp(task.updatedAt)
    && oneOf(task.status, ['queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'uncertain'])
    && oneOf(task.verificationStatus, ['pending', 'passed', 'failed']) && telemetry.kind === 'execution' && telemetry.taskId === task.id && text(telemetry.title, 180));
  const snapshot = messageSettings(result.messageSettings, input.messageSettings);
  effective(result.effective, task.id, snapshot, harness); assistant(result.assistant, task.id, harness);
  requireValue(!input.attachments?.length || typeof projectId === 'string');
  assertConversationContextMatches(input.knowledge, result.context, input.attachments?.length ? { projectId: projectId as string, attachments: input.attachments } : undefined);
}
export function decodeConversationCreated(raw: unknown, input: ConversationCreation): ConversationCreated {
  const result = record(raw); const conversation = summary(result.conversation);
  requireValue(typeof result.replayed === 'boolean' && conversation.revision === 0);
  assertConversationCreationMatches(input, conversation); capabilities(result.capabilities);
  return raw as ConversationCreated;
}
export function decodeConversationTurnAccepted(raw: unknown, conversationId: string, input: ConversationTurnAdmission): ConversationTurnAccepted {
  const parsed = conversationTurnSchema.safeParse(input); requireValue(parsed.success && parsed.data.mode === 'follow-up' && id(conversationId));
  const result = record(raw); const conversation = summary(result.conversation);
  requireValue(typeof result.replayed === 'boolean' && conversation.id === conversationId && conversation.revision === parsed.data.expectedRevision + 1);
  requireValue((parsed.data.knowledge ?? []).every(ref => ref.projectId === conversation.projectId));
  turn(result.turn, conversationId, parsed.data, conversation.projectId, String(conversation.harness));
  return raw as ConversationTurnAccepted;
}

/** Opt-in enqueue acceptance is immutable; current promotion state belongs to a later read. */
export function decodeConversationQueueAccepted(raw: unknown, conversationId: string, input: ConversationQueueEnqueue, nativeProtocol = false): ConversationQueueAccepted {
  const parsed = conversationQueueEnqueueSchema.safeParse(input);
  requireValue(parsed.success && (nativeProtocol || parsed.data.messageSettings !== undefined) && id(conversationId));
  const result = record(raw); const item = record(result.item);
  requireValue(result.conversationId === conversationId && typeof result.replayed === 'boolean'
    && integer(result.queueRevision, 1) && result.queueRevision === parsed.data.expectedQueueRevision + 1);
  requireValue(uuid(item.id) && item.conversationId === conversationId && item.sequence === result.queueRevision
    && item.state === 'waiting' && item.promoted === null && timestamp(item.createdAt) && timestamp(item.updatedAt));
  let expectedPreview = ''; let previewBytes = 0;
  const encoder = new TextEncoder();
  for (const character of parsed.data.text) {
    previewBytes += encoder.encode(character).length;
    if (previewBytes > CONVERSATION_QUEUE_PREVIEW_BYTES) break;
    expectedPreview += character;
  }
  requireValue(item.preview === expectedPreview && item.truncated === (expectedPreview !== parsed.data.text));
  messageSettings(item.messageSettings, parsed.data.messageSettings);
  return raw as ConversationQueueAccepted;
}
