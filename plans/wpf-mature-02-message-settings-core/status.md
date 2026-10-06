# WPF-MATURE-02-CORE 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 15:31:25 UTC / fixed base 70cc4e852365e974cefde30bfad75c7d233985c6 |
| Plan | [plan.md](plan.md) |
| 所属大task | [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) |
| co-lead | mika |
| 单一status owner / model | status_read / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core |
| Branch | codex/claude-message-settings-core |
| 工作基线 / HEAD | 70cc4e852365e974cefde30bfad75c7d233985c6 / 4e7b7f968a2160a60989b3b6343506ae8fb5ef6a（source）；validation 8c56f15c5a70afd4e33031876244f70d1284d957（后续仅metadata） |
| 工作树dirty状态 | 78c73677438efec7455fc68b44109fa7da9ce5f5 已核 clean；本次仅独审/集成 metadata |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | integration |
| 检查状态 | PASSED — 4e7b7f968a2160a60989b3b6343506ae8fb5ef6a 本树单文件5/5，局部strict exit0；PG/SDK/provider/target未运行 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；没有本片 main 接收回执 |
| 实现目标 | 4e7b7f968a2160a60989b3b6343506ae8fb5ef6a |
| 实现范围 | packages/contracts/src/claude-turn-settings.ts, packages/contracts/src/claude-turn-settings.test.ts |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 逐消息设置契约已通过验证和独立审查，等待主线接收 |
| 下一可用交付 | 主线接收契约；后继把已冻结设置传到现有Claude执行入口 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED 4e7b7f968a2160a60989b3b6343506ae8fb5ef6a / 0P1P2 |
| Claim | c652bc61-f8a9-4848-a709-978adbb425ed v1 ACTIVE；[commit 后 receipt](../../docs/evidence/wpf-mature-02-message-settings-core/claim-receipt.json) |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| M02CORE-01 | completed | status_read | 已批准有界设计、独立树与 2026-10-06T15:24:10.824Z COMMITTED claim |
| M02CORE-02 | completed | status_read | 4e7b7f968a2160a60989b3b6343506ae8fb5ef6a 两源固定 |
| M02CORE-03 | completed | status_read | 5 selected / 5 passed；局部strict0；[checks](../../docs/evidence/wpf-mature-02-message-settings-core/checks.json) |
| M02CORE-04 | completed | status_read | Mika15:31:09 / architecture_read15:31:25 UTC APPROVED，原packet不改 |
| M02CORE-05 | in-progress | status_read | [integration-ready](../../docs/evidence/wpf-mature-02-message-settings-core/integration-ready.md)，未main，保留writer |
| M02CORE-06 | in-progress | status_read | 后继实际接线只读设计；未amend，现有产品source禁止修改 |

## 阻塞 / 风险 / 未验证

15:23:55 附近 fresh df 可用 1,018,896KiB = 1,043,349,504B，低于 1GiB。父 lead 明确只准小源码/metadata；不安装/运行测试或类型。解除条件为 fresh 至少 1,107,296,256B，并确认既有依赖复用闭包。15:28:41/42 实際两个检查前分别为 1,118,162,944 / 1,118,031,872B，条件已满足，按 root 授权各运行一次；历史 HOLD 保留。没有 runtime imports、PG/provider/model、个人服务或 journal 操作。

## Dashboard / 架构影响与下一步

本 status 是唯一手填事实源。待 Lead 登记新 sub-task 权威 WT/branch/planDir，未声称已聚合。新增纯契约 Module 尚未导出或接入产品；架构图待 Lead 在接线片固定后统一登记，不改共享 registry/架构源。

source/raw/config 固定；[manifest与交审入口](../../docs/evidence/wpf-mature-02-message-settings-core/review-ready.md)供独立只读审查。真实检查仅纯 contract，并未开放中心/adapter/UI；不把5/5升级为模型能力证据。自有cache2文件/1,357,827逻辑B已清，未动共享依赖或旧资源。没有新增用户决定。父计划索引由 Lead/parent owner 更新，本 owner 不改父 status。
