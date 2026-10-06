# Bounded private stderr diagnostic seam — proposal only

Recorded 2026-10-06 09:49:29 UTC. No production scope amendment, implementation, test or child launch in this segment. Original canary FAILED result and consumed permit remain immutable. This is WPF-MATURE-02-03, not another big task or progress source.

## Evidence and concrete hypothesis

Read fixed main `4391bbf9f1785212d098ef6aa1c01a0320a003d3`, which contains approved R06 `a239b14d5328c78cca02a8757e26f2b65502f926`. R06 currently counts stderr bytes only. `finishClose()` destroys stderr, and `stop()` can call it when exitCode/signalCode is already set, before child `close`. Adding only a data callback would not prove complete capture. The old SIGABRT cause remains unknown; this is a source-level risk inference, not a dynamic reproduction.

Node distinguishes process exit from closed stdio: [Node 24 child_process close](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html#event-close) and [exit](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html#event-exit). This current 24.x documentation is not a claim that local Node24.20.0 behavior has been exercised in this segment.

## Smallest proposed production interface

Add optional `privateStderr: { maxBytes: number; write: (chunk: Uint8Array) => void }` to TransportOptions; absent means existing byte-count-only behavior. `maxBytes` must be integer 1..65536 and write a synchronous trusted-host function; normalize a copied descriptor before spawn. No remote request, environment value, model output, CLI flag, product API or UI can enable this option.

One small capture helper owns only byte prefix accounting, not the process: at most maxBytes total copied bytes are synchronously handed to the callback, then additional stderr is drained/count-only. No UTF8 decoding, ring buffer, raw error attachment, global logging, retry or alternate child launcher. A thrown callback error is caught; subsequent callback delivery is disabled and observation is marked failed, without storing the exception or replacing the transport's original safe reason. The trusted callback may not block, return a Promise, reenter transport or write to public output; the fixed host implementation only writes the bounded chunk to an already-open local private file. As with current synchronous host code, an arbitrarily blocking callback or stalled filesystem cannot be preempted by a JavaScript timer; do not claim a hard OS execution limit.

Only when opted in, CloseReport may add safe counters/flags:

```ts
stderrCapture: {
  observedBytes: number; // saturated count of delivered stream bytes, not child emission proof
  writtenBytes: number; // callbacks that returned normally; host fsync receipt is separate
  truncated: boolean;
  observerFailed: boolean;
  streamEnded: boolean; // stderr end, not exitCode
  childCloseObserved: boolean;
  incomplete: boolean; // deadline, stream error, missing end or unobserved close
}
```

These facts are independent: truncation and observer failure can coexist with clean stream EOF. “Capture complete” requires opted-in, no truncation/failure/incomplete, normal stderr end, child close observed, and host flush/close success. Even that only describes bytes delivered to the pipe, not output never written by a crashed child. Snapshot and CodexTransportError remain fixed metadata without private bytes, file path, callback error, env or remote body. Existing callers that omit the option see no new field or diagnostic behavior.

## Owned close behavior

R06 remains the sole child supervisor. Opted-in close stops RPC/writer/inbound handling as before, but keeps the stderr data listener through stream completion while waiting for child close. Observing exitCode/signalCode skips unnecessary signals; it does not finalize opted-in capture. A single deadline starts at first stop and is bounded by the existing terminateMs + killMs; it is never extended by chunks or repeated close calls. Existing TERM/KILL escalation only targets the owned handle. Child close resolves promptly; deadline resolves safe metadata with incomplete=true and retains existing confirmed-exited/unconfirmed truth. Forced local stream destruction does not become a normal EOF. No wait for unrelated descendants, PID scan, process group kill, or additional lifecycle owner.

Default behavior with no option stays unchanged. The optional branch must not leak handles/timers or change unknown request reservations, readiness, delivery classifications or safe errors. R05C is the direct consumer to coordinate before changing these shared files.

## Requested literal production paths — not yet claimed

| Path | Bounded reason |
| --- | --- |
| `apps/runner/src/codex/types.ts` | Optional private sink and safe capture report fields |
| `apps/runner/src/codex/options.ts` | Validate/copy the opt-in descriptor before spawn |
| `apps/runner/src/codex/index.ts` | Connect bounded capture and opt-in drain to its existing owned close |
| `apps/runner/src/codex/stderr-capture.ts` | Tiny byte capture helper; no process/lifecycle |
| `apps/runner/src/codex/stderr-capture.test.ts` | Zero-child capture and public transport lifecycle tests using decoded/fake streams |

No framing/writer, adapter, main/config, shared contracts, F01 paths or production peer edits. The new real synthetic immediate-exit fixture/driver stays in this task's existing experimental scope. Mika must coordinate R05C and approve the exact scope before atomic amend. Scope additions will use current writer claim/version, never release/re-take.

## Proposed zero-child test matrix

All unit cases run in-process; no app-server, provider, auth, network, or spawned child. Public lifecycle tests use a test-local fake child with PassThrough stdio and deterministic close/exit scheduling, not another runtime supervisor.

| Case | Observable requirement |
| --- | --- |
| option absent / malformed bound / nonfunction | Default retains only counts; invalid options reject before spawn |
| multi-chunk UTF8 / cap boundary / excess | Exact byte prefix and byte cap, no silent text decoding; truncated accurately set |
| sink throws after one good write | Callback disabled, observerFailed latched, raw marker absent from errors/snapshot/report |
| process exit before final stderr and close | Do not prematurely destroy; trailing marker captured, completed only after stream end and child close |
| stream error / deadline without close | Capture incomplete, bounded close, no false complete or false exit confirmation |
| close twice / TERM ignored / natural close | Same closed promise, one deadline/escalation owner, listeners/timers settle |
| mutation of caller descriptor / cap set to null or fraction | Copied validated options and bounded behavior |

Use explicit new test path and the already configured compiler, record selected/passed count and exit. No rerun of all 31 transport tests or 27 semantic tests solely for this metadata. Before actual implementation, Mika/R05C selects any additional direct-consumer check justified by the changed optional close path. Real-pipe validation below consumes the diagnosis child budget instead of adding an uncounted test child.

## Three-child / sixty-second diagnostic envelope

At most 3 calls to the single R06 factory, no subprocesses from fixtures. One durable `wx` budget record is created before the first factory call and each reservation is fsynced before spawn; it binds fixed source/hash/options and a concrete hypothesis/change. Unknown launch/result consumes its slot. No automatic retry. Budget is one continuous monotonic 60 seconds including setup, private sink finalization and cleanup; do not start a stage without 15 seconds reserved for it and stop all new launches by 45 seconds. Per attempt abort at 8 seconds, terminateMs=500 and killMs=500, listener/file cleanup within remaining reserved time. If review/adaptation cannot be completed inside this window, end the stage and return evidence; unused slots do not silently reset the clock or authorize a later batch.

1. **Capture diagnostic control (≤1 child).** Same-tree fixed R06 plus one owned Node fixture, minimal whitelisted environment/empty cwd, no sandbox/network. Fixture writes known non-sensitive prefix/multibyte/tail markers via synchronous fd2 writes and exits immediately with code7. This is a concrete real-pipe test of the new capture/drain seam. Require exact private bytes/hash, normal EOF/child-close metadata, confirmed exit and safe public errors. Any failure stops the batch before canary; no re-run to green.
2. **Original profile with new observation (≤1 child).** Only if stage1 passes, run the already approved frozen Seatbelt profile/canary synthetic peer with the new private sink; same grants, own two roots, own dynamic loopback, source-bound inputs. This is justified by newly available bounded stderr evidence; the original failed record is not overwritten. No model/list/thread/turn/auth. Require close and cleanup receipts even on bootstrap failure; raw stderr goes only to the host private sink, never repository/normal tools output.
3. **Reserved hypothesis test (≤1 child, default NOT_RUN).** Only if stage2 yields a specific non-sensitive classification and an exact pre-reviewed input difference can be fixed within the remaining envelope. Record the concrete predicted result and diff before reservation. Any new profile grant or changed executable/library list needs Mika's source review first; no broad read/network grants, environment dumps, private crash scan or guessed toggles. If diagnosis is unknown, capture incomplete, cleanup unconfirmed, review unavailable or budget insufficient, this slot remains unused and the batch stops.

## Private sink ownership and cleanup

The trusted composition host creates one dedicated private parent root (0700), outside tracked evidence and outside the child-writable sandbox state. It opens one per-attempt file using wx plus no-follow where supported, mode0600; verify regular file/owned inode. The fd is never passed to the child or environment. Callback uses bounded synchronous writes with explicit short-write handling. R06 neither opens arbitrary paths nor owns the fd. Host alone flushes and closes after transport closed, even on sink error; record safe byte/hash/flush-close state without raw text.

Only intentionally created synthetic data enters these attempts, but arbitrary runtime stderr is still private/untrusted. Inspect only this batch's exact private path within the recorded byte cap, extract a reviewed fixed reason/classification, never print raw stderr to tool transcript or commit it. Raw files remain private until bounded inspection/receipt is complete, then remove only own recorded inode/root; incomplete cleanup is recorded and stops new attempts. Public evidence records private-capture state/hash, UTC, monotonic duration, fixed inputs, selected hypothesis, safe reason, close and cleanup, not the raw file contents. No reads of personal diagnostics, real credentials or another task's process state.

## Quality and dependencies

Local find-skills → clean-code fixed sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5 and codebase-design: one process owner, one byte accounting helper, opt-in narrow interface, original safe errors, explicit resource ownership and meaningful failure tests. No logging platform or sandbox framework. OpenAI Docs is not needed for this local Node seam; no current docs are substituted for frozen Codex schema. This proposal does not establish tools isolation or access:none.

Fixed input `apps/runner/src/codex/index.ts`: 13095 bytes, SHA-256 `036f7a002237a8dc55bb99015ddf1b26b4491eeeaac1fbeffbe99ee648801a4d`.

Fixed input `apps/runner/src/codex/options.ts`: 3410 bytes, SHA-256 `a2d03fab6158330700a623b3803725739d42bc32e6600f4fbbd1bab71599d655`.

Fixed input `apps/runner/src/codex/types.ts`: 2721 bytes, SHA-256 `7e66b84406cfb238a6d1a701aa2cd1e05e6935b5760c55cc7e1ccfbe1a944f07`.
