# One bounded diagnostic batch — sealed result

Result target `d35c59682133d77d8581f3c3bce89a4ab3416b26`; recorded 2026-10-06 10:17:08 UTC. Launch source `7297986fbc879bb5040879daf97c7d5bb8b657ac`, independent architecture_read/gpt-6-astra APPROVED 2026-10-06 10:13:38 UTC, no remaining P1/P2; Mika fresh preflight/one-batch authorization message cites 10:14:03 UTC and HEAD548a63d clean. One invocation executed at10:14:37.579Z. [Run manifest](run-manifest.json) binds10 safe raw files, fixed input and source manifest.

**Diagnostic collection and cleanup completed; canary FAILED and actual isolation/catalog remains blocked.** The safe CLI exited0 only because bounded collection/cleanup completed. It does not mean the seven canary checks passed. The [safe CLI](batch-cli.json) reports finalElapsedMs282.794417 after final result fsync, withinBudget=true, cleanupComplete=true. The durable [result file](batch-result.json) explicitly records the earlier before-result-persistence elapsed278.462ms. No recursive receipt or hard OS IO timeout is claimed.

| Attempt | Observed result | Limit of the evidence |
| --- | --- | --- |
| Known stderr control | confirmed-exited/code7;40bytes, hash ca5c7bbdd4599b7cb7154d4895952561b9f7e94d48d84dba22c898910af1130c; expected-control | Confirms R06 capture for this unsandboxed synthetic control |
| Original profile canary | confirmed-exited/SIGABRT, exitCode=null;0 observed stderr bytes, empty hash e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; classification=empty; passed=false | Parent pipe received0bytes; does not prove sandboxed child could write stderr or had no error text. Exact cause/denied rule unknown |

Both captures reached observed stream end and child close, with no truncation/observer failure/incomplete. These are pipe-capture facts, not proof of what the child attempted to emit. No valid seven-check canary report is available. All native null/unknown values remain unchanged. No inference about access:none or installed Codex behavior.

factoryCalls=2, thirdAttempt=NOT_RUN. The one batch reservation and each attempt reservation are durable; unknown/failure cannot refill the budget, create another clock or justify retry. 0 real app-server/auth/provider, no grants changed, no third child. [CLI exit receipt](batch-cli-exit.json) records the exact authorized command once.

Canary listenerClosed=true and retainedRoots=[]; actual copied profile/preload/peer hashes match fixed inputs. Both private artifacts were flushed, closed and removed; privateRootRemoved=true, retained=[], cleanupComplete=true. The known allowed, denied and private root paths were checked absent after completion. Early attempt artifact checkpoints describe pre-cleanup retained=true; final privateArtifacts/privateCleanup describe their subsequent deletion. Raw private stderr was never output or committed; batch-cli.stderr is empty.

Current state: STOPPED / sealed. Independent result review NOT_STARTED. Further work is bounded read-only source/rule research only; no new child, OS event scan, private crash history, raw diagnostic read, grant change or actual catalog/provider run. R06/production shared modules can be delivered independently of this unresolved platform startup.
