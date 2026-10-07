# S01 event-state A/B operator handoff

Recorded 2026-10-07T05:56:14.683444+00:00; status_read / gpt-6-astra. This is preparation, **NOT_OPEN / NOT_RUN**. Current observation HEAD121c3022f55f6b4cff5711f00f7038bff8740d80=origin clean; a single fresh coordination list confirmed claim508f9c85-a27c-4382-bfe9-caca43be4b0e v2 ACTIVE, owner/branch/WT and all5 literal scopes unchanged. No new take/amend.

## Fixed entry and acceptance

Window identity is the existing exact literal `s01-event-state-ab-once`; do not substitute a timestamp namespace. Use the clean full40 execution HEAD supplied in the subsequent explicit OPEN. The commit containing this handoff is the candidate; its exact hash is returned to Mika after push, not invented inside its own contents.

Reuse [d3ba approved entry](preparation-deadline-fix/ready.md), source d3ba03a88b8d25d134b7abade7f55f8198b182ba over da932; manifest SHA4a555e969cb445e913c6bb5bf99a7757166eb3a73c56cabc2bd445a53ab39040 and architecture14:11:28/Mika14:12:06 approvals remain historical. Fresh41 unique current experiment/read-only bindings match the approved overlay; zero source/raw changes. No repeat64 tests, imports, source export, PG or runner start. The root docs/evidence/s01/mixed-ab-run and therefore A/B outputs are absent.

A=a3e670b906c1b65d586b7730ca19da83109f1dcc; B=aae1eb1054d75e78273e7c91ed048aeac80195da. Within the exported apps/server/apps/runner/packages/root declarations, only events.ts and its nonruntime test differ; all other repository evidence/history differences are outside the exported production input. This measures the fixed events optimization, not latestmain, SDK capacity or SLO.

## Resource and sequence gates

Original automatic limits remain300s/512MiB: prep15s; A/B each135s/240MiB; common32MiB including4MiB final receipt/CLI/archive reserve. Each side exactly one candidate8-runtime×16 fixture case, at most128 submitted tasks/attempts; total≤256. A must PASS and fully close children/streams/DB/journals/evidence before B; B requires≥150s and≥240MiB remaining. Failure/unknown consumes the one attempt; no retry or replacement tasks. Both sides use separate random owned DBs on existing localhost:55432 and dynamic HTTP ports, in sequence; 0provider.

Proposed physical admission reserve for the later OPEN: existing shared-floor4,053,008,384B + experiment512MiB(536,870,912B) + **additional1GiB(1,073,741,824B) PG/WAL headroom** = **5,663,621,120B fresh available minimum**. The1GiB is a conservative scheduling reservation for sequential owned DBs and shared WAL, not measured DB growth, a hard quota, or permission to consume the existing floor. No PG query/preallocation or disk sample was made in this preparation. Lead must confirm the existing cluster/WAL filesystem conditions and no incompatible actual holder at OPEN; if unavailable, do not spawn. Visible stream/input byte accounting is not whole OS/disk/WAL accounting. Existing source input/stream/result bounds and 1s low-space monitor stay unchanged; shared-growth uncertainty is not hidden by this reserve.

Recovery full7 has priority. Required before execution: actual Recovery process/EOF/DB/Chrome/TMP closure, other two teams' ordinary runs at a confirmed safe stopped point (read-only/source work may continue), explicit Mika OPEN, then fresh own claim/head/origin/clean/input hashes/output absence and disk floor. Do not infer release from elapsed time or source-only activity. Direct collaboration delivery to Web co-lead01a10ec2-ff1a-76d0-a277-446baf89b19d returned agent-not-found once; no retry. Mika must relay the operator handoff using the existing read-snapshot coordination route.

## Exact invocation after OPEN only

From this worktree, with `EXECUTION_HEAD` set to the exact later OPEN40hex (never auto-select a moving ref):

```sh
set -euo pipefail
set -a
source /tmp/flow-coordination.env
set +a
export FLOW_S01_ADMIN_URL="$FLOW_COORDINATION_DATABASE_URL"
export TSX_TSCONFIG_PATH="$PWD/experiments/runner-capacity/mixed/tsconfig.json"
export NODE_DISABLE_COMPILE_CACHE=1
exec /usr/bin/time -p /opt/homebrew/opt/node@24/bin/node --import tsx experiments/runner-capacity/mixed/ab-main.ts s01-event-state-ab-once "$EXECUTION_HEAD"
```

The existing driver validates localhost:55432 and changes only the database path to postgres for admin, without printing credentials. The center/runner child TSX config uses each frozen exported root, preserving same-root workspace resolution. Existing process owner remains the only child lifecycle authority; no new supervisor/loader. Capture safe CLI/time output through the tool; archive exact output and the tool completion/exit externally with original timestamps. Internal CLI callback time, `/usr/bin/time` and whole tool start→completion must be reported separately and all automatic work must fit300s. Import-before-entry and tool completion are not silently removed from elapsed time.

Automatic run directory owns reservation/inputs/result plus A/B receipts. CLI≤32KiB and external time/tool receipt plus later metadata remain within the existing4MiB final reserve, not a second allowance; this preparation and status update total≤64KiB. The final receipt must show source-root and each child/group/stdio/DB/journal cleanup separately, retaining unknown identities. Do not inspect old FKye9L or other unknown roots.

Quality: applied existing local find-skills/codebase-design/fixed clean-code methods to reuse boundaries, error/unknown propagation, immutable A/B attribution and one resource ledger; no framework or source change. Approval of preparation is not execution authorization or performance evidence.
