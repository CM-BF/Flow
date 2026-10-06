# M1 scheduler decision

Status: accepted for M1, 2026-10-05. Owner: Execution Lead.

Choose **pg-boss 12.37.0 + PostgreSQL 16.13**, Node 24.20.0. This replaces FLOW-001's initial Temporal preference for the personal self-hosted milestone. A task/command and its small wake-up job can commit in the same database transaction, reducing the dual-write and deployment surface. Queue jobs execute only short database transitions; the runner's model session and human waits are not long-running queue handlers. This is not a new general workflow engine.

Temporal has stronger built-in durable workflows and signals, but introduces a separate execution platform and workflow history/replay maintenance. Reconsider when richer long-lived workflow composition justifies that operational surface. Both choices still require stable business operation IDs and reconciliation of unknown external side effects.

Implementation requirements: persist owner-scoped idempotent commands, task/attempt state and all evidence independently of queue retention; use short transactions, locks and constraints; register a pg-boss error listener; await COMMIT before accepted response; treat delivery as at-least-once. Expired runner ownership becomes uncertain and is not automatically retried elsewhere. Periodic/startup recovery scans repair missed wakeups and classify expired attempts. Queue retries never substitute for domain idempotency.

`send(...,{db:{executeSql}})` uses the same transaction connection. The selected package uses the named ESM `PgBoss` export and array-of-jobs worker handlers. No singleton key is used as a substitute for owner command idempotency.

## Evidence and limits

Run `DATABASE_URL=<isolated database> pnpm test:scheduler`. Recorded output: [scheduler.json](../evidence/f00/scheduler.json). The probe passed rollback without publication, committed job across a queue process restart, retry preserving job ID, and completion. It creates a disposable schema and drops only that schema on exit.

This probe does **not** validate the application, human waits, cancellation, lease fencing, database/container crash recovery, remote transport or production capacity. C01/R01 and I01 must test those relevant M1 behaviors through the public interfaces.

## Sources and applied skills

- [pg-boss introduction](https://pgboss.io/introduction), [transaction adapters](https://pgboss.io/api/adapters), [fixed release](https://github.com/timgit/pg-boss/releases/tag/12.37.0), tag `be404f48472d5eca17a60654dd719e48d82dfae1`, schema 45.
- [Temporal messages](https://docs.temporal.io/develop/typescript/workflows/message-passing), [activity idempotency](https://docs.temporal.io/activity-definition), [self-hosting](https://docs.temporal.io/self-hosted-guide/deployment).
- find-skills local-first discovery selected local codebase-design/tdd/clean-code. No strong pg-boss-specific skill was found (highest result 85 installs), so official documentation is the implementation reference.
- Read Supabase's official PostgreSQL skill v1.1.1 at `c9be0e931b7930f7d02126d04774d904c381e7d7`: apply short transactions, consistent lock order, queue-only SKIP LOCKED and database constraints.
- Read Temporal's official developer skill at `133fa1df397c94c20d91a4e79029df2f894a7283`. Its imprecise retry-key and replay examples were rejected in favor of formal documentation: external idempotency keys remain stable across retries, and already recorded completed Activities do not rerun just because a workflow replays.
