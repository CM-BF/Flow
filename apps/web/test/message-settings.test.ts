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
