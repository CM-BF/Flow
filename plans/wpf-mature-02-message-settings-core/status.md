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
| 本片段交付阶段 | planning |
| 检查状态 | 下一纵向 NOT_RUN；首leaf4e7b7f968a2160a60989b3b6343506ae8fb5ef6a历史5/5与strict0不重跑 |
| 已集成main状态 / HEAD | 首leaf已main 22d5ca67159b35bb794b2711cf6df0cb905b92e8；下一纵向尚未实施 |
| 实现目标 | 下一纵向未固定；首leaf历史4e7b7f968a2160a60989b3b6343506ae8fb5ef6a已main |
| 实现范围 | packages/contracts/src/claude-turn-settings.ts, packages/contracts/src/claude-turn-settings.test.ts |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 纯设置契约已进入主线；正在准备把冻结设置实际传入Claude执行入口 |
| 下一可用交付 | 明确共享范围后，实现中心与队列到现adapter的消息设置纵向接线 |
| 当前阻塞 | ACTIVE: 下一接线待共享路径交接与精确领取；只读设计不受阻 |
| 需用户决定 | NONE |
| Review | 下一纵向NOT_STARTED；[review.md](review.md)保留首leaf4e7 APPROVED/0P1P2 |
| Claim | c652bc61-f8a9-4848-a709-978adbb425ed v1 ACTIVE；[commit 后 receipt](../../docs/evidence/wpf-mature-02-message-settings-core/claim-receipt.json) |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| M02CORE-01 | completed | status_read | 已批准有界设计、独立树与 2026-10-06T15:24:10.824Z COMMITTED claim |
| M02CORE-02 | completed | status_read | 4e7b7f968a2160a60989b3b6343506ae8fb5ef6a 两源固定 |
| M02CORE-03 | completed | status_read | 5 selected / 5 passed；局部strict0；[checks](../../docs/evidence/wpf-mature-02-message-settings-core/checks.json) |
| M02CORE-04 | completed | status_read | Mika15:31:09 / architecture_read15:31:25 UTC APPROVED，原packet不改 |
| M02CORE-05 | completed | status_read | Lead main22d5已接两源/packet；owner逐字核两源；同core后继保留writer |
| M02CORE-06 | in-progress | status_read | [精确seam/scope请求](../../docs/evidence/wpf-mature-02-message-settings-core/next-slice-handoff.md)；未amend不改既有源 |

## 阻塞 / 风险 / 未验证

15:23:55 附近 fresh df 可用 1,018,896KiB = 1,043,349,504B，低于 1GiB。父 lead 明确只准小源码/metadata；不安装/运行测试或类型。解除条件为 fresh 至少 1,107,296,256B，并确认既有依赖复用闭包。15:28:41/42 实際两个检查前分别为 1,118,162,944 / 1,118,031,872B，条件已满足，按 root 授权各运行一次；历史 HOLD 保留。没有 runtime imports、PG/provider/model、个人服务或 journal 操作。

## Dashboard / 架构影响与下一步

本 status 是唯一手填事实源。待 Lead 登记新 sub-task 权威 WT/branch/planDir，未声称已聚合。新增纯契约 Module 尚未导出或接入产品；架构图待 Lead 在接线片固定后统一登记，不改共享 registry/架构源。

source/raw/config 固定；[manifest与交审入口](../../docs/evidence/wpf-mature-02-message-settings-core/review-ready.md)供独立只读审查。真实检查仅纯 contract，并未开放中心/adapter/UI；不把5/5升级为模型能力证据。自有cache2文件/1,357,827逻辑B已清，未动共享依赖或旧资源。没有新增用户决定。父计划索引由 Lead/parent owner 更新，本 owner 不改父 status。

## 首leaf main收口 / 下一片

Lead [main receipt](/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/i02/claude-message-settings-intake.json)绑定main22d5与source4e7/metadata b342；owner独核两源Git逐字一致，未merge/retest。claim v1继续原四scope；下一片仅设计，新增source须handoff/amend。新registry待Lead下一批登记，未核聚合。
