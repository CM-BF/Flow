# Recovery / MATURE06 lateLogout — READ-ONLY / NOT RUN

Recommendation: center owner consider **revoke-only logout**: retain authentication, awaited revoke, unauthenticated DTO/no-store; omit logout Set-Cookie. This removes this endpoint's late deletion of a newer cookie without a new client authority. Source/spec inference, not a verified fix. Original TODO06 handoff remains; no new task/claim/gate/runtime.

## Reuse and six fixed inputs

Management `docs/evidence/web-platform/connection-session-consumer-interface.md` already proposes this under “迟到注销响应补充”; reused (10311 B, SHA256 45f990a437b10ea5315edf29ebb278220cf1d593cff13b962139fe6d86fa9c18). Older caller-binding/Connect-reuse suggestions are NOT reinstated: latest alignment accepts single-origin and fresh non-idempotent Connect. Delta here is compatibility, ordering limits and tests.

Authority `/private/tmp/root-recovery-center-alignment-intake-review-20261007.json`: 4269 B / SHA256 1e89d65635f9232a8808647802685cdaa0d9a627bea04187d76107cd17314adf; underlying alignment SHA3110773645186d0e7f63bc6960911e70655456c1184cc2553deff99897c3c45d.

Center ref **f68dbb7167dcbd3377bb13c38c02636cfb7c28ff**, four hashes match alignment:
- `apps/server/src/browser-session/index.ts`: 9561 B / 332c4c91ce07c59f1c9b41102b06ee2b931b192e0e6bba306249535cb89fd15a.
- `apps/server/src/browser-session/store.ts`: 4474 B / 8fea251438d040ee49b5978bf132e3408b5ff9acce6483b97a3d4fbb67c7bae5.
- `apps/server/src/browser-session/session.test.ts`: 26902 B / c6085f7179e8af66d41ab041f09d26cd9003080b864aec493a290b5c7067cbd6.
- `packages/contracts/src/browser-session.ts`: 1095 B / 766148783d7ea6cba0c61193096f09eaef3d7670eced26a0ee7339a66c784c30.
Web ref **2f8cc1f61d32f518998a64d0adeec582f85481f2**:
- `apps/web/src/connection/session.ts`: 8274 B / add2e1484461f397ff667da8d1176a86dc426948d0baccf2279b213caa869fca.
- `apps/web/src/App.tsx`: 71948 B / a6843bf0b2831d9a666fb9a030b0d26c6e588709b89c6501a379e914124d6b62.

## Smallest repair and compatibility

`index.ts:48,91–113`: stable cookie name per center/cookieOrigin. Connect sets S2; logout authenticates S1+CSRF, deletes S1, sends same-name Max-Age=0. S1 headers arriving after S2 delete the cookie slot, not S1's value. CSRF blocks a late REQUEST carrying S2 cookie/S1 CSRF (403), not an already-authorized S1 RESPONSE.

Candidate at `index.ts:109–113`: omit logout setCookie, keep awaited revoke/DTO. No migration, epoch lock, new identity field or Web workaround. Read97–100 already sets no cookie. Verify success/relevant errors have no session Set-Cookie; six files do not establish every middleware's behavior.

Residual S1 is invalid credential, not authorization: `store.ts:39–43,57–58` reads live rows and deletes exact hash/origin/epoch. Read returns **unauthenticated**, not a distinct “revoked” DTO; protected requests reject. Cookie can remain until original expiry/eviction or explicit Connect replacement, without renewal. This is server logout, not client cookie erasure/privacy cleanup. Revoke failure/unknown transport outcome is not confirmed logout.

`index.ts:51–67,101–105` keeps exact destination scheme/Host, trusted caller Origin and current-cookie CSRF. Single-origin acceptance does not prove arbitrary multi-origin/TLS proxy support. `store.ts:45–58`/contract5–6 retain global32 live rows, random fresh Connect,8h expiry, no renewal/eviction/idempotency. Deleted S1 frees a slot despite residual cookie; concurrent/lost-ACK Connect still consumes slots. No automatic POST retry/new reuse policy.

Web `session.ts:46–57,72–118`: generations/abort reject stale JS continuations; logout removes local authority immediately; explicit Connect sends one POST then cookie-only GET, including lost ACK. None controls native cookies. `App.tsx:1236–1268,1271–1293` rechecks on wake/broadcast and hides/retains previous workspace on auth loss. Preserve drafts/unknown receipts and explicit reconnect, no automatic business replay. Ready UI may remain stale until authoritative recheck.

## Official rules and response-order limits

[RFC6265 §4.1.1](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.1) warns of concurrent Set-Cookie races; [§5.3](https://www.rfc-editor.org/rfc/rfc6265.html#section-5.3) replaces by name/domain/path and evicts expired cookies, not by old value. HttpOnly prevents script access, not late network replacement.

[Fetch HTTP-network fetch](https://fetch.spec.whatwg.org/#http-network-fetch) processes response cookies with credentials. [Forbidden response headers](https://fetch.spec.whatwg.org/#forbidden-response-header-name) hide Set-Cookie from ordinary response headers. The [credentialed CORS section/example](https://fetch.spec.whatwg.org/#cors-protocol-and-credentials) shows callback failure need not prevent cookies. JS generation checks cannot undo this independent operation. Abort after headers is not rollback; abort before delivery does not establish server revoke outcome or that no cookie processing occurred.

Inference: awaiting completed logout before Connect orders ONE cooperating caller only. Other tabs/clients, navigation, crashes and timeout/abort escape it. A server mutex orders database operations/writes, not browser receipt. Cookie-only GET may precede another delayed header. Conditional clear using request cookie/CSRF still sees S1, not jar state at delivery. `credentials:omit` also omits the cookie required for logout. Callback filtering, sleep, no-store/CORS and TCP write acknowledgment do not provide cookie compare-and-delete.

Revoke-only solves late logout deletion, NOT arbitrary Connect reversal: delayed Connect S1 may overwrite S2, including revoked S1. Keep authoritative reads/explicit recovery; no universal ordering claim. Versioned cookie names/all-tab locking/new handshakes change protocol/storage/cleanup and exceed this repair.

## Minimal controlled HTTP test proposal

1. Existing HTTP seam (`session.test.ts:53–77,125–134`): Connect S1; logout with S1 cookie/CSRF; assert200 unauthenticated/no-store/**no Set-Cookie**. Replay S1: read unauthenticated/protected401, no clearing header. Independent S2 remains valid; wrong Origin/CSRF cannot revoke S2. Verify revoked row no longer counts toward capacity, reusing existing invariants.
2. Deterministic barrier: owned same-origin proxy forwards real S1 logout, waits for successful upstream revoke/response, holds whole response BEFORE browser headers. Keep request alive. Another page in the same owned browser context explicitly Connects S2 and confirms cookie-only GET matches S2. Release unchanged held logout, await actual delivery, read again: candidate retains S2; fixed old behavior is negative baseline. Do not synthesize success or merely delay body/JS callback. Stable center/principal alone cannot identify S2: compare CSRF in memory, record only equality.
3. Normal logout without Connect: jar can retain S1 but read/protected call rejects; explicit Connect replaces it with zero automatic business POST. Preserve drafts/unknown receipts. Failed/aborted logout is separate. Raw Node/manual-cookie checks prove revoke/header behavior, NOT browser jar isolation; a bounded native-cookie case is necessary for that claim.

One marked DB, dynamic owned HTTP/proxy, bounded barrier with timeout/finally release/abort cleanup; native-cookie case needs separately scheduled owned Chrome. Tokens/cookies/CSRF stay memory-only; record order/status/header-presence/equality, no values. Center owner implements under legal scope; no edits/execution authorized here.

Method: reused local find-skills/clean-code and fixed AGENTS; narrow responsibility, explicit errors, public behavior assertions. No install/product import/check/PG/Chrome/provider/product endpoint/resource or process sampling/project write. Only official public docs fetched; one TMP report <=8KiB. Existing evidence/claims/gates unchanged.
