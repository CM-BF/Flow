# S01P08 local optimization ready for review

Recorded 2026-10-07T06:48:24.358937+00:00. Base `311e62158186177e344b49d24ed32e335268be1d`. Only production delta: adapter.publishPatches keeps its first-session check but omits the extra batch check when that session already exists. Every patch, final event and native start keeps its original forced ownership check. AttemptControl/periodic heartbeat/lease expiry and server event fences are unchanged; no new cache, timer, Module or public Interface.

| Injected sample | Before | After | Unchanged output |
| --- | --- | --- | --- |
| 32 fragments |15 assert/heartbeat calls|11 assert/heartbeat calls|5 patches /9 events /32768 text bytes|
| 512 fragments |15 assert/heartbeat calls|11 assert/heartbeat calls|5 patches /9 events /32768 text bytes|

The real adapter and AttemptControl are used with an in-memory CodexTransport and a mocked heartbeat method. Controlled clock remains0ms in the count samples, separating forced checks from periodic ticks. This verifies4 fewer redundant calls for these inputs, not real HTTP/SQL/latency/RSS/native/provider improvement. Existing coalescing determines the five patches; fragment count is not patch count.

Final11/11 distinct: two count/output cases; cancel between patches, cancel after session, denial before any native factory and sink failure; next check sees cancel/stop/disconnect; periodic heartbeat with expired late response; shutdown and only-inflight sharing. Initial baseline7/7, strict4 incomplete mock response diagnostics→complete typed fields→strict0/final7 remain historical; final optimization11/11+strict0 is a separate two-child segment. No failed assertion removed. Broad authorization caching is rejected: a previously successful check cannot hide the next cancellation/disconnection, and a late grant cannot resurrect an expired control.

C02 formally stopped adapter writes and amended v12→v13 at06:45:25.779Z; [handback receipt](adapter-handback-receipt.json). S01P08 fresh no-conflict amend1e4868a6 v1→v2 committed06:45:48.214Z,4scope. Only then was adapter edited; stream.test.ts remains C02-owned and unchanged.

Read [local.json](local.json) for all six child/input/raw records: baseline4 and optimization2 separately authorized. All final owned absent/mergedEOF, exact same-inode ownTMP removed. Max closed sample516B, not hard quota or continuous peak. Baseline old evidence cache419B was precisely cleaned after child closure; later cache lives inside TMP. Cumulative raw4481B, new segment832B/128KiB; no actual local holder or pending launch. Whole external segment wall was not captured; actual child timestamps and source work boundaries are reported separately.

Baseline source/closure/manifest at192d8b35 remain fixed Git historical inputs; only adapter intentionally differs from its87-file readonly closure. The original baseline manifest is not a claim that all current WT bytes remain equal. New final bindings refer to the optimization checkpoint. No PG/HTTP/native/provider, no changes to old S01 evidence. Product/main acceptance and independent review remain pending.
