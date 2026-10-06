# S01P07 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 20:28:02 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | mika |
| 单一status owner / model | status_read / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-claim-recovery |
| Branch | codex/runner-claim-recovery |
| 工作基线 / HEAD | 22a0806bc2465e11096949618113833f31766b19；源码 checkpoint 83a0799293057f7472f0329c61e566708b2a2381；本轮检查原始证据待提交 |
| 工作树dirty状态 | 本 owner 已领源码与文档待提交 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 检查状态 | 28/28 新入口；旧 runner/shutdown 42/43（CLI缺源1失败）；capacity正选9/9，真实PG4未选；首次types配置路径错误exit2，修配置待定向复验 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；基线为已供给固定 main 22a0806bc2465e11096949618113833f31766b19 |
| 实现目标 | 尚未固定产品实现 |
| 实现范围 | apps/server/src/runners.ts, apps/server/src/runner-claim-receipts.ts, apps/server/src/index.ts, apps/runner/src/admission-journal.ts, apps/runner/src/runtime.ts, packages/contracts/src/runner-claim.ts, packages/contracts/src/index.ts, packages/client/src/index.ts |
| 阶段 | M2 |
| 优先级 | 3 |
| 任务层级 | 子task |
| 当前产出 | 空闲复用持久领取身份、丢响应后恢复同一分配的中心与 runner 接线已准备，正在验证旧停机与并发保护。 |
| 下一可用交付 | 保持领取及时性与崩溃保护的中心、客户端和 runner 完整接线。 |
| 当前阻塞 | ACTIVE: 旧CLI直接消费者缺少入口闭包22源+1metadata，已精确申请供给；真实专库验证待独立窗口。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| 领取 | [COMMITTED amend](../../docs/evidence/s01p07/claim-amend.json)：9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac v2 / 18 literal |

| TODO ID | 状态 | Owner | 证据 / 检查 |
| --- | --- | --- | --- |
| S01P07-01 | in-progress | status_read | [接口](../../docs/evidence/s01p07/interface.md)；直接消费者已只读识别 |
| S01P07-02 | in-progress | status_read | contract/client/route/中心事务源码草稿，未检查 |
| S01P07-03 | in-progress | status_read | v2 journal/runtime 已接线，旧 peer 适配、新恢复用例待检查 |
| S01P07-04 | in-progress | status_read | [checks](../../docs/evidence/s01p07/checks)：79通过/1失败分三批；types配置未进入检查；0PG/provider |
| S01P07-05 | pending | status_read | NOT_STARTED / NOT_INTEGRATED |

## 架构与登记

计划改变 runner admission 协议、受权自身份和本地日志格式；沿现单 admission loop 与中心 runner→task→attempt 锁序，无新 scheduler。架构视图目标待固定实现；登记与 main 集成由 Lead 负责。

唯一事实源为本 status；Lead 已登记本 WT/branch/plan 路径，尚未核实际聚合。原 S01 实验 claim/结果独立保留，不沿用其 approval 或 main 事实。已接收33源186913B并逐hash核符；18 ignored dependency links已核固定版本，3 @flow仅本WT；0install。原固定基线输入与本 owner 修改分开记录。
