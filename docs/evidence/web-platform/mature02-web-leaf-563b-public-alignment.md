# MATURE02 Web leaf: fixed public input alignment
Read-only follow-up to /tmp/mature02-web-leaf-65659028/report.md and the four-file readback supplement. No project writes, worktree/claim, import, test, HTTP, resource sampling or installation. Reused the already recorded local find-skills/codebase-design/clean-code/assistant-ui methods. Only three source paths inspected.

Fixed source: 563b1ea151d8d26a2100238d8faf26b697f38d71
Manifest metadata: a23883fbc595564dcb66e0030b430674b896574e
Manifest: docs/evidence/mature02c01/fixed-manifest.json
Manifest SHA256: 23347f1107af75427b0dd1ca269e4bdc2e31b5744437df761057a4b036f2bca8
Manifest records 9 source / 59 protected files, owner 86 distinct checks and focused types; I did not repeat those checks or audit all 68 files. Independent assignment approval/main acceptance remains pending per dispatch. This removes an interface-name uncertainty, not the integration/claim gate.

## Exact reader and imports
packages/client/src/index.ts:381–386 provides:
`claudeMessageSettingsProfiles(options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<ClaudeMessageSettingsCatalogPage>`.
It serializes after/limit, uses the existing request authority at /api/execution-profiles, supplies EXECUTION_PROFILE_HEADER=CLAUDE_TURN_SETTINGS_PROTOCOL and parses with claudeMessageSettingsCatalogPageSchema. Leaf must not issue its own fetch/header, infer the old catalog protocol, or downgrade errors into the old catalog.

Use `import type { FlowClient } from '@flow/client'`. A private reader can be `FlowClient['claudeMessageSettingsProfiles']`; bind with `(options, signal) => client.claudeMessageSettingsProfiles(options, signal)` to preserve this/connection authority. Do not pass an unbound instance method. `Awaited<ReturnType<FlowClient['claudeMessageSettingsProfiles']>>` is an exact public-derived page type when useful, not a handwritten wire DTO. The actual named page/schema are imported by the fixed client from @flow/contracts (:7); contracts index:14 retains execution-profiles exports.

From `@flow/contracts`, consume `ClaudeTurnSettings`, `ClaudeTurnSettingsPolicy`, `ClaudeTurnSettingsDecision`, `claudeTurnSettingsSchema`, `checkClaudeTurnSettingsAllowed` and `CLAUDE_TURN_SETTINGS_PROTOCOL` as needed. contracts index:40 now publicly exports claude-turn-settings. Its protected leaf hash equals CORE ea276. The request remains protocol/profile/requested, not a wrapper invented by Web. If a local choice type is needed, derive `ClaudeTurnSettings['requested']`; do not create a second schema/union.

## Preserve the approved leaf boundary
Catalog/selection/UI uses its own bounded page instance with the real reader above, abort/generation protection and published complete tuples. No new HTTP layer, draft journal or command state machine. Picker selection is controlled and captures the full requested tuple plus exact profile reference; configured profile.model is not the selected message model. The public helper (:58–67) preserves missing policy=unknown, profile mismatch, unconfigured combination, and allowed; allowed means configured tuple, never provider entitlement or observed SDK behavior. 0 choices does not create defaults. Invalid known fields throw, not silently downgrade. Reuse the existing authorized controller lifecycle; connection/permission change invalidates reader callbacks.

The eight candidate literals remain unchanged:
- apps/web/src/execution-profiles/catalog.ts
- apps/web/src/execution-profiles/selection.ts
- apps/web/src/execution-profiles/ExecutionProfilePicker.tsx
- apps/web/test/message-settings.test.ts
- apps/web/test/message-settings.fixture.tsx
- apps/web/test/message-settings.browser.ts
- plans/wpf-message-settings
- docs/evidence/wpf-message-settings

WPF-MESSAGESETTINGS01 remains the proposed direct child of WPF-MATURE-02, subject to manager's unique registration/fresh take. This readback does not create it. Manager owns exact new base/controlled input preparation; do not merge the entire client branch or consume a moving checkout.

Necessary leaf verification stays bounded: actual public-client mock transport + exact new protocol/schema; all published tuple dimensions, zero choices, malformed response, stale pages/connection, explicit selection only, keyboard/390/dark fixture. These are future tests, not passed here. App/ConversationThread/outbox/queue/projection/Recovery and requested-vs-observed readback are still later serialized integration, outside eight literals. Shared ACK decoder remains the only ACK authority; this leaf must not copy it. No full feature/actual App capability claim.

## Three read source hashes
packages/client/src/index.ts 6355ed6f114a7b01833a03488ed4b0c59fb9ebd91f88acedffcd4051834bbee5
packages/contracts/src/index.ts d62739a19e76a0f65effacb34d4e1b0d2d7d5fd90bf32fd2e2bcb1ef79351384
packages/contracts/src/claude-turn-settings.ts 646cd6d72d7a5cdace16209075ab7c2538c9ee7555a89b78b601a81933f681fd
