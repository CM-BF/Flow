# CHAT05 native activity evidence

This slice exposes **bounded activity excerpts**, not a complete raw transcript. SDK0.3.290 full assistant blocks and user tool_result frames enter the existing adapter → runtime durable outbox → authenticated ordered report transaction → PostgreSQL → owner-only activity read routes. SDK queries in these checks are injected; **0 provider calls, 0 cloud calls**. No existing service, browser or personal installation was changed.

## Sources and interpretation

- Initial contract: ae4cc5c630b88616fe75c72eff9fc276a9f84f6c; current fixed implementation target is recorded in status/manifest after commit.
- Base: 3d4985fca060155435b159e0467815bf8e88b8b8. Full approved O07 c22412b5dd1368e3cdb14cd2c9afb6785b33a0e5 merged, including its K02 dependency; no local edits to their domain implementation.
- [sdk-source.json](sdk-source.json) binds the installed 0.3.290 package/declarations/license. SDK usage does not imply provider availability.
- Complete text/public-thinking/tool_use blocks, tool_progress, and tool_result are observations. `input-ready` is generated input, not execution success. `succeeded` means SDK reported a non-error tool_result, **not independent proof of external effects**. Detached calls remain running; late progress cannot downgrade a known terminal result. Final conversation replies still come solely from assistant-final.
- Session/source UUID/block index and parent/tool identity are validated; original transport retries and repeated identical native frames do not duplicate timeline entries. Source reuse with changed content/kind or another attempt is rejected. Historical user replay and anonymous nonconforming frames are not attributed. Partial stream deltas are not included in this first complete-frame slice.
- No body/signature is stored for redacted thinking. Missing thinking produces no invented record. Unsupported content stores only its type; no opaque native payload is copied.

## Body truncation is visible and not reversible here

Each detail retains at most 65,536 UTF-8 bytes, `truncated`, original byte count and a full-content SHA256. **Omitted bytes have no Flow retrieval path in this slice.** A truncated JSON prefix may be invalid JSON: consumers must display the truncation notice and render that prefix as text, never report a provider failure from parsing it. The full digest is an identity claim for unseen bytes, not a promise that Flow can retrieve them. Native sessions are not an implicit fallback store. REQ15 / CHAT05-06 owns later raw retention, pagination or blob references; no generic blob layer was added now.

## Checks

- Mapper red→green: [mapper-red.txt](mapper-red.txt), [mapper-green.txt](mapper-green.txt), 5 behavior tests.
- Initial real HTTP red: [http-red.txt](http-red.txt), 6 expected failures at old runner event union (`invalid_events`). The DB and HTTP server started; this is not a loading failure.
- Already-migrated-center idempotency only: [migration-check.txt](migration-check.txt), 1 selected pass / 12 not selected. Review P2 identified that beforeAll had already applied020 before the task was created; this output does **not** prove first upgrade.
- First closed chain: [closure-first.txt](closure-first.txt), 18/18 (13 HTTP/PG/runtime +5 mapper).
- Direct consumer initial output: [consumers-first.txt](consumers-first.txt), 66/67; older final-reply fixture contained anonymous assistant frames. Fixed mapper to omit unattributable frames without fabricating UUIDs or changing final-reply semantics. Original fixture/assertions were not changed.
- [checks-before-terminal-refinement.txt](checks-before-terminal-refinement.txt) preserves an earlier 85/85; final check adds absorbing terminal state for late progress and valid nested result assertions.
- Final selected check: [checks-final.txt](checks-final.txt); [typecheck-final.txt](typecheck-final.txt). Exact run totals/target in manifest/status; no all-product test claim.

Reproduce with Node24 / pnpm9.15.4 after frozen install:

```sh
pnpm exec vitest run apps/runner/src/native-activity/mapper.test.ts apps/server/src/native-activity/activity.test.ts apps/runner/src/claude.test.ts apps/runner/src/outbox-resume.test.ts apps/runner/src/runner.test.ts apps/runner/src/goal-tool-bridge/sdk.test.ts apps/runner/src/goal-graph-tools/sdk.test.ts packages/contracts/src/contracts.test.ts
pnpm typecheck
```

HTTP tests create and drop a random `flow_chat05_<uuid>` on local test PG55432, with dynamic server ports. They do not use flow_i01/c01 or personal preview. Tests mount exported native-activity and missing K02 migration seams; production export/client/server mounting belongs to Lead. The identical public report route, fencing, event schema, outbox and owner read functions are exercised. Two synthetic SDK cancellation/success runs and two lost-ACK recovery windows preserve lazy details; success final reply remains separate. DB-based uncertain projection is a seeded state check, not a new clock/lease benchmark.

## Remaining boundaries

No real model/tool/provider run or Web interaction was authorized or performed. The injected Read frames prove transport/state handling, not permission to execute Read (test adapter tools remain empty). Existing PreToolUse policy, goal graph/knowledge capabilities and native credentials remain unchanged. Cross-session subagent execution is not added; parent links must belong to the same recorded attempt/session. Broad capacity, large raw payload retrieval and partial token streaming remain unverified. Read pages are bounded to100 and omit bodies; no performance claim was made.

## Review P2 correction: first upgrade

The earlier test proved no-op reapplication only; its first-upgrade wording was too broad. Added a standalone `migration.test.ts` with a new random owned database and no createServer/beforeAll: actual legacy migrations1/2 → persisted task/runner/completed attempt/detail → assert versions exactly[1,2] and native table absent → first020 → byte-identical JSON projections of the existing rows, empty native activity page, versions[1,2,20] → second020 leaves rows intact and exactly one version20. The independent fixture pool is closed and its database dropped in finally.

[upgrade-review-fix.txt](upgrade-review-fix.txt): only this new test ran, **1/1**,415ms; [upgrade-typecheck.txt](upgrade-typecheck.txt): noEmit exit0. The prior85 were not rerun or relabeled. Product implementation remains unchanged from57d28e9. New test and documentation delta are bound separately in `upgrade-manifest.json`; Mika independently approved target216333f257f2be147d40b44e56e727167ea116b2, closing the first-upgrade evidence P2. The owner recorded this approval on2026-10-06 06:20:06 UTC; no additional tests or provider calls accompanied that metadata update. Production mounting and Web consumption remain separate integration work.
