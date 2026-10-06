# Native configured catalog — first implementation

Implementation target `c9c6e891003af2fc52ca77b0c4527d6d85e20e22`; independent review NOT_STARTED. Baseline main41315b033deb0b1953484359b686c0b228997367 merged without conflicts at944780d803ed36deb010d0760f7dd46f75cc3a6f using scope=[] integration receipt, now released. Writer claim0dd97484…v3 remains active; only five approved production paths changed.

Exact single native-v1 opts GET /api/execution-profiles into the strict flow.native-execution-profile-catalog.v1 envelope. Existing no-header/steering-v1 readers keep their Claude SQL and admission behavior. The new SQL filters known harness+adapter and revoked rows before limit, validates digest/shape including its sentinel, and returns configured/not-probed only. Codex and goal-purpose ordinary conversations are explicitly unsupported. Strict wrapper validation rejects contradictory conversation flags, effective-model/readiness/fast claims, duplicates and bad cursors. No old configuration fields/digest are removed or defaulted.

No new table/migration, runner launch, global server/contracts index change, client HTTP copy or sharedclient edit. Future client reader must verify exact protocol and never silently fallback; current client/index belongs to TUI01B, coordinated by Lead. Public exports already flow through existing export*. [Design](../native-catalog-seam.md) and [manifest](manifest.json) bind the precise module seam and source/raw.

## Actual validation

Fixed Node24.20.0 / Vitest4.0.18; installed main toolchain reused through explicit local config, no install or dependency symlink. 33 distinct passing behavior checks across the following invocations, not one 33/33 run:

- Contract file7/7 in domain.stdout. Same invocation's PG suite was an import setup failure; it is not counted as a pass.
- Native HTTP/PG file first8/9 passed. The one failing raw duplicate-header request omitted HTTP Host and was rejected before JSON; added Host and status assertion, selected that exact test:1/1 passed with8 intentionally not selected. These nine distinct cases cover current product source; no product behavior change was needed for this fixture repair.
- Existing legacy profile7 + steering admission7 + client profile2 + native publication1 =17/17 in consumers.stdout. They use own PG/dynamic HTTP and injected synthetic SDK messages; no actual provider invocation.
- Strict noEmit of changed contracts/server and their direct imports/client tests exited0, typecheck-final-result.json. Empty stdout alone is not execution evidence. Initial explicit path resolution lacked installed @types declarations; fixed config only, failure retained.

The owned native fixture uses a fresh UUID database and advisory ownership, real dynamic loopback HTTP, bounded requests/queries, no worker SDK/transport process. Rows stay immutable; only owned runner revocation isolates test catalogs. afterAll closes its server/pool, drops its exact owned DB and asserts absence before releasing admin ownership. Existing direct consumer fixtures retain their established cleanup. No shared service stopped, no capacity workload, no diagnostic child/window consumed.

Commands (working directory is the authority worktree):

```
/opt/homebrew/opt/node@24/bin/node /Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/vitest.mjs run --config experiments/codex-app-server-conformance/native-catalog/vitest.config.mjs packages/contracts/src/execution-profiles.test.ts apps/server/src/execution-profiles/native-catalog.test.ts
/opt/homebrew/opt/node@24/bin/node /Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/vitest.mjs run --config experiments/codex-app-server-conformance/native-catalog/vitest.config.mjs apps/server/src/execution-profiles/native-catalog.test.ts
/opt/homebrew/opt/node@24/bin/node /Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/vitest.mjs run --config experiments/codex-app-server-conformance/native-catalog/vitest.config.mjs apps/server/src/execution-profiles/native-catalog.test.ts -t 'preserves no-header'
/opt/homebrew/opt/node@24/bin/node /Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/vitest.mjs run --config experiments/codex-app-server-conformance/native-catalog/vitest.config.mjs apps/server/src/execution-profiles/execution-profiles.test.ts apps/server/src/execution-profiles/steering-admission.test.ts packages/client/src/execution-profiles.test.ts packages/client/src/native-profile-publication.test.ts
/opt/homebrew/opt/node@24/bin/node /Users/citrine/Projects/AgentHarness/Flow/node_modules/typescript/bin/tsc --project experiments/codex-app-server-conformance/native-catalog/tsconfig.json
```

Earlier initial Vitest CommonJS alias run selected zero tests; alias was corrected, retained as failure. No tests/assertions were removed, no dependency installed, no old27/31/19 suite rerun. Old diagnostics/raw/manifests untouched. Canary remains FAILED/unknown and real app-server/auth/provider0. This catalog does not establish model entitlement, effective settings, tools:none, or conversation support for Codex.

Clean-code/codebase-design safety point 2026-10-06 10:30:39 UTC: checked naming, one reader with reused profileView, explicit protocol/error/unknown behavior, SQL bounds, no duplicate config canonicalizer or runtime. Strict codecs intentionally validate the wire contract rather than accepting TS assertions. Existing Claude codec/listProfiles bytes and shared consumers verified unchanged against fixedmain; source/read-only hashes in manifest. Only task-owned local configs handle toolchain lookup. Independent source review NOT_STARTED.
