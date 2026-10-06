# WPF-MATURE-02 evidence

Current thin-consumer implementation `38516be71bf267ab546347a39da2adbe71f79e20`: [production import report](production-import/README.md), [manifest](production-import/manifest.json). One 27/27 direct-consumer run passed; independent review NOT_STARTED. Production source from reviewed main `4391bbf9f1785212d098ef6aa1c01a0320a003d3` is unchanged; the experiment now re-exports it within this same worktree.

The following records are historical fixed slices; their source hashes do not describe the new thin wrapper.

## Original semantic slice

Fixed implementation target: `0d0524c3439363d1fe60aad63f62817ba51fa2a5`. Recorded 2026-10-06 09:11:49 UTC. Independent review APPROVED by status_read / gpt-6-astra; Mika accepted 2026-10-06 09:15:59 UTC. No P1/P2; read-only review, no test rerun. Not integrated in main. Claim retained for review/fixes.

[Manifest](conformance-manifest.json) binds 6 source/README files, one TAP raw and 29 exact schema copies. Node v24.20.0 selected and passed 27 local tests, failed/skipped 0. All bound hashes match this Git target. The schema source is the frozen default-stable Codex CLI 0.154.0 E02 archive, not latest docs or experimental API.

[Interface](interface.md) separates this worker's catalog/final semantics from R06 transport and R05 production host/policy/profile. [Experiment README](../../../experiments/codex-app-server-conformance/README.md) documents call boundaries and local limits. [Plan/status](../../../plans/wpf-mature-02-harness-capabilities/status.md) remains the unique progress source.

No real app-server, account/auth, provider, model or network request was made by these tests. No R06 transport composition or production/Web behavior was tested. [Isolation plan](isolated-run-plan.md) is NOT_RUN pending enforceable controls and canary evidence. Full Claude/Codex settings and next-turn revision acceptance remain open.

Separate isolation-design target: `e535fc04364c3be4a08ab0c6bc8bebe25afed977`. Its [manifest](isolation/manifest.json) and [review](../../../plans/wpf-mature-02-harness-capabilities/review.md) record the static-only design approved by Mika at 09:28:12 UTC for one synthetic invocation; no real Codex authorization. The subsequent invocation result is recorded below. This does not extend the semantic approval.

Current one-shot result: **FAILED / STOPPED**. See [runtime report](isolation/canary-run-report.md). One authorized synthetic call aborted with SIGABRT before a valid canary report; child/listener cleanup confirmed, no retry. No real app-server/provider/auth. Static source records remain historical and unchanged.
