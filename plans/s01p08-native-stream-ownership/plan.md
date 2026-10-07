# S01P08 Native stream ownership cost

Parent FLOW-001 / co-lead mika. Bounded measurement and safe local optimization, base311e621. Keep native side-effect checks, per-patch current authorization, periodic heartbeat, lease expiry, cancel/revoke/disconnect and unknown settlement. No PG/provider/native execution or benchmark framework. Original A/B did not measure this path.

- [x] S01P08-01 Quantify actual adapter + AttemptControl calls through injected transport.
- [ ] S01P08-02 Eliminate only proven redundant checks, or document why unsafe.
- [ ] S01P08-03 Direct safety/behavior checks and independent review.
- [ ] S01P08-04 Controlled main intake; retain unresolved claims/measurement limits.

Candidate: retain a check before initial session emission and every patch; skip only a second batch-level check for an already published session. No freshness cache or modified AttemptControl semantics. C02 owns adapter.ts/stream.test.ts until exact handoff; never modify before atomic receipt.
