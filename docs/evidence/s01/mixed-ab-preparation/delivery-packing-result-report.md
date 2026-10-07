# S01 buffered packing ABBA result

**Actual PASS, independent result review pending.** Execution `1a3f8aa5edb2444f2960e7433b31ccaf8bd046af`, fixed prepared packet `ca4846244573d5ec2ea879b27abc1b8bfe3c333d`; one consumed window `s01-buffered-packing-abba-once`. Source core82095227/caller8a933, approved packing product11ab. Four serial workers used the same2048trace, buffered policy,64×32 schedule/yields and existing receiver. New worker differs only in pg-delivery.js; old compiled/raw remain immutable. 0PG/HTTP/Chrome/provider/native/tsx/esbuild/install.

The new packing implementation used less synchronous finish wall time and measured delivery CPU in these two observed runs. This supports a local packing-cost observation for this fixed trace, not general speed, production latency, original pool cause or128-capacity claims. No further run was started.

| Order | PID | Fork→close ms | Start command→close ms | Record phase wall ms | Sync record ms | Observed wait ms | Sync finish ms | Measured CPU ms | JSON envelope B |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 old | 15496 | 204.779 | 156.696 | 86.199 | 1.986 | 83.682 | 63.414 | 74.298 | 129390 |
| 2 new | 15711 | 141.895 | 94.969 | 87.797 | 1.994 | 85.307 | 1.415 | 12.254 | 129385 |
| 3 new | 15848 | 139.612 | 93.406 | 85.809 | 2.007 | 83.270 | 1.433 | 12.321 | 129384 |
| 4 old | 15985 | 200.306 | 153.814 | 84.154 | 1.995 | 81.703 | 63.292 | 73.809 | 129381 |

Descriptive n=2 means: old/new finish 63.352875/1.423813ms; CPU 74.0535/12.2875ms; fork→close 202.542375/140.753458ms. These are arithmetic descriptions, not confidence estimates. Per-arm callback-drain and worker-start timing remain in [analysis](delivery-packing-result-analysis.json) and raw; parent complete plan 687.131833ms.

## Semantics and measurement limits

All four receipts are known:2048 input→506 nonSQL samples+4 SQLgroups,4 delivery messages, exact receiver nonSQL fields/ordinal and group key/count/elapsed equivalence, single summary/no extra. All64 batches delivered. All reporter and parent-control pending/dropped are0. This preserves the same aggregate policy; it does not preserve individual SQL records instead of aggregation.

Envelope counts include dynamic childMs/PID and serialized result metric fields. Their slight byte differences are not a policy/message-count difference. They are UTF8 application JSON counts, not IPC/OS wire bytes. CPU starts before delivery construction and stops after first callback drain; excludes startup and subsequent result-send/drain/close. Record phase includes64 yields, timers and OS scheduling; sync record and observed wait are separately measured, not subtracted to infer netCPU. Fork→close gives common parent-origin total per arm; first-message intervals are not used as speed evidence. FixedABBA is not randomization; cache/JIT/order/machine conditions and personal-user background UNKNOWN remain confounders. No personal services/tasks were inspected or stopped.

## Resource and clock facts

Checkpoint2026-10-07T16:10:12.408Z PID/PGID15395; four workers close0/null, dualEOF, zero worker stdio. OPS14 exit0/finalownedabsent/MERGED EOF, observed=retained=saved5266B, nofirst/secondary/signals; earlyEPERM remains in observations. ExactTMP `/tmp/flow-s01-packing-actual-fubdsza_` dev16777234/ino124304580 sampled0entries/0logicalB, sameidentity deleted; owner exactlstatENOENT16:10:32.815Z. Empty final sample is not a peak claim. No newKEEP or DB. Actual activity returned before metadata sealing; root relays to Web/manager.

Caller persisted endedAt16:10:13.150Z, pre-persistence950.968625ms; supervised783ms; /usr/bin/time real1.17s/user0.51/sys0.23. Tool first call yielded session65159 at1.001583125s; delayed final poll observedexit0 at16:10:32Z. Before16:10:11Z→final16:10:32Z gives a conservative22s observation envelope, not precise activitywall; tool chunks are not added. Exact whole externalwall and activepeak remainUNKNOWN. Formal exterior trace is [outer record](delivery-packing-actual-outer.json).

Fresh93 input pins/compiled/source/claim508fv3/6/cleanexactHEAD/fiveabsent outputs passed. Preflightfree20165656576B≥17454858240B; caller's own freshfree is retained in reservation. Floor includes declared otherpotential/KEEP and one managerreserve, not a measured hardcap. Candidate actual≤8MiB logical, TMP≤2MiB/raw128KiB; final charge recorded below and in manifest. Original60s window consumed; no retry. Old O1FAIL/O2NOT_RUN, prior per-query comparison, original ACK/cancel/final-validation limits and KEEP are unchanged.
