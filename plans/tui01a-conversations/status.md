# TUI01A 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:19:49 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | TUI-001（[大task定义](../tui01-terminal-client/plan.md)） |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| 单一status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-conversations |
| Branch | codex/tui-conversations |
| 工作基线 / HEAD | 77c420cf9ee5de0291ea93014b6ea11aead6fab5 / 首合同提交前 |
| 工作树dirty状态 | 自有首合同与package候选 |
| 工作分支状态 | in-progress |
| 检查状态 | NOT_RUN |
| 已集成main状态 / HEAD | 尚未集成；基线77c420cf9ee5de0291ea93014b6ea11aead6fab5 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/tui, packages/interaction |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 1 |
| 当前产出 | 正在建立可选择会话、发送消息并恢复历史的终端入口。 |
| 下一可用交付 | 可运行的终端与无界面入口，退出后中心任务继续。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| 领取 | 0ba7e5d7-a201-4cb5-ab50-0f8bf0d536b6 v1；[receipt](../../docs/evidence/tui01a/claim-receipt.json) |
| 架构影响 | TUI/headless→共享interaction→FlowClient→center；当前分支planned，固定后Lead更新架构图。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| TUI01A-01 | completed | runner_owner / Lead | [Interface](../../docs/evidence/tui01a/interface.md)、package候选；锁待Lead输入 |
| TUI01A-02 | in-progress | runner_owner | 尚未实现 |
| TUI01A-03 | pending | runner_owner | 尚未执行 |
| TUI01A-04 | pending | runner_owner | 尚未执行 |
| TUI01A-05 | pending | runner_owner / Lead | NOT_STARTED |

Dashboard：canonical新建待Lead登记。0provider、私人服务未操作。父plan在tui-client分支，集成前相对链接暂待共享输入；不在本树复制第二权威。
