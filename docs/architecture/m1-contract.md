# M1 public contract v1

F00 implements the TypeScript/Zod types in `packages/contracts`, consumed by the HTTP client and every feature. PostgreSQL is authoritative. The personal workspace has one configured owner credential; runners use separately generated, revocable credentials stored only as SHA-256 digests by the center. No secrets appear in events. Remote deployments terminate HTTPS; development listens on loopback.

## HTTP interface

All endpoints except `GET /api/health` require `Authorization: Bearer …`. Owner and runner roles cannot substitute for one another. Error responses are `{error:{code,message}}` with appropriate 400/401/403/404/409 status.

| Caller | Method and path | Input → result |
| --- | --- | --- |
| Owner | POST `/api/tasks` | `TaskSubmission`, required Idempotency-Key → 202 `AcceptedTask` |
| Owner | GET `/api/tasks?limit=40&before=…` | bounded newest-first `TaskList`, opaque nextCursor |
| Owner | GET `/api/tasks/:id` | `TaskSnapshot`, newest 100 timeline entries in ascending order |
| Owner | GET `/api/tasks/:id/events?after=0&limit=100` | `EventPage` with oldest entries strictly after cursor |
| Owner | GET `/api/tasks/:id/stream?after=…` | SSE `update` frames containing the same `EventPage` shape |
| Owner | GET `/api/details/:id` | `Detail`, loaded only on expansion |
| Owner | POST `/api/tasks/:id/decision` | `DecisionAnswer`, required Idempotency-Key → `TaskSummary` |
| Owner | POST `/api/tasks/:id/cancel` | `{}`, required Idempotency-Key → `TaskSummary` |
| Owner | POST `/api/runners` | `RegisterRunner` → one-time `RunnerRegistration` |
| Owner | POST `/api/runners/:id/revoke` | `{}` → `{revoked:true}` |
| Runner | POST `/api/runner/claim` | `{}` → `ClaimResponse` |
| Runner | POST `/api/runner/heartbeat` | `Ownership` → `HeartbeatResponse` |
| Runner | POST `/api/runner/events` | `EventBatch` → `EventAcknowledgement` |

Task, attempt, timeline cursor, runner and native session identities are separate. Idempotency is scoped to workspace + owner + operation (including task ID for task commands). Hash validated canonical content, persist the original response, reject changed content under the same key. A successful response follows transaction COMMIT, never just a queue `send` result.

## Bounded reads and streaming

`limit` is an integer 1–100; `after` is a nonnegative safe integer. `EventPage.nextCursor` is the last delivered cursor (or the requested cursor for an empty page); `watermark` is the latest durable cursor observed by that query. Continue from **nextCursor**, not watermark, while hasMore is true. A snapshot contains the newest 100 entries; hasMore means older entries exist. Read older history from after=0 and page using nextCursor. Cursors are task-scoped, monotonically increasing and never reused.

SSE sends bounded pages, including task status, pendingDecision and usage even when entries are empty. State changes therefore do not depend on parsing generated prose. Clients reconnect from their last delivered cursor and fetch a fresh snapshot after a reset. M1 retains all events; an impossible cursor beyond the current watermark yields reset=true and nextCursor=0. SSE sends periodic comment keepalives and cancels only its observer when the connection closes. It never changes task lifecycle. Slow clients must be disconnected or throttled rather than growing an unbounded server buffer.

Text entries are bounded to 4,000 characters. Reference business fields are exactly `id/title`; full tool results, artifacts, session resources and verification evidence live in separate detail storage. Both serialized EventBatch and HTTP request body are at most 2 MiB; each content is at most 1 MiB UTF-8 and batches contain at most 50 events. Runners split batches below those limits. Ordinary snapshots and SSE never select full detail content.

## Runner ownership and event acknowledgement

The default lease is 10 seconds, heartbeat interval at most 2 seconds, using the center/database clock. Claim creates exactly one effective attempt in a short transaction, with monotonically increasing ownerVersion; token must belong to that attempt's runner. Heartbeats cannot revive expired leases. Expiration/revocation marks unfinished work `uncertain`; there is no automatic reassignment or repetition of unknown external writes in M1.

Sequences start at 1 and are contiguous per attempt. `(attemptId,sequence)` and `(attemptId,eventId)` are unique. A batch is ordered and atomic. Identical saved events may be replayed; same ID or sequence with different content is 409. A gap or new event against stale ownership is 409. `accepted` counts only newly stored events; `lastSequence` is the highest contiguous durable prefix. **An entirely identical saved batch remains acknowledgeable after terminal state or lease expiry**, subject to runner identity/version, to recover a lost final response. No new events are appended in those states.

The runtime serializes event emission and keeps stable IDs/content until acknowledged, with a bounded local buffer. Heartbeat loss stops new tool actions, signals interruption and retains unacknowledged events; it is not reported as user cancellation or successful completion. Existing actions may already have taken effect. On reconnection the runtime checks ownership before any new action; a stale attempt remains uncertain for reconciliation.

`assertOwnership()` checks reachability, current lease, runner identity, ownerVersion and cancellation. The Claude adapter invokes it on **every PreToolUse**, and again after a human decision. `waitForDecision()` belongs to the runtime: emit exactly one decision event, then await the durable answer. The runtime alone emits `completed`, after the adapter actually exits; adapter failures throw. A requested cancel and actual stopped acknowledgement are distinct facts. A completion received while cancellation is requested keeps the actual outcome and the cancellation history; it cannot erase observed completed work.

## Verification and native sessions

Artifacts use SHA-256 of UTF-8 content as version. M1's designated verifier is `flow.text` version `1`, with the submitted `verification` rule or `{kind:"nonempty"}` by default. Its inputDigest is SHA-256 of `JSON.stringify({artifactVersion,rule})`, where rule is reconstructed in order as `{kind:"nonempty"}` or `{kind:"contains",expected}`. The server checks task/attempt linkage, content/version integrity, verifier identity/version and digest, and independently evaluates the same deterministic rule against the saved content before accepting reported result. A conflicting report is rejected. Verification evidence is nonempty; failed verification retains both artifact and evidence. No model assertion directly passes verification.

Task status reports execution; verificationStatus separately reports acceptance. Artifact submission alone is pending. Verification failure does not delete successful execution. Each new artifact invalidates prior acceptance until that version is verified.

A resumeSessionId must already be recorded for the same workspace/harness and must route to its original runner; the center excludes concurrent use of a native session. Unknown sessions are rejected, unavailable original runners leave the task queued or uncertain; do not silently start a new session or move it to another runner. This is same-runner native transcript recovery, not cross-machine recovery.

## Usage accounting

Samples have source/scope/scopeId/model/sampleId. These form a stable deduplication key independent of event IDs. Store all categories, including null, as evidence. Only `accounting:authoritative` samples contribute to totals: fixture's session stream for tests, Claude's per-model `modelUsage` session stream for the native adapter. Assistant-message/result.usage diagnostics are informational and never added again. `costKind` distinguishes SDK estimates, provider billing and unknown cost; SDK values must be labeled estimates.

Cumulative samples require an explicit baseline: `new-session` is zero only for a genuinely new session; `sample` references an already persisted sample in the same stream; `unknown` (or missing/invalid baseline) records evidence but leaves corresponding totals unknown/incomplete. Later samples may use the previously accepted cumulative sample. On a resumed task, do not claim a new-session baseline; use a known persisted sample or unknown. Equal repeated samples add nothing, decreasing counters never create negative consumption and mark that stream incomplete. Delta samples must not share an overlapping authoritative cumulative source. Missing categories remain null rather than zero; partially known totals are marked incomplete.

## Implementation and test seams

The approved public seams are the center HTTP interface, shared client, runner/HarnessAdapter interface and complete Web/CLI journey. Tests observe these interfaces with a real isolated PostgreSQL database; provider calls are isolated to R02. Simulation does not prove native model recovery, cross-machine operation or 100+ capacity. Worktree-specific DBs/ports must be recorded before tests.
