# RELEASE03 B lost-ACK causal read — source/raw only

Observed 2026-10-06T17:17:43.020715+00:00. Reviewer workspace_panels_owner. Fixed harness 9927bb071494ec16a9d8091a6ba5edb4ea72c18a; execution HEAD b6c13e0190771fd42e8f34d75cab7ab37adbf6c2; sealed metadata 6411ba7a43f0f54b5fc924ef8850b88d80e44ac2, current clean when inspected. All12 raw files equal sealed Git blobs. Artifact source 5069586a9f17332de526e101eca3a4250cbc8d91; loaded index-CZaGITme.js SHA256 a7178926f022221df9cba8b816145c2bafed25ba8239ab8e0ae617d17a8b843e matched the retained actual static asset and app.json. No product/runtime import, Node/test/HTTP/PG/Chrome, space sample or project write. Local find-skills/clean-code/webapp-testing methods reused; no installation. A prerequisite and resource/cleanup assessment belong to the parent/manager and are not rerun here.

## Conclusion

The harness did inject the first fault, but did NOT establish its assumed browser-visible unknown-ACK condition. A second same-key/same-body request received the saved successful receipt before the harness ever reached its explicit Retry click. Current evidence therefore does not establish a product lost-receipt defect. Keep B FAILED/compatibilityId null and the original unknown/retry assertions; correct the fault seam, rather than treating the vanished receipt as success or deleting the assertion.

## Concrete actual chain

- app.json and worker.json record plain Send as the only completed check. The scoped Files action succeeded far enough to pass composer attachment count and click Send; execution then failed at browser.ts429 waiting5s for Receipt unknown. The locator first saw Sending message and later no Message receipt. The explicit Retry is at436, after this failed await; that click was not reached.
- wire[34] is POST /api/conversations/e60d2495-4f64-4d8c-bf08-a275f420c314/turns, status202, dropped:true, key4b758a99-32ee-479e-a354-d746268b9ff9:turn. Its real upstream ACK has replayed:false, turn aa38d65e-52d6-4f35-8d0c-0fe4dedaf700 and task bdb80514-7faa-4e48-8387-d4781216c68b.
- wire[35] is the same POST/key/exact body, status202, dropped:false, replayed:true, same turn/task. Both recorded response digests recompute correctly. Body SHA256 is08876ca44e1b29713be2f7e4e46fb2220daf292778005897c2ffaf544cad2bb8. The first response digest is410929eb553335928e00156404cec8d37461a9d2be1a2ff8c5d6637662510588; second5792d2f0820f6d60b3eb3635cb45076bd54e1c823b5154176f507cde10ac246e.
- wire36 onwards reads that task, its assistant stream metadata and updated conversation. The retained screenshot shows the accepted user turn, queued activity, pending reply, and intact Independent draft after lost ACK, with no Message receipt. This is consistent with receipt acceptance, not proof of an unknown receipt being discarded.
- pageErrors is empty; consoleErrors records only favicon404. No retained requestfailed/Fetch exception/NetLog evidence identifies the browser transport's exact retry reason. Do not invent a TypeError observed by the App.

## Fixed mechanism and attribution limits

Fixture114–188, especially146–173: loseNext is consumed before the upstream response; for the first successful response it suppresses BOTH headers and body then destroys the downstream socket after recording the upstream ACK. It does not fault the following same-key transport attempt. The next request therefore receives an ordinary202 replay.

Actual artifact source client393–395 and540–551 executes one fetch per call, without a retry loop; SyntaxError from JSON decoding becomes UnknownConversationAcknowledgementError. A transport exception also propagates. Projection270–287/290–331 invokes dispatch once for Send, and again only through explicit retry; successful verified ACK calls outbox.accept323, while non-definitive failures call outbox.fail328–329. Outbox89–92 requires unknown for retry;103–109 retains unknown on non-definitive error and clears only acceptance. Thread36–43 hides the receipt when outbox is null and provides explicit Retry;100–129 makes one handoff operation and awaits it. Retained actual JS has the same single-fetch/catch/accept/fail paths, not merely a guessed later source version.

The duplicate wire plus no reached Retry click is actual evidence of an additional network attempt. Chromium reused-socket retry is consistent with the headers-not-delivered failure and the root's mechanism assessment. This report has no NetLog/socket reuse/request-initiator trace, so that precise internal reason remains an inference, not newly reproduced browser behavior. It is unnecessary to establish that the current one-shot fault did not force the intended unknown state.

## Smallest deterministic repair proposal (not implemented)

Prefer a fixture-only committed-ACK-unreadable mode: capture and preserve the REAL successful upstream ACK/body/hash exactly as now; withhold that ACK from the browser but complete a well-framed2xx application/json response containing a deliberately invalid short JSON body (for example '{'). Preserve the actual upstream status; recompute downstream framing and do not copy the old Content-Length. Record fault mode plus downstream status/body/hash separately from upstream truth. This is a completed HTTP response whose ACK is unreadable, not a fabricated center4xx or a genuine transport-loss claim. The known public client decoder must classify it unknown, without a pre-header socket failure that may be transparently retried.

Keep Send/Queue unknown visibility, frozen attachment refs, independent next draft, explicit same-key/body Retry, replayed:true and same turn/item identity assertions. Require the first injected response to be recorded before user Retry; ensure no second application request precedes that click. After the explicit click, the next request gets the unchanged real replay. If retaining the name lost ACK, clarify it means the successful center ACK was suppressed, not proven socket failure. A true truncated-body transport experiment would need separate explicit framing/client-error evidence and must not be silently substituted or granted a run here.

Do not make injection persist indefinitely, count browser hidden retries as explicit recovery, replace the public decoder, clear receipt state, add automatic retry or modify product code. The defect to repair here is the harness precondition, with source review followed by separately authorized validation.

## Recovery fixture applicability — separate source

Recovery ec91d1113898e70f380f9bb503f3b5ceff9467b2 retains the same older drop-once/pre-header-destroy strategy. It has the same potential nondeterministic unknown-ACK premise. That is not a regression from ec91's native Host/Set-Cookie fix. No Recovery source was changed during this review; its27 controlled direct result remains fixed1b8 and its real browser remains NOT_RUN. A later authorized fixture-only delta can use the same explicit unreadable-ACK distinction; do not carry RELEASE run evidence across features.

## Fixed source hashes

- 9927bb071494ec16a9d8091a6ba5edb4ea72c18a `apps/web/test/web-current-preview.fixture.ts` SHA256 `353aabc21dffc9461015f2d798e3a6894f5eeb58714368de21a75bf18d38a1bb`
- 9927bb071494ec16a9d8091a6ba5edb4ea72c18a `apps/web/test/web-current-preview.browser.ts` SHA256 `fe3219fa3787eb27c4159f442c01884b64085cb7e3dda32d78213a18afdc084e`
- 5069586a9f17332de526e101eca3a4250cbc8d91 `packages/client/src/index.ts` SHA256 `a481b2422039612e109dfb08d0502b20f3550ef53247ada0a0fc400810d2f9dd`
- 5069586a9f17332de526e101eca3a4250cbc8d91 `apps/web/src/conversations/projection.ts` SHA256 `50ab77de33452456d30097b20529e5220b23f52910e183acad8e4c871b2406db`
- 5069586a9f17332de526e101eca3a4250cbc8d91 `apps/web/src/conversations/outbox.ts` SHA256 `c04ce0116aefafe026dff18bf54d0e0336965d077defdc2537aa9a34e9b88085`
- 5069586a9f17332de526e101eca3a4250cbc8d91 `apps/web/src/conversations/ConversationThread.tsx` SHA256 `e1e98f00c2450224e2ce619c8a8d8a9a03b844361bee627df25b07b89cfe004c`

## Sealed raw hashes (all12 retained)

- `app-failure.png` 58257 B SHA256 `f5e70b203d399b334392571c5ddf42eda757c211f577c023dcace8a4e260bbd2`
- `app.json` 2186 B SHA256 `3ea4d48a0be713f0ed51656560eff18ca3c9eee28102471db3005ac6095a3eac`
- `budget.json` 136 B SHA256 `39c692b1ddfaf212768538a3ea19b4166fc87f61fb21bb4d09901c0f84a4e8dd`
- `cleanup.json` 412 B SHA256 `0a36a8cae4ec5eb0358e9c5387f8ec2a9bc894cec9fd30dac9936d967c3604b4`
- `database-owner.json` 169 B SHA256 `8caf34077d48fe83b9b190fe0031d34a85f71a4688ce6a5ce321e995add6cf1b`
- `history-attestation.json` 4659 B SHA256 `414fe8e30e5f4f9e175d941eb3560dd04e3d952c0217a0702d750c22bd87db45`
- `outcome.json` 5230 B SHA256 `4862913f71698ca8bc63dc7db6a49f6f6a0351a1d446fe4b95711e40d38f1096`
- `process.log` 5496 B SHA256 `e357a57b6bddc8a8067411d648356f4b9a192c27e2476fde7322090ddce3a81b`
- `sources.json` 5521 B SHA256 `9b8fc611007e3ef3faac0df1d52fcbcee4967194eb161e74f1f43b9289687ace`
- `supervisor.json` 8479 B SHA256 `a951b81e33939698b5ad205a130af4ab4912db73cb19060aae9f5d8d71a816a3`
- `wire.json` 47478 B SHA256 `fec6ccd225f84a4dc79f153bd2211c573de98c1b5c8f8804d567ac45992cc5d1`
- `worker.json` 7306 B SHA256 `747a0526dceba1f93e8b41393bc26db77a852d1727efd7de03ce57027e23d21e`

Scope limit: only causal diagnosis and repair proposal; no runtime approval, SVC green receipt, A re-review, new budget or implementation permission.
