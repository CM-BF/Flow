# TUI fixture process-group closure

Scope: test fixture only; original R3 functional completion, suite failure and KEEP are immutable. Its original group/error were not captured, so this change does not assert the historical cause.

Module `ownProcessGroup(child)` registers the real detached child immediately after spawn, before yielding. A PGID alone cannot register ownership. `stop()` is idempotent and resolves one bounded record: actual child close, final group observation, up to eight safe OS observations, successful signals and the first child/signal/final failure. No stderr, argv, body or credentials are recorded. Two groups per handoff remain the bound.

Reuse OPS14 semantics: unknown observation blocks all later signals; read-only rechecks may establish absence after child close. TERM 3s / reap 1s remain unchanged. Node has already reaped at its exit event, unlike OPS14 WNOWAIT, so no signal after observed exit is allowed. A live descendant after its leader exited remains unconfirmed, never assumed stopped. Group absence and child close are both necessary. Signal/child failure survives later successful absence. Fixture persists every group record before the aggregate verdict and preserves prior work failures.

Production server/runtime and database cleanup rules are unchanged. No new supervisor. Existing fixture and experimental journey directly consume the helper. Future actual input must explicitly bind the new helper and new journey digest; consumed R2/R3 inputs and their source manifests are not rewritten. Actual PG/Chrome/PTY journey is not authorized here.

Validation: targeted pure OS/clock ports, one owned tiny process and actual fixture close with synthetic records; focused types. No PG/HTTP/Chrome/native/provider or old KEEP access. Resource admission and supervision reuse OPS14; at most four supervised checks, cumulative120s, scratch8MiB, raw128KiB. Unknown artifacts remain retained.

Skills: local find-skills discovery matched Node/TypeScript lifecycle work to `/Users/citrine/.agents/skills/{codebase-design,clean-code,brainstorming}/SKILL.md`; existing installed versions, no install/network. Interface centralizes ownership/termination, actual consumers test behavior, no duplicate state machine. Clean-code review at this start: small single responsibility, safe errors, original primary preserved; no unrelated refactor.
