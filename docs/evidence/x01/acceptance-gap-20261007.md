# X01 acceptance gap check — 2026-10-07

Bounded metadata/read-only check began10:41:57Z; no new test, PG or product edit. Canonical plan remains plans/x01-plugin-management. Frozen main observation2f32f6b27fc79151cd1e9d26e7fb5af70a791505 was clean. Current source and receipt reads are distinguished from dated historical status. New actual process result997f7d44/packet ea642cff independently approved10:42:21; original records remain unchanged.

## Original TODO mapping

| Original item | Established evidence | Remaining acceptance | State |
|---|---|---|---|
| X01-02 public contracts/client | Registry versions/config/grants/audit; installed material;034 enable/disable/frozen binding; v3 current-capability claim; provenance; trusted startup; owner CLI runtime/admit/binding now mainb675 | Complete removal/reference policy, full extension categories and lifecycle consistent public projections; configure/grant strict ACK follow-up is a separate db-owner slice | in-progress |
| X01-03 center persistence/commands | Real27 domain cases,6 claim SQL/HTTP,5 artifact transaction cases; CAS, replay, current-grant/attempt fences; actual center restart keeps registered runner and material authority | Full upgrade/rollback/removal and Web/CLI concurrent lifecycle matrix; no inference that every operation/recovery variant is complete | in-progress |
| X01-04 trusted npm/active pin | Real semver7.8.5/ISC controlled bundle; material prepare/read/import/invoke; two Flow wrapper material versions; public task chain and now two actual runner processes | Upstream package-version upgrade identity, A-v1/B-v2/rollback-C-v1 under real center and config changes; active references/removal semantics; broader config adaptation | in-progress |
| X01-05 third-party isolation | Explicit operator trust, strict store/digest, bounded package contents, separate center from package execution; unknowns fail closed | No hostile third-party process/container or renderer isolation; no independent filesystem/network/DOM capability barrier proof | pending |
| X01-06 product management | Web registry/local browser extensions read view already main; owner CLI config/grant/fetch/install and new runtime/enable/admit/binding available; latest process journey exercised four new CLI methods over real HTTP | Web still hardcodes runtime unavailable and has no lifecycle write controls; TUI management not evidenced; complete install→configure/grant→enable→task→disable→upgrade/rollback→remove journey and UX matrix missing | in-progress |
| X01-07 concrete extensions | Public enable→frozen binding→real runRunner/semver→sourced artifact/verification; genuine server/runner main startup and clean post-ACK restart now independently proved | Renderer and independently pluggable verifier example, upstream upgrade identity and full version-change acceptance; actual operator-trusted code is not unknown-third-party isolation | in-progress |
| X01-08 context interface | CTX01 fixed core experiment mainc56fc9a:3 behavior cases/60 samples, no model; existing context/lineage facilities are inputs | Production plugin context interface, unique compression-owner lifecycle, source invalidation/restore/fork matrix not established by core experiment | pending |
| X01-09 candidate compatibility | Fixed candidate study/core experiment exists, avoids fabricating upstream scale/performance claims | Exact intended candidate identity and Pi/proxy/real harness/export/migration/corrupt-store matrix remain independent | pending |
| X01-10 overall integration/review | Multiple narrow slices independently reviewed and main receipts exist; latest process actual approved; not one unreviewed WIP bundle | Full remaining X01-03–08 acceptance, UI/TUI lifecycle and security scope still missing; candidate09 does not block general integration | pending |

None of X01-02–10 qualifies for completed merely from this1/1. X01-01 stays completed. “No public runRunner caller / CLI does not exist” is obsolete for the trusted tool slice, not a reason to weaken outstanding full-lifecycle requirements.

## Original matrix mapping

| Matrix row | Current boundary |
|---|---|
| Persistence / one authority | Real public CLI and two center starts verified; Web equivalent writes and all state classes across restart still open |
| Concurrency / authentication | Domain/claim/event actual evidence exists; full enable/disable/upgrade concurrent UI matrix not complete |
| Active version | Material-pin local and completed old task unchanged on actual clean restart verified; A-v1/B-v2/C-v1 real upgrade/rollback plus configuration/revocation acceptance missing |
| Disable / removal / effects | New-binding disable, current phase gates and unknown ACK protection exist; physical removal/ref-blocking and complete retained-effect reconciliation remain open |
| Isolation / privacy | Operator-private configuration and trusted package only; no third-party isolation/privacy adversarial acceptance |
| Actual extensions | Real npm tool and built-in flow.text verification proved; renderer/independent verifier version evidence remains open |
| Existing npm reuse | Actual semver7.8.5 source/license/build/material/runtime source association proved; upstream registry tar authentication and upstream version upgrade are separate unproved scopes |
| Web/CLI journey | CLI management subset real HTTP now proved; Web/TUI full lifecycle and themes/keyboard/ongoing-error UX for new writes missing |
| Context | Experimental core does not substitute production compression owner, lineage or candidate integration |

## Next smallest user-facing candidate

**Show truthful plugin runtime readiness in the existing Web management detail, then expose explicit enable/disable for an already installed trusted material through the existing commands.** First stable deliverable may be only truthful runtime/disabled/stale-grant state with cancellation and error states; do not combine a six-operation UI rewrite. Current main PluginManagement.tsx:59/87 always says runtime unavailable although the backend is now capable, and its reader only receives four registry methods. Public pluginRuntime/commandPluginRuntime already exist in main; use them, no second state authority, runner-trust editor or browser package execution.

Exact candidate paths: existing apps/web/src/plugin-management/PluginManagement.tsx; new apps/web/src/plugin-management/runtime-state.ts and runtime-state.test.ts (or existing use-read direct consumer when adequate); existing apps/web/test/plugin-management/browser.ts; minimal apps/web/src/App.tsx reader injection. No client contract/index change is needed for the first read projection. For write controls, retain stable key/exact revision/payload on UNKNOWN, never claim disable reverses past side effects.

Fresh ledger10:42:32: X01 architecture_read v24 still holds the first existing component and browser test; these require explicit STOP→partial amend→new Web owner take if delegated. App.tsx is WPF-RECOVERY01 / external_web_d01_owner / workspace_panels_owner v4, so its small injection must be coordinated without touching recovery state. X01-PLUGIN-COMMAND-ACK01 / db_transaction_owner v1 currently holds client/index and plugin-management; do not take it or duplicate its strict ACK work. TUI01F owns task-controls only; this is not permission to assume a TUI plugin manager exists. Scope for the new Web leaf is proposed, not claimed or assigned by this document.

Independent alternative if Web scope is occupied: a real-center trusted upgrade/rollback pin matrix using current register-version/select-version/install/enable interfaces, fixed two-material inputs and old-task result/report-only recovery. It would directly close the A/B/C identity gap, not call two wrappers of the same upstream bundle an npm upstream upgrade. No new runtime scheduler, install policy broadening, provider or untrusted-code loading is authorized by this audit.

Applied local find-skills→codebase-design/clean-code: single domain authority, bounded lazy read, explicit current-vs-historical state, small real consumer interface, no speculative framework. Skills reused from /Users/citrine/.agents/skills; clean-code sickn33 fixed baseline. Architecture diagram main baseline is unchanged by this metadata-only acceptance map; future Web reader/command edge must be registered by its eventual owner.

10:46:23.929Z new confirmed handoff: X01 STOP→amend v24→v25 removed only PluginManagement.tsx and browser.ts; canonical web-runtime-handback-receipt.json. Web ready owner may fresh take without App.tsx change; original App suggestion above is only one candidate and does not impose a new dependency. Audit source/read phase ended 2026-10-07T10:47:17.625248+00:00; no new engineering execution.
