# X01 real public runner journey — preparation only

This one case uses the fixed semver 7.8.5/ISC bundle already accepted on main. An owned loopback registry serves a newly packed Flow wrapper; the real public fetch worker downloads it, the public install endpoint creates the actual installed receipt, and owner grant/enable/admission freeze it. FlowClient v3 and the existing runRunner/journal/phase gates/outbox execute the material and report a sourced artifact through the real center. No mocked transport, installed metadata seed, alternative runner or external registry is used.

Fixed inputs: main `1e12eaf13a02b45a99dfe126bc182c2ea45a8390`, current reviewed runtime/wiring `9b639f79`/`2ea5adfe`, and five fixed semver package files. The closed mirror is 221 TypeScript files plus 33 official SQL migrations, package material and the original fixture input (260 files / 1,207,575 bytes). The old fixture input supplies its unchanged 180-second and 256-request validation only; it does not select old tests. All direct and dynamic SQL inputs are bound. The mirror is validation input, not a product overlay.

## Interface and ownership

The existing PluginDatabaseFixture owns one marked random DB and receipt lifecycle. Its pool max is 4, the actual server pool max 12 and admin max 1: at most 17 connections; the package fetch worker borrows the server pool and its existing preClose hook drains it. The test owns two dynamic loopback listeners (registry and center), one tar child, the actual runner promise, and package/artifact/material/runner files beneath the one outer owned TMP. Runner signal/drain precedes app/worker close; registry closes normally. Owners, DB marker/OID, zero connections, ordinary DROP/absence, both listener closures and tar termination are recorded. An unknown lifecycle leaves the whole TMP retained. The outer recipe reuses reviewed OPS14 and existing bounded inventory/identity removal; no new supervision loop.

HTTP measurement: fixture.request measures owner traffic only. Fastify hooks count all real owner and runner requests and response bytes without replacing the transport. The caller validates the separate public-traffic receipt and the registry request count. Four registry requests (normally two), 256 center requests, response 128 KiB each and 4 MiB suite bound. The test permits at most 80 iterations per finite observation under the common deadline. One case, one task, one registration, one attempt; one tar with 5-second timeout and 8 KiB captured output. Exact npm code hash/license/provenance is checked before packing; the future tar digest/SRI is measured and used throughout that actual journey, not invented before execution.

## Future actual window — NOT_OPEN

180 seconds = 110 work + 60 cleanup + 10 final; final inventory keeps 3 seconds and receipt persistence keeps 2, with independent post-save delivery verdict. One marked DB, 32 MiB TMP / 4096 entries, raw 1 MiB. Reserve 1 GiB unspendable cleanup plus 128 MiB DB/WAL reserve (not a measured hard cap), plus all actual paired budgets. Base floor 1,242,562,560 B. Cache and package data stay under own TMP. There is no provider/native/Chrome/personal service/npm installation; public plugin install is the future selected behavior.

Exact future command: `/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/x01/public-runner-pg-once.py --admission ABSOLUTE_FRESH_RECEIPT --sha256 EXACT_SHA256`. Requires explicit mika/X01_PUBLIC_RUNNER_PG OPEN, current v21 full identity/scope, fresh ledger ≤60s, clean actual HEAD, fixed manifest/external/links, absent `public-runner-pg-run-r1`, and available full combined floor. This preparation grants no actual window and creates no admission.

## Preparation results and limits

Two allowed local children only: full real createServer/runRunner/client closure noEmit exit 0; Vitest list exit 0 and exactly one named case. No hooks/case/PG/HTTP/tar ran. Both owned groups and merged streams completed; two exact TMPs sampled and removed with same identity. End samples do not prove peak; whole external wall remains unknown. Original reviewed tests 19/9/3/5 and prior PG suites were not repeated.

This future case proves one real prerelease comparison and frozen source association through public APIs if it passes. It does not prove external registry tar authenticity, hostile-package isolation, CLI trusted startup, exact-pin recovery after unknown side effects, current global main or all public clients. Generic retry 409 remains a safety boundary, not complete plugin recovery.
