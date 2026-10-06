# WPF-MATURE-02 first semantic slice

Fixed implementation target: `0d0524c3439363d1fe60aad63f62817ba51fa2a5`. Recorded 2026-10-06 09:11:49 UTC. Independent review APPROVED by status_read / gpt-6-astra; Mika accepted 2026-10-06 09:15:59 UTC. No P1/P2; read-only review, no test rerun. Not integrated in main. Claim retained for review/fixes.

[Manifest](conformance-manifest.json) binds 6 source/README files, one TAP raw and 29 exact schema copies. Node v24.20.0 selected and passed 27 local tests, failed/skipped 0. All bound hashes match this Git target. The schema source is the frozen default-stable Codex CLI 0.154.0 E02 archive, not latest docs or experimental API.

[Interface](interface.md) separates this worker's catalog/final semantics from R06 transport and R05 production host/policy/profile. [Experiment README](../../../experiments/codex-app-server-conformance/README.md) documents call boundaries and local limits. [Plan/status](../../../plans/wpf-mature-02-harness-capabilities/status.md) remains the unique progress source.

No real app-server, account/auth, provider, model or network request was made by these tests. No R06 transport composition or production/Web behavior was tested. [Isolation plan](isolated-run-plan.md) is NOT_RUN pending enforceable controls and canary evidence. Full Claude/Codex settings and next-turn revision acceptance remain open.
