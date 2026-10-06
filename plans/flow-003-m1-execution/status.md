# FLOW-003 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 01:21 UTC / 2026-10-06 01:21 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | Execution Lead / gpt-6-astra ultra |
| Worktree | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review` |
| Branch | `codex/plan-status-review` |
| 工作基线 / 本记录核验时HEAD | `eacee76fa7f1b6cc46b06b57ae68458637be4a26` / `eacb5237e75abd9a0da145f8235e2b6bee6f6102`（仅表示同步时观察值） |
| 工作树dirty状态 | 仅本次汇总metadata待提交 |
| 工作分支状态 | F00/C01/R01/L01已提交并集成验证；完整M1未完成 |
| 已集成main状态 / HEAD | `0763d4653264b09ddd355c292fc8bd88dfc3c584`；规则与旧计划已集成，F00及当前应用features尚未集成 |
| Review | [review.md](review.md)，NOT_STARTED，未获得独立approval |

## TODO状态（与plan稳定ID逐项对应）

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| M1-A01 | in-progress | Execution Lead 汇总 / 对应feature owner | 中心/runner/CLI启动与两个runner已验证，Web待交付 |
| M1-A02 | completed | Execution Lead 汇总 / 对应feature owner | 真实中心重启后丢响应重试同任务，内容冲突HTTP测试通过 |
| M1-A03 | in-progress | Execution Lead 汇总 / 对应feature owner | CLI决策/真实SSE断线重连通过，浏览器关闭/重开未验收 |
| M1-A04 | completed | Execution Lead 汇总 / 对应feature owner | 观察timeout不取消；显式取消/竞争/重复事件公开测试通过 |
| M1-A05 | in-progress | Execution Lead 汇总 / 对应feature owner | 中心/SSE/CLI轻量引用与262KiB展开通过，Web待核对 |
| M1-A06 | completed | Execution Lead 汇总 / 对应feature owner | 固定artifact版本、独立verifier和成功/验收分离通过 |
| M1-A07 | completed | Execution Lead 汇总 / 对应feature owner | queued中心重启恢复；runner退出uncertain不重派通过，不含活动透明恢复 |
| M1-A08 | in-progress | Execution Lead 汇总 / 对应feature owner | R02实际3/5小调用，系统harness闭环待合入 |
| M1-A09 | in-progress | Execution Lead 汇总 / 对应feature owner | 确定性累计/去重/unknown测试通过；native系统usage待核对 |
| M1-A10 | in-progress | Execution Lead 汇总 / 对应feature owner | 检查/限制已分开记录，UI/native/性能各自待交付 |
| F00 | completed | Execution Lead | 本文或既有已归档证据；见下方边界 |
| C01 | completed | Execution Lead 汇总 / 对应feature owner | 8481168，独立review+真实PG测试；尚未集成main |
| R01 | completed | Execution Lead 汇总 / 对应feature owner | 3382637，修复outbox后独立复审通过；尚未集成main |
| L01 | completed | Execution Lead 汇总 / 对应feature owner | 1baf123，修复信号后独立复审通过；尚未集成main |
| W01 | pending | Execution Lead 汇总 / 对应feature owner | reserved-external/awaiting-dispatch，base eacee76不变 |
| D01 | pending | reserved-external | 外部任务待用户派发，尚未实现；见 [plan](../d01-execution-dashboard/plan.md) |
| R02 | in-progress | Execution Lead 汇总 / 对应feature owner | runner_owner，m1-native-harness/codex/m1-native-harness；真实调用3/5，留2次系统验收 |
| I01 | in-progress | Execution Lead 汇总 / 对应feature owner | 564febf：全检54/54及新5/5跨进程场景；原4场景独立review通过 |

## 已完成证据与检查

- 历史证据保留在原路径，目录迁移未改写实验JSON/hash。FLOW-002已勾选项限于既有小任务/准备与失败记录，不代表生产harness或全面恢复可靠。
- F00分支提交542f70b/3995ec1：类型检查与4个contracts/client测试，PostgreSQL/pg-boss回滚/队列进程重启/稳定ID重试/完成短验证；见[短验证](../../docs/evidence/f00/scheduler.json)。不代表main或完整M1已经具备这些能力。
- 当前feature实现检查由各owner在本节更新；没有具体commit/环境/输出时不声称通过。

## 阻塞 / 风险 / 未验证

- 用户期望并发上限10；运行时当前实测cap4，启动第5worker返回`collab spawn failed: agent thread limit reached`。ready任务随实际可用槽派发。
- 应用端到端、真实harness、双主题及故障验收仍待相应feature证据，短probe不能代替。

## 下一步与handoff

Owner在合并此文档基线后立即核验实际branch/head并接管本status；此初始化记录不替代owner后续更新。启动、实质进展、受阻、交付与review修复时更新。交付带commit、检查范围、证据和未解决项；review者先核对实际target，仅只读审查实现，修复交owner。

2026-10-06 01:21 UTC：跨任务汇总事实源已更新；[I01证据](../../docs/evidence/i01/checks.json)、[恢复边界](../../docs/architecture/recovery-boundaries.md)。新活跃LAB01由assignment_review负责，独立worktree `performance-probes` / branch `codex/performance-probes`，只做0模型/0云的两个有界toy；自身status在该worktree的 `plans/lab01-performance/status.md`。汇总不代写其状态。
