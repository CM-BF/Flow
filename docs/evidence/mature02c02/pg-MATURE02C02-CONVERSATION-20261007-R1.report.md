# Conversation PG R1 — FAILED, result review pending

Execution `668a0683a94202b2f53ade7f258308f84bd8fbe0`, source `e7a130c4` over42de/bfcb, prepared317 inputs1810789B/31SQL, manifest0dd19d82. The one authorized namespace is CONSUMED/CLOSED and shared PG was returned immediately. Runtime claim was v12/72; after closure, adapter.ts was explicitly stopped and atomically removed in v13/71, without rewriting the execution claim/input.

One run:6 selected,5 passed,1 failed; child and final tool exit1; finalReceiptWritten=true/success=false. The first five cases passed: native-v1 profile LIMIT filtering/native-v2 pins;035 and Claude/native creation/replay; deterministic hidden-first/between conversation pagination and direct-route denials; two public conversation turns on the same runner/thread with two closed injected transports, typed Unicode digest and unknown execution fields; existing queue controls/replay/promotion/cancel.

The last case failed at codex-pg.test.ts:145 while attempting to UPDATE an immutable execution profile. The database trigger rejected the fixture mutation before the intended native-v2 corrupt-sentinel GET/assertion. This is an observed setup failure; it does not prove that sentinel rejection succeeds or fails. No product fix, assertion removal, retry or further PG run followed.

Production center/runner paths and actual PG/HTTP used a persistent injected transport, not native Codex/provider.122HTTP requests, two completed task turns, sameThread=true, instances closed with reads1/2; typed final digest0906e5b5e560b0a97c83dbe456cc3c6ca8fae141db7b7ed9e761806e8e9302c1. Model/settings evidence remains unknown. Native recovery, UI, installation migration upgrade and complete C02 remain unverified.

Resource receipts: PID97064 exit1, process group absent/signals[], stdout/stderr EOF,183 observed/retained raw bytes. DB name/OID1238600/random marker match reservation and CREATE ACK. Fixture reports runners/app/pool/admin closed,0connections, ordinary DROP/absence, retainedDatabase=null and cleanupErrors[]. DB end logical sample12770327B;14connections is configured upper bound, not a peak measurement.

The original strict acceptance gate rejects primaryPhases even when cleanup succeeded: fixtureReceiptConfirmed=false, errors TESTS_FAILED_OR_SELECTION and RESULT_UNKNOWN. Outer TMP is intentionally KEEP, dev16777234/ino123593883, with no final inventory; one fixture child root was removed. Post-run only exact lstat confirmed these facts. No old KEEP root was visited. The run is not PASS and complete TMP accounting is not claimed.

Operator06:44:46.236736→06:44:50.251186Z:4.01450675s before final receipt; delivery4.014786584s. External tool second observations06:44:45→06:44:50 give conservative≤6s, not an exact whole wall. Metadata/read-only post-checks occurred after actual return. Active TMP/DB peaks unknown; sample limits and128MiB DB/WAL reserve do not become hard quotas.

A preparatory Python-stdin decoding failure occurred before any admission code or PG wrapper; no files or target were created. Subsequent shell Git commands were no-ops. It is preserved in admission metadata; the corrected ASCII preflight passed before the single actual invocation. No automatic namespace reuse.
