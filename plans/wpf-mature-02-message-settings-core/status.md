# WPF-MATURE-02-CORE 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 15:26:04 UTC / fixed base 70cc4e852365e974cefde30bfad75c7d233985c6 |
| Plan | [plan.md](plan.md) |
| 所属大task | [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) |
| co-lead | mika |
| 单一status owner / model | status_read / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core |
| Branch | codex/claude-message-settings-core |
| 工作基线 / HEAD | 70cc4e852365e974cefde30bfad75c7d233985c6 / 创建前 HEAD 同基线；本次 source checkpoint 待固定 |
| 工作树dirty状态 | 本 owner 四 scope 内新增文件，待固定 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 检查状态 | NOT_RUN — Vitest、类型、PG/build/target 全未执行；五组只有测试源码 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；没有本片 main 接收回执 |
| 实现目标 | 未提交 |
| 实现范围 | packages/contracts/src/claude-turn-settings.ts, packages/contracts/src/claude-turn-settings.test.ts |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 已写出逐消息设置的独立契约与精确回执匹配初稿，尚未验证 |
| 下一可用交付 | 资源允许后验证有限组合和回执身份，供中心与用户入口共用 |
| 当前阻塞 | ACTIVE: 共享磁盘不足，行为与类型验证暂停；小源码整理可继续 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| Claim | c652bc61-f8a9-4848-a709-978adbb425ed v1 ACTIVE；[commit 后 receipt](../../docs/evidence/wpf-mature-02-message-settings-core/claim-receipt.json) |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| M02CORE-01 | completed | status_read | 已批准有界设计、独立树与 2026-10-06T15:24:10.824Z COMMITTED claim |
| M02CORE-02 | in-progress | status_read | 两文件初稿；待 source checkpoint |
| M02CORE-03 | blocked | status_read | RESOURCE_HOLD；实际测试/类型运行数 0 |
| M02CORE-04 | pending | status_read | 独审 NOT_STARTED |
| M02CORE-05 | pending | status_read | 未 main，保留 writer 修复期 |

## 阻塞 / 风险 / 未验证

15:23:55 附近 fresh df 可用 1,018,896KiB = 1,043,349,504B，低于 1GiB。父 lead 明确只准小源码/metadata；不安装/运行测试或类型。解除条件为 fresh 至少 1,107,296,256B，并确认既有依赖复用闭包。没有 runtime imports、PG/provider/model、个人服务或 journal 操作。

## Dashboard / 架构影响与下一步

本 status 是唯一手填事实源。待 Lead 登记新 sub-task 权威 WT/branch/planDir，未声称已聚合。新增纯契约 Module 尚未导出或接入产品；架构图待 Lead 在接线片固定后统一登记，不改共享 registry/架构源。

先固定小源码/manifest，让 root 可只读检查；不以未验证 checkpoint 申请产品通过。没有新增用户决定。父计划索引由 Lead/parent owner 更新，本 owner 不改父 status。
