# Recovery38 candidate: source-only scoped review

Verdict: **APPROVED_SUPERVISOR_DELTA_SOURCE_SCOPED_NOT_RUN**, no blocking finding in this bounded rebind/entry/count review. This is not an admission gate, test result, full Recovery approval or a new candidate.

Candidate `/private/tmp/recovery38-once-lsab03fv`; runner SHA256 `22b8eb121b1fe81877a70884a53777a31c1d2c5c46ca61ae8cc4d593b7db810d`. Source `7cc7629b6603a6ccc7e2ab6143125dea8daae685`, current metadata `bf14ae68c2c9b1ba9666f9f5b6314ca15353625d`, branch `codex/web-conversation-recovery`, clean when read. All 19 current blobs equal fixed source and binding. Seven actual candidate files were inventoried before reading; hashes in audit.

## Minimum delta and budget

The supplied settings-to-recovery.diff exactly equals the actual diff from the corrected MessageSettings parent `adb3580e17e66894f1b4c06608b7a92f66c02b5630660afc1a407ba80d56db70`, whose structure was approved in `/tmp/root-message-settings-supervisor-review.json`. The steps.mjs bytes are identical to that parent. Changes are task/mode, 19-source count, stripped RECOVERY_ environment prefix, direct-only step count/meaning, and prior-runtime arithmetic. No types step remains.

run.py:91–94 requires previousRuntimeMs=4574, totalSeconds=(30000−4574)/1000=25.426 and cleanup reserve 5; lines185–187 derive work20.426 and total25.426 from one start. Lines309–321 use actual elapsed for cumulative≤30000 and PASS. Binding agrees. Cleanup reserve is available time, not a five-second artificial wait. Final elapsed/resource failure still prevents PASS; sampling/filesystem operations are not a hard OS quota or proof of real-time scheduling.

Inherited corrected cleanup at141–180 signals only the new owned group, boundedly waits, escalates, verifies group absence, inspects final recursive bytes/free after reap, and removes only own scratch. Cleanup/probe/capture errors enter non-PASS. Guarded structured capture, aggregate report cap and retained raw accounting remain unchanged. The legacy direct-second evidence writer is absent; all output stays in this new candidate directory. New paths therefore do not overwrite the historical27 run. Parent final-report I/O remains ordinary filesystem I/O, not an infallible storage guarantee.

## Exact direct entry / actual-result gate

vitest.config.mjs includes only `apps/web/test/conversation-recovery.test.ts`, one fork, maxWorkers1, fileParallelism=false, cache=false, explicit own cacheDir, bounded hooks/tests. The sole steps entry invokes the existing Vitest path with `run --config ... --configLoader native --no-cache --reporter=json --outputFile .../scratch/vitest-results.json`. No compiler, browser entry, PG fixture launcher or HTTP service step is present. steps.mjs spawns non-detached so the fork stays under the supervisor's owned process group.

Static source has 34 ordinary it calls and two two-element it.each calls =38. This is a source count, not a run result. run.py:313–321 requires one completed direct step exit0, JSON success=true, total=38, passed=38, failed=0, pending=0 and todo=0 (absent todo treated as0), plus parent exit0, no dropped log bytes, successful cleanup/capture and budget limits. Missing, malformed, fewer, extra, failed or skipped results cannot satisfy PASS. Actual reporter production of these fields remains to be exercised by the admitted run.

The test imports only observeRecoveryRecords from the fixture at test:18. Fixed fixture:1–11 has built-ins, type-only pg Pool and path strings; observer15–59 has no startup side effect. RecoveryDatabaseLease requires construction; service/PG/Vite imports remain in create/cleanup or explicit startRecoveryFixture228–234, which checks FLOW_RECOVERY_BROWSER. No direct case constructs that lease or calls the start function; the browser entry is not imported. This source inspection supports the existing toolchain rebind without a new static third-party runtime import. It does not execute Vite's transform graph or prove page.evaluate serialization/real IndexedDB.

## Safety fence and outstanding admission

sandbox.sb denies all network and all writes except own candidate subtree and /dev/null; the project/dependencies are read-only. Child environment removes FLOW_/PG/POSTGRES_/RECOVERY_, database URL, NODE_OPTIONS and proxy variables, and redirects scratch/cache. Existing @flow links are to this Recovery tree, not donor workspace sources. Exact entry/dependency pins and final gate are being independently checked by root/manager; metadata pins are not a whole transitive dependency integrity claim.

Current binding is CANDIDATE_SOURCE_BOUND_NOT_RUN: run.py:79 rejects it. Promotion to reviewed binding, the resulting new binding hash, and one fresh expiring exact-source/claim/resource gate are still required. No gate was present or created here. No Node, product import, test, HTTP, PG, Chrome, space sampling or project/owner-record write occurred. Only this /tmp report and audit were written. Old27 actual pass, first browser failure, and the full-feature NOT_STARTED boundary remain separate.

Method: reused local find-skills/clean-code/codebase-design guidance, checking single cleanup ownership, explicit failure verdicts, minimum interface delta and preserved behavioral assertions; no skill installation.
