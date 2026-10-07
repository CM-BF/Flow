# S01 buffered chunk packing

Source `a4ceb283b37dc5cd73ebb072bb912d110b59f78a`, product delta `11abf474fdb7c25cef2ebdc0135da1d0c0bcf5cf`; base `32cb3f56d9eb2fccd352e64e800b1b797bbc4f6a`. [Bindings](pg-delivery-chunk-review.json). SOURCE_READY / VALIDATION_PENDING, ordinary paused before any child. This is not a new replay grant.

## Responsibility and invariant

The existing private `createPgDelivery` owns retention, finite SQL aggregation, order, first fault and finish-once. Public interface and actual consumers are unchanged. The old finish builds growing array copies and repeatedly stringifies prefixes. The delta encodes each retained entry once for byte accounting, counts only the comma between adjacent entries in that array, and recomputes the encoded empty envelope after each flush so ordinal digit changes are included. A flushed object is never reused. Final `send` still serializes the complete message and checks its actual UTF-8 byte length before any sink call. This remains the authoritative 64 KiB (or stricter configured) bound; bridge/channel full-envelope checking is unchanged. Oversized entry, failed/partial sink and unknown still stop, never retry, and preserve first fault.

Finite copied fields contain permitted enum/epoch text and validated numbers. Unexpected Unicode/escaped private fields and caller `toJSON` are not admitted; the byte calculation nevertheless uses actual JSON encoding, not character length. No serialized-string cache, generic packer, additional state authority or production SQL/pool change. The expected algorithmic reduction is fewer growing-prefix serializations, not a measured CPU or latency improvement.

## Direct validation prepared

Four new cases cover bounded encoding work, exact boundaries and separate array commas with ordinal 9/10 and 99/100, oversized/private-field rejection, and an injected final-encoding mismatch proving the final check remains authoritative. Selected existing tests cover samples/SQL aggregation, sample/group/byte capacity, partial sink, and the actual receiver's eight finite semantic cases. No whole old A/B/64-test or real replay rerun.

The local caller reuses fixed OPS14 and its already-reviewed strong process/capture predicate plus bounded same-inode inventory before deletion. Explicit environment/dependencies/source inputs, final process/EOF and each raw are recorded in one `pg-delivery-chunk-local.json`; unknown keeps its own root and stops new launches. Each mode gets at most 30 seconds; five children/90 cumulative and original 15:45:09Z wall cutoff remain. Subsequent commands require resumed ordinary authorization; new actual replay remains NOT_OPEN. All old source, generated JS/input manifests/raw stay fixed at their historical Git.

Future ordinary command (not executed at this source checkpoint): `/usr/bin/env -i /opt/homebrew/bin/python3.13 -I -B docs/evidence/s01/mixed-ab-preparation/pg-delivery-chunk-local.py direct`, then `types`. Latest declared fresh floor 14,414,970,880B; manager higher sum wins. Shared build drain currently blocks launch. 0 PG/HTTP/provider/Chrome/install/performance replay.

## Independent review request

Review only this `pg-delivery.ts` delta, four new direct tests and the eventual bounded local result. Check exact output semantics, header/array accounting and final full-envelope authority; no need to re-review old 2048-trace actual. The db15:23:32 result approval is archived separately in [result-review](delivery-replay-result-review.json) and does not approve this optimization. Original O1 FAIL/O2 NOT_RUN and all KEEP unchanged. Skills: existing local find-skills/codebase-design/clean-code; narrow responsibility, explicit unknown, no redundant framework.
