# DPERF04 b0e937: scoped source re-review APPROVED

Fixed target `b0e937d53a664b3398d36a080cef1a2d4225b6f3`, compared only with `6c18b81a11eece9c07dd047d28da099a0b6bbb24`. Initial metadata HEAD `9dd9967013ebbe2ac980d2de2c51ea4079fabdd3` was clean. At final hashing metadata had advanced to `36d687fc682809ce73a90910d86ad34c6349d9dc`, still clean on `codex/dashboard-summary-detail`. Both target blobs still equal current working bytes; hashes and exact audit time are in sources.json. Prior reports are retained. Reviewer: /root/workspace_panels_owner.

**C1-U/P2 is addressed in fixed source; no remaining blocking finding in this two-file delta.** This is source-only approval for the requested client repair, not dynamic acceptance or the overall feature review. All Node/browser runs remain NOT_RUN in this review.

## Unchanged claim reading

`apps/execution-dashboard/public/app.js:84–95` indexes existing rows by claimId and only appends missing identities. It does not replace the collection or an unchanged row. `updateClaimReading` at 57–64 replaces facts only at initial creation, an explicit user update, or a changed record while neither expanded nor focused. Thus an unchanged auto refresh leaves the exact article/details/summary/scope nodes in place, preserving native open state, focus and selection. An expanded row remains protected even when focus temporarily moves outside; a collapsed but focused row is also protected (`91`). Changing observation notices is separate from the selected scope text.

`summary-detail.browser.mjs:202–209` now supplies a stable updatedAt for the unchanged record rather than changing that fact on every response. The 100-scope case at 223–244 drives the actual registered 20-second callback, waits for both summary completion and a new ledger readId, and checks exact row identity, original scope connectedness/text, expanded state, focus and selection. This directly targets the previous regression, unlike the earlier modal-only case. These are adequate planned assertions; they have not executed here.

## Changed, unknown and absent records

- Changed version/content while reading keeps the old facts and uses `prior-observation`, with an explicit update warning (`95–101`). It cannot silently relabel the old scope as current.
- The real button at `72–78` resolves the current record from the authoritative snapshot at click time, and only replaces facts when the latest ledger is available and no read is in flight. It then returns focus to the existing summary. Otherwise it explicitly refreshes the ledger. There is no captured old claim authorization and no mutation endpoint.
- Loading/unknown uses a visible “old record / do not take” warning and prior freshness (`92,96–98`). Availability plus unchanged **record fields** may label current observation, but the adjacent message retains the original detail observation time and requires atomic coordination before taking (`100`); it does not claim a write lease.
- A record absent from the currently available unregistered list is retained while expanded/focused with “does not prove occupied or released” (`93,99`). Closing and leaving removes only that display surface at a subsequent render. It does not release a claim. The local fixture variable named `released` at browser:255 actually models an available list with no U01; that scenario is only evidence about disappearance, never proof of a center release.
- Browser:245–258 covers changed-version prior display, Enter on explicit update, new exact scope and return focus, unknown retention, absent-list warning and removal after closing/leaving. The existing malicious/literal-scope checks remain at 217–221. No body prefetch or new authority was added.

## C2 causal delivery has not regressed

The entire tagged fetch/body-settlement and deliverLate/waitForLate block at browser:144–199 is byte-identical to the reviewed 6c18 version. It still requires actual route.fulfill success, exact tagged response body completion (or the cloned error body for assignment errors), then a new page evaluation before the stale-DOM assertion. Fulfill/body failure cannot be counted as stale-response exclusion success. Existing close/reopen, A→B→A, old-document-error and old-assignment-error scenarios retain their waitForLate calls; the new claim case merely precedes them. This is causal test structure, not an assertion that those branches passed in a browser.

## Method and limits

Read the complete two-file fixed delta and relevant fixed context; reused local find-skills / codebase-design / clean-code methods. Lifecycle ownership, current-versus-retained facts, explicit action freshness and exact response evidence were checked. No project modification, new claim/agent, product imports, tests/types, browser, PG, HTTP/service, registry or disk/free-space sampling. Output is confined to this small /tmp report and source manifest. Root owns supervisor/runtime evidence review; final integration remains with the original Execution Lead.
