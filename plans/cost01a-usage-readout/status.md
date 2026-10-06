# COST01A 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 14:00 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | [COST-001](../../../execution-cost/plans/cost01-execution-cost/plan.md) |
| co-lead | Execution Lead |
| 单一status owner / model | assignment_review / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/cost-usage-readout |
| Branch | codex/cost-usage-readout |
| 工作基线 / HEAD | 8dd6fe7978bb85674d9dbd945fc94084967536c1 / 首 canonical f98d9053 |
| 工作树dirty状态 | canonical 文档实施中 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 检查状态 | NOT_RUN；已读账本/固定 SDK 声明，尚无工程检查结论 |
| 已集成main状态 / HEAD | 本片尚未集成；基线观察 main d4a2e0a7f255a2c68b99c7aafbc006c7bc3b3b50 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/server/src/usage-readout, apps/server/src/usage.ts, packages/contracts/src/usage-readout.ts |
| 阶段 | M2 |
| 优先级 | 3 |
| 当前产出 | 正在核对已有用量记录，让缓存消耗与缺失数据能够分别解释。 |
| 下一可用交付 | 同一任务的输入、缓存、输出和估价读口，保留未知与覆盖范围。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| Claim | f3a39671-81b7-4f42-81d9-673925a7cd36 v2；五 literal，见 take-receipt |
| 架构影响 | 新 owner 只读投影；共享 exports/client/factory 由 Execution Lead 接线，当前未实现 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| COST01A-01 | in-progress | assignment_review | 既有 samples/cache 字段与 SDK0.3.290 源码已读 |
| COST01A-02 | pending | assignment_review | 未实现 |
| COST01A-03 | pending | assignment_review | 0 tests / 0 provider |
| COST01A-04 | pending | assignment_review | 独审尚未启动 |

## 技术事实与限制

原 usage.ts 仅持久累计 input/output/cost；缓存原值在 sample JSON。拟共享纯基线函数，避免另一套累计规则；Lead 已移交且原子追加 usage.ts。新目录/字段设计不依赖其完成。

worktree 创建前可用 1,394,163,712 B，估算已跟踪文件按 4 KiB 取整 162,824,192 B；创建后约 1.147 GiB，未安装。保留至少 1 GiB 共享余量，不启动大复制。

## Dashboard

本 status 是唯一手填事实源。首 canonical 提交后交 Execution Lead 登记；当前未实测聚合，不猜已展示。COST-001 的阶段归因/全局预算/三端完整验收仍 open。
