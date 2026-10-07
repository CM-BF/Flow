# S01 callback-paced delivery — review handoff

SOURCE_AND_LOCAL_RESULT_REVIEW_PENDING; actual PG/performance NOT_OPEN. Prior single-A failure remains FAIL/UNKNOWN_RETAIN; no old result, compiled object or KEEP root modified/read.

## Module / Interface

`pg-delivery.ts` retains one lazy incremental chunk packer. Existing synchronous `finish()` remains for offline consumers; `finishAsync(emitAsync)` closes recording immediately, returns one stable promise and awaits each chunk. It preserves samples, SQL aggregates, ordinal/array commas and final real JSON ≤64KiB checks; partial failure never retries. As before, `status().known` only means no failure observed, not remote completeness. Actual users must await finishAsync; do not mix synchronous finish with an active asynchronous finish.

`channel.ts` owns 1MiB pending and total/envelope accounting. New `drain({deadlineMs,signal})` waits for existing callbacks; `sendAsync` drains, sends once and waits for its callback. The center is the single serial async writer. There is no second queue or scheduler and no raised byte cap. Closed/disconnected/send callback/throw/cancel/deadline/byte-limit failures preserve a finite firstFailure code and dropped count, without private error messages. Late callbacks can retire pending bytes but cannot clear failure or resume finish.

`pg-delivery-bridge.ts` sends a single summary only after all chunk callbacks complete, preserving parent deliveryReceipt as completeness authority. Summary send failure also returns unknown. A callback is local completion, not a remote/durable ACK.

`child.ts` uses async finish after app.close and observer.restore; normal protocol stop begins drain. SIGTERM/disconnect cancel waiting. The existing 500ms IPC allowance now begins before buffered flush and is shared by chunks, summary and final drain; it is not extended or reset per message. Expiry preserves unknown/exit1. The child-settled diagnostic adds firstFailure, best effort through the same bounded reporter. Failure to deliver that diagnostic remains unknown, never inferred success.

## Local evidence and boundaries

One single `pg-delivery-backpressure-local.json` / four immutable raw files records the actual sequence:
- Baseline: 8000 finite records, delayed callbacks; original synchronous path hits the unchanged pending guard (`sink_unknown`, dropped1) after cumulative >1MiB. This is a passing counterexample asserting the fault, not a repaired success and not actual-run causality.
- Fixed: 8 new callback/large-flush/finish-once/error/cancel/deadline cases +4 directly affected chunk packing boundaries +4 existing center/reporter/receipt cases =16 passed,7 unselected.
- Focused strict exit0.
- Existing real child idle-stop/invalid-epoch direct consumers:2 passed,21 unselected; no runtime/PG loaded. These two tests fork the existing child using its existing loader; this is not a capacity/performance run.

4 top-level supervised children: all finalowned absent/MERGED EOF, raw2922B complete, no failure/signals/secondary; early EPERM observations remain. All own TMPs sameidentity sampled then removed. 4083ms is cumulative supervisor time, not whole segment wall. First source inputs are the original implementation; fixed runs retain individual input hashes. Source final differs from the last checked bridge only by removal of an unreachable duplicate `finished` guard, which the first guard already handles; no new behavior. Whole external wall and active peaks UNKNOWN.

## Prior result / source diagnosis

Root forwarded db_transaction_owner's 2026-10-07T19:14:33Z RESULT_FIDELITY_REVIEW_APPROVED/0P1P2 for d6ce1e9ca1a8b3ecc86bd087399785cb87d99aae:24 bindings16658807B/123 inputs match,707 eligible ACK/3 below4s, active RETURN and2KEEP are separate. Source synchronous flush can deterministically exceed1MiB pending; original16chunks/dropped1 is consistent but lacked first-drop code. This repair does not establish the previous failure's full cause and does not fix/relax ACK4s.

## Methods / versions

Local find-skills, codebase-design and fixed clean-code used: one packer, reporter owns callbacks/budgets, bridge owns summary, driver owns remote completeness. No new supervisor, duplicated observer or retry queue. Node runtime remains24.20.0, Vitest4.0.18. Node24 online documentation observed24.21.0: https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html#subprocesssendmessage-sendhandle-options-callback — send false can mean backlog; callback supports flow control but is before possible remote receipt. No install/update.

Resource segment19:18:14Z→19:43:14Z,16MiB cap includes source/metadata/raw/TMP;6 maximum serial top-level children/40s each/150s cumulative. Actual4, all closed before19:33:01.365Z; source/metadata finish remains within original segment. Current task start UNKNOWN and capacity TODOs remain open; main8e5faabb includes only previous private offline packing/replay, not this repair. Actual new PG/runtime candidate requires fresh source/input bindings and a separate grant; none created.
