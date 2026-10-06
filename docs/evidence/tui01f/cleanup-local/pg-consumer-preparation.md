# Single cleanup-only consumer: source preparation

Source `9d81b77f0ce0c67ae347a3d1309acbfa5ae650e5` adds only apps/tui/src/task-controls/cleanup-journey.test.ts. **NOT_RUN**: no import, typecheck, PG, HTTP listener, PTY or provider for this file. The earlier10 direct helper checks/focused types belong to45709c and do not include this new test.

The case uses the existing fixed a89 production createServer on one freshly created random flow_tui01f_cleanup_* database and dynamic loopback listener. It starts no task/runtime/SDK/PTY. Initial directory identity and marker are captured; a fresh reservation precedes DB creation. DB OID/name are retained in checkpoint, checked again before normal DROP. After actual app.close, the same reviewed-to-be observeConnections and cleanupAfterCheckpoint helpers control evidence/checkpoint/delete. Unknown shutdown or failed observation preserves resources. Failed checkpoint still reaches admin end. No FORCE, other-session termination, automatic retry or permission to clean the earlier unknown-inode tmp.

Future unique command (requires a **new non-existent absolute evidence path**, never run by this preparation):

```sh
FLOW_TUI01F_CLEANUP_EVIDENCE_DIR=/tmp/<new-Lead-window-directory> PATH=/opt/homebrew/opt/node@24/bin:/usr/bin:/bin /opt/homebrew/opt/node@24/bin/node node_modules/vitest/vitest.mjs run apps/tui/src/task-controls/cleanup-journey.test.ts --no-cache --configLoader runner --maxWorkers 1
```

Expected selection **1**, using existing installed/local bindings. No original2 behavior or36 checks selected. The future supervisor reuses the prior single-process-group method, 60s work +30s cleanup, raw≤1MiB observation threshold, fresh ≥1GiB+32MiB and monitor shared free≥1GiB. PG/WAL remains outside a hard byte guarantee. Window/actual free resource gate is **NOT_GRANTED/NOT_RUN**. Test timeout alone does not prove in-process cleanup settled; any wrapper timeout must retain unknown and owned evidence, never turn original exit1 green.

New source is88 lines / no new dependencies or secondary fixture framework. Existing helper owns checkpoint/destructive decisions; actual SQL/HTTP setup is the direct consumer. This case can provide separate cleanup evidence; historical full journey exit1 remains immutable.

2026-10-06 17:32 UTC: source-only whitespace/naming/lifecycle read complete, clean-code methods reused. No execution or source mutations outside existing claim.
