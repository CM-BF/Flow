import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { FlowApiError, FlowClient } from "@flow/client";
import { CLAUDE_TURN_SETTINGS_PROTOCOL, claudeMessageSettingsCatalogEntrySchema, type ClaudeTurnSettings } from "@flow/contracts";
import type { ConversationCreation, ConversationSummary, ExecutionProfile, ExecutionProfilePage } from "@flow/contracts";
import { createExecutionProfileCatalog } from "../src/execution-profiles/catalog";
import { assertCreationReceiptMatches, versionedSelection, messageSettingsSubmissionEligibility, configuredSelection, freezeConversationCreation, legacyDefaultSelection } from "../src/execution-profiles/selection";

const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
function profile(number = 1): ExecutionProfile {
  return {
    reference: { id: id(number), runnerId: id(number + 100), configDigest: "a".repeat(64) },
    configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "configured-alias", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: "b".repeat(64), limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 } },
    source: "runner-configured", availability: "not-probed",
    model: { value: "configured-alias", resolvedModel: null, displayName: "Configured alias", description: "Fixture declaration", providerCapabilities: "unknown" },
    controls: { model: "select-configured-profile", thinking: "fixed-disabled", effort: "unsupported", access: "configured-policy", queue: false, steer: false }, createdAt: "2026-10-06T04:00:00Z",
  };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

it("uses the actual HTTP client for explicit bounded pages, preserving same models on different runners", async () => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url!);
    expect(request.headers.authorization).toBe("Bearer fixture-only");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(new URL(request.url!, "http://fixture").searchParams.has("after") ? { profiles: [profile(2)], nextCursor: null } : { profiles: [profile()], nextCursor: id(1) }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }));
  const address = server.address(); if (!address || typeof address === "string") throw Error("No HTTP fixture");
  const catalog = createExecutionProfileCatalog(new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: "fixture-only" })); cleanup.push(() => catalog.dispose());
  expect(requests).toEqual([]);
  await catalog.refresh(); await Promise.all([catalog.loadMore(), catalog.loadMore()]); await catalog.loadMore();
  expect(requests).toEqual(["/api/execution-profiles?limit=20", `/api/execution-profiles?after=${id(1)}&limit=20`]);
  expect(catalog.getSnapshot().profiles.map(item => item.reference.runnerId)).toEqual([id(101), id(102)]);
  expect(Object.isFrozen(catalog.getSnapshot().profiles[0]!.configuration.limits)).toBe(true);
});

it("retains pages on failed refresh and 401, then explicitly recovers without changing a chosen value", async () => {
  let fail = false;
  const catalog = createExecutionProfileCatalog({ executionProfiles: async () => { if (fail) throw new FlowApiError(401, "unauthorized", "private response"); return { profiles: [profile()], nextCursor: null }; } });
  await catalog.refresh(); const selected = configuredSelection(catalog.getSnapshot().profiles[0]!);
  fail = true; await catalog.refresh();
  expect(catalog.getSnapshot()).toMatchObject({ loaded: true, stale: true, loading: false });
  expect(catalog.getSnapshot().profiles).toHaveLength(1); expect(catalog.getSnapshot().error).toContain("Access expired");
  fail = false; await catalog.refresh(); expect(catalog.getSnapshot()).toMatchObject({ stale: false, error: null });
  expect(selected.profile.reference.id).toBe(id(1)); catalog.dispose();
});

it("keeps a failed later-page cursor retryable and deduplicates concurrent loads", async () => {
  let calls = 0;
  const catalog = createExecutionProfileCatalog({ executionProfiles: async ({ after } = {}) => {
    calls++; if (calls === 2) throw Error("network"); return after ? { profiles: [profile(2)], nextCursor: null } : { profiles: [profile()], nextCursor: id(1) };
  } });
  await catalog.refresh(); await catalog.loadMore();
  expect(catalog.getSnapshot()).toMatchObject({ nextCursor: id(1), stale: true });
  await catalog.loadMore(); expect(catalog.getSnapshot().profiles).toHaveLength(2); expect(catalog.getSnapshot().error).toBeNull(); catalog.dispose();
});

it("refresh supersedes an uncooperative in-flight page; dispose clears and fences the connection", async () => {
  const old = deferred<ExecutionProfilePage>(), next = deferred<ExecutionProfilePage>(); let calls = 0; const signals: AbortSignal[] = [];
  const catalog = createExecutionProfileCatalog({ executionProfiles: async (_, signal) => { signals.push(signal!); return ++calls === 1 ? old.promise : next.promise; } });
  const first = catalog.refresh(), second = catalog.refresh();
  expect(signals[0]!.aborted).toBe(true);
  next.resolve({ profiles: [profile(2)], nextCursor: null }); await second;
  old.resolve({ profiles: [profile()], nextCursor: null }); await first;
  expect(catalog.getSnapshot().profiles[0]!.reference.id).toBe(id(2));
  let notifications = 0; catalog.subscribe(() => { notifications++; }); catalog.dispose();
  expect(catalog.getSnapshot().profiles).toHaveLength(0); expect(notifications).toBe(1);
  await catalog.refresh(); expect(calls).toBe(2);
});

it("a disposed catalog ignores a late HTTP success without changing a new connection", async () => {
  const pending = deferred<ExecutionProfilePage>();
  const old = createExecutionProfileCatalog({ executionProfiles: async () => pending.promise });
  const other = createExecutionProfileCatalog({ executionProfiles: async () => ({ profiles: [profile(2)], nextCursor: null }) });
  const request = old.refresh(); old.dispose(); await other.refresh();
  pending.resolve({ profiles: [profile()], nextCursor: null }); await request;
  expect(old.getSnapshot().profiles).toHaveLength(0); expect(other.getSnapshot().profiles[0]!.reference.id).toBe(id(2)); other.dispose();
});

it.each([
  { profiles: [profile(), profile()], nextCursor: null },
  { profiles: [profile()], nextCursor: id(2) },
  { profiles: [{ ...profile(), availability: "online" }], nextCursor: null },
])("rejects malformed or nonadvancing pages atomically", async page => {
  const catalog = createExecutionProfileCatalog({ executionProfiles: async () => page as ExecutionProfilePage });
  await catalog.refresh(); expect(catalog.getSnapshot().error).toBeTruthy(); expect(catalog.getSnapshot().profiles).toHaveLength(0); catalog.dispose();
});

it("freezes a detached full creation including nested pin, exact access and requested alias", () => {
  const source = profile(); const selected = configuredSelection(source); const creation = freezeConversationCreation(" A conversation ", selected);
  source.reference.id = id(9); source.configuration.model = "changed";
  expect(creation).toEqual({ title: "A conversation", harness: "claude", executionProfile: { id: id(1), runnerId: id(101), configDigest: "a".repeat(64) }, requested: { model: "configured-alias", thinking: "disabled", tools: "none" } });
  expect(Object.isFrozen(creation.executionProfile)).toBe(true); expect(Object.isFrozen(creation.requested)).toBe(true);
  expect(Reflect.set(creation.executionProfile!, "id", id(3))).toBe(false);
});

it("keeps legacy input unpinned and rejects invalid titles or unsupported profile configuration", () => {
  expect(freezeConversationCreation("Old default", legacyDefaultSelection())).toEqual({ title: "Old default", harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" } });
  expect(() => freezeConversationCreation(" ", legacyDefaultSelection())).toThrow();
  expect(() => configuredSelection({ ...profile(), configuration: { ...profile().configuration, thinking: "enabled" } } as never)).toThrow();
});

it("matches complete receipt pin and rejects wrong/missing/additional pin or missing requested fields", () => {
  const creation = freezeConversationCreation("Pinned", configuredSelection(profile()));
  const summary: ConversationSummary = { ...structuredClone(creation), id: id(99), revision: 0, createdAt: "now", updatedAt: "now" };
  expect(() => assertCreationReceiptMatches(creation, summary)).not.toThrow();
  for (const field of ["id", "runnerId", "configDigest"] as const) {
    const changed = structuredClone(summary); changed.executionProfile![field] = field === "configDigest" ? "b".repeat(64) : id(90);
    expect(() => assertCreationReceiptMatches(creation, changed)).toThrow(/does not match/);
  }
  expect(() => assertCreationReceiptMatches(creation, { ...summary, executionProfile: undefined })).toThrow();
  const legacy = freezeConversationCreation("Pinned", legacyDefaultSelection());
  expect(() => assertCreationReceiptMatches(legacy, { ...summary, requested: legacy.requested })).toThrow();
  expect(() => assertCreationReceiptMatches(legacy, { ...summary, executionProfile: undefined, requested: {} } as never)).toThrow();
});

it.each([undefined, "project-a"])("matches optional project identity %s without requiring a UUID", projectId => {
  const creation: ConversationCreation = { ...freezeConversationCreation("Project chat", legacyDefaultSelection()), ...(projectId === undefined ? {} : { projectId }) };
  const summary: ConversationSummary = { ...creation, id: id(99), revision: 0, createdAt: "now", updatedAt: "now" };
  expect(() => assertCreationReceiptMatches(creation, summary)).not.toThrow();
  if (projectId === undefined) expect(() => assertCreationReceiptMatches(creation, { ...summary, projectId: undefined })).not.toThrow();
  for (const different of projectId === undefined ? ["project-a"] : [undefined, "project-b"])
    expect(() => assertCreationReceiptMatches(creation, { ...summary, projectId: different })).toThrow(/does not match/);
});

it.each([null, "", "p".repeat(129)])("rejects malformed project identity %s in a receipt", projectId => {
  const creation = freezeConversationCreation("Project chat", legacyDefaultSelection());
  const summary = { ...creation, projectId, id: id(99), revision: 0, createdAt: "now", updatedAt: "now" } as unknown as ConversationSummary;
  expect(() => assertCreationReceiptMatches(creation, summary)).toThrow();
});


it("refresh cancels later-page loading and a refresh failure requires head retry, not stale append", async () => {
  const pending = deferred<ExecutionProfilePage>(); let headCalls = 0;
  const catalog = createExecutionProfileCatalog({ executionProfiles: async ({ after } = {}) => {
    if (after) return pending.promise;
    if (++headCalls === 2) throw Error("network");
    return { profiles: [profile()], nextCursor: id(1) };
  } });
  await catalog.refresh(); const append = catalog.loadMore(); await catalog.refresh();
  expect(catalog.getSnapshot()).toMatchObject({ nextCursor: id(1), canLoadMore: false, stale: true });
  pending.resolve({ profiles: [profile(2)], nextCursor: null }); await append;
  expect(catalog.getSnapshot().profiles).toHaveLength(1);
  await catalog.refresh(); expect(catalog.getSnapshot().canLoadMore).toBe(true); catalog.dispose();
});

it("a fresh catalog never sends until explicitly refreshed, and removes subscriptions", async () => {
  let calls = 0, notices = 0;
  const catalog = createExecutionProfileCatalog({ executionProfiles: async () => { calls++; return { profiles: [], nextCursor: null }; } });
  const initial = catalog.getSnapshot(); const unsubscribe = catalog.subscribe(() => { notices++; });
  await catalog.loadMore(); expect(calls).toBe(0); expect(catalog.getSnapshot()).toBe(initial);
  await catalog.refresh(); expect(notices).toBe(2); unsubscribe(); await catalog.refresh(); expect(notices).toBe(2);
  expect(catalog.getSnapshot()).toMatchObject({ loaded: true, stale: false, profiles: [], canLoadMore: false }); catalog.dispose();
});

it("retains mixed directory purposes and pagination while only explicit chat access can become creation", async () => {
  const goal = { ...profile(2), configuration: { ...profile(2).configuration, access: "goal-tools", materialScopeDigest: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" } };
  const unsupported = { ...profile(3), configuration: { ...profile(3).configuration, access: "unsupported-fixture-access" } };
  const readonly = profile(4); readonly.configuration.access = "configured-readonly";
  for (const allowed of [profile(), readonly]) expect(freezeConversationCreation("Allowed", configuredSelection(allowed)).requested.tools).toBe(allowed.configuration.access);
  for (const blocked of [goal, unsupported]) {
    expect(() => configuredSelection(blocked)).toThrow(/cannot be used for ordinary chat/);
    expect(() => freezeConversationCreation("Blocked", { kind: "configured", profile: blocked } as never)).toThrow(/cannot be used for ordinary chat/);
  }
  const catalog = createExecutionProfileCatalog({ executionProfiles: async ({ after } = {}) => after ? { profiles: [profile(5)], nextCursor: null } : { profiles: [profile(), goal, unsupported, readonly] as ExecutionProfile[], nextCursor: id(4) } });
  await catalog.refresh();
  expect(catalog.getSnapshot()).toMatchObject({ loaded: true, stale: false, error: null, nextCursor: id(4) });
  expect(catalog.getSnapshot().profiles.map(item => item.configuration.access)).toEqual(["none", "goal-tools", "unsupported-fixture-access", "configured-readonly"]);
  await catalog.loadMore(); expect(catalog.getSnapshot().profiles).toHaveLength(5); catalog.dispose();
});

it.each([
  { requireReadApproval: true, materialScopeDigest: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  { requireReadApproval: false, materialScopeDigest: "b".repeat(64) },
])("rejects known invalid goal-tools policy without exposing a partial page", async policy => {
  const invalid = { ...profile(2), configuration: { ...profile(2).configuration, access: "goal-tools", ...policy } } as unknown as ExecutionProfile;
  const catalog = createExecutionProfileCatalog({ executionProfiles: async () => ({ profiles: [profile(), invalid], nextCursor: null }) });
  await catalog.refresh(); expect(catalog.getSnapshot().error).toBeTruthy(); expect(catalog.getSnapshot().profiles).toHaveLength(0); catalog.dispose();
});


describe("versioned creation invariants", () => {
  const requested = { model: "explicit-model", thinking: "adaptive" as const, effort: { kind: "level" as const, value: "high" as const }, speed: "fast" as const };
  function entry() {
    const legacy = profile();
    return claudeMessageSettingsCatalogEntrySchema.parse({ profile: {
      ...legacy, model: { ...legacy.model, displayName: "configured-alias" },
      configuration: { ...legacy.configuration, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [requested] } },
      controls: { access: "configured-policy", queue: false, steer: false, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: "configuration.turnSettings.choices" } },
    }, conversation: { state: "existing-claude-contract", capabilitySource: "conversation-response" } });
  }
  function ready() {
    const source = entry(), selected = versionedSelection(source), reference = source.profile.reference;
    const catalog = { profiles: [source.profile], nextCursor: null, loading: false, error: null, loaded: true, stale: false, canLoadMore: false };
    const context = { profile: reference, capability: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, choices: "execution-profile" as const } };
    const value: ClaudeTurnSettings = { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, requested };
    return { source, selected, catalog, context, value };
  }
  it("freezes the exact public versioned identity without defaults or a creation tuple", () => {
    const source = entry(), selected = versionedSelection(source), creation = freezeConversationCreation("Prepared", selected);
    const expected = structuredClone(source.profile.reference); source.profile.reference.configDigest = "c".repeat(64);
    expect(creation.executionProfile).toEqual(expected); expect(creation).not.toHaveProperty("messageSettings");
    expect(creation).not.toHaveProperty("projectId"); expect(creation.requested).toEqual({ model: "configured-alias", thinking: "disabled", tools: "none" });
    expect(Object.isFrozen(selected.entry.profile.configuration.turnSettings!.choices[0]!.effort)).toBe(true);
    expect(Object.isFrozen(creation.executionProfile)).toBe(true);
    expect(() => configuredSelection(source.profile as never)).toThrow();
    expect(() => versionedSelection({ ...entry(), unknown: true })).toThrow();
    const invalid = entry(); invalid.profile.model.value = "wrong"; expect(() => versionedSelection(invalid)).toThrow();
  });
  it("keeps prepare independent and rejects missing or cleared tuples for either submission intent", () => {
    const f = ready(); expect(() => freezeConversationCreation("Prepared", f.selected)).not.toThrow();
    for (const selection of [f.selected, legacyDefaultSelection()]) {
      expect(messageSettingsSubmissionEligibility(undefined, f.catalog, f.context, selection)).toMatchObject({ allowed: false });
    }
    const admitted = messageSettingsSubmissionEligibility(f.value, f.catalog, f.context, f.selected);
    expect(admitted).toEqual({ allowed: true, value: f.value });
    if (admitted.allowed) expect(Object.isFrozen(admitted.value!.requested.effort)).toBe(true);
    expect(messageSettingsSubmissionEligibility(undefined, f.catalog, { profile: null, capability: null }, legacyDefaultSelection())).toEqual({ allowed: true, value: undefined });
  });
  it("requires trusted GET, fresh catalog and all three profile identity fields", () => {
    const f = ready();
    expect(messageSettingsSubmissionEligibility(f.value, f.catalog, { profile: f.context.profile, capability: null }, f.selected).allowed).toBe(false);
    for (const field of ["id", "runnerId", "configDigest"] as const) {
      const changed = { ...f.value, profile: { ...f.value.profile, [field]: field === "configDigest" ? "d".repeat(64) : id(900) } };
      expect(messageSettingsSubmissionEligibility(changed, f.catalog, f.context, f.selected).allowed).toBe(false);
      expect(messageSettingsSubmissionEligibility(f.value, f.catalog, { ...f.context, profile: changed.profile }, f.selected).allowed).toBe(false);
    }
    expect(messageSettingsSubmissionEligibility(f.value, { ...f.catalog, stale: true }, f.context, f.selected).allowed).toBe(false);
    expect(messageSettingsSubmissionEligibility({ ...f.value, requested: { ...requested, speed: "standard" } }, f.catalog, f.context, f.selected).allowed).toBe(false);
    expect(messageSettingsSubmissionEligibility({ ...f.value, requested: { model: "explicit-model" } } as never, f.catalog, f.context, f.selected).allowed).toBe(false);
  });
  it("preserves a valid empty choice declaration but permits neither omission nor a fabricated tuple", () => {
    const f = ready(); f.source.profile.configuration.turnSettings!.choices = [];
    const selected = versionedSelection(f.source), catalog = { ...f.catalog, profiles: [selected.entry.profile] };
    for (const value of [undefined, f.value]) expect(messageSettingsSubmissionEligibility(value, catalog, f.context, selected)).toMatchObject({ allowed: false, reason: expect.stringContaining("没有可用") });
    expect(f.value.requested).toEqual(requested);
  });
});
