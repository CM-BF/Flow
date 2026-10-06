# DPERF04 lifecycle preparation — source-only

Implementation `45f8a185ad0d43543a3c9eca7a29da97ebb31ba9` changes only shared runBrowserCheck imports/lifecycle. Six other sources, the whole task-links file, summaryFixture and summaryChecks/main bodies are byte-identical to b17; see [audit](source-audit.json). Parent candidate `/private/tmp/dperf-b2` is PREPARED_NOT_REVIEWED_NOT_RUN, no gate. Original bd053 candidate remains untouched.

## Ownership / Interface

Parent owns one cumulative60000ms clock and two separate process groups. It first validates fixed source/32 existing readonly inputs, then launches pinned native Chrome with its normal native sandbox and exact owned profile/temp/cache/crash paths (including MAC_CHROMIUM_TMPDIR and BREAKPAD_DUMP_LOCATION). It captures actual return code/signal, pipe EOF/close observations, full bounded stdout/stderr and requested group signals. Node retains the existing custom sandbox and receives exact parent-bound Chrome PID/PGID/loopback CDP endpoint. Worker only runs the original check, closes its context/CDP transport/server/fixture, and never spawns or signals Chrome. Each entry remains separately bound; summary-detail does not automatically start task-links.

DPERF-TAIL: resources are sampled after both groups are reaped and before scratch removal, plus after result/budget writes. Non-ENOENT os.walk failures propagate; observation failure enters FAIL while owned cleanup continues. Actual monotonic afterResultBudgetWritesElapsedMs distinguishes real final observation from the planned deadline. Final record serialization follows that observation, so this is not an exact final-byte timestamp. Limits remain64MiB observed scratch /8MiB retained /1MiB worker log and64KiB Chrome streams; overflow fails rather than silently losing log bytes. Polls are not OS quotas.

DPERF-SOFT-STOP: parent SIGTERM/INT sets a stop flag and records failure even during cleanup. Same finally TERM/KILL/reaps both groups; unknown group absence retains scratch. Outer finally restores prior handlers even when evidence persistence fails. SIGKILL/power loss cannot be guaranteed. Resource errors do not bypass safe owned cleanup; failed persistence cannot be claimed as a completed run.

## Separate authority decision still required

Native Chrome is **outside the custom outer OS file-write/egress restriction**. Owned directories/background flags/native sandbox do not make this equivalent to bd053 or guarantee no writes/network elsewhere. No personal directory permissions, sandbox-disable switch or discovery was added. Settings research is reuse, not DPERF acceptance. `nativeChromeBoundaryApproval` stays null; future manager must pin a genuine Lead JSON decision for this exact parent and wrapper digest before a fresh resource/shared-window gate. No such record is fabricated here. Required trusted record fields are decision=ACCEPTED, boundary=native-chrome-sibling-without-custom-outer-write-or-egress-sandbox, runnerSha256 and workerSha256 (the shared wrapper digest).

## History / validation

Root+manager b17 source and populated-binding reviews are archived; their conclusions are scoped source-only. The new root addendum REQUEST_CHANGES is preserved and this preparation responds to its twoP2 without declaring them independently closed. Historical abd2 Node8/8 and3950ms stay bound to that target; no rerun. Browser0/60000ms (15000cleanup) unchanged, fullfeatureUNKNOWN/mainNOT_INTEGRATED. Manual byte/diff/hash/source review only; no runtime/import/parser/free sampling. Private binding now names actual sealed metadata HEAD `3a51a78ebd7f90e36fa2c0c1f5e9d83c2ec4e51c` (normalpush/ls-remote equal, clean). Implementation and all product hashes are unchanged; this supplies no execution grant.

Skills: reused localfind-skills/clean-code/codebase-design/webapp-testing. One parent owns budgets/processes, worker receives only a fixed endpoint, observation errors propagate, prior reports remain immutable. No framework, dependency install, real registry/4320 or PG. Existing Node evidence is not relabelled as browser or current lifecycle evidence.
