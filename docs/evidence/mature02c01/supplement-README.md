# MATURE02C01 supplementary P2 delivery

2026-10-06 17:22:50 UTC. Fixed source `6d1145de30eea1eb4c267c88386ebc0479dfbd99`, previous independently approved source `563b1ea151d8d26a2100238d8faf26b697f38d71` remains historical. Supplement pending assignment_review; no self-approval.

The ACK module rejects legacy runnerRequested whenever a valid turn settings snapshot exists. A final settings wrapper also requires effective.thinking=unknown, alongside the existing exact snapshot/model checks. No-wrapper queued ACK and legacy no-snapshot receipt remain valid. Neither protocol, transport, retry, key/body nor CLI behavior changes. The optional-capability P3 observation is not expanded into this patch.

Two new direct HTTP cases each first accept the valid counterpart, then reject contradictory external receipts with the existing fixed unknown error. One request with the original key/body per counterexample. Raw red: 2 failed/52 not selected. Same selection green: 2 passed/52 not selected. Focused types exit0; root types/old86/CORE29/PG/provider NOT_RUN. New total distinct inventory is 88 across historical rounds, not 88 rerun now.

Each process refreshed >=1GiB+8MiB reserve, finished below30s, no timeout/output cap or new dependency. Combined raw stdout is 11198B. Vitest --no-cache; no runner, subprocess provider or database. Red raw contains synthetic UUIDs and fixture values only.

[supplement-manifest.json](supplement-manifest.json) binds 107 entries: 2 updated source, 98 unchanged prior bindings, 6 new raw files, original manifest. All fixed Git/current bytes+SHA match. Existing manifest, raw, source review and old approval files unchanged.

Clean-code/codebase-design safe-point review: one existing effective-settings responsibility; two finite invariant checks, no new helper/FSM or public interface. Existing error boundary is reused and tests target receipt contradictions rather than duplicated implementation. Claim85784ec0 v1 fresh active at17:20:46; other7 product and all59 protected inputs unchanged.
