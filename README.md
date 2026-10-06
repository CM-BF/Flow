# Flow

A personal, self-hosted workspace for durable agent work. The center keeps task state and evidence in PostgreSQL; Web and CLI are replaceable observers, and runners continue after a browser closes.

M1 durable execution has passed integration and independent review. See [execution plan](plans/flow-003-m1-execution/plan.md), [public contract](docs/architecture/m1-contract.md), [scheduler decision](docs/architecture/m1-scheduler.md) and [skill/quality record](docs/quality/skills.md). The checked scope includes PostgreSQL acceptance, complete browser closure, independent runner progress, CLI decision/cancellation, and a new browser reading the same versioned artifact and verification. Deterministic Web evidence and the bounded native Claude checks are recorded separately. See [M1 system evidence](docs/evidence/i01/m1-system.md) and [recovery boundaries](docs/architecture/recovery-boundaries.md); branch evidence does not automatically imply main integration.

## Development

Use Node **24.20.0** and pnpm **9.15.4**. On this host: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

```sh
pnpm install --frozen-lockfile
docker compose -p flow-dev up -d
# Create isolated test databases once in your local development PostgreSQL:
docker compose -p flow-dev exec postgres createdb -U flow flow_c01
docker compose -p flow-dev exec postgres createdb -U flow flow_i01
pnpm check
DATABASE_URL=postgresql://flow:flow-local-only@127.0.0.1:55432/flow pnpm test:scheduler
```

The development database binds only to loopback. Each feature uses its own database, ports and temporary work directory; do not run two worktree migrations against one database. The `.env.example` values are development examples, not production credentials. Generate a private owner token, then register each runner to obtain its separate one-time token. Never commit `.env` or runner credentials.

## Run the verified core

After exporting the example variables with your private `FLOW_TOKEN`, start the center using `pnpm server`. The process reads environment variables; it does not automatically load `.env`. In a second terminal use `pnpm cli runner register --name local --harness fixture --capacity 1`; keep its one-time token private. In a third terminal set that token as `FLOW_RUNNER_TOKEN`, give the runner its own `FLOW_RUNNER_WORKDIR`, and start `pnpm runner`. A second runner needs its own registration, token and directory.

Submit with `pnpm cli submit "Prepare a result" --scenario decision --key my-request`, then inspect the returned ID using `pnpm cli show TASK_ID` or `watch TASK_ID`. Answer the displayed decision with `pnpm cli decision TASK_ID approve --decision DECISION_ID`. Closing watch leaves the task running; use `cancel TASK_ID` to request a stop. Full commands and exit semantics are in [CLI usage](apps/cli/README.md).

Fixture is the default deterministic harness. Do not label fixture output as a native model result. Native configuration and local concurrency are documented in [Runner usage](apps/runner/README.md). Ordinary fixture/Claude runners accept integer `FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS` values from `1` to `16`, defaulting to `1`; A2A and dedicated engineering hosts remain limited to `1`. The center separately enforces registered capacity. These configured ceilings are not measured throughput guarantees. Product Web setup is in [Web usage](apps/web/README.md).

Terminal conversation and goal commands are documented in [TUI usage](apps/tui/README.md); start with `pnpm --filter @flow/tui start --help`. Never run two development Compose projects on the same port; reuse the already-running local instance when present. The test suites intentionally rebuild only their isolated `flow_c01` and `flow_i01` schemas.

 All changes follow the root [AGENTS.md](AGENTS.md): Sol-or-higher writers, feature worktrees, stack-specific skill discovery and recurring clean-code checks.

## Web and execution dashboard

With the center and a registered runner running, use `FLOW_CENTER_URL=http://127.0.0.1:4310 pnpm web`, open the printed local URL, leave Center URL blank for the same-origin proxy, and enter your owner token. Choose Contract fixture to try a deterministic decision task without spending model calls. Native Claude requires the explicit runner materials configuration. The historical R02/I01 probe window is closed; any new real-provider validation needs its own explicit budget and evidence record.

Run `node apps/execution-dashboard/src/server.mjs` for the engineering execution dashboard (default loopback4320). Its task registry reads authoritative owner worktrees and is separate from the product Web. See [dashboard setup and custom registry](apps/execution-dashboard/README.md). Both interfaces have complete light/dark themes.

M1 is the durable task foundation. A unified cross-task explanation and decision experience is a later milestone; the current task page is not a claim that the final Flow experience is complete.
