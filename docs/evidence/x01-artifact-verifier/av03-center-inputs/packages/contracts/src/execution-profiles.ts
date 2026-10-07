import { z } from 'zod';
import { CLAUDE_TURN_SETTINGS_PROTOCOL, claudeTurnSettingsChoicesSchema } from './claude-turn-settings.js';

export const EXECUTION_PROFILE_HEADER = 'X-Flow-Execution-Profile';
export const EXECUTION_PROFILE_STEERING_VERSION = 'steering-v1';
export const ACTIVE_STEERING_PROTOCOL = 'flow.active-steering.v1';

export const claudeTurnSettingsConfigurationSchema = z.strictObject({
  protocol: z.literal(CLAUDE_TURN_SETTINGS_PROTOCOL), choices: claudeTurnSettingsChoicesSchema,
});

const digest = z.string().regex(/^[a-f0-9]{64}$/);
// The public catalog carries model identifiers, never arbitrary paths, prompts or settings text.
const modelValue = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/);
export const executionProfileReferenceSchema = z.strictObject({ id: z.uuid(), runnerId: z.uuid(), configDigest: digest });
export type ExecutionProfileReference = z.infer<typeof executionProfileReferenceSchema>;
/** A configured request and gate policy, not a provider availability or effective-settings attestation. */
export const executionProfileConfigurationSchema = z.strictObject({
  harness: z.literal('claude'),
  adapterVersion: z.literal('claude-sdk-0.3.290-v2'),
  model: modelValue,
  thinking: z.literal('disabled'),
  permissionMode: z.literal('dontAsk'),
  access: z.enum(['none', 'configured-readonly', 'goal-tools', 'goal-graph-tools']),
  requireReadApproval: z.boolean(),
  materialScopeDigest: digest,
  // Absent preserves the original configuration bytes and means steering unsupported.
  activeSteering: z.strictObject({ protocol: z.literal(ACTIVE_STEERING_PROTOCOL) }).optional(),
  // Omission preserves legacy bytes. The finite choices are configured policy, never a model probe.
  turnSettings: claudeTurnSettingsConfigurationSchema.optional(),
  limits: z.strictObject({ maxTurns: z.number().int().min(1).max(4), maxBudgetUsd: z.number().positive().max(1), timeoutMs: z.number().int().min(1).max(90_000) }),
}).superRefine((profile, context) => {
  if (profile.turnSettings && (profile.activeSteering || !['none', 'configured-readonly'].includes(profile.access))) {
    context.addIssue({ code: 'custom', message: 'Message settings require an ordinary Claude profile without active steering or goal tools.' });
  }
  if (profile.activeSteering && !['none', 'configured-readonly'].includes(profile.access)) {
    context.addIssue({ code: 'custom', message: 'Active steering is limited to ordinary Claude execution profiles.' });
  }
  if ((profile.access === 'goal-tools' || profile.access === 'goal-graph-tools') && (profile.requireReadApproval || profile.materialScopeDigest !== '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945')) {
    context.addIssue({ code: 'custom', message: 'Goal tools require an empty material scope and no read approval policy.' });
  }
});
export type ExecutionProfileConfiguration = z.infer<typeof executionProfileConfigurationSchema>;
export const executionProfilePublicationSchema = z.strictObject({ configuration: executionProfileConfigurationSchema });
export type ExecutionProfilePublication = z.infer<typeof executionProfilePublicationSchema>;
/** Stable JSON field order shared by the center and runner; hashing remains outside browser contracts. */
export function executionProfileConfigurationJson(value: ExecutionProfileConfiguration): string {
  return JSON.stringify(executionProfileConfigurationSchema.parse(value));
}
export interface ExecutionProfile {
  reference: ExecutionProfileReference;
  configuration: ExecutionProfileConfiguration;
  source: 'runner-configured';
  availability: 'not-probed';
  model: { value: string; resolvedModel: null; displayName: string; description: string; providerCapabilities: 'unknown' };
  controls: { model: 'select-configured-profile'; thinking: 'fixed-disabled'; effort: 'unsupported'; access: 'configured-policy'; queue: false; steer: false };
  createdAt: string;
}
/** Publication accepts both Claude configurations; the controls must reflect the selected branch. */
export interface ExecutionProfilePublished { profile: ExecutionProfile | ClaudeMessageSettingsExecutionProfile; replayed: boolean }
export interface ExecutionProfilePage { profiles: ExecutionProfile[]; nextCursor: string | null }

export const CODEX_ADAPTER_VERSION = 'codex-app-server-0.154.0-v1';
/** Fixed native request fields; none is Flow intent, never/read-only is not proof of no tool execution. */
export const codexExecutionProfileConfigurationSchema = z.strictObject({
  harness: z.literal('codex'),
  adapterVersion: z.literal(CODEX_ADAPTER_VERSION),
  model: modelValue,
  reasoningEffort: modelValue.nullable(),
  serviceTier: modelValue.nullable(),
  serviceTierForTurn: modelValue.nullable(),
  access: z.literal('none'),
  approvalPolicy: z.literal('never'),
  sandboxMode: z.literal('read-only'),
  // Host resource bounds, never provider USD or turn-count guarantees.
  hostLimits: z.strictObject({ wallTimeMs: z.number().int().min(1).max(90_000), maxOutputBytes: z.number().int().min(1).max(1_048_576) }),
  sessionPersistence: z.literal('host-owned').optional(),
});
export type CodexExecutionProfileConfiguration = z.infer<typeof codexExecutionProfileConfigurationSchema>;
export const nativeExecutionProfileConfigurationSchema = z.discriminatedUnion('harness', [executionProfileConfigurationSchema, codexExecutionProfileConfigurationSchema]);
export type NativeExecutionProfileConfiguration = z.infer<typeof nativeExecutionProfileConfigurationSchema>;
export const nativeExecutionProfilePublicationSchema = z.strictObject({ configuration: nativeExecutionProfileConfigurationSchema });
/** The legacy branch is parsed by its unchanged codec, with no defaulted new fields. */
export function nativeExecutionProfileConfigurationJson(value: NativeExecutionProfileConfiguration): string {
  return JSON.stringify(nativeExecutionProfileConfigurationSchema.parse(value));
}
export interface CodexExecutionProfile extends Omit<ExecutionProfile, 'configuration' | 'controls'> {
  configuration: CodexExecutionProfileConfiguration;
  controls: { model: 'select-configured-profile'; thinking: 'unsupported'; effort: 'configured-request'; serviceTier: 'configured-request'; access: 'requested-none'; queue: false; steer: false };
}
export type NativeExecutionProfile = ExecutionProfile | CodexExecutionProfile | ClaudeMessageSettingsExecutionProfile;
export interface NativeExecutionProfilePublished { profile: NativeExecutionProfile; replayed: boolean }

/** Opt-in read protocol. This catalog reports configured intent, never provider readiness. */
export const NATIVE_EXECUTION_PROFILE_VERSION = 'native-v1';
export const NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL = 'flow.native-execution-profile-catalog.v1';
const catalogCommon = {
  reference: executionProfileReferenceSchema,
  source: z.literal('runner-configured'),
  availability: z.literal('not-probed'),
  model: z.strictObject({ value: modelValue, resolvedModel: z.null(), displayName: modelValue,
    description: z.string().max(512), providerCapabilities: z.literal('unknown') }),
  createdAt: z.iso.datetime({ offset: true }),
};
const catalogProfileSchema = z.union([
  z.strictObject({ ...catalogCommon, configuration: executionProfileConfigurationSchema,
    controls: z.strictObject({ model: z.literal('select-configured-profile'), thinking: z.literal('fixed-disabled'),
      effort: z.literal('unsupported'), access: z.literal('configured-policy'), queue: z.literal(false), steer: z.literal(false) }) }),
  z.strictObject({ ...catalogCommon, configuration: codexExecutionProfileConfigurationSchema,
    controls: z.strictObject({ model: z.literal('select-configured-profile'), thinking: z.literal('unsupported'),
      effort: z.literal('configured-request'), serviceTier: z.literal('configured-request'), access: z.literal('requested-none'),
      queue: z.literal(false), steer: z.literal(false) }) }),
]);
const catalogConversationSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('existing-claude-contract'), capabilitySource: z.literal('conversation-response') }),
  // Unsupported covers creation and every conversation operation; no capability is implied by omission.
  z.strictObject({ state: z.literal('unsupported'), reason: z.enum(['codex-conversation-unimplemented', 'profile-purpose-not-supported']) }),
]);
export const nativeExecutionProfileCatalogEntrySchema = z.strictObject({ profile: catalogProfileSchema, conversation: catalogConversationSchema })
  .superRefine(({ profile, conversation }, context) => {
    const configuration = profile.configuration;
    if (configuration.harness === 'claude' && configuration.turnSettings) {
      context.addIssue({ code: 'custom', message: 'Message settings require their explicit catalog protocol.' });
    }
    const reason = configuration.harness === 'codex' ? 'codex-conversation-unimplemented'
      : configuration.access === 'goal-tools' || configuration.access === 'goal-graph-tools' ? 'profile-purpose-not-supported' : null;
    if (reason ? conversation.state !== 'unsupported' || conversation.reason !== reason : conversation.state !== 'existing-claude-contract') {
      context.addIssue({ code: 'custom', path: ['conversation'], message: 'Conversation compatibility must match the configured profile.' });
    }
    if (profile.model.value !== configuration.model) {
      context.addIssue({ code: 'custom', path: ['profile', 'model'], message: 'Catalog model must match configured intent.' });
    }
  });
export type NativeExecutionProfileCatalogEntry = z.infer<typeof nativeExecutionProfileCatalogEntrySchema>;
export const nativeExecutionProfileCatalogPageSchema = z.strictObject({
  protocol: z.literal(NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL),
  profiles: z.array(nativeExecutionProfileCatalogEntrySchema).max(100),
  nextCursor: executionProfileReferenceSchema.shape.id.nullable(),
}).superRefine((page, context) => {
  const ids = page.profiles.map(entry => entry.profile.reference.id);
  if (new Set(ids).size !== ids.length || page.nextCursor !== null && page.nextCursor !== ids.at(-1)) {
    context.addIssue({ code: 'custom', message: 'Invalid catalog page identity or cursor.' });
  }
});
export type NativeExecutionProfileCatalogPage = z.infer<typeof nativeExecutionProfileCatalogPageSchema>;

/** Same GET path and header, with an exact version opt-in. Old readers cannot decode this entry. */
export const claudeMessageSettingsCatalogEntrySchema = z.strictObject({
  profile: z.strictObject({
    ...catalogCommon,
    configuration: executionProfileConfigurationSchema.refine(value => value.turnSettings !== undefined, 'A message settings profile must opt in'),
    controls: z.strictObject({
      access: z.literal('configured-policy'), queue: z.literal(false), steer: z.literal(false),
      messageSettings: z.strictObject({ protocol: z.literal(CLAUDE_TURN_SETTINGS_PROTOCOL), choices: z.literal('configuration.turnSettings.choices') }),
    }),
  }),
  conversation: z.strictObject({ state: z.literal('existing-claude-contract'), capabilitySource: z.literal('conversation-response') }),
}).superRefine(({ profile }, context) => {
  if (profile.model.value !== profile.configuration.model) context.addIssue({ code: 'custom', message: 'Catalog model must match configured intent.' });
});
export type ClaudeMessageSettingsCatalogEntry = z.infer<typeof claudeMessageSettingsCatalogEntrySchema>;
export type ClaudeMessageSettingsExecutionProfile = ClaudeMessageSettingsCatalogEntry['profile'];
export const claudeMessageSettingsCatalogPageSchema = z.strictObject({
  protocol: z.literal(CLAUDE_TURN_SETTINGS_PROTOCOL),
  profiles: z.array(claudeMessageSettingsCatalogEntrySchema).max(100),
  nextCursor: executionProfileReferenceSchema.shape.id.nullable(),
}).superRefine((page, context) => {
  const ids = page.profiles.map(entry => entry.profile.reference.id);
  if (new Set(ids).size !== ids.length || page.nextCursor !== null && page.nextCursor !== ids.at(-1)) {
    context.addIssue({ code: 'custom', message: 'Invalid catalog page identity or cursor.' });
  }
});
export type ClaudeMessageSettingsCatalogPage = z.infer<typeof claudeMessageSettingsCatalogPageSchema>;

/** A new codec advertises host-owned sessions without breaking strict native-v1 readers. */
export const NATIVE_EXECUTION_PROFILE_V2 = 'native-v2';
export const NATIVE_EXECUTION_PROFILE_CATALOG_V2 = 'flow.native-execution-profile-catalog.v2';
/** One configured-capability projection shared by the strict codec and center directory. */
export function nativeConversationCapability(config: NativeExecutionProfileConfiguration) {
  if (config.harness === 'codex') return config.sessionPersistence === 'host-owned'
    ? { state: 'native-conversation' as const, protocol: 'native-v1' as const, capabilitySource: 'conversation-response' as const }
    : { state: 'unsupported' as const, reason: 'session-persistence-unsupported' as const };
  return config.access === 'goal-tools' || config.access === 'goal-graph-tools'
    ? { state: 'unsupported' as const, reason: 'profile-purpose-not-supported' as const }
    : { state: 'existing-claude-contract' as const, capabilitySource: 'conversation-response' as const };
}
export const nativeExecutionProfileCatalogV2EntrySchema = z.strictObject({ profile: catalogProfileSchema,
  conversation: z.union([
    z.strictObject({ state: z.literal('existing-claude-contract'), capabilitySource: z.literal('conversation-response') }),
    z.strictObject({ state: z.literal('native-conversation'), protocol: z.literal('native-v1'), capabilitySource: z.literal('conversation-response') }),
    z.strictObject({ state: z.literal('unsupported'), reason: z.enum(['session-persistence-unsupported', 'profile-purpose-not-supported']) }),
  ]),
}).superRefine(({ profile, conversation }, context) => {
  const config = profile.configuration;
  const expected = nativeConversationCapability(config);
  if (conversation.state !== expected.state || conversation.state === 'unsupported' && expected.state === 'unsupported' && conversation.reason !== expected.reason
    || profile.model.value !== config.model || config.harness === 'claude' && config.turnSettings) {
    context.addIssue({ code: 'custom', message: 'Catalog capability must match the exact configured profile.' });
  }
});
export const nativeExecutionProfileCatalogV2PageSchema = z.strictObject({ protocol: z.literal(NATIVE_EXECUTION_PROFILE_CATALOG_V2),
  profiles: z.array(nativeExecutionProfileCatalogV2EntrySchema).max(100), nextCursor: executionProfileReferenceSchema.shape.id.nullable(),
}).superRefine((page, context) => {
  const ids = page.profiles.map(entry => entry.profile.reference.id);
  if (new Set(ids).size !== ids.length || page.nextCursor !== null && page.nextCursor !== ids.at(-1)) context.addIssue({ code: 'custom', message: 'Invalid catalog page identity or cursor.' });
});
export type NativeExecutionProfileCatalogV2Page = z.infer<typeof nativeExecutionProfileCatalogV2PageSchema>;
