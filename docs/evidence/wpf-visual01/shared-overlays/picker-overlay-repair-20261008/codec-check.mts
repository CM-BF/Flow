import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const executionUrl = "file:///Users/citrine/Projects/AgentHarness/Flow-worktrees/web-shared-overlays/packages/contracts/src/execution-profiles.ts";
const claudeUrl = "file:///Users/citrine/Projects/AgentHarness/Flow-worktrees/web-shared-overlays/packages/contracts/src/claude-turn-settings.ts";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'zod') return nextResolve("file:///Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/.pnpm/zod%404.6.5/node_modules/zod/index.js", context);
  if (specifier === './claude-turn-settings.js' && context.parentURL === executionUrl) return nextResolve(claudeUrl, context);
  return nextResolve(specifier, context);
} });
const { claudeMessageSettingsCatalogEntrySchema } = await import(executionUrl);
const { CLAUDE_TURN_SETTINGS_PROTOCOL } = await import(claudeUrl);
const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const model = "model-" + "x".repeat(174);
const normalModelId = "claude-sonnet";
function entry(number: number, normalModel = false) {
  return claudeMessageSettingsCatalogEntrySchema.parse({
    profile: {
      reference: { id: id(number), runnerId: id(101), configDigest: "a".repeat(64) },
      configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "creation-base", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: "b".repeat(64), limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 }, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [
        { model: number === 1 ? normalModel ? normalModelId : model : "another-profile-model", thinking: "adaptive", effort: { kind: "level", value: "high" }, speed: "standard" },
        { model: "fast-model", thinking: "disabled", effort: { kind: "not-requested" }, speed: "fast" },
      ] } },
      source: "runner-configured", availability: "not-probed", model: { value: "creation-base", resolvedModel: null, displayName: "creation-base", description: "Fixture intent only", providerCapabilities: "unknown" },
      controls: { access: "configured-policy", queue: false, steer: false, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: "configuration.turnSettings.choices" } }, createdAt: "2026-10-06T00:00:00Z",
    }, conversation: { state: "existing-claude-contract", capabilitySource: "conversation-response" },
  });
}


const normal = entry(1, true); const long = entry(1, false);
assert.equal(normal.profile.configuration.turnSettings!.choices[0]!.model, normalModelId);
assert.equal(long.profile.configuration.turnSettings!.choices[0]!.model.length, 180);
const invalid = structuredClone(normal); invalid.profile.configuration.turnSettings!.choices[0]!.model = 'Claude Sonnet';
assert.equal(claudeMessageSettingsCatalogEntrySchema.safeParse(invalid).success, false);
console.log(JSON.stringify({publicCodec: true, normalAccepted: true, long180Accepted: true, priorIllegalDisplayNameRejected: true}));
