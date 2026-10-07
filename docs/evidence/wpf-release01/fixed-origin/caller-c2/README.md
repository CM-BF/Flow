# RELEASE01 fixed-origin caller — PREPARED / NOT_RUN

This is the single candidate for the existing WPF-RELEASE01 successor. It is ready for concentrated source/native-boundary review, not for execution. There is no heavy gate, credential file, PG/Chrome holder, or three-App runtime result. The separate three-case Python helper check and its local-only resource observation are recorded below. Native boundary approval is null. The two reviewed harness files remain byte-identical to implementation `9658a6b763de69038778de1b0c16de64ff824c75`; final owner metadata HEAD is recorded in binding.json. All four claim literals remain owned by `38b9a7ff-c9be-4b56-af50-e076afb603bc v1`.

## Exact entry and inputs

Future single-use command, only after the review and fresh resource/identity admission:

`python3 /private/tmp/rel01-c2/supervisor.py --gate <absolute fresh gate.json>`

The gate must bind current binding/runner hashes, exact claim and fresh observed ledger hash, no overlaps, a reviewed native boundary with exact parent/worker hashes, a single run ID, future expiry, explicit total/start/stop limits, and a private admin input path/device/inode. Do not pass a handoff description as the gate. No default PG URL or old backend fallback exists. A consumed gate cannot be reused. The current PREPARED binding fails before launch.

`inputs.json` supplies the final backend source `6c0fdcda8858aac33489c48c1948e902dd6a3d7e`, tree `a83d27430908d78a27a846be9cfbf9de27a1ab97`, artifact `7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920` under `/private/tmp/flow-svc06-diagnostics-artifact-Snq8cV`. Its eight entry pins and manifest are fixed. The existing artifact verifier, not another verifier, checks the full manifest at actual runtime before imports. Preparation reused the accepted tuple observation and did not claim a fresh full 15,628-entry verification.

The final isolated-host result is `Flow/docs/evidence/i02/svc06-bootstrap-r2-result-review.json`: target92a207b, deliverya0117ed, main6571056. Its accepted host bootstrap is an input; it is not this three-App compatibility result. The older tuple observation's pending-review item is now historical.

Public normalized settings: cookieOrigin `http://127.0.0.1:61228`; trustedOrigins `["http://127.0.0.1:61228"]`; authEpoch `svc09-b2b-20261007`. Context format1 has the same publicOrigin and policy SHA `81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638`. Root supply review `03ba8e…` verifies these non-secret inputs; they are no longer missing.

Three immutable descriptors in inputs.json are `461a9732…`, `caa1e938…`, and `d629631d…`. Root observation `/private/tmp/root-svc09-retained-three-app-asset-integrity-20261007.json` fixes all 30 assets (4,538,660 bytes), root/dist identities, manifests and source heads. It is reused without another preparation scan. The actual harness rechecks identities and bytes before serving them. The 461a manifest is format1 and has releaseId=null; no releaseId is invented. Four format2 compatibility observations per App remain read/send/samekeyrecover/negotiation, bound to the same final backend and public context. No rebuild, modification of assets, or replacement of the existing report codec occurs.

## Lifecycle and network boundary

The Python parent reuses the DPERF sibling process/EOF/soft-stop/final-sampling pattern. The delta is necessary for the existing Release harness: Node first creates an owned marked DB, dynamic backend and restricted dynamic proxy; `launchOwnedChrome` then publishes only the exact proxy/worker identity through owned scratch. Parent starts native Chrome after that request, returns its actual PID/PGID/argv/binary hash and owned CDP endpoint, and later acknowledges close only after native group absence plus both Chrome EOFs. Harness report import remains after Chrome/HTTP/DB cleanup.

Node is in one new owned process group inside the custom macOS sandbox. TSX loader thread and installed esbuild native helper stay in that group. File writes are limited to exact scratch and this run's raw directory. Loopback traffic serves the owned proxy/backend/CDP and explicit test PG; outbound personal port61228 is explicitly denied. Only a small allowlist of ordinary environment keys is inherited; FLOW/PG/proxy/Node-options values are not copied. The one explicit private admin input is passed to the worker and removed from its environment before imports. It is never printed or placed in inputs/results. The operator supplies a uid-owned, single-link,0600 regular file≤4096 bytes; the operator also owns its eventual removal. No current preparation reads that file or private configuration.

Native Chrome retains Chromium's own sandbox and runs as a separate owned sibling group. It does **not** inherit the custom outer OS write/egress restriction; this difference needs an explicit new exact source-native acceptance. `--proxy-server=<owned exact HTTP proxy>` plus `--proxy-bypass-list=<-loopback>` is the actual route, with no DIRECT fallback/PAC/general proxy. A same-origin canary checks the route before Cookie/App work. Node APIRequestContext must not be used for61228: no page.request/context.request/route.fetch. Actual Chrome page-relative fetch supplies the separate Cookie/CSRF probe; the three retained Apps continue their native Bearer journey and are not injected into Cookie clients. No personally running61228 endpoint, user tab/profile, provider, or actual deployment is touched.

`MAC_CHROMIUM_TMPDIR`, TMPDIR/TMP/TEMP, cache, profile and BREAKPAD_DUMP_LOCATION all point into this candidate's owned short scratch. No --no-sandbox, system-temp/Library permission relaxation, background browser, or second Chrome is introduced. The installed static inputs are Node24.20.0, TSX4.23.15, Playwright1.63.0, esbuild0.28.2, Chrome154.0.8037.99. Static entry pins include the actual playwright-core bootstrap/coreBundle path; no nonexistent guessed inprocess entry is required. These pins do not claim dynamic execution has passed.

## Proposed resource envelope — not a grant

| Resource | Candidate bound / responsibility |
| --- | --- |
| Wall time | new180,000ms total,150,000ms work +30,000ms cleanup; previousRuntimeMs=0; no credit from old Release03/Quick/type budgets |
| Process groups | parent1; Node1 group with one TSX loader thread/necessary esbuild helper; native Chrome1 group; all launches are dynamic and owned |
| PG | one random `flow_release_<uuid>` DB; server pool max8 + scheduler pg-boss max3 + fixture sequential max1, conservative max12 connections (fixed notify=false, no extra LISTEN client); normal marker-verified DROP only after owned connections0 |
| PG bytes |128MiB planning DB/WAL allowance, not measured peak or an independently enforced PG quota; future manager must accept/update actual combined PG bound |
| Scratch |64MiB maximum of regular-file logical/allocated bytes, containing profile/cache/temp/crash/handshakes; existing scratch scanner remains independent |
| Retained |8MiB total new candidate/raw/log/report/terminal/outer evidence;256KiB reserved for trusted outer stdout/stderr/observation; no deleting failed raw to fit |
| Metadata |1MiB extra own project evidence/records, outside candidate runtime accounting |
| Space | proposed start≥6,190,268,416B, stop≥1,207,959,552B; no fresh capacity sampled; manager must use any larger live combined requirement and preserve other groups' KEEP inputs |

The public OPS helper `measure.py` SHA52b92553… is reused byte-for-byte only for retained(BASE excluding exact scratch). This is PARTIAL_RETAINED_ADOPTION, not a complete scratch migration. Unknown measurement is FAIL/KEEP, not zero. Scratch ENOENT alone is tolerated; other directory errors propagate. Retained/free/scratch are sampled during work, after reap before deletion, and after result/budget writes. Resource failure still attempts owned scratch cleanup when group identity and measurement are known; an unknown measurement is preserved for inspection.

Soft TERM/INT marks failure monotonically and allows the worker to close contexts, native Chrome via the parent handshake, proxy/center, marker DB and pools. Parent keeps draining all streams, then reaps only its owned groups, checks every EOF and drop count, and seals exact current-run raw hashes. Normal successful cleanup returns three imported verified compatibility IDs. If Node is killed before marker/DB cleanup can be proven, the caller reports UNKNOWN_OR_FAILED and keeps raw ownership evidence; it never force-drops an unknown DB or claims complete cleanup. The external PG operator must resolve that specific marked resource before a later run; no current fallback cleanup is authorized.

## Receiving contract and open validation

The eventual trusted outer capture must retain start/PID, actual OS exit, stdout/stderr with a total≤256KiB, and end time. A single terminal record binds result, budget, and raw-manifest hashes. Accept only actual outer exit0 + exact matching terminal + sealed result/budget/raw + worker exit0 + zero errors/drop + both owned groups absent/EOF + scratch absent + marker DB normal DROP/proxy/center closed +3 verified reports. Declared exit or disk PASS alone is insufficient. Charge conservatively ceil(max outer elapsed, terminal-after-final-writes, parent elapsed). Handled stop before declared completion forces failure; a later OS signal is rejected by actual outer exit. No SIGKILL cleanup guarantee is made.

Initial preparation used Python ast and source/JSON/hash/claim checks. The c2 ownership helper then ran its three-case, one-Python, isolated local check; it imported this parent module but never called main. No Node/product import/types/browser/PG/HTTP/build/install ran. The local-only fresh space sample is not a heavy admission. Sandbox syntax/effect, deferred startup/close handshake, PG allowance and complete runtime are unvalidated and await concentrated review/admission. The primary review focus is network isolation, bounded cleanup after partial startup, and post-cleanup report acceptance—not a repeated review of already accepted 30 assets or a new release platform.

## c2 delta from fixed c1

REL-C1-R1: exclusive creation captures directory dev/inode/uid; cleanup uses that actual identity and only removes the same owned directory after groups and measurement are confirmed. Pre-existing or replaced paths are KEEP and fail; no invocation adopts an old scratch. REL-C1-R2: fixed backend scheduler has a separate pg-boss pool max3; declared ceiling is now12, not the historical9. The separate15s helper check ran once:3/3 PASS, outer0,243.295908ms/charge244ms, exact synthetic TMP absent. It imports only this Python parent module and calls actual ownership functions, never main. No PG/Chrome/browser compatibility execution occurred. Root delta/native review remains pending. All c1 files and original source/type evidence remain unchanged.
