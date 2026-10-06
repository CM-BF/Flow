# TUI01F test-only cleanup repair

Fixed source `45709c982df080af5a71ecbd66760a76ab65cf94`. Only fixture.ts plus private fixture-cleanup.ts and its direct tests changed. Production controller/runner/server lifecycle, both existing behavior tests and Python PTY script stay byte-identical.

## Interface and decisions

The test-only observer waits up to 3000ms, at 50ms intervals, at most 60 samples. SQL projects only pid/state from this exact private database, LIMIT33; more than32 rows is unknown. Observations retain elapsed time and pid/state or a bounded error code, never SQL/error messages/credentials. A response past the monotonic deadline stays unknown, including an empty late response. The deadline limits waiting, not the underlying database operation; existing pg query timeout remains. No consumer termination is introduced.

Owned process groups, terminal, runner and HTTP shutdown still happen first. Any failed shutdown, nonzero connections at the deadline or query exception prevents irreversible cleanup. mkdtemp is immediately followed by lstat capture of dev/ino/type, persisted in reservation. A durable checkpoint must succeed before DROP/rm. Immediately before rm the directory must still match the initial dev/ino and not be a symlink. A DROP may already have succeeded before an inode mismatch is found; returned facts distinguish removed DB from retained tmp. This is an owned-fixture identity check, not OS isolation or a claim that hostile path replacement races are impossible.

Failed checkpoint still returns to the fixture admin close path. Missing initial identity never gets manufactured from the current path. The prior journey private directory remains KEEP; this work never touched it.

## Actual validation

An extracted single-observation baseline failed one deterministic case (nonzero then zero). That reproduces the old decision, not the unproven root cause of the real afterAll failure. Final **10/10** direct checks, **4ms** / process **0.491s**, followed by focused fixture/type closure **exit0 / 2.297s**. No PG, HTTP server, PTY, provider or install; old36 and the two original behavior tests were not rerun. Red/green stdout and process exits are separate immutable files.

The10 cover transient/persistent connections, safe query failure, unsettled-query deadline, checkpoint-before-delete ordering, failed checkpoint, preexisting unknown shutdown, inode mismatch, missing initial identity and failed DROP. Injected ports exercise the actual helper decisions without opening a database or deleting recovery data. Raw1699B, generated compile cache1357812B; all3 process groups absent. Only the fresh own compile-cache file was recorded then removed, empty own dirs removed; final free1190850560B. Resource preconditions before each process were >=1GiB+8MiB. Each process <30s. Details in resources.json.

Installed pg8.23.1 → pg-pool3.14.0 is bound in pg-pool-dependency.json (14460B / SHA6f304776edaabde2954cbf8c4366fa6d9512bfba0e408e78cc56b3c46c69d058). Ending callback can follow local client-array removal before asynchronous client.end completes. pool.end is not a remote zero-connection barrier. Prior rows/error were not captured, so the real failure's cause remains unknown. The first apps/server/node_modules guess was absent; actual root node_modules donor was read without imports or changes.

Original [one-shot result](../journey-1714/README.md) stays two behavior passes with suite exit1; raw/manifest unchanged. Real PG cleanup with this repair is **NOT_RUN**, pending independent review and any separately authorized scoped run. No TUI↔Web or full suite success claimed.

## Method

2026-10-06 17:29 UTC: fresh claim9fe77a96 v1 active, codex/tui-task-cancel, assignment_review / gpt-6-astra. Same-stack local find-skills discovery reused codebase-design/clean-code/tdd at /Users/citrine/.agents/skills; clean-code prior sickn33/bdacd76 baseline, no reinstall. Two explicitly authorized test-only seams: finite observer and destructive cleanup gate. Review of naming, lifecycle/error ownership, duplication and unnecessary abstraction completed. No production FSM or generic cleanup framework.

First coordination path typo failed before loading the CLI; corrected canonical apps/execution-dashboard/src/coordination/cli.mjs list supplied own claim. Two metadata/cache-shape assertions stopped before deletion; resources.json records them. No product check was rerun for these bookkeeping corrections.
