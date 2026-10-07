# X01 terminal handoff / report-only recovery

Segment starts 2026-10-07T09:32:47Z;20min,local children cumulative120s/each60s,TMP16MiB/raw512KiB/source-meta2MiB.0PG/browser/provider/install. Reuse existing local recipe and fixed dependency mirror; only changed modules/direct tests get override, no public PG resupply.

EventOutbox remains sole event persistence/report owner. A bounded emitBatch accepts the same codec(max50/MAX_BATCH_BYTES), captures all IDs/sequences before first HTTP, and reuses its tail/barrier/pending-events.json. Persistence uses file sync, rename and parent sync; failure is sticky and reports nothing. Existing body/finalization behavior stays on this single outbox.

Runtime alone assembles plugin artifact+verification+completed after settled/ownership/abort gates. Validated completed ACK must call the existing AdmissionJournal.complete before the report callback resolves and pending file is unlinked. Recovery already follows this order and only replays fixed stored event IDs/bytes; no package reinvocation or fresh phase keys. A crash before a result is durable remains UNKNOWN, not magically recoverable.

Direct proofs: lost ACK replays same terminal bundle once without reinvoke and preserves pin; journal cleanup failure retains pending; crash after journal success before unlink safely replays; owner-fenced replay retains uncertain bytes; unknown phase/outcome retains original assignment. Normal adapters and activity-body/steering paths keep existing semantics. No new scheduler, recovery DB or second journal. Current baseline outbox must intake fixed main P02 body branches, not stale physical base.

Ownership: v22 adds only outbox.ts and plugins/terminal-outbox.test.ts, existing runtime.ts/runtime.test.ts already owned. client/index explicitly STOP/amend handed to READBOUND01; runtime/wiring reviewed intake remains pending independent of this new implementation.
