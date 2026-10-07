# X01 production runner connection — exact handoff

## Current handoff order — 2026-10-07T08:24Z

This dated section supersedes historical ownership/status below; no new write authority or execution window is granted. Main `2a7e004b5ab7ceb2e44903af92aaf251cdda0e8a` contains P02 `f5a13cbe`, plus X01 semver/pinning. Provenance remains the exact six-source narrow intake; its5/5 PG result is independently approved, not public runRunner completion.

1. P02 integration alone does not transfer runtime/server/client/contract exports. Fresh ledger now shows former CHAT05P02 claim `f51cc458-ced9-48ff-a033-97f42483dcf4` v5 RELEASED at2026-10-07T08:20:34.511Z. No formal stopped-writing handback receipt has yet been received by X01 in this segment, and X01 has not amended these literals. Obtain/verify that receipt and current ownership before any writes.
2. X01 coordinates the next exact `apps/runner/src/runtime.ts` and `apps/server/src/index.ts` integration slice after the formal handback and atomic claim amendment; keep P02 body publication/outbox/read routes and existing Codable/Claude behavior. Reuse the single runtime, admission journal, AttemptControl and EventOutbox; no unconsumed helper or second client/runner.
3. `packages/client/src/index.ts` goes first to LAZY for its small direct consumer change. After its stable main intake, explicit STOP plus current-version atomic scope removal, X01 can claim that literal. Never claim/write it simultaneously. Contract-index exports require their own fresh exact owner coordination as well.
4. X01 already holds four startup literals `configuration.ts`, `configuration.test.ts`, `main.ts`, `main-concurrency.test.ts` under `apps/runner/src/` via C02's formal handback. They are scope preparation only: verify latest main/interface and bounded source intake before implementation; do not create idle helpers simply because these paths are available.

The transport/runtime requirements below remain the concrete next interface; old claim-v4/C02-v15 statements are historical. New sender must use a paired current plugin capability: older strict centers reject pluginSource, and persisted events may not be stripped/reformatted on retry. The six-source main intake verifies provenance association, not independent proof of npm execution.


Read-only main baseline `3e4362b08359433620a07b05bd034a25e2dd7c4b` at 2026-10-07T07:27Z. This is an implementation request within the existing X01 plan, not a second runner/client or a claim transfer.

Already main: frozen plugin binding/phase grant Module, current v3 center allocation and compact receipts, v3 AdmissionJournal, `executePluginTool`, trusted package store/host. Current `runRunner` still calls v2 `claimOpportunity`/`status` and `journal.opportunity`; it never calls `executePluginTool`. FlowClient has no plugin publication/grant/v3 methods. Server has v3 claim routes but has not mounted plugin runtime management/admission routes. Artifact wire currently has no typed plugin provenance. Real semver input is the separately reviewed source `4fc60b4c`; its injected authorization tests do not close these gaps.

## Small next production slice

1. `packages/client/src/index.ts`: keep the existing authenticated `request` implementation; add methods `pluginClaimOpportunity(input, signal)` and `pluginClaimOpportunityStatus(input, signal)` using the existing `PluginRunnerClaimRequest` and `decodePluginRunnerClaimResponse` with the correct operation. Parse/detach before the first await; no retry or key generation in transport. Add thin `publishPluginHost` and `authorizePluginPhase(input, key, signal)` on the existing routes. Unknown mutation acknowledgement must remain distinguishable from an explicit HTTP refusal; invalid/mismatched/replayed grant ACK cannot authorize code execution. No new fetch client.
2. `apps/runner/src/runtime.ts`: explicit trusted plugin port/store opt-in jointly selects v3 transport and `journal.bindRunner(runnerId, qualification)` / `journal.pluginOpportunity`; persisted v2 remains v2 and missing/mismatched v3 capability blocks. Keep the same loop, wakeup, request draining, capacity bound, AttemptControl and EventOutbox. When assignment has a validated binding call `executePluginTool` before the ordinary adapter branch, then emit its artifact and verification through the existing outbox. Grant keys derive deterministically from binding/invocation/attempt/ownerVersion/phase. `PluginExecutionUnsettled` keeps admission and never emits completed or retries import/invoke. Old unresolved journal entries do not restart adapters.
3. `packages/contracts/src/index.ts`: only additive exports of already reviewed plugin claim/runtime types when the real client consumer lands. Existing v2 defaults and codecs remain byte/behavior compatible.

These three literal files are held by CHAT05P02 claim `f51cc458-ced9-48ff-a033-97f42483dcf4` v4 at the fresh ledger read. X01 requests only an explicit stopped-writing/atomic partial handback after its current slice intake, or the owner applying coordinated small delegates. X01 has not claimed or edited them. Avoid a parallel unconsumed transport helper solely to bypass that ownership.

## Following necessary connections

- `apps/runner/src/configuration.ts` and `apps/runner/src/main.ts` remain C02-owned (`8ad6536b…` v15): operator-controlled store and exact digest trust produce current capability, publish host before admission, and pass the port to the existing runtime. A historical publication is not current process execution capability. No public path/config may self-authorize.
- `apps/server/src/index.ts` remains CHAT05P02-owned after X01 v12 handback: mount existing plugin runtime routes only with explicit trusted publication policy and compatible runtime/recovery. No default open policy.
- `packages/contracts/src/runner.ts` and `apps/server/src/events.ts`: bounded typed provenance from execution must be verified against the frozen binding inside the existing report transaction, then stored as the artifact's source reference. Existing text alone must not be presented as this provenance guarantee. Fresh ownership is required before taking these paths.
- `apps/server/src/reconciliation.ts`: prevent generic recovery submissions from silently dropping an immutable plugin binding into fixture execution. Scope and current implementation need a narrow review at that actual integration step.

Direct acceptance for the shared slice: default v2 unchanged; current store mismatch/port removed blocks persisted v3 key; unknown claim/status/phase ACK retains the original identity; assigned journal persists before the real package action; load and invoke each get current exact authorization; real semver artifact+flow.text only after ACK; unsettle/cancel-after-import cannot claim completed. Public enable/disable and production provenance require the later server/event connections. No PG/native/provider was run for this map.

## Independent work while shared paths are occupied

`semver-pinning.test.ts` exercises the existing real package/material/loader Interface. Build two controlled **Flow wrapper** releases `1.0.0`/`1.0.1` with identical fixed npm semver7.8.5 bytes; freeze an invocation before installing the second material, then call both and verify exact separate receipts/provenance. Check mixed material tuple rejection and removal of current operator digest trust. This is not an upstream semver version upgrade or a center disable/revision test. No algorithm copy, new production helper, runtime, authorization authority or schema change.

Local plan: 3 new direct cases, two real tar children, focused noEmit, at most 4 top-level commands each 60s within 20min; 16MiB owned TMP, 256KiB raw, 1MiB source/metadata; nonspendable reserve and actual peer budget checked before starting. Original semver9/old27/6PG remain untouched. Lifecycle uses fixed OPS14 and existing X01 sampling/cleanup; no new supervisor.
