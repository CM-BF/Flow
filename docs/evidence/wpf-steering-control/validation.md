# Validation

Fixed implementation `b2cbbca5f823e122ec4e234e16fb7ef45a063af9`, base `ca4c3f723d2f786601e7cc9bd0363d756d974810`. [checks.json](checks.json) binds all six source/test files to both browser reports. Tests actually ran with HEAD `a3bf1b0a8122de23e72722e0d36e4c421f954f73` plus uncommitted implementation; the reports retain that HEAD and dirty listing. The later target is a source hash binding, not a rewritten test timestamp.

- Direct **33/33 PASS**, Vitest 4.0.18, 01:58:33 -07:00 / 08:58:33 UTC; [direct.log](direct.log).
- Web TypeScript exit 0; [typecheck.log](typecheck.log).
- Development **8/8**, 2026-10-06T08:59:00.755Z; [report](development-browser.json), [log](development-browser.log).
- Production fixture build + **8/8**, 2026-10-06T08:59:10.737Z; [report](production-browser.json), [build/browser log](production-browser.log).
- Both browser reports have page errors `[]`, failure `null`. Public FlowClient crossed actual localhost HTTP to two independent simulated centers; no DB/provider/model/real-center interaction.
- Source staged diffcheck exit 0. Raw command logs remain unmodified; full metadata diffcheck exceptions, if any, are listed below separately.

Meaningful boundaries: gate/read zero before opening; schema/UTF8 error retains draft and allocates no key; digest concurrency/revoke; identity/digest/bytes ACK checks; unknown original-key retry and later4xx; saved replay preserves newer receiptRevision; refresh all loaded pages at unchanged revision; capacity refusal preserves unknown; read/ACK races; timeout and late rejection; hidden/offline/revoke/same-ID center replacement. Browser covers native Enter/ShiftEnter/IME, new draft independence, accepted+unavailable response, recovery, paging, focus, reduced-motion setting and 390px light/dark horizontal bounds.

Owner visually inspected final production desktop light and narrow dark: muted text, body, focus ring and controls remain legible. No claimed performance benchmark or arbitrary layout percentage.

## Preserved failures and superseded runs

- [first-typecheck.log](first-typecheck.log): TypeScript cursor inference needed an explicit number annotation; subsequent [second-typecheck.log](second-typecheck.log) and final typecheck passed.
- [first-direct.log](first-direct.log): 27 assertions passed but the run failed on a test-owned deferred rejection before the port had been invoked. The test now confirms invocation before disposing/rejecting; production abort protection was retained.
- [first development report](first-development-browser.json), [log](first-development-browser.log), [failure image](first-development-failure.png): fixture socket destruction caused Chrome to transparently retry the same POST and receive its saved ACK, invalidating the scripted expectation of unknown. The fixture now deterministically saves first and returns503. This models an unavailable response, not a raw captured production transport failure.
- [history-budget-red.log](history-budget-red.log): one test counted an extra initial attempt against the four-attempt budget. Corrected initial setup, without changing the production budget.
- [interleaving-red.log](interleaving-red.log): two genuine control defects, 31 passing plus2 failing. A late state read could erase a new ACK's metadata, and a new ACK could introduce a different native session for the known attempt. Shared merge validation and final-batch reconciliation fixed both; final33 passed.
- `before-stale-fix-*-browser.json` and `before-interleaving-fix-*-browser.json` preserve successful earlier source snapshots. They are not the final source evidence.

The complete implementation was frozen after final browser execution. Remaining review is independent and is not inferred from author checks. Page-memory receipts, standalone UI, no actual App integration and real-center boundaries remain as in [interface](interface.md).

Full staged metadata diffcheck is nonzero only for preserved raw logs: `direct.log:11`, `first-direct.log:37`, `history-budget-red.log:57`, `interleaving-red.log:72,81`, `second-typecheck.log:4`, `typecheck.log:4` (trailing blank lines/one diagnostic whitespace line). The implementation diffcheck is zero. Raw logs were not cleaned to fabricate an all-files-zero result.

## Independent review

Root APPROVED fixed b2cbbca5f823e122ec4e234e16fb7ef45a063af9 after 09:07:34 UTC on 2026-10-06. Independently ran 33 direct tests (09:02:26 UTC, 2.31s), read all six files, verified six hashes/source diffcheck, and performed a separate CUA journey on63251. This was not a rerun of the author dev8/prod8 or typecheck. Exact observations and remaining boundaries are in [review](../../../plans/wpf-steering-control/review.md). No product source changed after fixed approval.
