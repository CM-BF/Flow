# TUI01A 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:55:14 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | TUI-001（[大task定义](../tui01-terminal-client/plan.md)） |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| 单一status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-conversations |
| Branch | codex/tui-conversations |
| 工作基线 / HEAD | 77c420cf9ee5de0291ea93014b6ea11aead6fab5 / 29b546537862c562569ce9df74919f2239d94df8 |
| 工作树dirty状态 | 修复源码已固定并push；本metadata提交后clean |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED 29b546537862c562569ce9df74919f2239d94df8；本轮19/19=11重叠+8新增、types0；原17保留 |
| 已集成main状态 / HEAD | 尚未集成；基线77c420cf9ee5de0291ea93014b6ea11aead6fab5 |
| 实现目标 | 29b546537862c562569ce9df74919f2239d94df8 |
| 实现范围 | apps/tui, packages/interaction |
| 阶段 | M2 |
| 本片段交付阶段 | integration |
| 优先级 | 1 |
| 当前产出 | 已能在终端选择会话、发送消息并重新打开历史；退出后任务继续。 |
| 下一可用交付 | 基础终端已通过独立审查，等待集成。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED 29b546537862c562569ce9df74919f2239d94df8；Mika/status_read增量复审，两P2关闭 |
| 领取 | 0ba7e5d7-a201-4cb5-ab50-0f8bf0d536b6 v3；[current receipt](../../docs/evidence/tui01a/lock-return-receipt.json) |
| 架构影响 | TUI/headless→共享interaction→FlowClient→center；当前分支已实现并检查；Lead集成时更新架构图。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| TUI01A-01 | completed | runner_owner / Lead | [Interface](../../docs/evidence/tui01a/interface.md)、package候选；固定依赖1cec921，lock已交回 |
| TUI01A-02 | completed | runner_owner | controller 11/11，私有intent/epoch/显式恢复 |
| TUI01A-03 | completed | runner_owner | renderer/journal/headless 4/4，实际PTY输入/resize/退出恢复 |
| TUI01A-04 | completed | runner_owner | 真实HTTP/随机PG 2/2，丢ACK同key、profile、退出时running→重开final；remaining[] |
| TUI01A-05 | completed | runner_owner / Lead | Mika独审APPROVED29b；8新增回归+11直接consumer；等待main接收 |

Dashboard：canonical由Lead登记；最近事实见本表。0provider、私人服务未操作。父plan在tui-client分支，集成前相对链接暂待共享输入；不在本树复制第二权威。

后继：共享client ACK纯校验复用及revision上界P3见父计划shared-ack-design；未扩大本片源码。产品源码已停止写，claim保留待main收据。
