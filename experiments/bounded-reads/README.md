# B01 bounded reads probe

This is a sequential API consumer of the real Flow center and local PostgreSQL. It creates synthetic stored histories and never runs a model. The scenarios are 1/16/128 stored tasks × 128 events, plus one task × 16,384 events. They do not measure executing agent capacity or browser behavior.

Use Node24, the existing pnpm9.15.4 workspace dependencies, and a free result filename:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node node_modules/typescript/bin/tsc -p experiments/bounded-reads/tsconfig.json --noEmit
PATH=/opt/homebrew/opt/node@24/bin:$PATH TSX_TSCONFIG_PATH=experiments/bounded-reads/tsconfig.json node --import tsx experiments/bounded-reads/probe.ts ../../docs/evidence/b01/results.json
```

The output argument is resolved relative to `probe.ts`, not the shell directory. The probe refuses to overwrite existing evidence. Dependencies may be reused from the main checkout as ignored node_modules directories containing symlinks; the probe tsconfig resolves `@flow/contracts` into this worktree. Do not change shared lockfiles or install new packages for the probe.

The default admin connection is the repository's local development example, on loopback port 55432/database postgres. `FLOW_B01_ADMIN_URL` can supply an already authorized connection at that same local endpoint; never log it. Each scenario creates its own `flow_b01_<pid>_<scenario>` database and closes it after use; no existing database is cleared. HTTP uses a dynamic port, never 4320, 49922, or 55049. Before a performance run, coordinate a short quiet window with other leads.

The normal HTTP deadline is 110 seconds, with a 120-second process stop; response bodies are capped at 96 MiB total and each synthetic history at 16,384 timeline rows. Each scenario has one initial request and 50 warm samples. PG/OS buffers are not flushed, so “initial” is application-first and is not physical cold-cache evidence. p50/p95/p99 use nearest rank; with 50 samples p99 equals the maximum. Results include raw samples, bytes, plans, storage size, environment, and cleanup outcomes. Measurements are local sequential observations, not an SLO.

The seed uses SQL and bypasses write ingestion; separate checks submit through real owner/runner HTTP for the 50-event batch limit, detail UTF-8 1 MiB limit, and 2 MiB HTTP body limit. Snapshot/events/feed layering and expansion counts are API-consumer checks, never a claim about a UI. HTTP bytes are UTF-8 uncompressed JSON bodies, excluding headers/TCP.

Set `FLOW_B01_COMPARE_CANDIDATE=1` only when intentionally checking the experimental query against the baseline product query; it is disabled by default after the fix. `candidate-results.json` was produced from commit bb81fba before applying the product change. `candidate.ts` compares an indexed per-task-cursor query against the real query captured from the center. It is an experiment only. It depends on current writers committing task cursors in order under the task row lock and on each task's projected events forming a prefix; production late-commit, 201-task acceptance, and concurrent projection regression checks are required before applying it. The candidate remains proportional to task count and takes the existing projection lock.

A failed assertion or runtime check exits nonzero and preserves a result when the output file has been reserved. The result names each created database/port; on a hard stop, cleanup is explicitly unconfirmed. Verify the recorded process has ended before closing/removing only that run's named resources. Do not stop another task's service or drop a database whose creation was not confirmed. Normal results require closed HTTP/server pools and dropped temporary DBs.

Evidence and interpretation: [B01 report](../../docs/evidence/b01/README.md), [validation history](../../docs/evidence/b01/validation-history.md), [plan/status/review](../../plans/b01-bounded-reads/plan.md).
