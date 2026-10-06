import { assertConversationCreationMatches } from "@flow/client";
import {
  conversationCreationSchema,
  executionProfileConfigurationSchema,
  executionProfileReferenceSchema,
  type ConversationCreation,
  type ConversationSummary,
  type ExecutionProfile,
} from "@flow/contracts";

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
  | { readonly kind: "configured"; readonly profile: Immutable<ChatProfile> };

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
export function configuredSelection(input: DirectoryProfile): Extract<ProfileSelection, { kind: "configured" }> {
  const profile = readDirectoryProfile(input);
  const access = profile.configuration.access;
  if (!isChatAccess(access)) throw new Error("This execution profile cannot be used for ordinary chat");
  return freeze({ kind: "configured" as const, profile: { ...profile, configuration: { ...profile.configuration, access } } });
}

/** Call once before CREATE; the caller's outbox owns this payload and its idempotency key. */
export function freezeConversationCreation(title: string, selection: ProfileSelection): Immutable<ConversationCreation> {
  const profile = selection.kind === "configured" ? configuredSelection(selection.profile).profile : null;
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
