# WPF-K02C01 交接

用户能力：聊天会话读取和回执确认保留可选项目身份，项目变更/丢失不会静默通过。旧中心缺省字段仍兼容；新元数据不混入用户与assistant正文。

实现 `7633937c322090bbd6d526f378df464f2a7436ed`，branch `codex/web-context-compatibility`，独立树 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-compatibility`；base `3d4985fca060155435b159e0467815bf8e88b8b8`。shared输入e9a0259由Lead精确patch授权，见 [manifest](k02-web-contract-manifest.json)、[hash核验](input-verification.json)，不等于K02后端ready。

[唯一状态](../../../plans/wpf-k02-compatibility/status.md) · [计划](../../../plans/wpf-k02-compatibility/plan.md) · [独立审查](../../../plans/wpf-k02-compatibility/review.md) · [验证](validation.md) · [技能/clean-code](quality.md) · [claim](take-receipt.json)。

局部复验：在本树使用 `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/conversation-outbox.test.ts apps/web/test/conversation-projection.test.ts apps/web/test/conversation-queue.test.ts apps/web/test/execution-profiles.test.ts`；Web类型检查 `pnpm --filter @flow/web typecheck`。依赖 `pnpm install --frozen-lockfile`，不得更改共享依赖。

本片没有独立可视UI或新URL；保留既有QUEUE HTTP fixture58071及所有旧预览，不把其未包含本片的运行版本称新交付。未运行模型、真实中心或DB，没有知识引用选择/发送/详情能力；后端/控件后继另领。main集成由Lead负责，当前未集成。
