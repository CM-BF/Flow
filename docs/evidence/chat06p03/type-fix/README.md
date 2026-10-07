# Integration type-consumer fix

Lead's actual root check at 18:07:38 UTC failed with seven diagnostics: docs baseline files cannot resolve the runner-owned Claude SDK, followed by lost type inference. Original stderr/receipt are preserved byte-for-byte in integration-red.txt/json. The original hash algorithm/5 behavioral checks remain approved; this is a separate type-only baseline adaptation.

The two original TS sources from 4c6676caf545aea1939a9b676b419cf702eed19c are archived exactly as baseline/*.ts.txt. The explicit test adapters at baseline/*.ts change only the SDKMessage type import into the already-public runner Accumulator.observe parameter type. All runtime statements/imports are untouched; reversing that one replacement reproduces every original byte. No new root package dependency, node_modules link, `as any`, loader, exclusion, or test assertion change.

Prepared, not yet run: runtime-proof.mjs uses fixed existing TypeScript 5.9.3 to erase both original and adapted source and compare emitted JavaScript without loading either module. This is source transformation evidence, not a behavior check.

Actual consumer types must run in Lead's already-installed dependency-owning tree after the corrected baseline and existing test are staged. tsconfig.integration.json inherits all root strict options, contains exactly those three files and their real imports, and has no SDK/package aliases or broad exclusions. This owner source-only tree has no node_modules, so repeating the old local global SDK alias would not independently reproduce the integration error. Do not run this config before Lead stages the fixed inputs; do not install/link dependencies to make it pass.

No original behavior test, PG, SDK/provider, or whole-root typecheck is requested here. Resource/window admission remains Mika/Lead-owned. Old 4c6676ca manifest/raw are unchanged as fixed Git history; current adapter drift is explicit and will be bound by a new fix manifest.
