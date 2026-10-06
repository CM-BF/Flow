# R03 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 03:29 UTC；启动基线已核验 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | assignment_review / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-reliability |
| Branch | codex/runner-reliability |
| 工作基线 / HEAD | 3773db5d014a6d38d09553acd0a5fe8df900b7c4 / 3487ffe99107b6a8ce50fca7aff587ba74525975（当前切片提交前） |
| 工作树dirty状态 | 租期首提交已提交；当前存储修复/扩大行为回归待提交 |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED：lease23+runner25+client4+contracts2=54/54（4.36s），typecheck；含flow_r03真实中心字段/fence，0模型 |
| 已集成main状态 / HEAD | 本片段未集成；基线main3773不包含本修复 |
| 实现目标 | 未提交 |
| 实现范围 | packages/contracts/src/runner.ts, apps/server/src/runners.ts, apps/runner/src/attempt-control.ts, apps/runner/src/runtime.ts, apps/runner/src/runner.test.ts, apps/runner/src/lease.test.ts |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 时钟偏差、晚回包、同步过期与存储故障均通过局部检查 |
| 下一可用交付 | 不依赖跨机器时钟的保守租期与失败清理 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | NOT_STARTED，[review.md](review.md) |
| Claim | 6b6b025f-0338-42a6-9ff5-1122ccb83986 v1 active，receipt/live exact match |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| R03-01 | completed | assignment_review | Lead认可；ClaimResponse顶层remainingLeaseMs，无assignment=0 |
| R03-02 | completed | assignment_review | ±5分钟、claim/heartbeat耗时、晚回包、busy event loop、非法duration |
| R03-03 | completed | assignment_review | 目录/事件存储失败退出、实际SIGTERM、专库PG lease/fence、直接消费者 |
| R03-04 | in-progress | assignment_review | 固定source与原始证据，待独立review |
| R03-05 | pending | assignment_review | BR-01/S01未纳入本段 |

## 下一步 / 限制

按 [设计](../../docs/architecture/r03-runtime.md) 先做公开 runRunner/HTTP 红测，不直接测控制器私有函数。固定剩余租期/请求起点后实现；预算0模型。技能方法见 [quality](../../docs/evidence/r03/quality.md)。本文件为唯一进度事实源；dashboard登记由Lead负责，尚未实际核验聚合。
