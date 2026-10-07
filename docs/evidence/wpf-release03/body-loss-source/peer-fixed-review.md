# RELEASE03 ef458 independent source review

APPROVED_SOURCE_SCOPED — 0 blocking findings. Reviewed 2026-10-06T17:26:51.613259+00:00; reviewer workspace_panels_owner. Fixed source ef458ff06cf7f12549b4bf3e10fc9b3e4c886ec7; baseline 6411ba7a43f0f54b5fc924ef8850b88d80e44ac2; actual metadata 495f7287273ce7d4bfd56503c093c273a0a5b92c, clean. Scope only the two harness deltas and their existing lifecycle/caller context. No import, typecheck, test, Node/HTTP/PG/Chrome execution, free-space sample or project write. Root/manager retain runtime admission and evidence review responsibilities; Execution Lead owns integration.

## Injection fidelity and lifecycle

fixture108–141 requires complete upstream JSON of2..131072 bytes, uncompressed/identity encoding, no simultaneous length+transfer framing, valid byte length when supplied, valid UTF8, parsed object and the real turn/item ID. The real full body/hash remains in Wire; only a one-byte strict Buffer prefix is sent downstream.134 constructs fresh headers from actual status/content type and full Buffer byte length, removes inherited Transfer-Encoding, adds Connection:close.135–139 flush headers, write the real prefix, then gracefully socket.end after its write callback. This is intentional raw-socket FIN, not ServerResponse.end and not immediate response.destroy. It preserves the chosen transport body-loss scenario, not a complete malformed-JSON response.

The one-second local timeout destroys only that owned socket and records a fault error. Local close rejects when error/hadError or required prefix/end callbacks are absent. Local flags are not treated as browser reception. Caller215–220 handles failure into fixture problems, retains wire/fault facts and accounts added bytes; pending writes remain owned by faultWrites. Signal230 closes owned server connections; close236 waits its pending writes after owned HTTP cleanup. Existing parent hard deadline remains the ultimate process/DB cleanup owner. Once-listeners on the per-response/per-socket objects do not enter a global registry; timer clears on actual close. No persistent loss loop or new retry authority was added.

Caveat for later evidence: endFlushed means the socket.end callback, and headersFlushed records local flushHeaders call. Neither alone proves remote reception; browser observations below are mandatory. A deadline or early close marks failure rather than a claimed successful injection.

## Browser evidence and unknown/retry assertions

browser408–447 installs observers before injection/click. It selects the POST with intended kind/text, then binds all response/failure/finish events by exact Request object; final436 matches actual path/key/body hash to Wire. It captures only nonsecret selected headers synchronously. It does not await Playwright's potentially unsettled response.finished() failure branch.

435 uses the existing signal-aware two-second bounded waiter for selected failure plus local socket closure;437 requires exact request→response-headers→requestfailed sequence and rejects requestfinished.438 bounds accepted failure categories;441 compares observed full byte Content-Length/content type/Connectionclose/noTransferEncoding.442–444 recompute real-prefix hash/length and require all local completion facts with no error. Each successful verifier removes its own handlers; actualApp finally546–550 removes all remaining observers before context.close on failure/abort as well. No new unbounded observation Promise was introduced. The prior context/parent cleanup limits are unchanged.

Turn470–485 still demands actual unknown UI, one pre-explicit-Retry matching wire POST, exact ordered attachment refs, public ACK decode, one explicit Retry, exactly two total requests, same key/body/turn and replayed:true. Next draft must survive. Queue488–500 now enforces equivalent first-fault framing, exact one pre-Retry, original refs, explicit Retry, two requests, replayed:true/same key/body/item, accepted UI, independent next draft and zero task cancel. The old assertions were strengthened, not removed. Failure artifacts now retain faultObservations; expected console errors must match a recorded selected failure and that same fault key/path.

These assertions may still fail in an actual browser. Source approval does not claim native framing or the browser body error has run successfully, nor waive unknown UI or exact network-attempt counts if the platform behaves differently.

## Historical evidence, scope and accounting

Independently recomputed: both current files equal fixed ef458 and the source-audit manifest hashes. All43 old raw files (464871 bytes) match sealed6411 Git bytes and their declared hashes. A history contract is byte-identical,11859 bytes / SHA25659cde31c515e29ef9856cfd5733a8d2ce9733fff31dc8dec466232abd5507086. No protected apps/server, packages/client/contracts, tools/personal-preview, lock/rootmanifest or apps/web/src delta. Source diffcheck0.

Four historical budget elapsed values are3874+4109+12326+19626=39935ms;180000−39935=140065ms remaining arithmetic. No budget or raw was changed and no new run was started. Both previous B failures remain failures. A attestation adapter is unchanged in this delta; final compatibility still requires a separately successful actual App run plus existing cleanup gates. This review does not mint an A/B gate or SVC approval.

## Fixed hashes and method

- `apps/web/test/web-current-preview.fixture.ts` SHA256 `4016c7811e77e12d8c8dbf2e6d90a433f93a3559bdff1e34b3a268a651c6d974`
- `apps/web/test/web-current-preview.browser.ts` SHA256 `2b010a0eab2155b048e1af634774515bd2f37b1db1b8dbdd9f9282a64ee5e0b7`
- `docs/evidence/wpf-release03/body-loss-source/source-audit.json` SHA256 `9bc9235948cc67247f4d49adc288e563bdb05c5b4c70ba187b03f166458b8ba2`
- `docs/evidence/wpf-release03/source-manifest.json` SHA256 `5e386f09eab0d4aa0f5970a7164e3871b64c6855abc945f4118083032db3d526`

Local find-skills/clean-code/webapp-testing methods reused; naming and ownership remain limited to fault injection and observations, without product authority/transport refactoring. Earlier causal raw and design reports remain intact. No new runtime finding was fabricated from static analysis.
