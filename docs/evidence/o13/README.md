# O13 fixed delivery

Source: `ddf9f9404561515b61a85d89aa203d609dbfff8e`. Base: `2f16e30a7e4dbeb7d4bc28e03284835764ef19a0`. Author: native_center_owner / gpt-6-astra. Independent review pending. The 11 owned product/test paths are frozen; controlled shared client input is documented in [shared-input.json](shared-input.json). No factory mount, migration, dependency, runtime/profile or legacy authority change.

The recoverable entry saves exact natural-language input and key before createGoal, binds its returned goalId, then composes the existing GoalSession with explicit graph-plan/native-execute. A goal-owned paged planning list is lazy and body-free. The same Intent v1 persistence/recovery rules apply to all actions; no read, graph title or reconnect dispatches a child automatically. See [Interface](interface.md) and [quality review](quality.md).

## Actual checks and provenance

Node24, pnpm9.15.4, Vitest4.0.18, own frozen-lock offline install. Each `.txt` contains actual process output and its same-name `.exit` contains the captured shell process exit. Empty typecheck stdout is not manufactured compiler output. Checks were run incrementally against this worktree, not against a later checkout of the source commit. No metadata-driven rerun.

| Raw prefix | Actual result / selection |
| --- | --- |
| entry-red | exit1; module missing, zero tests; not passing evidence |
| entry-first | exit1; 6 new failed, 8 unchanged lifecycle passed |
| entry-final | exit0; 6 entry passed |
| commands-first | exit1; 4 new passed, 1 bound-fixture failed, 6 unselected |
| commands-bound-final | exit0; corrected bound fixture 1 passed, 10 unselected |
| list-first | exit1; unsupported package import in test, zero tests |
| list-final | exit1; immutable-row fixture rejected before 3 tests; 3 skipped |
| list-fixed | exit0; 3 public HTTP/PG list checks passed |
| journey-first | exit0; 1 public HTTP/PG success journey passed (then only one test existed) |
| uncertain-first | exit0; 1 public HTTP/PG uncertain journey passed, success test 1 unselected |
| types-first | exit0; root noEmit before final tests added |
| types-second | exit2; list test createProject typing missing explicit workspaceId |
| types-final | exit0; final root noEmit after that test-only fix |

24 different passing checks = 6 entry + 5 new command/planning + 8 unchanged lifecycle + 3 list + 2 separate journey checks. Counts are across rounds; no claim of a single 24/24 run. The old lifecycle pass preceded later additive planning/actions; its unchanged source is bound in the manifest. The thin F01 client checks are separately reviewed input, not added to this count. No original O07/O09/O12 complete suites, Web/PTY, real query or provider checks were repeated.

Reproduction entry points use `pnpm exec vitest run` with the exact paths in the manifest's source/validation groups; the focused final command test uses its `-t` selection and negative journey uses `-t 'a revoked claimed child'`. The strict root check is `pnpm exec tsc --noEmit`. Original logs are the authoritative selected counts, not these reproduction notes.

After successful list checks, the test's evidence filename changed to include its random DB identifier; the existing generic facts were archived without changing contents. A final TypeScript-only fixture correction supplied the existing default `workspaceId: personal` explicitly. After successful native journey, its helper exposed runnerId/client for the separate negative case. No product behavior was changed after its green checks. [checks.json](checks.json) retains all exits and the evidence limitation.

## Real and injected boundaries

The success journey uses actual public HTTP, random PostgreSQL, real Claude adapter/guard/runtime/outbox and injected query transports. One synthetic goal, three graph nodes/two edges, one planning task and one readonly child. The graph is authored by synthetic MCP calls through the existing planner tools, not by a model. Actual input is frozen explicitly after planning. Lost goal/planner/child ACKs preserve exact key/body; disk-backed local record and center restart recover without automatic retransmission. A second owner sees stale-input rejection. The artifact passes mechanical verification while remaining unaccepted; an independent client reads its exact digest and explicitly accepts it with explanation history.

The negative journey admits and publicly claims a child, then revokes the runner. It stays uncertain; a fresh client/profile cannot repeat execution or accept an unverified artifact. It makes zero SDK query calls. Two injected queries in the success case each close once; provider calls are zero in both. Disconnect does not cancel the durable task. Real model planning/child budget, UI workflow, production deployment and complete FLOW-001 acceptance remain open.

## Resource evidence and limits

Three retained per-DB fact files record preflight absence, own random database, cleanup with zero remaining connections/databases; both journey temporary directories are removed. The tests check an independent random ownership marker before dropping their own DB. Their runtime and in-process SDK peers close normally. Dynamic ports are used; personal services untouched.

The failed immutable fixture's original generic cleanup JSON was overwritten by the next successful list run, so its random database name is not retained. Its actual failure and afterAll outcome remain in `list-final.txt`; there is no claimed named cleanup receipt for that run. The three retained later facts do not retroactively prove its named cleanup.

One list page measured864bytes; max20 entries, cursor max1024bytes, exact PostgreSQL microsecond sort position, one consistent read and at most20 associated task summaries. Intake max32KiB, existing intent and new planning observation max64KiB. Existing observation permits2active/4queued; one planning page retained. No throughput/capacity claims or benchmark derived from this small sample.

The manifest binds all fixed raw bytes, protected inputs, source and shared inputs to ddf9f9404561515b61a85d89aa203d609dbfff8e. Later metadata/status/this README are excluded from that source-commit binding to avoid self-referential manifests. Original failures are preserved.
