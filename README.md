# Flow

A personal, self-hosted workspace for durable agent work. The center keeps task state and evidence in PostgreSQL; Web and CLI are replaceable observers, and runners continue after a browser closes.

M1 is under active implementation. See [execution plan](plans/flow-003-m1-execution/plan.md), [public contract](docs/architecture/m1-contract.md), [scheduler decision](docs/architecture/m1-scheduler.md) and [skill/quality record](docs/quality/skills.md). F00 establishes the workspace and contract; app behavior is not yet delivered.

## Development

Use Node **24.20.0** and pnpm **9.15.4**. On this host: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

```sh
pnpm install --frozen-lockfile
pnpm check
docker compose -p flow-dev up -d
DATABASE_URL=postgresql://flow:flow-local-only@127.0.0.1:55432/flow pnpm test:scheduler
```

The development database binds only to loopback. Each feature uses its own database, ports and temporary work directory; do not run two worktree migrations against one database. The `.env.example` values are development examples, not production credentials. Generate a private owner token, then register each runner to obtain its separate one-time token. Never commit `.env` or runner credentials.

Integration and startup instructions will be expanded with the actual app deliverables. All changes follow the root [AGENTS.md](AGENTS.md): Sol-or-higher writers, feature worktrees, stack-specific skill discovery and recurring clean-code checks.
