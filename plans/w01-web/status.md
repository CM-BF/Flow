# W01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 00:57 UTC / 2026-10-06 00:57 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | reserved-external / 用户另开task后确认owner与至少Sol模型 |
| Worktree | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web` |
| Branch | `codex/m1-web` |
| 工作基线 / 本记录核验时HEAD | 以 [外部交接](../../docs/handoffs/external-web-dashboard.md) 的冻结提交与派工时实际 Git 核验为准 |
| 工作树dirty状态 | 派工前由 Execution Lead 创建并核验；未启动实现 |
| 工作分支状态 | reserved-external / awaiting-dispatch；用户将自行新开task，尚未运行，内部不得重复派发 |
| 已集成main状态 / HEAD | `0763d4653264b09ddd355c292fc8bd88dfc3c584`；规则与旧计划已集成，F00及当前应用features尚未集成 |
| Review | [review.md](review.md)，NOT_STARTED，未获得独立approval |

## TODO状态（与plan稳定ID逐项对应）

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| W01-01 | pending | 待分配Web owner | 未完成，无通过结论 |
| W01-02 | pending | 待分配Web owner | 未完成，无通过结论 |
| W01-03 | pending | 待分配Web owner | 未完成，无通过结论 |
| W01-04 | pending | 待分配Web owner | 未完成，无通过结论 |

## 已完成证据与检查

- 历史证据保留在原路径，目录迁移未改写实验JSON/hash。FLOW-002已勾选项限于既有小任务/准备与失败记录，不代表生产harness或全面恢复可靠。
- F00分支提交542f70b/3995ec1：类型检查与4个contracts/client测试，PostgreSQL/pg-boss回滚/队列进程重启/稳定ID重试/完成短验证；见[短验证](../../docs/evidence/f00/scheduler.json)。不代表main或完整M1已经具备这些能力。
- 当前feature实现检查由各owner在本节更新；没有具体commit/环境/输出时不声称通过。

## 阻塞 / 风险 / 未验证

- 用户期望并发上限10；运行时当前实测cap4，启动第5worker返回`collab spawn failed: agent thread limit reached`。ready任务随实际可用槽派发。
- 应用端到端、真实harness、双主题及故障验收仍待相应feature证据，短probe不能代替。

## 下一步与handoff

外部owner收到用户prompt后先核验实际branch/head和独占范围再接管本status；此初始化记录不替代owner后续更新。启动、实质进展、受阻、交付与review修复时更新。交付带commit、检查范围、证据和未解决项；review者先核对实际target，仅只读审查实现，修复交owner。

## Dashboard 同步

本 status 是 W01 唯一手填进度事实源；等待聚合器展示，未声称同步通过。
