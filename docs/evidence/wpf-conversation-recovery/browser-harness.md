# Recovery browser harness — prepared, NOT_RUN

The browser/fixture source is a future entry, not execution permission. No PG, browser, HTTP, Vite import, new types or dependency writes were run for RB1–RB4. Overall feature review remains NOT_STARTED. The existing 20/20 controlled-IDB baseline belongs only to 4ba; the later 22-case source and two subsequent material-binding cases (24 total) have not run.

## Ownership and budget Interface

- Parent entry uses built-ins before validating a fresh `FLOW_RECOVERY_GATE`, exact HEAD/19 hashes and cumulative budget. `FLOW_RECOVERY_BROWSER=1` alone is insufficient. `FLOW_RECOVERY_TEST_ADMIN` must be the explicitly authorized isolated PG endpoint; no default, credential discovery or personal service.
- Gate fields: `allowRun`, unique `run`, `sourceCommit`, `sourceHashes`, `expiresAt`, `totalMs` (30,000..90,000 and cumulative <=90,000), `minimumFreeBytes` (at least 1GiB+128MiB), `scratchParent` resolving to `/private/tmp`, `maxScratchBytes` (explicit, at most64MiB). These are source-prepared requirements, not a newly approved run window. At least15s is reserved for cleanup. Fresh manager/user-authorized window and actual resources remain separate prerequisites.
- A parent timer uses monotonic elapsed time and owns worker/Chrome detached groups before startup awaits. Work stop sends TERM; cleanup escalates only owned groups to KILL and verifies their disappearance. A hard deadline writes incomplete ownership facts and exits nonzero, preventing automatic rerun.
- Parent DB lease persists exact random name/marker and attempted/confirmed/markerWritten. Unknown CREATE acknowledgement is an error even if later observation is empty. DROP requires confirmation, matching marker and zero connections; no FORCE or termination of unrelated sessions. Nonempty or unobserved remaining state cannot be green. A missing-marker/unknown database is retained with facts for explicit operator review.
- Whole evidence recursively <=8MiB. Admission reserves5MiB: logs<=1MiB, final worker report<=2MiB, two PNGs<=512KiB each, bounded ownership/budget records. No prior raw deletion. Vite/native-loader and Chrome profile live only in the unique scratch tree, never ignored dependency dirs/evidence cache. Scratch uses a separately admitted cap; peak logical bytes/free-space samples do not prove a physical peak bound. 250ms monitoring stops on threshold/measurement error; it is not a hard quota.
- Output is `docs/evidence/wpf-conversation-recovery/browser-runs/<run>/`: sources, budget, process/database/scratch ownership, worker report, cleanup, supervisor outcome and images. `budget.complete` is accounting; `cleanupComplete` is separate. Missing/incomplete prior budget or cleanup blocks a new attempt. Worker App cleanup can be forcibly terminated by its owner; final process/DB/scratch observations determine cleanup, never a promise timeout alone.

## Explicit coverage matrix

| Requirement | Prepared observation | Current evidence |
| --- | --- | --- |
| Actual browser cookie-only refresh / CSRF / SSE handshake | HttpOnly cookie, public session GET, cookie/no-bearer stream HTTP 200 and missing-CSRF rejection | NOT_RUN; SSE event delivery/reconnect remains PENDING |
| Text + delivery intent + file material | Files UI selects seeded resource; original reference/order in IDB; reload explicit Restore, unverified metadata; explicit Browse then exactly one official composer chip/name without reselect/remount; zero content reads or mutation | NOT_RUN |
| Original material turn with lost ACK | Real center commit, dropped response; subsequent retry body and key exactly match, attachment ref unchanged | NOT_RUN |
| Two browser tabs CAS | Actual shared IndexedDB; B cannot replace A's restored draft version | NOT_RUN |
| Auth loss with unsaved page-only text | Force transaction abort through browser IDB method, expire isolated session, real public read via focus; no reload, reconnect retains mounted text, zero command POST | NOT_RUN; failure injection is identified, not spontaneous quota exhaustion |
| 390 light/dark keyboard | Stable viewport, focus the real trigger then Enter opens / Escape returns focus; bounded PNG; not a full Tab traversal audit | NOT_RUN |
| Complete knowledge/profile/steering draft | Direct/source preparation only | PENDING browser |
| CREATE + first-turn / Queue / Steer recovery | Original authority direct/source cases | PENDING browser |
| Second-center/principal isolation | Source/direct only; fixture is one real center | PENDING browser |
| Center caller Origin / delayed cookie clearing / repeated connect slot semantics | Independently frozen central inputs and final integration gate | PENDING central decision/evidence |

No matrix item is marked passed from this preparation. A successful bounded subset will not stand in for remaining full feature acceptance. No budget expansion or automatic rerun is implied.

## 7244 worker review follow-up — source only

The binding now owns a small `syncComposerDraft` operation. React triggers it on Input publish but keeps the existing preparation watcher bound only to its real lifetime. Synchronization checks current capability/readiness/lease, immutable item membership, held submission, current composer IDs and in-transit IDs after each completed add. The pinned core appends complete metadata synchronously; no file/network preparation is started. Two controlled-composer direct cases are prepared for verified restoration/deduplication/removal and paused add settlement/revocation/held-next-draft isolation; NOT_RUN. The browser case checks real official composer DOM and filename after Browse, retaining the exact first-request attachment-reference assertion. Original 7244 evidence is unchanged.
