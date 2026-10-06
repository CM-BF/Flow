# WPF-QUEUE00 交付入口

实现：5acc5b1bde23e9c587a4580da55a75340811ecdd；branch `codex/web-queue-compatibility`，固定base75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。

只读capability兼容片段：queue boolean可以被读取，queue/steer UI和命令仍未接入。普通follow-up与既有回执/草稿语义保持。本轮无新服务/URL，所有旧用户预览保留原版本，不暗换或重启。

- [计划](../../../plans/wpf-queue00-compatibility/plan.md) / [状态](../../../plans/wpf-queue00-compatibility/status.md) / [审查](../../../plans/wpf-queue00-compatibility/review.md)
- [检查与边界](validation.md)、[技能/clean-code](quality.md)、[正式领取](take-receipt.json)

复验：在本树使用Node24 PATH运行`pnpm exec vitest run apps/web/test/conversation-projection.test.ts apps/web/test/conversation-outbox.test.ts`及`pnpm --filter @flow/web typecheck`。不需要模型、数据库、服务或凭据。
