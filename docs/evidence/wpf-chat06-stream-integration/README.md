# WPF-CHAT06I01: assistant drafts in the actual Flow App

The App now consumes the approved stream module through a bound host and an independently controllable trusted extension. It keeps the official Thread/runtime, drafts, queue and profile ownership. This is HTTP fixture validation, not a real provider or center deployment.

- [Plan](../../../plans/wpf-chat06-stream-integration/plan.md), [status](../../../plans/wpf-chat06-stream-integration/status.md), [review](../../../plans/wpf-chat06-stream-integration/review.md)
- [Interface and limits](interface.md), [skills and clean-code](quality.md), [validation](validation.md)
- [Claim receipt](take-receipt.json), [accepted scope](accepted-proposal.json)

Run in this worktree with Node 24 and pnpm 9.15.4:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-stream-integration.fixture.ts --stream-preview
```

The dynamic App URL and two isolated fixture centers are printed on stdout. Public fixture token: `flow-fixture-only`. Open Conversation 2 for a current draft, or create a chat to see a deterministic incremental reply and a final answer. The fixture intentionally keeps the task running after the final body to verify that message completion and task execution are separate. It never invokes a model or a database.

Checks:

```sh
pnpm exec vitest run apps/web/test/conversation-stream-integration.test.ts apps/web/test/plugin-host.test.ts
pnpm --filter @flow/web typecheck
pnpm --filter @flow/web build
pnpm exec tsx apps/web/test/conversation-stream-integration.browser.ts
pnpm exec tsx apps/web/test/conversation-stream-integration.browser.ts --production
```

Each browser invocation owns dynamic fixture ports and closes only those services. It does not stop the retained development preview or any other owner’s service. The production browser needs the preceding build; it tests built App assets against the same isolated HTTP contracts.

Real-center use keeps the existing Web setup: set `FLOW_CENTER_URL` for the local Web `/api` proxy, or use the Connect form’s administrator URL. Enter the existing center owner token yourself; it stays in page memory. This task neither reads real credentials nor upgrades the personal backend. The center must support the negotiated protocol before it advertises live assistant text.
