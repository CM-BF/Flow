import { assertConversationCreationMatches } from "@flow/client";
import {
  CLAUDE_TURN_SETTINGS_PROTOCOL,
  claudeMessageSettingsCatalogEntrySchema,
  claudeTurnSettingsSchema,
  claudeTurnSettingsChoicesSchema,
  claudeTurnSettingsJson,
  checkClaudeTurnSettingsAllowed,
  conversationCreationSchema,
  executionProfileConfigurationSchema,
  executionProfileReferenceSchema,
  type ClaudeMessageSettingsExecutionProfile,
  type ClaudeMessageSettingsCatalogEntry,
  type ClaudeTurnSettings,
  type ConversationCapabilities,
  type ExecutionProfileReference,
  type ConversationCreation,
  type ConversationSummary,
  type ExecutionProfile,
} from "@flow/contracts";

import type { MessageSettingsCatalogSnapshot } from "./catalog";

export type Immutable<T> = { readonly [K in keyof T]: Immutable<T[K]> };
export type ChatAccess = "none" | "configured-readonly";
/** A directory declaration can describe a purpose that ordinary chat cannot submit. */
export type DirectoryProfile = Omit<ExecutionProfile, "configuration"> & {
  configuration: Omit<ExecutionProfile["configuration"], "access"> & { access: string };
};
export type ChatProfile = Omit<DirectoryProfile, "configuration"> & {
  configuration: Omit<DirectoryProfile["configuration"], "access"> & { access: ChatAccess };
};
export type ProfileSelection =
  | { readonly kind: "legacy-default" }
  | { readonly kind: "configured"; readonly profile: Immutable<ChatProfile> }
  | { readonly kind: "versioned"; readonly entry: Immutable<ClaudeMessageSettingsCatalogEntry> };

const emptyMaterialScopeDigest = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
export function isChatAccess(access: string): access is ChatAccess {
  return access === "none" || access === "configured-readonly";
}
function freeze<T>(value: T): Immutable<T> {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as Immutable<T>;
}
export function legacyDefaultSelection(): ProfileSelection {
  return Object.freeze({ kind: "legacy-default" });
}

/** Keep unsupported access visible while validating every other known configuration field. */
export function readDirectoryProfile(input: unknown): Immutable<DirectoryProfile> {
  const profile = structuredClone(input) as DirectoryProfile;
  if (!profile || typeof profile !== "object") throw new Error("Invalid execution profile declaration");
  profile.reference = executionProfileReferenceSchema.parse(profile.reference);
  const access = profile.configuration?.access;
  if (typeof access !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(access)) throw new Error("Invalid execution profile access declaration");
  // Substituting only access lets the fixed schema validate all other fields without widening chat admission.
  const configuration = executionProfileConfigurationSchema.parse({ ...profile.configuration, access: "none" });
  profile.configuration = { ...configuration, access };
  if (access === "goal-tools" && (configuration.requireReadApproval || configuration.materialScopeDigest !== emptyMaterialScopeDigest)) throw new Error("Invalid goal-tools profile policy");
  if (
    profile.source !== "runner-configured" || profile.availability !== "not-probed" ||
    profile.model?.value !== profile.configuration.model || profile.model.resolvedModel !== null ||
    profile.model.providerCapabilities !== "unknown" || typeof profile.model.displayName !== "string" ||
    typeof profile.model.description !== "string" || typeof profile.createdAt !== "string" ||
    !Number.isFinite(Date.parse(profile.createdAt)) ||
    profile.controls?.model !== "select-configured-profile" || profile.controls.thinking !== "fixed-disabled" ||
    profile.controls.effort !== "unsupported" || profile.controls.access !== "configured-policy" ||
    profile.controls.queue !== false || profile.controls.steer !== false
  ) throw new Error("Invalid execution profile declaration");
  return freeze(profile);
}

/** This explicit allowlist stays narrow even when the shared publication schema gains new purposes. */
export function configuredSelection(input: Immutable<DirectoryProfile>): Extract<ProfileSelection, { kind: "configured" }> {
  const profile = readDirectoryProfile(input);
  const access = profile.configuration.access;
  if (!isChatAccess(access)) throw new Error("This execution profile cannot be used for ordinary chat");
  return freeze({ kind: "configured" as const, profile: { ...profile, configuration: { ...profile.configuration, access } } });
}

/** Explicit opt-in selection. The directory declares choices, not live conversation authority. */
export function versionedSelection(input: unknown): Extract<ProfileSelection, { kind: "versioned" }> {
  const entry = claudeMessageSettingsCatalogEntrySchema.parse(input);
  if (!isChatAccess(entry.profile.configuration.access)) throw new Error("This execution profile cannot be used for ordinary chat");
  return freeze({ kind: "versioned" as const, entry });
}

/** Call once before CREATE; the caller's outbox owns this payload and its idempotency key. */
export function freezeConversationCreation(title: string, selection: ProfileSelection): Immutable<ConversationCreation> {
  const profile = selection.kind === "configured" ? configuredSelection(selection.profile).profile
    : selection.kind === "versioned" ? versionedSelection(selection.entry).entry.profile : null;
  return freeze(conversationCreationSchema.parse({
    title, harness: "claude",
    ...(profile ? { executionProfile: profile.reference } : {}),
    requested: { model: profile?.configuration.model ?? "runner-default", thinking: "disabled", tools: profile?.configuration.access ?? "configured-readonly" },
  }));
}

/** Optional project and profile identities must match, including their presence. */
export function assertCreationReceiptMatches(expected: ConversationCreation, received: ConversationSummary): void {
  try { assertConversationCreationMatches(expected, received); }
  catch (cause) { throw new Error("Conversation receipt does not match the frozen creation configuration", { cause }); }
}


/** Public codec owns this branch; it must never pass through the legacy directory decoder. */
export function readMessageSettingsProfile(input: unknown): Immutable<ClaudeMessageSettingsExecutionProfile> {
  return freeze(claudeMessageSettingsCatalogEntrySchema.parse(input).profile);
}

/** Supplied by the authorized conversation owner; ids and catalog visibility alone grant nothing. */
export interface MessageSettingsContext {
  readonly profile: Immutable<ExecutionProfileReference> | null;
  readonly capability: Immutable<ConversationCapabilities["messageSettings"]> | null;
}
export type MessageSettingsAvailability =
  | { readonly allowed: true; readonly profile: Immutable<ClaudeMessageSettingsExecutionProfile> }
  | { readonly allowed: false; readonly reason: string };

function sameProfile(a: Immutable<ExecutionProfileReference>, b: Immutable<ExecutionProfileReference>): boolean {
  return a.id === b.id && a.runnerId === b.runnerId && a.configDigest === b.configDigest;
}

/** A local preflight, never a provider probe or permission to retry an old command. */
export function messageSettingsAvailability(catalog: MessageSettingsCatalogSnapshot, context: MessageSettingsContext): MessageSettingsAvailability {
  const capability = context.capability;
  if (!capability || capability.protocol !== CLAUDE_TURN_SETTINGS_PROTOCOL || capability.choices !== "execution-profile") {
    return { allowed: false, reason: "当前会话未提供逐条消息设置能力，保留选择并联系宿主刷新会话。" };
  }
  if (!context.profile || !sameProfile(context.profile, capability.profile)) {
    return { allowed: false, reason: "会话与设置能力的配置身份不一致，请刷新会话。" };
  }
  if (!catalog.loaded || catalog.stale || catalog.loading) {
    return { allowed: false, reason: "请刷新设置目录后再选择或提交；当前选择会保留。" };
  }
  const reference = context.profile;
  const profile = catalog.profiles.find(item => sameProfile(item.reference, reference));
  if (!profile) return { allowed: false, reason: "已加载目录中没有会话的完整配置，请继续加载或刷新。" };
  if (!profile.configuration.turnSettings?.choices.length) {
    return { allowed: false, reason: "此配置没有可用的完整消息设置组合；发送和排队不可用，当前草稿会保留。" };
  }
  return { allowed: true, profile };
}

/** Call synchronously with the same submission's intent/material capture. The receipt owner persists it. */
export function captureMessageSettings(
  value: Immutable<ClaudeTurnSettings> | undefined,
  catalog: MessageSettingsCatalogSnapshot,
  context: MessageSettingsContext,
): Immutable<ClaudeTurnSettings> | undefined {
  if (value === undefined) return undefined;
  const snapshot = claudeTurnSettingsSchema.parse(value);
  const available = messageSettingsAvailability(catalog, context);
  if (!available.allowed) throw new Error(available.reason);
  const decision = checkClaudeTurnSettingsAllowed(snapshot, {
    profile: available.profile.reference,
    choices: claudeTurnSettingsChoicesSchema.parse(available.profile.configuration.turnSettings?.choices),
  });
  if (decision.decision !== "allowed") throw new Error("所选完整组合不属于当前会话配置，请重新选择；旧选择不会自动清除。");
  return freeze(snapshot);
}

export type MessageSettingsSubmissionEligibility =
  | { readonly allowed: true; readonly value: Immutable<ClaudeTurnSettings> | undefined }
  | { readonly allowed: false; readonly reason: string };

/** For Send and Queue before detaching a draft. Prepare/receipt replay do not use this gate.
 * A saved selection remembers the requirement even before a trusted conversation GET arrives.
 * Clearing stays editable; no tuple or profile is filled in on the user's behalf. */
export function messageSettingsSubmissionEligibility(
  value: Immutable<ClaudeTurnSettings> | undefined,
  catalog: MessageSettingsCatalogSnapshot,
  context: MessageSettingsContext,
  selection: ProfileSelection,
): MessageSettingsSubmissionEligibility {
  if (selection.kind === "versioned" && (!context.profile || !sameProfile(selection.entry.profile.reference, context.profile))) {
    return { allowed: false, reason: "请准备并刷新所选完整配置的会话；当前草稿会保留。" };
  }
  if (selection.kind === "versioned" || context.capability != null) {
    const available = messageSettingsAvailability(catalog, context);
    if (!available.allowed) return available;
    if (value === undefined) return { allowed: false, reason: "此会话需要完整消息设置，请明确选择 model、thinking、effort 和 speed 后再发送或排队。" };
  }
  try { return { allowed: true, value: captureMessageSettings(value, catalog, context) }; }
  catch (error) { return { allowed: false, reason: error instanceof Error ? error.message : "无法确认完整消息设置；当前草稿会保留。" }; }
}

/** Equality is the public canonical snapshot, including profile identity and every requested axis. */
export function sameMessageSettings(a: Immutable<ClaudeTurnSettings> | undefined, b: Immutable<ClaudeTurnSettings> | undefined): boolean {
  return a === undefined || b === undefined ? a === b : claudeTurnSettingsJson(a) === claudeTurnSettingsJson(b);
}
