import {
  conversationCreationSchema,
  executionProfileConfigurationSchema,
  executionProfileReferenceSchema,
  type ConversationCreation,
  type ConversationSummary,
  type ExecutionProfile,
} from "@flow/contracts";

export type Immutable<T> = { readonly [K in keyof T]: Immutable<T[K]> };
export type ProfileSelection =
  | { readonly kind: "legacy-default" }
  | { readonly kind: "configured"; readonly profile: Immutable<ExecutionProfile> };

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

/** Validate the public DTO; a declaration is never evidence of provider availability. */
export function configuredSelection(input: ExecutionProfile): Extract<ProfileSelection, { kind: "configured" }> {
  const profile = structuredClone(input);
  profile.reference = executionProfileReferenceSchema.parse(profile.reference);
  profile.configuration = executionProfileConfigurationSchema.parse(profile.configuration);
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
  return freeze({ kind: "configured" as const, profile });
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

/** Receipt pin presence matters as much as its fields, including for legacy unpinned input. */
export function assertCreationReceiptMatches(expected: ConversationCreation, received: ConversationSummary): void {
  const input = conversationCreationSchema.parse(expected);
  const actual = conversationCreationSchema.parse({
    title: received.title, harness: received.harness, requested: received.requested,
    ...(received.executionProfile === undefined ? {} : { executionProfile: received.executionProfile }),
  });
  if (received.harness !== input.harness || received.title !== input.title ||
    received.requested?.model !== input.requested.model || received.requested?.thinking !== input.requested.thinking || received.requested?.tools !== input.requested.tools ||
    JSON.stringify(input) !== JSON.stringify(actual)) throw new Error("Conversation receipt does not match the frozen creation configuration");
}
