# READBOUND module quality and local segment

2026-10-07T09:44:00Z safe-point review. Task: MATURE06-READBOUND01; TypeScript/Fetch Web Streams/Node24/Vitest4; local find-skills selected brainstorming (bounded existing design), codebase-design (one decoder, three real consumers), clean-code sickn33@bdacd76 (domain limits, names, abort/error lifecycle, no retries or new transport). Skills paths are in design.md. No install.

Module interface: internal readBoundedJson(response, maxBytes, signal, description) counts decompressed UTF-8 before decoding/JSON parsing and owns only its reader lock. Native wrapper retains original domain validation and error text. FlowClient.request remains the one auth/cookie/CSRF/timeout transport; selected policies use separate success/error limits. Legacy stream calls remain unbounded as before; null error JSON now correctly falls back to its original HTTP status rather than dereferencing null. No contracts/server/projection change.

X01 integration: preserved index preimage2ea (62869B bd23661a…1fdbb) and exact plugin-runner donor9b (2687B f7436544…8ead9). Both are now main3811048522dcc8a896e7ccf09872389b14bccd63 per X01 handoff; this branch's fixed base remains d022. The donor exists only as evidence input with a narrow resolver/rootDirs, not as a separately submitted product file. Main intake must use that already-integrated dependency and preserve those three lines.

Independent pre-implementation cap calculation by chatui01_owner matched reference5324 / settlement19763 / metadata100=554123 / default20=128123 / patch8=442760 / fullblock=6296793. Boundaries cover fixed valid compact center JSON, not arbitrary whitespace, bad DB fields, compressed wire or heap peaks.

Red: 9 selected, 2 passed, 7 failed (timeouts in formerly unbounded/uncancellable mocked reads and old oversized-error semantics); raw preserved, original test text hash matches receipt. PID42768 exit1/final absent/EOF complete, historical EPERM led original conservative caller to KEEP its empty TMP. Mika authorized exact dev/ino empty-only rmdir; separate receipt preserves that history.

chatui01_owner independently identified the old caller predicate's misuse of historical observation EPERM. Future predicate follows OPS14 final state plus reaped exit, actual merged EOF, full capture bytes, no signal unknown, no secondary failure, and only normal/nonzero exit as primary. History stays in observations. This is covered by12 pure Report cases, without launching test processes or operating on TMP inside those cases.

Final local segment: green45/45 across 4 explicit paths (assistant-stream7, native-body19, selected-bounds15, shared-reader4), focused TypeScript exit0, pure caller12/12. Four supervised children including red total12.605s supervision / raw4564B. Per-wrapper walls sum12.67353354s before final persistence, not tool-wide wall. All final owned groups absent, merged EOF, raw observed=retained; red's separate authorized cleanup and later same-inode empty-only cleanup left no owned TMP. TMP is before/after sampling, not realtime OS isolation. Fresh gates included existing5.334GB floor +SVC06 declared676MiB +own19MiB. No PG/provider/Chrome/install; local returned09:43:48Z.

No unresolved product issue found in this safe-point pass. Independent implementation review pending; local proof does not claim network transfer speed, process heap cap, real provider, latest-main whole-suite or deployment.

## 2026-10-07T14:10:18.091Z status timestamp normalization

Metadata-only follow-up under the original claim44849884 v3/6, confirmed active for this owner at2026-10-07T14:09:35.742Z; original branch HEAD9dfbb65dc13e0dec143555ee84fdc47d6f03f183 was clean. Existing main-accepted.json observedAt2026-10-07T10:07:46.923668+00:00 remains unchanged. Only the completion field is represented as2026-10-07T10:07:46.923Z; explanatory text is in the time-source field. Original start09:32:16Z is preserved, with no inferred event time.

Used the existing own-status parse recipe against main0da0dfcc68da42cc38d7c8e982f6b16321118391 status.mjs (SHA2564eafd635647a5a5657e536dec721ec6bfd6b51ce65f3327c22ad7994f4cde7ef). Before: errors[]/humanMissing[] but one timing issue for the completion field. After: errors[]/humanMissing[]/timingIssues[], start and completion known, WPF-MATURE-06 parent and Mika co-lead resolved. Explicitly inspected timingIssues rather than trusting exit0. This is status shape validation, not a live dashboard refresh or product check.

Reused installed find-skills local-first method, codebase-design and clean-code sickn33@bdacd76: one existing time contract/parser, no new normalization helper, no product or raw evidence changes. Only this quality record and the owner status changed; no engineering tests/PG/service/provider actions. Commit/push then stop all remaining claim scopes before release; release receipt stays external and is not backfilled after release.
