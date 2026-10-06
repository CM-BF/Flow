import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { FlowApiError, FlowClient } from "@flow/client";
import {
  CLAUDE_TURN_SETTINGS_PROTOCOL, EXECUTION_PROFILE_HEADER,
  claudeMessageSettingsCatalogEntrySchema, claudeTurnSettingsSchema,
  type ClaudeMessageSettingsCatalogPage, type ClaudeTurnSettings,
} from "@flow/contracts";
import { createMessageSettingsCatalog, type MessageSettingsCatalogSnapshot } from "../src/execution-profiles/catalog";
import {
  captureMessageSettings, messageSettingsAvailability, readDirectoryProfile,
  readMessageSettingsProfile, sameMessageSettings, type MessageSettingsContext,
} from "../src/execution-profiles/selection";

import { beginMessageSettingsEdit, commitMessageSettingsChange, type MessageSettingsDraftAuthority, type MessageSettingsDraftOwnership, type MessageSettingsPickerProps } from "../src/execution-profiles/ExecutionProfilePicker";
import type { Immutable } from "../src/execution-profiles/selection";

const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const basic: ClaudeTurnSettings["requested"] = { model: "requested-model", thinking: "adaptive", effort: { kind: "level", value: "high" }, speed: "standard" };
function entry(number = 1) {
  return claudeMessageSettingsCatalogEntrySchema.parse({
    profile: {
      reference: { id: id(number), runnerId: id(101), configDigest: "a".repeat(64) },
      configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "creation-base", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: "b".repeat(64), limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 }, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [basic, { ...basic, effort: { kind: "not-requested" }, speed: "fast" }] } },
      source: "runner-configured", availability: "not-probed", model: { value: "creation-base", resolvedModel: null, displayName: "creation-base", description: "Test configuration", providerCapabilities: "unknown" },
      controls: { access: "configured-policy", queue: false, steer: false, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: "configuration.turnSettings.choices" } }, createdAt: "2026-10-06T00:00:00Z",
    },
    conversation: { state: "existing-claude-contract", capabilitySource: "conversation-response" },
  });
}
function page(number = 1, more = false): ClaudeMessageSettingsCatalogPage {
  return { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profiles: [entry(number)], nextCursor: more ? id(number) : null };
}
function setup() {
  const profile = readMessageSettingsProfile(entry());
  const catalog: MessageSettingsCatalogSnapshot = { profiles: [profile], nextCursor: null, loaded: true, loading: false, error: null, stale: false, canLoadMore: false };
  const context: MessageSettingsContext = { profile: profile.reference, capability: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: profile.reference, choices: "execution-profile" } };
  const value = claudeTurnSettingsSchema.parse({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: profile.reference, requested: basic });
  return { catalog, context, value };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const closes: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const close of closes.splice(0).reverse()) await close(); });

it("uses the public opt-in FlowClient method for explicit bounded pages, never a legacy fallback", async () => {
  const requests: { url: string; protocol: string | string[] | undefined }[] = [];
  let malformed = false;
  const server = createServer((request, response) => {
    requests.push({ url: request.url!, protocol: request.headers[EXECUTION_PROFILE_HEADER.toLowerCase()] });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(malformed ? { profiles: [entry().profile], nextCursor: null } : page(request.url!.includes("after=") ? 2 : 1, !request.url!.includes("after="))));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  closes.push(() => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }));
  const address = server.address(); if (!address || typeof address === "string") throw Error("No fixture address");
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: "fixture-only" });
  const catalog = createMessageSettingsCatalog((options, signal) => client.claudeMessageSettingsProfiles(options, signal)); closes.push(catalog.dispose);
  expect(requests).toEqual([]); await catalog.loadMore(); expect(requests).toEqual([]);
  await catalog.refresh(); await Promise.all([catalog.loadMore(), catalog.loadMore()]);
  expect(requests).toEqual([{ url: "/api/execution-profiles?limit=20", protocol: CLAUDE_TURN_SETTINGS_PROTOCOL }, { url: `/api/execution-profiles?after=${id(1)}&limit=20`, protocol: CLAUDE_TURN_SETTINGS_PROTOCOL }]);
  expect(catalog.getSnapshot().profiles).toHaveLength(2);
  malformed = true; await catalog.refresh();
  expect(requests).toHaveLength(3); expect(catalog.getSnapshot()).toMatchObject({ stale: true, loaded: true });
  expect(catalog.getSnapshot().profiles).toHaveLength(2);
});

it("keeps a stable immutable snapshot and subscriptions until an actual update", async () => {
  const catalog = createMessageSettingsCatalog(async () => page()); closes.push(catalog.dispose);
  const first = catalog.getSnapshot(), subscribe = catalog.subscribe; let notices = 0;
  const unsubscribe = subscribe(() => notices++);
  expect(catalog.getSnapshot()).toBe(first); expect(catalog.subscribe).toBe(subscribe);
  await catalog.refresh(); expect(notices).toBe(2);
  const profile = catalog.getSnapshot().profiles[0]!;
  expect(Object.isFrozen(profile.configuration.turnSettings?.choices[0]?.effort)).toBe(true);
  expect(Reflect.set(profile.configuration, "model", "changed")).toBe(false);
  unsubscribe(); await catalog.refresh(); expect(notices).toBe(2);
});

it("retains stale pages/selection on access failure, and only explicit refresh recovers", async () => {
  let fail = false; const catalog = createMessageSettingsCatalog(async () => { if (fail) throw new FlowApiError(401, "unauthorized", "private message"); return page(); }); closes.push(catalog.dispose);
  await catalog.refresh(); const { context, value } = setup(); const frozen = captureMessageSettings(value, catalog.getSnapshot(), context);
  fail = true; await catalog.refresh();
  expect(catalog.getSnapshot().error).toContain("Access expired"); expect(catalog.getSnapshot().error).not.toContain("private message");
  expect(() => captureMessageSettings(value, catalog.getSnapshot(), context)).toThrow(/刷新/);
  expect(frozen?.requested.model).toBe("requested-model"); fail = false; await catalog.refresh();
  expect(captureMessageSettings(value, catalog.getSnapshot(), context)).toEqual(frozen);
});

it("keeps failed append retryable, but failed head refresh fences stale append", async () => {
  let calls = 0; const catalog = createMessageSettingsCatalog(async ({ after } = {}) => {
    calls++; if (calls === 2 || calls === 4) throw Error("unavailable"); return page(after ? 2 : 1, !after);
  }); closes.push(catalog.dispose);
  await catalog.refresh(); await catalog.loadMore(); expect(catalog.getSnapshot().canLoadMore).toBe(true);
  await catalog.loadMore(); expect(catalog.getSnapshot().profiles).toHaveLength(2);
  await catalog.refresh(); await catalog.loadMore(); expect(calls).toBe(4); expect(catalog.getSnapshot().canLoadMore).toBe(false);
});

it.each(["duplicate", "cursor", "backward", "over-limit"])("rejects an invalid %s page without exposing part of it", async kind => {
  let first = true; const catalog = createMessageSettingsCatalog(async () => {
    if (first) { first = false; return page(2, true); }
    if (kind === "duplicate") return { ...page(3), profiles: [entry(3), entry(3)] };
    if (kind === "cursor") return { ...page(3), nextCursor: id(4) };
    if (kind === "over-limit") return { ...page(3), profiles: Array.from({ length: 21 }, (_, index) => entry(index + 3)) };
    return page(1);
  }); closes.push(catalog.dispose);
  await catalog.refresh(); await catalog.loadMore();
  expect(catalog.getSnapshot().error).toBeTruthy(); expect(catalog.getSnapshot().profiles.map(item => item.reference.id)).toEqual([id(2)]);
});

it("fences ignored aborts and isolates a disposed connection from another catalog", async () => {
  const old = deferred<ClaudeMessageSettingsCatalogPage>(); let calls = 0; let signal: AbortSignal | undefined;
  const catalog = createMessageSettingsCatalog(async (_, nextSignal) => { if (++calls === 1) { signal = nextSignal; return old.promise; } return page(2); });
  const pending = catalog.refresh(); await catalog.refresh(); expect(signal?.aborted).toBe(true);
  const other = createMessageSettingsCatalog(async () => page(3)); closes.push(other.dispose);
  catalog.dispose(); await other.refresh(); old.resolve(page()); await pending; await catalog.refresh();
  expect(catalog.getSnapshot().profiles).toHaveLength(0); expect(other.getSnapshot().profiles[0]!.reference.id).toBe(id(3)); expect(calls).toBe(2);
});

it("captures the requested model and complete tuple as a detached immutable public snapshot", () => {
  const { value, catalog, context } = setup(); const frozen = captureMessageSettings(value, catalog, context)!;
  value.requested.model = "later-draft"; value.profile.id = id(9);
  expect(frozen.requested.model).toBe("requested-model"); expect(frozen.requested.model).not.toBe(catalog.profiles[0]!.configuration.model);
  expect(Object.isFrozen(frozen.requested.effort)).toBe(true); expect(Reflect.set(frozen.profile, "id", id(8))).toBe(false);
  expect(frozen.profile.id).toBe(id(1));
});

it("keeps absence distinct from explicit not-requested and rejects unconfigured cross-products", () => {
  const { value, catalog, context } = setup(); expect(captureMessageSettings(undefined, catalog, { profile: null, capability: null })).toBeUndefined();
  const explicit = { ...value, requested: { ...value.requested, effort: { kind: "not-requested" as const }, speed: "fast" as const } };
  expect(captureMessageSettings(explicit, catalog, context)?.requested.effort).toEqual({ kind: "not-requested" });
  expect(() => captureMessageSettings({ ...explicit, requested: { ...explicit.requested, speed: "standard" } }, catalog, context)).toThrow(/完整组合/);
  expect(sameMessageSettings(undefined, explicit)).toBe(false); expect(sameMessageSettings(explicit, structuredClone(explicit))).toBe(true);
});

it.each(["id", "runnerId", "configDigest"] as const)("requires exact %s in both capability and submitted identity", field => {
  const { value, catalog, context } = setup(); const different = { ...value.profile, [field]: field === "configDigest" ? "c".repeat(64) : id(9) };
  expect(() => captureMessageSettings(value, catalog, { ...context, capability: { ...context.capability!, profile: different } })).toThrow(/身份/);
  expect(() => captureMessageSettings({ ...value, profile: different }, catalog, context)).toThrow(/完整组合/);
});

it("rejects missing capability, unavailable pages and empty choices without clearing caller-owned values", () => {
  const { value, catalog, context } = setup();
  expect(() => captureMessageSettings(value, catalog, { ...context, capability: null })).toThrow(/能力/);
  expect(() => captureMessageSettings(value, { ...catalog, profiles: [] }, context)).toThrow(/没有会话/);
  const empty = entry(); empty.profile.configuration.turnSettings!.choices = [];
  expect(messageSettingsAvailability({ ...catalog, profiles: [readMessageSettingsProfile(empty)] }, context)).toMatchObject({ allowed: false });
  expect(value.requested.model).toBe("requested-model");
});

it("does not route message-settings profiles through the unchanged legacy creation controls", () => {
  expect(() => readDirectoryProfile(entry().profile)).toThrow(/Invalid execution profile/);
  const invalid = entry(); invalid.profile.configuration.activeSteering = { protocol: "flow.active-steering.v1" };
  expect(() => readMessageSettingsProfile(invalid)).toThrow();
});

// The exact opening and synchronous host commit seams used by the rendered Picker/fixture, not a mock restore.
function controlledHost() {
  const initial = setup();
  let authority: MessageSettingsDraftAuthority = { ...initial, ownership: Symbol("draft one"), editable: true };
  let applied: Immutable<ClaudeTurnSettings> | undefined = initial.value;
  let writes = 0, callbacks = 0;
  let rendered: Pick<MessageSettingsPickerProps, "catalog" | "context" | "value" | "draftOwnership" | "editable" | "onChange"> = { ...initial, value: applied, draftOwnership: authority.ownership, editable: true, onChange };
  function onChange(next: Immutable<ClaudeTurnSettings> | undefined, expected: MessageSettingsDraftOwnership) {
    callbacks++;
    return commitMessageSettingsChange(next, expected, () => authority, frozen => { applied = frozen; writes++; });
  }
  return {
    initial, open: () => beginMessageSettingsEdit(() => rendered),
    authority: (update: Partial<MessageSettingsDraftAuthority>) => { authority = { ...authority, ...update }; },
    publish: () => { rendered = { catalog: authority.catalog, context: authority.context, value: applied, draftOwnership: authority.ownership, editable: authority.editable, onChange }; },
    replaceValue: (value: Immutable<ClaudeTurnSettings> | undefined) => { applied = value; },
    get: () => ({ applied, writes, callbacks, authority }),
  };
}

it.each(["apply", "omit"] as const)("host CAS rejects %s from lagging props even when the new draft has the identical tuple", kind => {
  const host = controlledHost(), edit = host.open(), before = host.get().applied;
  host.authority({ ownership: Symbol("same tuple, different draft") }); // Deliberately no publish; old React props still look valid.
  expect(edit.apply(kind === "omit" ? undefined : host.initial.value)).toEqual({ status: "stale" });
  expect(host.get()).toMatchObject({ writes: 0, callbacks: 1, applied: before });
});

it.each(["close", "cancel", "details navigation", "unmount"])("revokes old Apply and omit after %s even without a new host token", () => {
  const host = controlledHost(), first = host.open();
  const oldApply = first.apply;
  first.close();
  const second = host.open();
  expect(oldApply(undefined)).toEqual({ status: "stale" });
  expect(oldApply(host.initial.value)).toEqual({ status: "stale" });
  expect(host.get()).toMatchObject({ writes: 0, callbacks: 0 });
  expect(second.apply(host.initial.value)).toEqual({ status: "applied" });
  expect(host.get().writes).toBe(1);
});

it("consumes an opening before a reentrant host callback and allows exactly one synchronous write", () => {
  const { catalog, context, value } = setup(), ownership = Symbol("draft"); let writes = 0;
  let edit!: ReturnType<typeof beginMessageSettingsEdit>;
  edit = beginMessageSettingsEdit(() => ({ catalog, context, value, draftOwnership: ownership, editable: true,
    onChange(next, expected) {
      expect(edit.apply(undefined)).toEqual({ status: "stale" });
      return commitMessageSettingsChange(next, expected, () => ({ ownership, editable: true, catalog, context }), () => { writes++; });
    },
  }));
  expect(edit.apply(value)).toEqual({ status: "applied" });
  expect(edit.apply(undefined)).toEqual({ status: "stale" }); expect(writes).toBe(1);
});

it("checks live edit authority for explicit omit, and live capability/full tuple for a defined selection", () => {
  const omit = controlledHost(); omit.authority({ editable: false });
  expect(omit.open().apply(undefined)).toEqual({ status: "unavailable" }); expect(omit.get().writes).toBe(0);
  const defined = controlledHost(); defined.authority({ context: { ...defined.initial.context, capability: null } });
  expect(defined.open().apply(defined.initial.value)).toEqual({ status: "unavailable" }); expect(defined.get().writes).toBe(0);
  // Removing a settings request still works on an editable old-center draft; it is not a capability grant.
  const oldCenter = controlledHost(); oldCenter.authority({ context: { profile: null, capability: null } });
  expect(oldCenter.open().apply(undefined)).toEqual({ status: "applied" }); expect(oldCenter.get().applied).toBeUndefined();
});

it("never resurrects an opening after revoke/restore with the same token and same tuple", () => {
  const host = controlledHost(), edit = host.open();
  host.authority({ context: { ...host.initial.context, capability: null } }); host.publish(); expect(edit.reconcile()).toBe(false);
  host.authority({ context: host.initial.context }); host.publish();
  expect(edit.apply(host.initial.value)).toEqual({ status: "stale" }); expect(host.get().callbacks).toBe(0);
  expect(host.open().apply(host.initial.value)).toEqual({ status: "applied" });
});

it("fences an externally changed controlled value, a new view and independent pane tokens", () => {
  const host = controlledHost(), old = host.open(); host.replaceValue(undefined); host.publish();
  expect(old.apply(host.initial.value)).toEqual({ status: "stale" }); expect(host.get().writes).toBe(0);
  const paneA = controlledHost(), paneB = controlledHost(), expected = paneA.get().authority.ownership;
  expect(commitMessageSettingsChange(paneA.initial.value, expected, () => paneB.get().authority, () => { throw Error("wrong pane write"); })).toEqual({ status: "stale" });
  const viewEdit = paneA.open(); paneA.authority({ ownership: Symbol("another view") }); paneA.publish();
  expect(viewEdit.apply(undefined)).toEqual({ status: "stale" });
});

it("revalidates pages at commit without clearing C or losing a valid candidate on unrelated pagination", () => {
  const host = controlledHost(), edit = host.open(), before = host.get().applied;
  host.authority({ catalog: { ...host.initial.catalog, profiles: [...host.initial.catalog.profiles, readMessageSettingsProfile(entry(2))] } }); host.publish();
  expect(edit.reconcile()).toBe(true); expect(edit.apply(host.initial.value)).toEqual({ status: "applied" });
  const next = host.open(); host.authority({ catalog: { ...host.initial.catalog, stale: true, error: "offline" } });
  expect(next.apply(host.initial.value)).toEqual({ status: "unavailable" });
  expect(host.get().writes).toBe(1); expect(host.get().applied).toEqual(before);
  expect(Object.isFrozen(host.get().applied?.requested.effort)).toBe(true);
});

it("reports an ambiguous host throw after a write without claiming the draft is untouched or retrying", () => {
  const { catalog, context, value } = setup(), ownership = Symbol("draft"); let writes = 0; let applied: Immutable<ClaudeTurnSettings> | undefined;
  const edit = beginMessageSettingsEdit(() => ({ catalog, context, value, draftOwnership: ownership, editable: true,
    onChange(next, expected) { return commitMessageSettingsChange(next, expected, () => ({ catalog, context, ownership, editable: true }), frozen => { applied = frozen; writes++; throw Error("subscriber failed after write"); }); },
  }));
  expect(edit.apply(value)).toEqual({ status: "unknown" }); expect(applied).toEqual(value);
  expect(edit.apply(undefined)).toEqual({ status: "stale" }); expect(writes).toBe(1);
});

it("a retained details callback cannot navigate or revoke a later opening with the same draft token", () => {
  const host = controlledHost(), old = host.open(); let navigations = 0;
  const oldNavigation = old.navigate; old.close(); const current = host.open();
  expect(oldNavigation(() => { navigations++; current.close(); })).toBe(false);
  expect(navigations).toBe(0); expect(current.isActive()).toBe(true);
  expect(current.navigate(() => { navigations++; })).toBe(true);
  expect(current.apply(undefined)).toEqual({ status: "stale" }); expect(host.get().writes).toBe(0); expect(navigations).toBe(1);
});
