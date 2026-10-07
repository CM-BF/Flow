# Quick b3: bounded accounting preparation only

State: **PREPARED / NOT_RUN**. No gate, new native Chrome acceptance, or runtime reservation. Product fe6 and metadata b44fce are unchanged. This packet does not replace either failed attempt or authorize a third run.

## Minimal correction

`supervisor.py` now measures retained files directly: its existing `sizes` traversal prunes only the exact `BASE/scratch` directory. The live sample, result/budget accounting, and final reserve check all use that same traversal. It never subtracts an earlier mutable scratch measurement. Near-name directories remain evidence. Existing no-follow symlink behavior and non-ENOENT error propagation remain unchanged.

Scratch is still measured independently as logical bytes and `st_blocks * 512`; its original 64 MiB limit and the retained 8 MiB total (including 128 KiB seal reserve) are not increased. The retained limit is logical evidence bytes, not a physical peak guarantee. Filesystem observation remains polling, not a hard quota. Root confirmed the old non-atomic formula is incorrect; the b2 samples are consistent with that defect but do not prove the exact per-file allocation history.

The only other parent delta is the required two-attempt carry: b1 actual outer exit 1, late terminal, cleanup and 12,326 ms; b2 actual outer exit 1, late terminal, cleanup and 6,142 ms. Exact permitted terminal keys handle b2's raw-relative select trace being sealed **null** and absent; they cannot be replaced by a fabricated trace/PNG or a basename-only seal. Root failed-actual reports are pinned, and the original earlier parent budgets remain unchanged. b2 normal HTTP/context closure remains **NOT_CAPTURED**.

## Carry and boundaries

Spent **18,468 ms**, remaining **41,532 ms = 26,532 work + 15,000 cleanup**. `prior-evidence.json` pins **86 files / 1,014,126 bytes**: complete b1/b2 packets, both outer directories, b2 admission directory, original b1 gate, two root actual reviews, and six original archive/account/metadata indices. Logical byte counts include each listed path once; archived raw mirrors are not counted twice. Parent also reserves **2,113,536 bytes** for the next outer capture. New packet, logs, trace, screenshots and seals all share the same retained 8 MiB budget.

The diagnostic worker remains byte-identical f099491c…; four fe6 sources, 117 own input declarations, 37 external entry pins, Node pin, accepted c2 strict/26-direct evidence, six browser groups, and two PNG names remain unchanged. This preparation does not inherit b2 native approval for the changed parent. Original b1/b2 and all raw bytes are untouched.

## Minimal synthetic check supplied, not executed

`accounting-check.py` imports the **actual fixed supervisor module** under a non-main name with bytecode writes disabled, verifies its prepared hash, then calls its actual `sizes` and `scan_error` helpers. It does not duplicate the algorithm or enter the browser supervisor. Future command (only after separate authorization):

`python3 /private/tmp/msgquick-b3/accounting-check.py`

Five bounded assertions cover: (1) sequential scratch growth from 4 KiB to 64 KiB changes independent tmp size but leaves retained logical/allocated size unchanged; (2) a near-name directory remains counted; (3) file/directory symlinks to a second owned synthetic directory are not followed; (4) near-name/parent exclusion is rejected; (5) ENOENT remains transient while permission failure propagates. All temporary files are under one newly owned directory; original assertion and cleanup errors are both retained. A future caller would need real exit 0 plus one complete PASS JSON with five checks and absent owned tmp. No browser, network, Git, process or free-space sampling occurs in this check.

Proposed check budget, **not granted**: 5 seconds wall clock, 256 KiB logical synthetic files, 64 KiB stdout/stderr. Its fixed payload is below 80 KiB; physical blocks/metadata are not claimed as hard-limited. This proves disjoint counting with deterministic sequential changes, not a live race scheduler or the entire monitor loop. Unchanged 64 MiB/8 MiB guards are separately pinned in the source audit, not claimed as threshold runtime coverage.

## Static verification and clean-code

Only known-file text/hash reads and TMP writes were performed. No candidate import, syntax execution, synthetic run, product test, Chrome, PG, process/free-space sampling, dependency write or project edit. All 86 prior byte/hash pins and four current product hashes matched; original b2 baseline copies matched; protected binding fields matched. The three retained source sites and unchanged limits were checked as text, not executed. The initial edit guard expected four sites; it was corrected to the actual three before writing the parent. This is preparation tooling only, not a test result.

Applied existing local find-skills and clean-code: use an explicit exact directory exclusion, retain ownership/error boundaries, avoid a generic scanner/supervisor, reuse the actual helper in the proposed test. No skill install or broad dependency scan. Remaining: independent source/synthetic-plan review, actual synthetic check permission/result, exact native parent acceptance and fresh runtime admission. The original feature remains unverified by browser.
