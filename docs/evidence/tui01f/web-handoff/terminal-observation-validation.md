# Terminal observation delta and bounded checks

Fixed source `c6120945c82f3b89266ea4f21f774c310e924409`. Only `journey.ts` and `terminal.py` changed; controller, Ink, fixture and preview remain unchanged. New candidate complete source digest: `b157e0692813f2e4f092e9873485da36dff2e79031f34f8d7f41c2275d469eb9`. The original b155 digest is historical. No new full-journey permit exists; capture adapter remains fixed076.

The terminal observation Interface carries progress, the first bounded safe failure, exit, and settle-and-report. The held-request wait now races terminal failure. The adapter preserves bounded stderr and stdout JSONL (512 KiB total / stderr64 KiB /16 events) and redacts the synthetic token. Python setup errors now enter the same failure path; explicit ICANON readiness precedes typing. The initial stage checkpoint remains. A second durable terminal-settlement record is written after owned-group stop and pipe closure, before fixture resource deletion. If stop/pipe/persistence is unknown, the fixture is marked failed and retains resources. No new supervisor/DB cleanup implementation was introduced.

## Checks actually run once

| Check | Result | Evidence and limits |
| --- | --- | --- |
| Actual Ink PTY initial screen → ICANON false → Ctrl-C | 1 selected /1 passed, exit0;1675ms | `terminal-startup`;4056 output bytes, transcript2036 bytes;group12940 stopped, private directory removed after checkpoint |
| Actual ENOENT spawn + shutdown-only late failure | 2 selected /2 passed, exit0;316ms | `terminal-local`;311 output bytes;group20502 stopped;late failure uses a controlled stream stand-in, not a claim of real OS settlement |
| Focused noEmit | exit0;2303ms | `terminal-types`;0 stdout/stderr;group24381 stopped |

The PTY run used the real Node/Ink entry and same restricted environment, an isolated journal, inert loopback URL, and no `/open`, `/send` or center operation. Startup initialize only loads the local journal. PG/Chrome/provider calls0. Existing O16 supervise/independent watchdog enforced 15s work+5s cleanup for startup and total10s for local/types; fresh start ≥1GiB+4MiB, live reserve1GiB, private≤1MiB/output≤512KiB. Original reservation/source hashes, raw stdout/stderr, checkpoint and result are preserved; each private directory was empty at final measurement and removed only after durable checkpoint and dev/ino match. No installation, no full F04 rerun.

These new three distinct behavior checks do not repeat or absorb the historical4 pure+2 capture checks. Actual initial-screen success **does not prove** the original failure was an ICANON race, nor validate `/open`, draft conflict, cancellation or cross-client continuation. The original actual journey1/0 stays failed, and its19 raw bindings plus cleanup10 raw/source/summary bindings and7 historical protected inputs remain unchanged. The missing late transcript from that run cannot be recovered.

Applied local find-skills/brainstorming/codebase-design/clean-code at this bounded authorized seam: one owner for process observation and report, reused supervision, primary/cleanup facts separate, no product behavior change. Independent delta review remains pending; no automatic full journey retry.
