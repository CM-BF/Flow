# CI candidate — not activated

[check-workflow.yml](check-workflow.yml) is a **documentation candidate**, not an installed GitHub Actions workflow. No remote run has occurred. After independent review, the user can make the final decision to enable the exact file under `.github/workflows/` in the public repository and trigger it manually. This work does not request credentials, change OAuth scopes, install dependencies locally or trigger Actions. The historical workflow push was rejected for missing `workflow` scope; this document does not resolve that authorization.

The candidate selects one ephemeral Ubuntu 24.04 job. It fixes Node **24.20.0**, pnpm **9.15.4**, Vitest **4.0.18**, the existing lockfile and PostgreSQL **16.13-alpine**. Third-party Actions are pinned to inspected commit SHAs. The image tag fixes the intended PostgreSQL version, not an immutable image digest; the hosted OS image and downloads remain external inputs for the first actual run.

| Check | Existing entry | Expected selected / passed | Other tests |
| --- | --- | --- | --- |
| Contract limits and unknown usage | `packages/contracts/src/contracts.test.ts` | 2 / 2 | 0 |
| Persist command, reopen center, replay same key, reject changed body | `apps/server/src/server.test.ts`, exact title filter | 1 / 1 | 9 unselected |

The second entry uses **real PostgreSQL and `Fastify.inject` public HTTP handlers**. It is not TCP/socket HTTP or runner end-to-end coverage. It creates the real server, applies the current production migrations, persists a synthetic fixture task, closes/reopens the server and checks durable idempotency. There is no SDK/provider call or execution runtime. This small Linux check does not replace macOS/native, browser/TUI, model, engineering or full-repository validation.

## Database and dependency contract

The original template incorrectly set `TEST_DATABASE_URL` and provisioned `flow_test`. C01 reads **`FLOW_TEST_DATABASE_URL`**, falling back to `flow_c01`, and rejects any host/port/database other than `127.0.0.1:55432/flow_c01`. The candidate supplies that exact value and an isolated, job-owned service container. The public fixed password is only for this throwaway container, not a user secret. No host database or personal configuration is copied.

The selected fixture deletes `flow`/`pgboss` schemas before its test, so it must never point to a shared or persistent database. Its original source and assertions are unchanged. All server modules and SQL referenced through `new URL(..., import.meta.url)` and migration arrays remain in the ordinary checkout. The production factory, scheduler and migrations are real; optional model/package hosts are not supplied.

Future installation uses `pnpm install --frozen-lockfile --ignore-scripts`, an ephemeral store under `RUNNER_TEMP`, and no dependency cache action. This is a candidate, not proof that the ignored install scripts and Linux optional binaries already work together; the first actual run must establish that without a hidden install retry or automatic scope expansion. No local install, whole-suite `pnpm check`, repository typecheck or new test framework is part of this change.

## Result and cleanup contract

The job has a 12-minute ceiling, a bounded install, separate 60-second/120-second test commands with a five-second kill grace, and separate bounded cleanup/report steps. Each test writes its actual process exit and a small JSON report. The final summary requires the exact counts above; zero selection, missing report, count drift, failure or timeout cannot pass. JSON input to the summarizer is at most 256 KiB per test file. No large artifact is uploaded, no local log is copied, and no persistent cache is written. Normal Actions console/summary retention remains the repository's platform policy.

After the original `server.close()` path and Vitest process exit, the `always()` cleanup step addresses only the service container ID supplied by this job. It observes connections in a finite loop, requires zero connections, then performs a normal `dropdb` and verifies absence. It never uses FORCE or terminates database backends. A query failure, leftover connection, deadline or missing cleanup receipt stays **unknown/failed**. GitHub tears down ephemeral services at job end; that platform teardown is not evidence of application cleanup and does not preserve an unknown database for later diagnosis.

Cleanup/report are attempted with `always()`, but no claim is made that they complete after an abrupt runner loss or forced job cancellation. The normal-drop fact and test outcomes remain separate; summary success cannot mask a preceding failed step.

## User activation steps after approval

1. Create `.github/workflows/bounded-check.yml` on the repository's default branch with the **exact bytes** of the independently approved `docs/ci/check-workflow.yml`; do not edit the template while copying it.
2. Commit that file through the GitHub web editor or an identity already permitted to write workflow files. If GitHub rejects the permission, stop; do not broaden OAuth scopes or retry with another credential automatically.
3. Open **Actions → bounded zero-model contracts and PostgreSQL → Run workflow**, select the default branch containing that exact file, and run it once manually.
4. Check the actual source SHA, contract **2 selected / 2 passed**, handler **1 selected / 1 passed / 9 unselected**, both process exits **0**, and cleanup **normal-drop; connections=0; database-absent**. Missing/unknown cleanup, a failed step or count mismatch is not a successful run.

These are future user steps, not actions performed by this task. Save the resulting run URL only after the actual run; candidate review alone supplies no remote pass.

## Activation and static acceptance

The candidate is manual-only (`workflow_dispatch`), public-repository-only, `contents: read`, and checkout does not retain credentials. It has no user secret expressions, authenticated registries, provider credentials, upload action, cache configuration or automatic push/PR trigger. GitHub's built-in short-lived read token is used only by the standard setup/checkout Actions. Changing credential scope is a separate user action.

Before enabling, review the exact file and source SHA, YAML and shell/inline JavaScript syntax, version pins, the two test selections, SQL/resource presence and cleanup semantics. Current status: **static candidate only; remote install/tests/cleanup NOT_RUN**. The independent review and fixed evidence are recorded in [OPS-CI01](../evidence/ops-ci01/README.md).

Official references checked for this candidate: [PostgreSQL service networking](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers), [checkout inputs](https://github.com/actions/checkout/blob/11d5960a326750d5838078e36cf38b85af677262/action.yml), [Node setup inputs](https://github.com/actions/setup-node/blob/49933ea5288caeca8642d1e84afbd3f7d6820020/action.yml), [pnpm setup inputs](https://github.com/pnpm/action-setup/blob/b906affcce14559ad1aafd4ab0e942779e9f58b1/action.yml), and [Vitest reporters](https://vitest.dev/guide/reporters.html). These describe configuration interfaces, not evidence that this Flow candidate has run.
