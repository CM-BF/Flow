# O14 fixed module evidence

The candidate source commit is bound by `fixed-manifest.json`. Parent FLOW-001 / O01-05 / O12-05 / M02; fixed base5dbabadc7dda02da558f48505677eddbc9c83fb5. DTO originally published at e05694883c11abedba8eb4080f614a2b1d61a1de remains unchanged. [Interface](interface.md) is the current module contract; [original approved proposal](approved-design.md) preserves pre-take reasoning.

The module persists finite owner permission and one execution link per selected node. It calls the existing task admission and PgBoss wake transaction. A sweep resumes from committed facts after client loss/restart, and the existing runtime/outbox carries the actual injected SDK outputs. Mechanical artifact qualification can supply an explicitly authorized internal dependency; it does not write owner acceptance. The owner separately accepted the final exact output in the public journey. Old manual commands still require accepted dependencies.

Scope is14 source literals, including030 and two direct-consumer test lifecycle changes. No index/client/runtime/runner changes. Factory registration/automatic scheduling integration belongs to F01 and is not proven by this explicit sweep fixture. No new timer, provider call, real model planning, production deployment or personal service change. No GoalIntent v1 change. Cross-client browser/TUI journeys and real planner+child budget remain future parent acceptance.

## Verification

Node24.20.0, Vitest4.0.18, existing frozen third-party dependencies only; [dependency links](dependencies.json) use this tree for workspace code. No install or copy. Every command redirects its real stdout/stderr to `.stdout` and saves the actual shell process status in `.exit`; empty typecheck stdout is not a transcript invention. Test invocations are `node node_modules/vitest/vitest.mjs run <explicit-file> [-t <selector>]`; root types use `node node_modules/typescript/bin/tsc --noEmit`.

15 distinct Vitest checks were green across rounds:13 new module checks +1 existing goal diamond +1 existing delivery replacement. Rounds overlap and are not added. The standalone pure validity probe adds1 different bounded-work check, not another Vitest test.

| Raw prefix | Selection / actual result | Meaning |
| --- | --- | --- |
| pg-first | bounds finite + continues two;0 executed/10 skipped, exit1 | Real migration failure: reserved SQL keyword. Dedicated DB cleaned. |
| pg-second | same2;1 pass/1 fail/8 unselected, exit1 | Manifest policy literal mismatch rejected grant. |
| pg-journey-debug | journey;0 tests, exit1 | Fixture error-record syntax failed before DB creation. |
| pg-journey-debug-fixed | journey;1 fail/9 unselected, exit1 | Actual SQL constraint failure captured without credentials. |
| pg-journey-policy-fixed | journey;1 fail/9 unselected, exit1 | Two executions completed; light-read test omitted mandatory nodeIds. |
| pg-matrix | original10;7 pass/3 fail, exit1 | Fixture assertions used nonexistent reference kind/event and owner401 instead of existing403. |
| pg-focused | seven selected of13;6 pass/1 fail/6 unselected, exit1 | Fixes plus3 new failure/expiry/external-binding checks; artifact detail assertion still used wrong reference contract. |
| pg-verification-fixed | failed verification;1 pass/12 unselected, exit0 | Read retained failed artifact through actual delivery/detail references. |
| legacy-goals | existing diamond;1 pass/8 unselected, exit0 | Original assertions unchanged; randomized named DB and guarded cleanup added. |
| legacy-delivery | existing replacement/restart;1 pass/6 unselected, exit0 | Original assertions unchanged; own DB identity/resource cleanup checks added. |
| validity-bound-red / green | pure20-node/37-edge dependency DAG; exit1→0 |17,709→37 operational status reads. Fresh input change and uncertain source invalidate reads; no shared cache. |
| pg-memo-journey | journey after local memoization;1 pass/12 unselected, exit0 | Direct affected consumer passes; original15 not rerun. |
| types-first / tests / tests-fixed / second / domain / final | exits0 /2 /2 /0 /0 /0 | Fixture import then inferred UUID-template parameter errors fixed; final root noEmit0. |

Pure probe command: `node --import tsx docs/evidence/o14/validity-bound.mjs`. Red predates resolver memoization; the final probe adds fresh-read invalidation assertions. Red and green stdout are retained. The work-count improvement is local to this explicit graph, not a latency or system-wide capacity claim.

New checks cover finite schema/expiry, same key/body loss+restart, concurrent sweeps, two actual input-bound tasks, owner/runner isolation, exact goal identity, immutable history, failure/verification failure, decision/revocation, profile revocation, graph/input drift, admission budget, atomic task/link rollback and unknown restart without retry. Snapshots stay body-free (<4,000B in the one-node measured sample). Internal producers must remain the latest execution and current-attempt artifact binding. Root/source/provenance and light delivery share validity; current semantic acceptance remains separate.

## Resource facts and limits

Eight named O14 databases (including failed setup rounds) have original `flow_o14_*-facts.json` files with ownership marker, zero connections at cleanup and remaining[]. Four later records include actual DB size before drop (largest13,016,087B); earlier rounds did not record DB size and no retrospective value is invented. The pure-transform failure made no DB. Two older direct-consumer databases are named in `legacy-goals/cleanup.json` and `legacy-delivery/cleanup.json`; both removed normally. The goal diamond retains its two owned process PIDs in `legacy-goals/diamond.json`, and existing stopRunners awaited their exits; exact per-child exit codes were not saved.

Each O14 fixture checked free space >=1GiB+96MiB before creating its one database, declared<=96MiB new budget, and retained cleanup facts. Later observed free-before-drop values stayed above1GiB. Global volume deltas include other writers and are not attributed to this module. Code+own evidence remain below the20MB authorization. No other database/process/tree was cleaned.

The final journey recorded an HTTP drain deadline warning after the intentionally lost ACK; it remains in raw stdout. The same-key recovery passed, the owned resources closed, and database cleanup was empty. This is not a claim that every transport drained normally.

## Review request

Read the14 fixed source literals, shared validity recursion/provenance, immutable SQL constraints, project→grant→task lock sequence, and candidate rotation committed before project locks. Check original raw/exit and fixed/current/protected hashes without repeating15 checks. Verify current ordinary consumers and no new scheduler/profile/runtime semantics. Independent review and actual main integration are pending.
