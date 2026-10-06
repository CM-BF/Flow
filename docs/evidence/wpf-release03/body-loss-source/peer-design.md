# RELEASE03 after-header real-body-loss design review

SOURCE_DESIGN_FEASIBLE_WITH_ONE_OBSERVER_CORRECTION. No execution or project modification. This accepts the root choice to preserve a real truncated-body transport scenario; the complete-invalid-JSON option in the earlier causal report is a separate decoding case, not a replacement.

## Required implementation details

1. First finish reading the genuine bounded successful upstream ACK. Keep its original bytes/hash/status separately. JSON validity alone is not semantic ACK validity: preserve the existing public shared decoder validation for the exact frozen request/reference. Reject upstream incompleteness/aborted/error, capture overflow, compression or conflicting length/framing. A normal uncompressed chunked upstream may be captured as decoded body bytes; never forward its Transfer-Encoding together with a newly calculated Content-Length.
2. Form the downstream response with actual success status and JSON Content-Type, `Content-Length: fullAckBuffer.length` (bytes, not code units), and `Connection: close`. Send a Buffer subarray with `0 < prefix.length < full.length`; never string-slice/re-encode across a UTF8 boundary. The prefix must hash against the actual full receipt prefix. Do not forward stale framing/compression headers. Node strictContentLength must not be enabled for this intentionally short response: installed Node declarations explicitly state it would throw ERR_HTTP_CONTENT_LENGTH_MISMATCH (http.d.ts860–868/1045–1049).
3. Use graceful `response.end(prefix, callback)` / local finish with the Connection-close framing. Do not call response.destroy immediately after writeHead/flushHeaders/write callback; that recreates the pre-header/reset ambiguity. Local end/finish only demonstrates local completion, not browser receipt. Keep existing parent deadline/owned cleanup as the bounded failure escape; no sleeps to guess delivery, no extra unbounded socket-close wait.
4. Retain original upstream receipt independently from injected downstream header/prefix facts and local finish/close/error outcomes. Only finish this fault once. An unexpected second POST before the explicit Retry must fail the fixture precondition, not be counted as user recovery. Count actual wire attempts as well as selected Playwright requests; a transport retry need not necessarily create a distinct public Playwright request identity.

## Concrete observer correction: do not await response.finished as the failure oracle

Installed Playwright1.63.0 types.d.ts22559 declares `finished(): Promise<null|Error>`, but its accompanying comment says it returns null. Actual client implementation coreBundle.js60037–60038 waits on `_finishedPromise`;62357–62362 requestFailed records failure and emits requestfailed without settling that response promise. Only `_onRequestFinished`62364–62374 resolves `_finishedPromise(null)`. Thus a selected truncated response may emit requestfailed while `await selectedResponse.finished()` remains pending until page/target closure; it is not a reliable bounded proof of body failure and can consume the harness budget. This is a source-derived API hazard, not a new runtime reproduction.

Use a listener installed BEFORE click that latches the exact selected POST Request object and its method/path/key/body. On response for that same object, synchronously snapshot status plus selected nonsecret headers; installed types.d.ts1181–1185 defines the response event as headers/status received. Then wait, within the already bounded work budget, for requestfailed on that exact Request and record request.failure().errorText. Chromium loadingFailed handling in coreBundle.js36375–36400 keeps an existing response and emits the request failure, so a response followed by failed download is represented by the public events. An optional body() rejection may be retained as additional evidence, but must be handled/bounded and is unnecessary if the selected response+requestfailed+unknown UI have been established. Do not depend on private `_finishedPromise`, nor merely test a resolved/rejected `finished` value.

The failure listener must distinguish requestfailed from requestfinished, reject/mark inconclusive if headers never arrive or success finishes, and remove only its own handlers on completion/abort. Bind response/failure to object identity rather than URL alone, because explicit Retry shares path/key/body. Never persist Authorization/Cookie values; selected headers can be Content-Type/Content-Length/Connection. If the observed error is different from the intended short-body failure, preserve it and fail rather than broad regex green. Exact platform error text can be recorded without treating a guessed string as an observed fact.

## Acceptance and boundaries

- Before Retry: one actual matching POST, real upstream202 accepted, declared full byte length, nonempty strict real prefix locally ended, browser selected response headers observed, selected body download failed, actual unknown receipt visible, independent next draft intact.
- After one explicit user Retry: one additional actual POST with unchanged key/body/materials; real replayed receipt with same turn/item; no extra commands. Apply the same existing Queue case.
- Keep A contract and original all12 evidence unchanged. This source proposal grants no PG/Chrome/HTTP/Node/type run, no new runtime budget and no source ownership. W01 remains the RELEASE writer. Recovery's analogous pre-existing fault seam remains separate and untouched.

## Inputs and method

Local previously read find-skills/clean-code/webapp-testing reused; bounded source/interface reasoning only. No new tool installation, product import, service, free-space sample, tests or browser. Actual Chromium behavior still requires the separately admitted run; local graceful end is not proof that the client saw headers.

Read at 2026-10-06T17:21:01.684678+00:00

- `/tmp/root-release03-body-loss-source-design.json` SHA256 `1b8de8afb41c1b1b4779b68743db686ecbac4491bd4f0f738b4d2ba10c68990a`
- `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-attachment-production/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/types/types.d.ts` SHA256 `2806f6d7810fba0306066d500cd716a6d1128d90af2c3cf71723e3ea0a8904c4`
- `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-attachment-production/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/lib/coreBundle.js` SHA256 `549070af3acabb3efcc4f55bfe6210f9f7c2fcf633cf7eaa59bfe60719969171`
- `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-attachment-production/node_modules/.pnpm/@types+node@24.19.1/node_modules/@types/node/http.d.ts` SHA256 `06c12e208576282dfd4aa04cc47ae3447008fdf79a360a9b0f3a6fb940960cd1`
