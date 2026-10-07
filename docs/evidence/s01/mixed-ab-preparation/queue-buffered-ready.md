# S01 explicit buffered single-arm preparation

State: SOURCE_AND_LOCAL_REVIEW_READY, source `839a1614bb8429922716fb86e8a9ebe6b2972967`; actual PG/HTTP/performance NOT_RUN / NOT_OPEN. This is not a reuse of either consumed queue or offline replay window.

## Interface and unchanged acceptance

`queue-buffered-main.ts <s01-queue-buffered-once> <40-char clean execution HEAD> <fresh complete floor>` selects only `queue-buffered-single`. `selectQueueRecipe` rejects unknown kinds; `queueArm` rejects a second arm and forces `buffered`. `runSingleSide` uses the same budget/receipt accounting as legacy `compareSides`, but has exactly one A accounting slot. A means a budget slot, not old O1/per-query. The run identity is `queue-probe-buffered-v1`; the driver also rejects non-buffered delivery for that identity.

The production source remains fixed 4fdd856293a502209d7509ea37da901bbfd89f72, via existing exportQueueInput/queueSourceBindings. No old workspace contracts are overlaid on main. The existing runMixed still owns real center/runner, all 128 concurrent fixture executions, completed synthetic chat, six-second measurement, four-second eligible ACK span, sampled ownership, four real cancellations, final persistence/ACK/session proof and journal/DB/process cleanup. New identity receives exactly queueContract(A); no proof/child/clock/pacing changes. Both old queue-main O1→O2 and event-state A/B semantics remain their defaults.

Original O1 used per-query and never executed packing; original O2 was NOT_RUN. This candidate answers feasibility of the original synchronous burst under the buffered delivery strategy. It does not isolate packing causality, prove real native/provider capacity, or convert the old O1 failure to success. The packing optimization only affects buffered finish; ABBA was an offline fixed-trace observation.

## Provenance and actual readiness gap

[provenance](queue-buffered-provenance.json) binds only changed selection/entry and directly relevant unchanged modules. References: approved packing11ab/75e3, original queue-source f722 and environment caller375e, old queue execution67d; exact review scope remains in the original review records. No 93-input closure/raw copy; no compiled/replay/result original is changed.

Future candidate conservatively retains original whole300s/512MiB ceiling (15s preparation, one135s side including105s work plus cleanup, 32MiB common including4MiB final; side240MiB); single129 total task submissions=128fixture+one completed chat, one markedDB, original13 connections,8192 HTTP ceiling with light reads≤200/concurrency2 and four cancellation targets. These are candidate ceilings, not measured use or a new OPEN. All actual uncertainty remains FAIL/UNKNOWN/KEEP and no automatic retry.

Proposed output reservation is `docs/evidence/s01/pool-wait-run/buffered-single-v1`, with child output `/buffered`, both inside current owned literal. Neither is created in this segment. Existing historical pool-wait-run bytes stay unchanged. Before actual: independently review this source; bind a new finite caller selection/input/output list (old queue-operator intentionally still expects two outcomes and MUST NOT launch this candidate); verify current entire runtime/33 dynamic SQL/installed dependencies, exact output absence and complete fresh manager resource sum. Existing OPS14/allowlist/DB identity cleanup are reusable; no caller protocol mismatch is silently accepted. Output-parent presence is historical evidence, not an invitation to access old KEEP roots.

## Bounded local segment

16:57:00Z→17:12:00Z; max3 serial children/30s each/60s cumulative, new8MiB including TMP4MiB/raw512KiB. K01→AV03→S01 handoff is required before launch. Only new selection tests + changed sequence's existing direct tests, and focused noEmit including real driver; no old packing18/PG/native/provider tests. Reuse pg-delivery-chunk-local.py and fixed OPS14, explicit environment, single new queue-buffered-local.json; actual transcript/first failures/unknown are retained. Pure tests cannot prove real PG/HTTP or its resource closure.

Skills: existing find-skills local-first, brainstorming bounded direction already authorized, codebase-design small selection Interface with shared lifecycle owner, fixed clean-code naming/single responsibility/finite errors/no duplicate driver or supervisor. Full final validation stays owned by existing runMixed. No installation or external skill refresh.

## Recorded local outcome and review request

2026-10-07T17:01:31Z FULLRETURN. Two children: new selection8/8 + existing changed sequence5/5; focused strict0. Raw659B; PID17548/20217 exit0/finalabsent/MERGED EOF/full capture/no first-secondary-signals. Initial EPERM observations remain in the report. Both own TMP same-inode samples245/0B were removed, with exact ENOENT observation after return. No third child, no PG/HTTP/listener/native/replay, no old green re-run. Supervisor total1261ms, caller total1352.374ms, toolreported0.75061/0.673053709s kept separate; no inferred whole-external wall or sampled peak.

Single source of actual facts: [queue-buffered-local.json](queue-buffered-local.json). Exact review bindings: [queue-buffered-review-manifest.json](queue-buffered-review-manifest.json). Please review only new selector/identity/shared sequencing/wiring plus unchanged proof boundaries and this local evidence. Prior packing/O1/O2 verdicts remain their fixed histories. New source review is pending; pure success is not actual READY/OPEN.

Future caller remains intentionally unchanged: its two-outcome validator, namespace/OPEN, five output names and fixed runtime input must receive an explicitly reviewed finite single-arm variant before launch. The old queue input-v2 must never be reused as if it bound this new entry. Current inner minimum floor is historical; future caller must supply the manager's current complete higher sum. Candidate root has not been created; actual output absence is rechecked at future admission, not inferred from this preparation.
