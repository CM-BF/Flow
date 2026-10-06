# TUI-001 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 10:20:11 UTC / main41315b033deb0b1953484359b686c0b228997367 |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| 单一status owner / model | Execution Lead / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-client |
| Branch | codex/tui-client |
| 工作基线 / HEAD | 77c420cf9ee5de0291ea93014b6ea11aead6fab5 / 27d6fef8d95261c1f286a3acdd3d524d907a2a29；本次仅管理metadata |
| 工作树dirty状态 | 管理metadata提交后clean |
| 工作分支状态 | in-progress |
| 检查状态 | TUI01A独审APPROVED；本次仅main receipt与父计划核对，无重复工程测试 |
| 已集成main状态 / HEAD | f181d84b5fb3652d62e2a181acff442d42b3e066已含TUI01A 29b修复及独审2d297；产品首片可用，后继完整日用目标开放 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/tui, packages/interaction |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 1 |
| 当前产出 | 终端已能选择会话、发送消息并在丢失回执后恢复，首片已进入主线。 |
| 下一可用交付 | 复用共享回执校验，再接入逐步正文、活动详情和高级操作。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| Claim | f6055d8a-356e-4dfa-8420-1eaf81874410 v1；仅plan/evidence |
| 架构影响 | TUI→packages/interaction→FlowClient→中心已main；固定图后继需纳TUI01A 29b，个人服务未变 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| TUI001-01 | completed | Execution Lead | [设计](plan.md)、[研究来源](../../docs/evidence/tui01/research-provenance.json) |
| TUI001-02 | completed | runner_owner / Mika独审 | [TUI01A唯一状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-conversations/plans/tui01a-conversations/status.md)；29b两项P2已闭，mainf181d84；原端到端/PTY和增量19不同用例边界保留 |
| TUI001-03 | pending | Execution Lead派工 | stream/详情尚未实现 |
| TUI001-04 | pending | TUI owner / Mika合同 | 真实model能力仍逐项接通 |
| TUI001-05 | pending | TUI owner / Web合同 | 附件生命周期与context |
| TUI001-06 | pending | TUI owner | queue/steer/cancel/decision |
| TUI001-07 | pending | TUI owner | runner/plugin管理 |
| TUI001-09 | in-progress | runner_owner / Web独立消费者 | [共享ACK后继](../../docs/evidence/tui01/shared-ack-design.md)；TUI01B已派独立共享ACK与冲突恢复；F01两个client路径已归还，Web消费者由同级协调 |
| TUI001-08 | pending | 独立review / Execution Lead | 完整日用/PTY/双公开客户端共同中心/provider验收仍开放 |

本claim仅管理文档；TUI01A由runner_owner在独立tui-conversations树与0ba7e5d7 claim实施，复用R06交付后的同一槽。依赖固定1cec921，既有Web importer/package/snapshot保持，实际core仍0.3.22；lock移交已归还F01。首片9e5588原CHANGES_REQUESTED保持历史；29b已修复两个P2并获MikaAPPROVED，19增量含11重复及8新例，mainf181已接收。P3最大revision边界留共享ACK后继；无provider结论。唯一status进入dashboard；与GO只报真实大task blocker或完整Done。

本次仅收敛既有TUI001-08双客户端验收并分派TUI001-09；不新建大task或状态权威，不改TUI01A已审源码，不重复工程测试。
