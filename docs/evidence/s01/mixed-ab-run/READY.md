# S01 fixed event-state A/B — READY for intake

Independent result review: **RESULT_FIDELITY_REVIEW_APPROVED**, db_transaction_owner / gpt-6-astra, 2026-10-07T06:09:46Z, **0 P1/P2**. [Receipt](result-review.json), [report](report.md), [immutable manifest](result-manifest.json). Result target `914cb63824f614223b62153c770186e9d46d586e`; reviewed packet `aa2c2112b91ff31105d7ed46a88c09cf4edcf054`; execution `b75f1a2e250556265a24c825860e8549705b98cf`. Final metadata commit is read from this branch; this file does not invent its own commit ID.

Both fixed historical sides passed, each 128 fixture tasks/attempts/sessions, with the original resource closure and byte receipts. SQL calls decreased (53,279 → 48,601), but event HTTP window p95 increased (91.818 → 123.648 ms): **no consistent latency gain was demonstrated**. Fixed A→B order, observer overhead, shared PG and reused driver memory limit attribution. This is not latest-main, real SDK/provider capacity, SLO or complete-S01 acceptance. The exclusive window has been returned; no further run is authorized.

P3 measurement clarification, superseding only the wording in report.md:9: HTTP elapsed includes request preprocessing, fetch, response-body reading and JSON parsing up to the observation point in child.ts:86–87. It excludes subsequent ACK observation and Response reconstruction at line102. No statistic, raw, source or original manifest changes.

Intake is evidence/owner-status only: retain the fixed run directory from result914cb, add this READY and review receipt, and use the current authoritative plans/s01-runner-capacity status/review. No application source or new test execution is requested. Main remains **NOT_INTEGRATED** until an actual receipt. Original six TODOs, open SDK/ACK/browser/SLO requirements, historical idle result and separate S01P07 main facts remain distinct. Claim508f v2 is retained.

The original 4MiB common final reserve covers this offline metadata; current cumulative conservative measurement is recorded below. Runtime191,067,625B already includes the reserve, so archive bytes are not added to it again. Automatic elapsed time excludes later manual review/Git work; 28.02s time-p, 27.710442s entry and 40.037s tool observation envelope remain separate. DB/WAL final/peak remain UNKNOWN.

Execution Lead delivery: canonical READY in the registered owner worktree, using the existing read route. The current v2 direct-message limitation is not bypassed. No duplicate 58MB archive or new framework is created.

Final reserve check at 2026-10-07T06:16:18.564344+00:00: 14 direct run-root files plus the three whole plan documents measured **364,156B** before this final note; **8,192B** retained for these final edits gives **372,348B**, within both the prior397,266B upper allowance and original4,194,304B reserve. No A/B raw is double-charged.
