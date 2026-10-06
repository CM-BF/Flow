# Chat readability · WPF-CHATREAD01

The chat keeps more room for the transcript and composer. A compact profile/access summary opens the existing Radix dialog; it contains requested configuration, identifiers, protocol limits and execution history. New conversations still choose a complete profile. The existing AI Elements queue stays compact when empty, while errors, stale/paused/blocked states and unknown receipts remain visible outside its collapsed content.

Implementation: `527176c2b13880e6009be9605f08ae560315624d`; base `32c371d389a913f8dd71c3bd8b98dd0697411256`. [Plan](../../../plans/wpf-chat-readability/plan.md) · [status](../../../plans/wpf-chat-readability/status.md) · [review](../../../plans/wpf-chat-readability/review.md) · [quality](quality.md) · [validation](validation.md) · [claim](take-receipt.json).

Retained preview http://127.0.0.1:55616/ (session30078, workspace_panels_owner). It is a deterministic HTTP fixture, not a real provider or center. In this worktree:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-readability.fixture.ts --readability-preview
```

The recovery URL is dynamic: use stdout. Conversation3 has a completed reply/empty queue; Conversation2 has an incremental draft. Public fixture token `flow-fixture-only`. All existing user/owner previews stay untouched.

Validation commands:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH VITE_FLOW_FIXTURE=true pnpm --filter @flow/web build
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-readability.browser.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-readability.browser.ts --production
```

Each browser command starts and cleans only its own isolated dynamic fixtures. `--baseline` measures the checked-out code; the stored baseline was captured before changing production files. Do not rerun it against changed code and relabel that as the old baseline.

No App, officialThread, runtime, stream host, projections, commands/outbox, contracts/client, dependencies or real service changes. No models/DB/provider/onboarding tests. This is a presentation slice; main integration and real-service validation are separate.
