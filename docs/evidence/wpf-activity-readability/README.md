# WPF-ACTIVITYREAD01 delivery

Implementation `f2bcaae6623176acd718cf53707892154579970a`, base `3418fe682944145494463dca9e09f89c8b9c2295`. Branch `codex/web-activity-readability`. Only NativeActivity/Tool presentation and two explicit test files; [v2 claim](amend-receipt.json). Independent root review is APPROVED for this fixed target (2026-10-06 09:47:23 UTC after); main not integrated.

The activity view keeps tool state, loading, stale/error and recovery visible. Stable explanations and content provenance are available through native Details. Input ready is not running; Outcome unknown confirms no result; tool success does not establish final task/reply/verification success. Truncated and redacted content remain identifiable. Interface and lazy reads are unchanged: [interface](interface.md), [quality](quality.md), [validation](validation.md), [checks](checks.json).

Preview: http://127.0.0.1:61108/ — isolated HTTP fixture, no model or database. Owner workspace_panels_owner, session91708. Existing previews and personal services are untouched. Conversation 2 has running task metadata; expand Activity, then a tool or Reasoning. Conversation 3 has one six-record page with no redundant pager; About activity and Content details use Enter/Space. Fixture states are simulated and the server resets when restarted.

Recovery/start from this worktree:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-activity-integration.browser.ts --serve
```

Use the dynamic URL printed by stdout; it is not guaranteed to stay61108 after restart. `--production --serve` uses the existing production build and asks for the public fixture-only token `flow-fixture-only`; this is not a real credential. Tests use the same script without `--serve`, optionally `--production`.

Stable-frame screenshots: [desktop light1280×720](production-light.png), [light390×844](production-light-390.png), [dark390×844](production-dark-390.png), [content/recovery dark](production-recovery-dark.png). Each final report includes viewport/document/region rects after two animation frames. Old failure screenshots are retained separately as historical evidence.

Independent review: root reran16 direct tests and performed a focused real-App CUA journey; audited author dev13/prod12 evidence without rerunning those suites. No real provider/center/DB or personal-service verification. See the canonical review for attribution.

Canonical [plan](../../../plans/wpf-activity-readability/plan.md), [status](../../../plans/wpf-activity-readability/status.md), [review](../../../plans/wpf-activity-readability/review.md). This slice does not simplify the unowned outer message footer, queue or steering receipts, and does not finish the whole MATURE06 task.

主线接收：f181d84b5fb3652d62e2a181acff442d42b3e066，4源码与已审target相同，[本次只读证据](main-observation.json)。源码已集成，预览仍为原HTTPfixture，不代表个人服务或dashboard部署。
