# Recovery01 browser readiness — read-only
Implementation 1b8a335ecf26ece7539ad19e634508ac12ca3729; HEAD 547439d365047ed8d54ced7cf784047b847630d7; codex/web-conversation-recovery clean. Four fixed sources below, existing plan/status/interface/browser-harness and filesystem-only dependency links inspected. No Node/import/tests/HTTP/PG/Chrome/free-space probe/install/claim operation/project write. Local webapp-testing reread; assistant-ui/clean-code reused: semantic controls, real DOM/authority, owned cleanup. No skill helper executed.

## Conclusion: prepared entry, not launch-ready unchanged
No browser-runs directory or legacy *-browser-budget.json exists: no recorded browser expenditure.90s remains the existing cumulative ceiling, not a fresh grant.27/27 direct is controlled IDB/mockcomposer/mockfetch only; not replayed. Feature reviewNOT_STARTED/targetUNKNOWN.

Concrete fixture blocker before spending budget: fixture:109 puts browser Host in Headers, then:112 uses Node global fetch to a different center port. Previously verified Node24 primary source deletes Host before transport (prior /tmp/dperf04-1441-host-diagnosis/report.md; Node v24.20.0 deps/undici/src/lib/web/fetch/index.js around1400). fixture:147 configures cookieOrigin=public proxy URL while:149 starts center on another dynamic port. auth index:53–56 requires actual scheme+Host==cookieOrigin. Source inference therefore predicts destination rejection for cookie connect/session; comment “preserve public destination” is not evidence. NOT a reproduced HTTP failure. Narrow fixture transport must actually preserve original public Host/caller headers upstream and retain SSE/abort/Set-Cookie behavior, or use an equivalent single-origin seam. Do not invent Origin, trust Forwarded, weaken center auth or add Web HTTP. Any fix requires new source binding.

## Budget and entry prerequisites
browser:13–15/41–77 requires FLOW_RECOVERY_BROWSER=1, FLOW_RECOVERY_GATE and explicitly supplied isolated FLOW_RECOVERY_TEST_ADMIN. Gate binds actual metadataHEAD (now547439, not1b8) plus19 current hashes, expiry, unique run,30..90s total, minimumFree>=1GiB+128MiB, /private/tmp scratch parent, explicit scratch<=64MiB. Prior+admitted<=90s;15s cleanup reserved, at most75s for startup+journey. No gate issued here.

Built-ins precede resource gate; recursively retained evidence<=8MiB with5MiB run headroom.250ms monitoring begins before business imports/CREATE. Stop margin1GiB+64MiB; log1MiB/report2MiB/two PNG<=512KiB each. These are polling/logical bounds, not physical hard quotas. Parent owns worker+Chrome groups and random DB attempted/confirmed/marker facts. Hard deadline kills only owned children and leaves incomplete evidence, preventing automatic rerun. DB remaining/connections, process exit and scratch removal must settle; no FORCE/unrelated termination. Fit within75s has not been measured.

Future entry shape, NOT executed: Node24 `--import tsx apps/web/test/conversation-recovery.browser.ts`, initial TSX_DISABLE_CACHE=1/NODE_DISABLE_COMPILE_CACHE=1 and approved gate/admin env. Initial loader/dependencies stay read-only; worker Vite/Chrome caches only in owned scratch. This dev-App path does not require a build/install, but its complete dynamic import graph has not been exercised.

Filesystem readable: root tsx4.23.15, pg8.23.1, @playwright/test1.63.0; apps/web Vite8.3.2; root Fastify5.12.5, pg-boss12.37.0, @fastify/cors11.3.0, Zod4.6.5. Third-party symlinks point to previously authorized web-attachment-production .pnpm targets. apps/web/@flow/client and client/@flow/contracts resolve into THIS WT. Node24 and Chrome executables exist. No loader/resolver import or target mutation: existence is not startup proof. Ignored dependency claims were released/read-only; no new link/cache writes there.

## Actual versus simulated checks
browser:199–204 reads real browser IndexedDB with readonly transaction complete. Worker intends actual App/composer/cookie jar and fixed production center/PG, no page route mocks. Fixture seeds one project/conversation/two real text resources;0runner/provider.

:263–319 prepares text+queue intent, exact A/B refs in IDB, reload+explicitRestore, unverified and B-only verified Send/Queue0commands/0POST, then BrowseA yielding actual A,B chips without reselect/remount, no content prefetch. :320–327 uses two pages sharing browser IDB for CAS. :328–339 drops a committed turn ACK and checks exact key/body/ordered refs through reload and explicit retry.

:341–368 patches IDBDatabase.transaction to abort real readwrite transactions, expires sessions in isolated PG and triggers public session read without reload. It checks same performance.timeOrigin, page-only text and0newPOST. This is deliberate browser fault injection, not spontaneous quota failure. :370–374 checks missing-CSRF403/offline text; :376–383 checks Enter-open/Escape-focus and390 light/dark overflow/screenshots, not full keyboard audit.

Explicit open matrix (:217–222): SSE only cookie/noBearer HTTP200 handshake, not event delivery/reconnect. CREATE-two-stage, Queue/Steer recovery, complete profile/knowledge/steering draft and second center/principal remain PENDING browser. Pre-created conversation cannot prove CREATE crash boundary. Page-auth-loss checks text, not all material state. Successful bounded subset cannot equal full acceptance; do not rerun27 or silently extend90s. Existing browser-harness.md intro says27 not run, stale against current status/direct-second evidence; browser remains NOT_RUN.

## Center's three gates: exact fixed facts, not guessed later fixes
This WT consumes base84005 input; no newer center source assumed.
Known: factory browserSession opt-in; ready centerId/ownerPrincipalId/expiresAt/csrfToken; safe no-Origin GET requires same-origin Fetch Metadata+exact destination (index:51–68). Separate explicit Bearer. Stable DB identity/auth epoch; read never renews expiry (store:19–43); create locks identity/count before capped insert. HTTP/SSE share auth. These are source facts, not newly run verification.

1. Caller-origin: index:58 accepts any trusted source but:66/read and:105/create bind row to settings.cookieOrigin, not actual caller. Exact caller-bound lease with multiple trusted origins is not demonstrated. Single-origin fixture cannot close it.
2. Delayed logout: index:111–112 revokes authenticated token then emits expired Set-Cookie via:91–93. Late old response may clear new connect cookie; frontend epoch cannot block cookie processing. No race case here or supplied fixed resolution.
3. Repeated connect/lostACK/32cap: index:105 always generates token; store:45–54 caps active rows without eviction, but no reuse/idempotent-connect lookup. Repetition/slot accounting remains untested. Read can recover a cookie actually received, not a wholly lost response.
No later immutable correction/decision evidence was supplied for these3; retain as final browser/approval gates, without inventing new DTO/client fallback.

## Fixed/current SHA256
apps/web/test/conversation-recovery.browser.ts 883c1195584e23ec6bfe1a69b5b8aa50929204826ef26ff8a814b479fe5c6ac5
apps/web/test/conversation-recovery.fixture.ts 041eda9cb24bd7bcee8156f8784b6c8abf3f253dfff2b111dab7d19eb46c42c0
apps/server/src/browser-session/index.ts 332c4c91ce07c59f1c9b41102b06ee2b931b192e0e6bba306249535cb89fd15a
apps/server/src/browser-session/store.ts 8fea251438d040ee49b5978bf132e3408b5ff9acce6483b97a3d4fbb67c7bae5
