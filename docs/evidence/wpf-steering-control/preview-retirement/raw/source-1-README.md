# WPF-STEER01 handoff

Implementation `b2cbbca5f823e122ec4e234e16fb7ef45a063af9`; base `ca4c3f723d2f786601e7cc9bd0363d756d974810`; branch `codex/web-steering-control`. Independent control and UI for task-bound steering, independently APPROVED by root on 2026-10-06 after 09:07:34 UTC (limited to this module). [Validation](validation.md), [interface](interface.md), [quality](quality.md), [claim](take-receipt.json). Unique [plan](../../../plans/wpf-steering-control/plan.md), [status](../../../plans/wpf-steering-control/status.md), [review](../../../plans/wpf-steering-control/review.md).

Retained preview: http://127.0.0.1:63251/ (session 13237, owner workspace_panels_owner). Independent public HTTP fixture; 0 real models/DB. It is not the product App or personal center. Existing previews stay running.

From this worktree, with Node 24 and existing pnpm lock:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-steering.fixture.ts --steering-preview
```

The recovery command chooses dynamic ports; use the URL printed by stdout, not a promised port. Fixture token `flow-fixture-only` is public simulated auth. Do not use personal credentials. Start at **Show steering**; enter a separate instruction, press Enter or Send steering. Shift+Enter adds a line; IME composition does not submit. Refresh observes receipt state. Offline/Hide/Revoke/Switch center demonstrate boundaries. The first simulated instruction stays center-accepted until the scripted fixture drives receipt changes; this is not model compliance.

Direct checks and isolated browser journeys:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/conversation-steering.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-steering.browser.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-steering.browser.ts --production
```

Each browser invocation owns and closes only its dynamic fixture. It never stops the retained preview. The production run builds an isolated temporary fixture output and removes that output after the run.

Screenshots: [desktop light](production-light-1280.png), [desktop dark](production-dark-1280.png), [390px light](production-light-390.png), [390px dark](production-dark-390.png).

Follow-up remains explicit: actual App/P01 wiring, permanent credential-free receipt namespace and original-key recovery across reload/connection replacement, authenticated real-center/runner/provider validation. This module is one subtask of WPF-MATURE-06, not completion of the whole conversation experience. Main integration accepted at `77c420cf9ee5de0291ea93014b6ea11aead6fab5`; [main observation](main-observation.json) verifies target ancestry and six exact source hashes. Actual App/P01 wiring remains follow-up. Final branch/dirty facts are separately recorded by Git and status.
