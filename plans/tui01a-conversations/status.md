# TUI01A 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:35:40 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | TUI-001（[大task定义](../tui01-terminal-client/plan.md)） |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| 单一status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-conversations |
| Branch | codex/tui-conversations |
| 工作基线 / HEAD | 77c420cf9ee5de0291ea93014b6ea11aead6fab5 / 1cec921（固定依赖）；实现进行中 |
| 工作树dirty状态 | 自有source与最终证据待固定 |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED；17个不同局部行为（11 controller+4 renderer/journal/headless+2真实HTTP/PG/PTY），types exit0；目标随源码固定 |
| 已集成main状态 / HEAD | 尚未集成；基线77c420cf9ee5de0291ea93014b6ea11aead6fab5 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/tui, packages/interaction |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 1 |
| 当前产出 | 已能在终端选择会话、发送消息并重新打开历史；退出后任务继续。 |
| 下一可用交付 | 独立审查后交付基础会话终端；更多对话能力由后续片段接入。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| 领取 | 0ba7e5d7-a201-4cb5-ab50-0f8bf0d536b6 v3；[receipt](../../docs/evidence/tui01a/claim-receipt.json) |
| 架构影响 | TUI/headless→共享interaction→FlowClient→center；当前分支planned，固定后Lead更新架构图。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| TUI01A-01 | completed | runner_owner / Lead | [Interface](../../docs/evidence/tui01a/interface.md)、package候选；固定依赖1cec921，lock已交回 |
| TUI01A-02 | completed | runner_owner | controller 11/11，私有intent/epoch/显式恢复 |
| TUI01A-03 | completed | runner_owner | renderer/journal/headless 4/4，实际PTY输入/resize/退出恢复 |
| TUI01A-04 | completed | runner_owner | 真实HTTP/随机PG 2/2，丢ACK同key、profile、退出时running→重开final；remaining[] |
| TUI01A-05 | pending | runner_owner / Lead | NOT_STARTED |

Dashboard：canonical由Lead登记；最近事实见本表。0provider、私人服务未操作。父plan在tui-client分支，集成前相对链接暂待共享输入；不在本树复制第二权威。
