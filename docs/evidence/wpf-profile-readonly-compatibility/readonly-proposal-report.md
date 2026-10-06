# Narrow readonly profile selection proposal

Fixed input `4015c667f1e2b833755b2fda6ed205fb951ec576` on codex/m2-integration. Read-only/source-only proposal; **NOT_RUN**: no project writes, WT creation, import, types/tests, browser/PG, install, resource sample or service use. Existing find-skills / clean-code / codebase-design methods reused.

## Root cause and one-line repair

`apps/web/src/execution-profiles/selection.ts:64`: change only the parameter from `DirectoryProfile` to `Immutable<DirectoryProfile>`. Keep the return type and body unchanged. Mutable DirectoryProfile remains assignable to a readonly view; existing deep-readonly DirectoryProfile and ChatProfile become valid inputs without copying at call sites or adding overload/union/any/casts. Changing to `unknown` would also reach the runtime parser, but unnecessarily broadens the typed caller surface; the existing Immutable type is the narrower fix. No shallow Readonly, because the incompatible field is nested `configuration.turnSettings.choices`.

Three Web TS2345 diagnostics in the fixed raw log are Picker52, selection73 and execution-profiles.test44. Catalog5–6/24–26 returns deeply frozen parsed declarations; ProfileSelection21–22 contains Immutable<ChatProfile>. The new optional turnSettings array in shared ExecutionProfileConfiguration18–31 makes those immutable values incompatible with the former mutable parameter even when a particular runtime profile omits the field.

`readDirectoryProfile(input: unknown)`40–60 already structuredClone-detaches, validates the reference, all configuration fields via the original strict schema, publication metadata/controls, then deep freezes. configuredSelection65–68 reuses it and retains the none/configured-readonly allowlist. No shared parser, access policy, controls, title/creation mapping or UI changes are needed. The existing internal cast in the reader is untouched, not a new escape hatch. The annotation repair has no emitted-runtime behavior delta.

This does not opt the legacy Web into the message-settings catalog. Shared codec146–161 gives that branch different controls and an explicit protocol; the Web legacy reader still validates its existing controls. Do not widen it to fix the independent TUI journey error or add message-setting selectors here.

## Proposed isolated scope and validation

No authorized WT exists for this repair in this dispatch. Sole Git owner can provision a source-only WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-profile-readonly-selection`, branch `codex/web-profile-readonly-selection`, fixed4015 above. Do not amend Recovery or either current validation tree. Four candidate literals, subject to manager identity/ledger assignment:

1. `apps/web/src/execution-profiles/selection.ts` — one parameter annotation.
2. `apps/web/test/execution-profiles.test.ts` — at most one cast-free readonly nested-choice regression, using the existing profile factory and readDirectoryProfile; no new suite/framework.
3. `plans/wpf-profile-readonly-selection` — own plan/status/review.
4. `docs/evidence/wpf-profile-readonly-selection` — own provenance/check/review records.

The regression should pass a parsed deep-readonly profile to configuredSelection, then reselect its immutable profile/freeze creation. Verify nested choices stay detached and frozen after mutation of the original mutable input; preserve reference/configuration/choice order. This is structural input coverage, not a claim that Web now consumes the newer catalog protocol. Runtime malformed choices remain rejected by readDirectoryProfile/shared schema; do not cast malformed data into configuredSelection or relax the validator. Existing unsupported-access, malformed directory, detached creation and exact ACK tests stay intact.

Necessary later checks, only after separate resource/dep admission: existing explicit `apps/web/test/execution-profiles.test.ts` (includes one owned loopback HTTP fixture and bounded in-memory catalog tests, no PG/provider/browser); a Web or root strict/noUncheckedIndexedAccess noEmit run using the fixed shared input, not a transpile-only Vitest claim. Root noEmit is the decisive three-caller type check, but still contains the separate TUI journey diagnostic owned elsewhere. Do not claim whole-root green until that independently fixed input is integrated. No broad client/domain/PG or visual matrix is justified by this annotation-only change.

## Exact45 input and dependency boundary

All45 paths in fixed `docs/evidence/i02/message-settings-integration.json` were compared to Git bytes at4015: every length/SHA matched. Full exact path+hash set and manifest hash are in sources.json. They are protected inputs, not repair write scope; preserve the approved CORE ea276/C01 6d114/F01 input combination. Do not copy an unreviewed moving shared branch, reset the integration tree or reconstruct a partial protocol locally.

Read-only package metadata at I02 shows TypeScript5.9.3 and Vitest4.0.18 in its existing pnpm tree; apps/web @flow/client and @flow/contracts resolve to that same I02 workspace source, not dist. Exact observed realpaths/package hashes are listed. New WT must resolve its own fixed client/contracts source; only separately authorized exact third-party links may reuse a donor, with identity/hash checks and no target/cache writes. No reuse has been granted or performed. The dependency closure and fresh disk limit must be assessed after provision; this proposal does not claim a runnable new tree. Do not use the Web package test script (it selects projection.test), and do not install to mask missing dependencies.

The fixed root log has one separate TUI TS2322 plus the three Web errors. Existing domain approvals and one production check remain their original evidence; this narrow proposal neither reruns nor inherits them as validation of the future change.
