# DPERF04 Host assertion: test transport mismatch, not demonstrated Host bypass

Fixed `1441d86baa40e98f4cb81b82dcc551202973209b`, executed metadata `36d687fc682809ce73a90910d86ad34c6349d9dc`. Read source and existing result/log only; hashes in sources.json. No new execution or project edit.

**Conclusion:** test:124 uses a Node fetch Host override that this Node version's fetch path deletes. The existing 200 response therefore does not demonstrate that the dashboard accepted `Host: example.invalid`. The failed run did not record the incoming header, so its exact on-wire value remains unobserved. Product guard failure is not established; repair the test's request construction and attest the received header before judging it.

## Evidence

- Fixed `src/server.mjs:37` checks the actual `request.headers.host` against loopback names before method or route work, returning 403 on mismatch. There is no preceding route exemption. `summary-detail.browser.mjs:43–47` creates that same server directly, listens on port 0 at 127.0.0.1 and returns its real address. No proxy or public server is part of this fixture.
- `summary-detail.test.mjs:124` calls global fetch to that loopback URL with `{headers:{Host:'example.invalid'}}`. Local installed `node_version.h:25–27` identifies 24.20.0, without running Node. In the [official Node v24.20.0 vendored fetch implementation, line 1400](https://github.com/nodejs/node/blob/v24.20.0/deps/undici/src/lib/web/fetch/index.js#L1400), the network/cache fetch path unconditionally deletes the host header before dispatch. This version-bound source explains why the test does not exercise its intended request; it is not a new observed header capture. Merely inspecting a Headers object would not prove dispatch bytes either.
- Existing log: six leaf cases passed, seventh failed at line124 with 200 vs403, and its parent failed. That is six pass/two TAP fail including the parent, not two failing leaves. Coalescing/unknown-task/405 assertions before124 completed; document read/traversal/symlink/snapshot assertions at125–131 were not reached in this run.
- Existing supervisor result reports 1.632s elapsed, 28.368s remainder, cleanup fulfilled/groupAbsent/scratchAbsent and no PG/browser. This diagnosis does not repeat or independently execute cleanup.

## Smallest owner fix and later verification

Change only the Host spoof request in the existing test file: use `node:http.request` to TCP hostname127.0.0.1 plus the fixture's dynamic port, path `/api/summary`, method GET, explicit `headers.host='example.invalid'`, `setHost:false`, and a non-reused owned agent/socket. Do not resolve or connect to example.invalid. A bounded error/timeout path must destroy its own request; drain the response and settle on end; retain original403 assertion. Add one temporary request-event observer on this same fixture server to assert the actually received host is exactly example.invalid, removing the listener in cleanup. This closes the test's premise rather than weakening the product allowlist.

[Node's fixed v24.20.0 HTTP client source, lines497–512](https://github.com/nodejs/node/blob/v24.20.0/lib/_http_client.js#L497-L512), copies explicit headers and only fills an absent Host when automatic host generation is enabled. This supports the narrow transport choice; it has not been run here. Keep proxy-related environment stripped under the existing runner.

No server change is justified by the current evidence. If an explicit received hostile Host later still yields200, that would be a real product-boundary failure to investigate. Do not change expected403 to200 or skip this assertion.

After a fixed test-only repair/source rebind and a fresh manager gate, the existing explicit Node test entry should run to completion so the previously unreached document checks execute. Retain this failed raw run; remaining cumulative allowance is28.368s including reserved cleanup, not a new30s. This note grants no run and does not claim all remaining assertions pass. RELEASE A→B remains prioritized.

Method: fixed-source control flow plus installed version header and version-pinned official primary source; local clean-code/codebase-design reuse. 0 Node/import/test/HTTP experiment/PG/Chrome/resource sampling/project writes. Only this bounded /tmp diagnosis and manifest were created.
