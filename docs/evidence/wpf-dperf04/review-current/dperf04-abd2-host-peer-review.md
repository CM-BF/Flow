# DPERF04 fixed Host-test delta review
Verdict: APPROVED_SOURCE_SCOPED; 0 blocking findings.
Old 1441d86baa40e98f4cb81b82dcc551202973209b
Target abd2aff768f97350762b2eaddbe7ae6843902f48
Observed metadata HEAD 823071cd3188a1019d8e5c5eb2c60f0939536054, branch codex/dashboard-summary-detail, working tree clean.
Review is only this test delta and unchanged fixture listen/cleanup context. No product import, execution, tests, HTTP, PG, Chrome, space sampling or project write. Reused local find-skills/codebase-design/clean-code review methods.

1. Correct transport and observed evidence: test:125–138 installs an observer on the actual owned server request event. The probe now uses node:http.request to f.url + /api/summary, with explicit Host=example.invalid and agent:false. Fixture:44–47 creates the real dashboard server, binds 127.0.0.1 port0 and returns that numeric loopback/dynamic-port URL. Host does not change the TCP destination to example.invalid. The test asserts actual inboundHost exactly before asserting response403. This fixes the fetch-input-vs-wire ambiguity; a status alone no longer masquerades as proof that the hostile Host arrived.

2. Request/response lifecycle: test:130–135 sets the 2000ms socket-inactivity timeout to destroy the owned request with an Error; request error rejects and request.end() actually sends. Response is drained with resume(); only end resolves status. Response error and aborted reject, so premature response closure cannot be accepted as a successful403. agent:false prevents borrowing a pooled keepalive connection. All assertion/failure paths after request setup pass through finally:139 to remove the exact observeHost callback. A synchronous httpRequest/setup throw rejects the Promise executor and reaches that finally too. For this bodyless loopback probe the normal, timeout and abort/error terminal paths are covered by source; no new detached timer or automatic retry is introduced.

3. Timeout limit is accurately scoped: request.setTimeout(2000) is socket inactivity, not a2s absolute whole-test deadline. Existing parent test timeout25000 and separately reviewed external runner work/cleanup deadline remain necessary hard bounds. This is not a claim that the new probe was experimentally timed. Fixture:45 still closes all connections/server on test cleanup; no source change removes cleanup.

4. No weakened adjacent checks: existing pre-probe task404 and method405 remain. test:140–146 still loads the registered plan document, rejects ../../secret, rejects a symlink escape, restores the plan, and checks legacy /api/snapshot implementationProof. The fix did not delete these previously unreachable assertions. Production server and summary fixture blobs are unchanged from1441. The original failed fetch-based run/log stays historical, not reclassified as product pass.

Future evidence needed: the explicitly admitted one Node-only attempt must actually observe inbound example.invalid,403 and all later document checks, with its runner/cleanup result. Source approval is not permission to run, a test pass, or dashboard overall completion; no rerun was performed here.

SHA256 target test=current=metadata: 12ade5b68d65ded6eb312c6548b180c68508f7c91c0552e447c25759014fc2d5
SHA256 old test: 6a679056223aa37dacfed10f4b1628f6af0fb4b768f4f003bbf69c4a6d2f6f4b
SHA256 unchanged fixture: d0a07d497b6842a581b3a52c57f44ad10a132cd7adaa0057d1b236855871d4e5
SHA256 unchanged server: 3920854061fcd6ce35795baa146d207662309ea5345102db933a0e4f95425994
