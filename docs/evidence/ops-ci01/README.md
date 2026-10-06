# OPS-CI01 evidence

Base: `37f75d3654fc500d37b1ddfda0871807d878715f`. Candidate only; remote workflow, installation, tests and cleanup are **NOT_RUN**. No `.github/workflows` file was created.

- [Interface](interface.md) and [claim](take-receipt.json).
- [Static result](static-result.json), [stdout](static.stdout), [stderr](static.stderr), [exit](static.exit).
- [Static checker](static-check.py), [parsed candidate](workflow-parsed.json), [375 fixed inputs](protected-inputs.json).
- [Quality and skills](quality.md).

Static checks only: YAML data parse with system Ruby/Psych (gems disabled), five shell blocks with `bash -n`, two JavaScript blocks with Node24 `--check`; no block executed. The exact selected source has two contract cases and ten C01 cases; the candidate selects one C01 title. No Vitest, app import, dependency install, database, browser or provider was started.

The source-only provision's 375 unchanged inputs match its fixed base, including 30 SQL files. Versions 1 and 3 are inline migrations, so a guessed 31-file SQL assertion in the first static checker failed. [Original checker](initial-static-check.py), [exit1](initial-static.exit) and [trace](initial-static.stderr) remain. Inspection corrected the static SQL count and the exact 013/019 dynamic-array filenames; the final static checker passed. This was a preparation assertion, not a product test failure or missing SQL file.

The existing installed Vitest 4.0.18 JSON reporter was read, not imported: `numPendingTests` includes filtered/skipped cases, `numPassedTests`/`numFailedTests` count actual results, and `numTotalTests` includes all collected cases. This supports the proposed 2+1/9 report check but is not actual selection evidence.

Workflow pins were resolved from official Git refs on 2026-10-06 and their `action.yml` inputs read: checkout `11d5960a326750d5838078e36cf38b85af677262`, setup-node `49933ea5288caeca8642d1e84afbd3f7d6820020`, pnpm setup `b906affcce14559ad1aafd4ab0e942779e9f58b1` (peeled v4/v4.3.0 tag; the tag-object SHA itself was not used). Official source links are in the candidate README. No credential or local service data was accessed.

The independent reviewer must approve only this documentation candidate and static evidence. Any user decision to enable it and any first Linux runtime result remain separate.
