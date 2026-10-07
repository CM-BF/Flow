# F04 source-only failure diagnosis

At fixed journey d147 / capture076, the one-shot result is failed. This diagnosis reads existing source and the fixed red evidence only: no process, PTY, HTTP, PG or Chrome was started. Cleanup is separately recorded in `cleanup-once-summary.md`; it does not recover or replace missing runtime observations.

## What actually survived

- The fixture stage checkpoint persisted before shutdown: terminal `bytes=0`, `events=[]`, `failure=null`; the bridge records contain no TUI GET or POST and allTasks=0. **Here bytes counts Python JSONL stdout/stderr, not the internal PTY transcript** (`journey.ts:77-88`). Python normally emits nothing before `submitted` (`terminal.py:94`), so this is not evidence that the Ink screen produced zero bytes.
- The outer captured stdout is empty. Its stderr is 685 bytes of the final Node AssertionError at `journey.ts:241`; it contains no terminal transcript. The independent cleanup records contain ownership/resource facts only.
- `terminal.py:135-147` can emit a failure record when the owned group receives TERM. `journey.ts:229-234` saves terminal.report before `fixture.close()` stops that group, and result.json does not capture a second report. A later record could therefore have existed only in parent memory; whether it was actually emitted is unknown. No persisted copy exists in the examined artifacts. The removed private directory cannot supply such a copy: this driver never wrote its PTY transcript there. Do not reconstruct it.

## Source-confirmed visibility defects, not a proved product root cause

1. Waiting for the held request at `journey.ts:201` observes only the bridge promise, not terminal failure/exit. A local startup failure can become a later generic 15-second capture timeout.
2. `startTerminal` discards the actual stderr chunk and retains only a generic string (`journey.ts:88`), while Python openpty/Popen happen outside its failure try (`terminal.py:28-34`, try begins85). Early loader/spawn errors can therefore lose their bounded safe reason.
3. The final terminal failure/transcript is not captured after group stop and pipe close. Early checkpoint must remain; a second bounded terminal-settlement record must be durable before fixture resource deletion may proceed. Absence/timeout is an explicit unknown record, not a fabricated transcript.
4. The earlier passed03 PTY driver waits until ICANON is cleared before typing (`apps/tui/test-fixtures/cancel_driver.py:63-67`); F04 goes directly from rendered footer to `/open` (`terminal.py:86-87`). This is a concrete readiness difference worth a focused check, **not evidence it caused this run**. Visible footer does not establish installed input handlers/raw mode.

`main.tsx:28-45` opens the private journal, initializes the controller, then renders Ink. `controller.ts:254-261` initialize only loads the local intent slot, with no center read. A missing TUI GET can therefore be caused before `/open`; it does not identify a backend conflict or permission defect. Existing entry/env/aliases were fixed, but import-only loaded center/runner factories, not an interactive TUI launch.

## Narrow next step proposed, not executed

Keep production controller/Ink/fixture behavior frozen. Within the existing two experiment paths (`journey.ts`, `terminal.py`), give terminal observation one small Interface: progress/failure/exit plus settle-and-report. Preserve earliest primary error; keep stderr/transcript bounded and redact the synthetic token; observe failure while awaiting bridge capture; after stopping the already registered group, await bounded pipe closure and durably save the final report before calling fixture destructive cleanup. Checkpoint failure or unknown settlement marks fixture failed and retains resources. Do not create another process supervisor or treat cancellation as proof of stopping.

Before any full journey, propose one separately authorized **PTY-only initial-render/raw-mode/quit** diagnostic using the actual Node/Ink entry and the same narrow environment. No `/open` or `/send`, no center/PG/Chrome/provider, an isolated private journal and one owned group; preserve screen bytes and child exit facts. Add a controlled failure/late-shutdown-report direct check without PG/Chrome. Exact timing/output/private-byte limits and permission remain for Lead to fix; this document starts nothing. Do not spend another full journey just to discover a loader/PTY scaffolding error.

## Method / limitations

Applied already installed find-skills, codebase-design and clean-code: keep lifecycle and evidence ownership in the terminal adapter, reuse the existing supervisor, separate primary work failure from cleanup unknown, and validate the actual direct consumer. No dependency installation, product edit or additional runtime observation. The only definitive behavioral finding remains “original TUI request was not captured”; precise first terminal failure is unavailable in preserved raw. Full TUI01F-04 is still open.
