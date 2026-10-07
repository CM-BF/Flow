# S01 同policy buffered packing ABBA

SOURCE_AND_LOCAL_PREPARATION_REVIEW_APPROVED / 0 P1/P2. **Actual window consumed2026-10-07T16:10:12Z; [fixed result](delivery-packing-result-ready.md) awaiting fidelity review. No further OPEN.** Core source `82095227e5b865139093cc325484c9885f69e805` and operator source `8a933df2e71e03aa3e9525649877794777ebdec4` (full source commit in manifest). New delivery packing is previously approved `11abf474f`; [single local record](delivery-packing-local.json), [input](delivery-packing-input.json), [review bindings](delivery-packing-review.json).

## What this comparison answers

One fixed 2048-record trace, all four arms buffered, order old→new→new→old. Same 64×32 feed and yields, finite SQL aggregation, receiver, complete JSON envelopes, phase/ordinal, callbacks/drain/close gates. Candidate worker files are exact copies of the original six-JS/ESM build except `pg-delivery.js`, compiled from the approved packing source. Old directory is untouched. Parent-only code exports the existing arm and accepts its fixed worker file; the new finite plan reuses this lifecycle rather than copying a second receive/supervision loop. It stops after any failed/unknown arm or insufficient remaining time. Semantic receipt counts/message policy must match across successful arms.

ABBA is a fixed sequence, not randomization or stable-performance proof. Report all four same-parent-origin fork→closed walls, start-command→closed, record synchronous/wait/phase walls, finish time, worker CPU, encoded JSON bytes and complete resource facts. ChildMs/elapsed stored in the input are historical data, not new PG timing. JSON is not OS wire bytes. Personal background remains UNKNOWN and unprobed. This can compare this trace's packing implementations under the observed conditions; it cannot explain original pool/128 ACK failure, general latency/SLO or production capacity. No old replay/per-query test is rerun.

## Actual inputs and command (requires a separate OPEN)

Five fresh exact outputs are named in input, currently all lstat ENOENT. Caller validates full input hashes/realpaths, clean fixed HEAD=origin and branch, compiled artifacts and successful compile receipt, old/new worker delta, explicit environment and fresh resource floor. Supervised Python checkpoints PID/PGID then same-PID execs Node. OPS14 remains the only process-group signal owner; caller reuses reviewed capture/first-fault predicate, bounded same-inode inventory and deadline cleanup. Any process/capture/signal uncertainty keeps TMP. Business failure is never green. No PG/admin/provider permission exists.

`/usr/bin/env -i FLOW_S01_PACKING_OPEN=s01-buffered-packing-abba-once /opt/homebrew/bin/python3.13 -I -B docs/evidence/s01/mixed-ab-preparation/delivery-packing-operator.py --authorized-packing-once <exact-clean-head> <input-sha> <manager-fresh-floor>`

Candidate whole60s:45work+2TERM+3reap with remaining10s reserved for verification/cleanup/persistence, one coordinator+four serial workers, fixed Node, no tsx/esbuild. Raw cap128KiB, ownTMP≤2MiB/4096entries, all actual temporary/raw accounting within8MiB. Latest16,175,529,984B ordinary floor is historical, not actual authorization; manager actual+potential+KEEP complete sum including candidate8MiB and one existing reserve must be fresh. Never inherit consumed old60s window or launch because no holder is visible.

## Ordinary evidence and quality

Original new segment15:47:10Z→16:02:10Z, scope508fv3/6. Three children only: strict/noEmitOnError emit0; finite plan5/5 (ABBA serial, failed/unknown/time exhausted stop, changed policy reject); Python syntax, successful compile receipt, sole worker leaf delta and exact command four assertions. They do not fork actual workers. All finalabsent/MERGED EOF, raw620B, same-identity TMP bounded samples deleted and owner exactENOENT; earlyEPERM preserved. Supervised1186ms, caller1325.691ms, wholeexternal/activepeak UNKNOWN. Retained new JS+ESM82709B; compiler manifest `55dc3c42dd4534366a1da9f4ec66aa1701adf0fd9339852d784c6edd5ae85dbc`. Only phase/direct consumers selected; prior18 green/old actual not repeated.

Applied local find-skills/codebase-design/clean-code: one existing arm/receiver, explicit private policy interface and injected pure scheduling seam, no new supervisory loop, no change to production pool/SQL. Independent review should cover only new parent seam/finite plan, thin actual input/caller and ordinary/build fidelity, not re-review prior18 or43MiB raw. Prior e488 approval is separately archived, not inherited by this actual candidate.

## Independent review and scheduling

db_transaction_owner reviewed fixed `ca4846244573d5ec2ea879b27abc1b8bfe3c333d` at2026-10-07T16:02:39Z: SOURCE_AND_LOCAL_PREPARATION_REVIEW_APPROVED, 0 P1/P2. [Formal receipt](delivery-packing-independent-review.json) binds core/operator/build/local evidence. No existing input, manifest, compiled file or raw was rewritten. Final clean execution HEAD is the metadata commit containing this receipt, resolved explicitly by the future operator; never select moving HEAD automatically.

Actual60s/8MiB candidate still requires a separate manager OPEN after current Web build and queued browser work return. This metadata closeout uses the original16MiB preparation cap, not another reserve. Paused-queue scanning cost is only a subsequent S01 candidate coordinated by [Mika/FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md); no new implementation/plan scope or test is started.
