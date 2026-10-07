# S01P08 Native stream ownership cost

Parent FLOW-001 / co-lead mika. Bounded measurement and safe local optimization, base311e621. Keep native side-effect checks, per-patch current authorization, periodic heartbeat, lease expiry, cancel/revoke/disconnect and unknown settlement. No PG/provider/native execution or benchmark framework. Original A/B did not measure this path.

- [x] S01P08-01 Quantify actual adapter + AttemptControl calls through injected transport.
- [x] S01P08-02 Eliminate only proven redundant checks, or document why unsafe.
- [x] S01P08-03 Direct safety/behavior checks and independent review.
- [x] S01P08-04 Controlled main intake; retain unresolved claims/measurement limits.

Candidate: retain a check before initial session emission and every patch; skip only a second batch-level check for an already published session. No freshness cache or modified AttemptControl semantics. C02 adapter.ts 已在06:45:25正式交回，本claim于06:45:48成功amend后才实施；stream.test.ts仍属C02。06:52:59独审通过，main a72181d7已接收，2026-10-07T07:10:42.133Z本owner核实；07:10:53.290Z产品范围原子交回，仅保metadata范围等待dashboard登记。
