# WPF-QUEUE00 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 04:44 UTC / 固定输入75a33dec228e17bbbd0d3be9fd01bc9ac18a0133 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 已核新树与正式领取；准备最小queue boolean读取兼容 |
| 下一可用交付 | 固定实现与false/true直接行为回归 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-queue-compatibility |
| Branch | codex/web-queue-compatibility |
| 工作基线 / HEAD | 75a33dec228e17bbbd0d3be9fd01bc9ac18a0133 / metadata HEAD由Git聚合 |
| 工作树dirty状态 | 新增本feature metadata，产品未改；实际dirty由Git聚合 |
| 工作分支状态 | IN_PROGRESS |
| 检查状态 | NOT_RUN |
| 已集成main状态 / HEAD | NOT_INTEGRATED；仅固定输入包含既有CHAT |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/conversations/projection.ts, apps/web/test/conversation-projection.test.ts |
| Review | [review.md](review.md)，NOT_STARTED |
| D04 claim | 13185d8f-fcc4-453b-9ff1-4e4ca38f0666 / v1 / active；04:43:35.187Z；[receipt](../../docs/evidence/wpf-queue00/take-receipt.json) |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-QUEUE00-01 | completed | workspace_panels_owner | receipt/live核验与[质量](../../docs/evidence/wpf-queue00/quality.md) |
| WPF-QUEUE00-02 | in-progress | workspace_panels_owner | 准备2文件最小变更 |
| WPF-QUEUE00-03 | pending | workspace_panels_owner | 尚未执行 |
| WPF-QUEUE00-04 | pending | workspace_panels_owner | 独审/聚合/集成分别待办 |

本文件是唯一手填事实源，首次source交管理注册。旧CHAT claim v3已移出两个文件，不能在旧树恢复修改。架构影响：仅现有reader能力谓词兼容，公开Interface、状态机、数据库和依赖边界不变；不需要新增架构图。0模型/产品DB，无新服务；不修改或停止49922/55049/63743/59473及其他owner预览。
