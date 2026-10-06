# W01 official Thread and workspace validation

Implementation target: `cb4a39211e264538704ba9d474eeb08fc4b2759c`. Revision base: `b04df95821a55384c55c833e94405daaf35af8ad`; original frozen baseline `eacee76fa7f1b6cc46b06b57ae68458637be4a26` remains an ancestor. Branch `codex/m1-web`. This is owner validation; the overall independent review is separately recorded in [review.md](../../../../plans/w01-web/review.md).

The original visual result was rejected by the user. Historical checks and approval are not applied to this new target. No statement here claims that the user has accepted the new visual result.

## Checks actually run

Environment: macOS, Node24.20.0, pnpm9.15.4, installed Chrome154.0.8037.98 via Playwright1.63.0. All commands use `/opt/homebrew/opt/node@24/bin` first on PATH.

| Command or check | Result and scope |
| --- | --- |
| `pnpm --filter @flow/web typecheck` | PASS, application/components and tests |
| `pnpm --filter @flow/web test` | PASS, 10 public HTTP projection tests |
| `pnpm exec vitest run packages/client packages/contracts` | PASS, 4 tests in direct dependencies |
| `pnpm --filter @flow/web test:browser` | PASS, all 10 browser journeys; [full machine report](browser-results.json) |
| `pnpm --filter @flow/web test:browser --grep 'split\|closing during\|Delete' --reporter=list` | PASS, 3 targeted cases after final last-tab URL cleanup; kept the full JSON report rather than replacing it with a partial report |
| `pnpm --filter @flow/web build` | PASS at target; chunk-size warning retained and quantified below |
| Production preview at5176, without fixture environment | Connection page present, fixture label absent, no page errors; [smoke JSON](production-smoke.json). This does not connect to a real center. |
| `git diff --check` | PASS |
| `git apply --check docs/evidence/w01/dependency-lock.patch` | PASS with root lock restored |
| Write scope and shared files | Only apps/web, W01 plans/evidence; root manifest/lock and public contracts/client unchanged |

The full browser run passed immediately before the final one-line last-tab URL cleanup; the three affected navigation/close cases, app typecheck and build were rerun on the committed target. No feature code changed during evidence preparation.

## Behaviors covered

- All major execution states, failed verification alongside completed execution, both themes, and no page errors.
- Official Thread structure and unsupported edit/reload/attachments absent; new task uses the official Composer. Lost HTTP acknowledgement preserves the draft and idempotency key on retry.
- Durable acceptance followed by browser close/reopen; manual decision and explicit cancellation. Updated sidebar state follows the task projection for decision and cancellation.
- Closing a draft while acceptance is delayed does not reopen it, start ghost SSE observation or cancel the accepted task; it becomes available in the center-backed task list.
- Offline browser resumes observation without cancellation. HTTP tests additionally cover cursor versus watermark, empty status/decision/usage frames, stream reset, overlapping paging, in-flight detail/task selection and offline lifecycle regressions.
- Two visible task panes, merge/split, one observer per task, stable IDs, preserved unsent text/backend/scenario, close without cancel, keyboard arrow navigation and Delete focus.
- Per-task right tab state, hiding/reopening right workspace, keyboard FileTree→detail focus, real ANSI component rendering and no arbitrary file/terminal claim.
- Large history pages through the shared HTTP client; references do not fetch content before opening and cached reopening does not refetch. Earlier-history load preserves viewport offset and transfers focus when its button disappears.
- 390×844 viewport with no document horizontal overflow, visible focus/skip link and safe malformed hash handling, reduced-motion CSS.
- Chat-list failure is actually injected using the URL pathname (including the real query string), visibly reported and recoverable by Retry.

The isolated panels suite has 13 behavior groups and a separate independent approval; its evidence is [here](../workspace-panels/validation.md). Main Web validation does not imply review approval for every reused component's possible unused capability.

## Screenshots

| State | Light | Dark |
| --- | --- | --- |
| Needs decision | [light](light-waiting.png) | [dark](dark-waiting.png) |
| Running | [light](light-running.png) | [dark](dark-running.png) |
| Completed | [light](light-completed.png) | [dark](dark-completed.png) |
| Verification failed | [light](light-verification-failed.png) | [dark](dark-verification-failed.png) |
| Execution failed | [light](light-failed.png) | [dark](dark-failed.png) |
| Queued | [light](light-queued.png) | [dark](dark-queued.png) |
| Uncertain | [light](light-uncertain.png) | [dark](dark-uncertain.png) |
| Disconnected | [light](light-disconnected.png) | [dark](dark-disconnected.png) |
| Split chats | [light](light-split.png) | [dark](dark-split.png) |
| Task output workspace | [light](light-terminal.png) | [dark](dark-terminal.png) |
| Narrow/reduced motion | [light](light-narrow.png) | [dark](dark-narrow.png) |

[Artifact version/detail](dark-artifact.png), [large folded content](light-large-detail.png). Screenshots are real browser captures of the simulated HTTP preview, not mockup drawings.

## Dependency and performance boundary

[Exact asset measurements](bundle-sizes.json) include all produced JavaScript and CSS with raw/gzip bytes. JavaScript is about1.08MB raw and323KB gzip; CSS about83KB raw and15KB gzip. Both main JS chunks exceed500KB minified. No arbitrary chunk threshold is treated as performance acceptance; there is no agreed device/latency performance budget. The complete official elements and dependencies are retained, with per-message content visibility inherited from the official source and bounded HTTP paging/detail fetches.

Exact package versions are pinned in `apps/web/package.json`. The temporary local root lock was restored, and its full integration diff is [dependency-lock.patch](../dependency-lock.patch). The Execution Lead must integrate it with other owners' dependency changes; do not blindly apply it over a newer shared lock.

## Start and limits

From the worktree root, use Node24, run `pnpm --filter @flow/web fixture`, then in a second terminal `VITE_FLOW_FIXTURE=true pnpm --filter @flow/web dev`. Open `http://127.0.0.1:5174/#task=demo-decision`. Fixture port4317 and browser-test ports5175/4318 are distinct from Lead's dashboard4320. Real-center setup is documented in [README](../../../../apps/web/README.md).

This owner did not validate the real center/runner/harness, database persistence across process restart, real model, cross-machine recovery, artifact verifier implementation, Safari/Firefox, screen reader, or representative low-end-device performance. Right Terminal is read-only task text, Files is center references, and plugin slots are identifiers only. Unsent drafts/layout are in-page state; reload does not persist them. Cross-group remount preserves draft/task data but does not promise a persistent chat scroll position. Only the original Execution Lead integrates main; this owner did not merge it.
