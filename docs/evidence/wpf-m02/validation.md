# WPF-M02 validation and handoff

Input W01 `cb4a39211e264538704ba9d474eeb08fc4b2759c`; full M02 `e888862570cba3c59789053e68df7d5720650c36`; first no-ff merge `c0c41f9881713f3b371ba62c8f4e68ca5d71e8db`; reviewed main/causal correction `8c57f2f97345167207fa0d2590e9ad6310c922d4` merged without conflict as `35f0bb9df3f57b858c39b13fab940137c747d1f1`. Implementation target is recorded in this feature's review/status after the code commit. No merge into main was performed here.

## Run locally

From this worktree, use Node24 and pnpm9.15.4. All dependencies are installed locally; `apps/web/node_modules/@flow/{client,contracts}` resolve to this worktree's `packages/{client,contracts}`. No new dependency was introduced. Authorized installation completed the existing W01 manifest: exact versions remain in apps/web/package.json, temporary rootlock patch against initial merge c0 is `dependency-install.patch`; rootlock was restored before the later main merge and was not authored in this feature.

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/workspace-preview.ts --preview
```

Current owner preview: http://127.0.0.1:49922 (2026-10-06 02:47 UTC). The command prints a dynamic loopback URL and starts its own process-memory HTTP fixture. It auto-connects using the public fixture-only token. This is simulated. For a real running center, use `FLOW_CENTER_URL=http://127.0.0.1:<center-port> pnpm --filter @flow/web dev --port <free-port>`, then enter that center's owner token in the connection form; tokens remain in page memory.

## Checks

- `pnpm exec vitest run apps/web/test/projection.test.ts apps/web/test/workspace-projection.test.ts`:20/20PASS.
- `pnpm --filter @flow/web typecheck`:PASS.
- `pnpm --filter @flow/web build`:PASS; two >500kB chunks are explicitly deferred performance work, not hidden.
- `pnpm exec tsx apps/web/test/workspace-browser.ts`:9groupsPASS, browser-results.json.
- `pnpm exec tsx apps/web/test/workspace-observers-browser.ts`:6groupsPASS, observer-browser-results.json.
- `pnpm exec tsx apps/web/test/workspace-real-center.ts`:4groupsPASS, real-center-results.json. Uses a unique local flow_wpf_m02_* database on the existing local test PostgreSQL at55432, dynamic center/Vite ports,10 independent tasks driven through public runner protocol. Closes its own servers/browser and drops only its own DB. No10-model claim.

Module checks cover separate forward/history cursor, dedup/late commits, bounded catchup/backoff/offline, reset+stale history, decision409 refresh/no auto re-answer, abort/generation/key retention and pending recovery, exact index totals and stale filter results. HTTP browser checks cover explicit older loading/manual anchor retention on prepend/resize, buffered new records,100+ truncation/complete index, explicit show before overflow decisions, reference0-before-open and1-on-open, task-specific detail/focus, error/unknown states, light/dark390px keyboard/reducedmotion. Observer checks cover8retained chats,1watch/visible single pane and2split watches, hidden cursor catchup, two-page lifecycle, command/detail budget, hidden late acceptance/route preservation, close without cancellation, failed snapshot Retry and controlled active tab visibility.

Real center checks cover10durable tasks including running/waiting/uncertain/terminal states, Web exact index/attention, no eager details, in-place decision reaching runner heartbeat, explicit cancel reaching runner heartbeat followed by cancellation acknowledgement, stale decision409, historical new-record buffer, exact requested artifact verification and theme/narrow screenshots. API-only checks and browser steps are described separately in real-center-results.json.

## Visual evidence

- workspace-light.png / workspace-dark.png / workspace-light-390.png / workspace-dark-390.png
- workspace-eight-chats-split.png / workspace-controlled-tab-390.png
- real-center-light.png / real-center-artifact-dark.png / real-center-dark-390.png
- controlled-tab-before.png and reference-focus-before.txt preserve actual pre-fix findings.

## Boundaries

Independent review is NOT_STARTED until a reviewer records a fixed target. Current SSE repair remains an independent-review blocker despite owner tests passing. No main integration, plugin-host implementation, real model execution, filesystem or PTY claim. Status fact source is plans/wpf-m02-web-workspace/status.md; manager confirmed dashboard22sources read this task at2026-10-06T02:38:47.600Z with complete human fields and no missing/issues, which does not mean implementation/review passed.
