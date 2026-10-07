# Actual server startup observations — five-leaf delivery

Source `233ef91d3` implements the approved `76ad2709` direction. This delivery does **not** connect `main.ts` or `index.ts`, run a server, or replace artifact `2515` / source `098b`. Those two shared entry paths remain outside claim v7. Every earlier failure and KEEP remains unchanged.

## Responsibility and interface

`startup-progress.ts` owns one optional, bounded observation stream. It owns no file, process, connection, retry, readiness decision or cleanup. `withStartupPhase(observer?, phase, operation)` calls the operation once, records enter/settled or error, and returns its result or rethrows the exact original value. Observer exceptions cannot replace that result. Callers retain their existing primary/cleanup handling.

`createStartupProgress({enabled, write, now?})` provides a safe observer and terminal `finish('listening'|'failed')`. The synchronous writer must be nonblocking, e.g. the existing process stderr pipe. Disabled mode neither calls the clock nor writes. Unknown writer failures and backpressure close observations without retry; no diagnostic permission grants service/model/application authority.

Each newline starts `@flow-startup `, followed by compact JSON: version `v`, monotonic sequence `s`, integer elapsed milliseconds `ms`, fixed phase `p`, event `e`. Error events include only allowlisted name `n` and allowlisted OS code or five-character SQLSTATE `c`; absent/untrusted values are `Unknown` / `null`. No message, stack, SQL, environment, token, request text or raw cause is serialized. These are stage boundaries, not an underlying-cause proof.

Maximum **128 frames / 8192 offered UTF-8 bytes**, including a reserved terminal frame. Normal fixed 31 migrations plus configuration/authentication/CORS/scheduler/routes/two onReady scans/listen and main point produce 80 frames and pass the byte assertion. Overflow, invalid clock/event/order or an open phase emits an explicit incomplete footer when the sink can accept it. Write failure can prevent any footer: missing terminal frame, partial capture, or sink failure remains incomplete. `complete + failed` means a closed observation stream with application failure. A complete stream alone does not prove all expected phases ran, health, ownership, task claim, or cleanup.

The existing `openStartupDiagnostics` private stderr port remains the only persistence consumer. The direct check exercised its actual 0600 file/nonce/PID binding with synthetic frames and EOF; its 64KiB independent cap is unchanged. A second direct check used `preserveStartupFailure`: observer write failure preserved original EIO and separate cleanup EPERM/unknown. It created no process or PG connection.

## Environment and future connection

Only exact `FLOW_STARTUP_DIAGNOSTICS=v1` passes both wrapper and actual **center** allowlists. Missing or unrecognized values preserve the previous environment. Runner, Web and build exclude the opt-in. An explicit trusted fixture enables it; no automatic opt-in was added.

After shared-entry handoff, the smallest candidate is `ServerOptions.startupObserver?: StartupObserver`, with existing serial awaits wrapped by `withStartupPhase`; main constructs the stream from the exact opt-in, emits the first main point, and closes it around the existing listen outcome without changing the original failure/cleanup path. Static imports before main's first statement stay unobserved. Missing stages cannot identify loader duration. `listening` is only actual listen completion, not the parent's ownership/health result. No changes to timeout, verification, short-circuiting or stop semantics are proposed.

This requires a newly reviewed runtime artifact after real entry wiring: the old artifact inventory/source guard must not be bypassed by a shadow server. The existing fixed controller continues to use artifact public load/lock/status/stop. No new observer process or supervisor is introduced.

## Evidence and limits

`startup-progress-local-01/` is the only run: 12/12 Vitest cases (including actual private file consumer), 2/2 Node environment cases, focused types exit 0; 1193ms supervised total / 3042 raw bytes. Three final groups absent twice and dual EOF, no signals; initial EPERM/unknown observations preserved. Exact empty scratch removed. Scratch peak was not sampled; inputs create only the small owned fixture and bounded stream. No PG, services, Chrome, models, auth, build, installation or personal I/O.

Tests use the repository's Vitest entry. The private file case requires the explicit owned scratch environment and otherwise skips; pure cases collect normally. Previous controller/default-host cases were not rerun. Source/dependency identity and command inputs are in the original reservation; the existing ignored Vitest link reads installed 4.0.18, without installation or donor copying.

Skills: local find-skills selected existing codebase-design/clean-code/brainstorming. Parent's explicit approved design supplies the brainstorming decision. The small optional port, fixed safe schema and existing persistence keep ownership separate; clean-code review found no duplicate supervisor or lifecycle authority. Fixed paths/hashes are retained in the result record. Shared main/index handoff and real connection remain the next implementation boundary.
