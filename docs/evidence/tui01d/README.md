# TUI01D — explicit goal terminal

Author source: `0aaa7eb9591d83e5194d0894a1417f75615f0517`; base `a8aef18291de147c0a6ce9a3bba9383b54f5cf1f`. Independent review is **NOT_STARTED**; this is not main integration. Parent [TUI-001](../../../../tui-client/plans/tui01-terminal-client/plan.md), co-lead Execution Lead.

The existing terminal now accepts `--goal UUID`, using the public `@flow/interaction/goal` controller for both Ink and JSONL. It presents bounded plan/state/history references and expands material only explicitly. Decide/cancel derive current observed identities. Explicit domain commands use the original durable key/body and CAS semantics. Ordinary text remains a local draft; quit disconnects observation without cancelling background work. Journal file IO is shared with the original conversation codec, whose filenames and JSON are unchanged. No new dependency or provider call.

## Verification

Final [checks](checks-final.txt): **21/21 in 11.56 s**, comprising 8 new checks and 13 unchanged direct consumers (4 terminal + 9 recovery). [Exit receipt](checks-final-exit.json) is the command wrapper's actual exit code. Final [types](typecheck-final.txt) has empty stdout and [exit receipt](typecheck-final-exit.json) records the actual exit 0; empty output alone is not used as success evidence.

| Public behavior | Evidence |
| --- | --- |
| Two real clients; stale input and project revisions rejected once, refreshed observation, no replacement POST; sibling activity keeps material cached | [two clients](final/tui-two-client.json) |
| 57 immutable references in 3 pages, historical body read explicitly | [history](final/tui-history.json) |
| Actual committed HTTP response dropped; private original intent survives controller and center restart; only explicit recover repeats identical key/body | [lost ACK](final/tui-lost-ack.json) |
| Pending decision body is lazy; decision/cancel use observed identity; quit leaves running work; cancellation is only stopped after the runner event; fixed artifact mechanical verification does not imply business acceptance | [controls](final/tui-controls.json) |
| Real Node CLI JSONL and owned PTY: focused editor, Chinese/emoji, backspace exercised, multiline, 52-column resize, Ctrl-C, raw mode restored; zero command POSTs | [CLI/PTY](final/tui-cli.json) |
| Owned random PostgreSQL database removed and center closed | [cleanup](final/tui01d-cleanup.json) |

The deterministic runner peer uses public registration/claim/events against production `createServer`, with no model or native SDK loop. The lost-ACK restart is a new terminal controller/private journal and center instance; it is not an OS crash or power-loss claim. The PTY assertion observes actual screen output but is not a screenshot/a11y review or a Web journey.

## Local request and byte boundary

Two sibling activity refreshes made 2 state GETs, **2,436 UTF-8 response-body bytes total**, with 0 repeated material bytes; the previously expanded input body was 2,437 bytes. The history journey made 3 reference requests for 57 unique records, **13,786 response-body bytes**, then 1 explicit body request. Counts come from the actual server onSend payload, not TCP/HTTP headers or compressed wire measurements. Synthetic material marker checks and fixed body equality establish this fixture's lazy read behavior. These are one bounded correctness journey, not a latency benchmark, LLM-token reduction or general performance estimate.

Plan/history pages are 20; observe is at most 50 nodes; displayed windows at most 1,600 code points; original full body remains in the public controller after explicit expansion. Cached body is labelled recorded content, with current validity checked through fresh plan/state. JSONL and journal remain bounded to 192 KiB. Goal refresh is explicit, not a polling loop.

## Preserved failures and scope of the fix

- `red.txt`: missing new module caused initial collection failure (0 selected), not a passed test.
- `journey-first.txt`: incorrect relative test import caused collection failure; fixed to the real server public fixture.
- `journey-second.txt`: 3/5 passed. Decision expansion incorrectly spread an extra goalId into a strict query; fixed by selecting the public reference fields. PTY typed before editor focus; the driver now waits for the rendered cursor and raw mode.
- `goal-final.txt`: 7/8 passed. The test itself stopped reading the PTY while waiting for exit, which could block terminal output. The driver now drains output while waiting, with the original 5 s bound and a 2 MiB cap. No business assertion was removed or timeout enlarged.
- `pty-final.txt`: the selected CLI/PTY check passed, 4 unselected. The final 21/21 run exercises the combination.
- `initialization-red.txt` is historically misnamed: it is a passing single check, not a red proof. Its original name also described construction failure too broadly; the final test name accurately states unreachable-center initialization. Original raw output is retained.
- `local-checks.txt` is earlier 15/15; `typecheck-first.txt` is earlier empty stdout. They are not added to the final distinct test count.

No browser, provider, personal service, credential/configuration change or complete TUI→Web→TUI handoff was performed. A mechanical `flow.text` pass remains separate from accepted delivery. Native execution and natural-language goal interpretation are not added by this terminal slice. The original conversation path remains the default. Stale journal locks are not automatically stolen; FS sync/rename does not prove all crash/power-loss cases.

## Reproduce

Use Node 24.20.0, pnpm 9.15.4 and the fixed workspace install, local test PostgreSQL at port 55432. Do not use a personal service database. The reused public fixture creates and drops its own `flow_o12_<random>` database; its name retains the original helper prefix.

```sh
FLOW_O12_EVIDENCE_DIR="$PWD/docs/evidence/tui01d/recheck-unique" pnpm exec vitest run apps/tui/src/goal/terminal.test.ts apps/tui/src/goal/journey.test.ts apps/tui/src/terminal.test.ts apps/tui/src/recovery.test.ts --no-cache --configLoader runner
pnpm exec tsc --noEmit
```

Set PATH to the installed Node24 directory. Use a fresh evidence directory; do not overwrite the raw outputs bound in [manifest](manifest.json). See [Interface](interface.md), [quality](quality.md) and [claim](claim.json).
