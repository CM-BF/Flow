# TUI-001 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06T12:13:55.672556+00:00 / main362af3bac77541e5a60979326bcf4d4b8c947915 |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| 单一status owner / model | Execution Lead / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-client |
| Branch | codex/tui-client |
| 工作基线 / HEAD | 77c420cf9ee5de0291ea93014b6ea11aead6fab5 / 27d6fef8d95261c1f286a3acdd3d524d907a2a29；本次仅管理metadata |
| 工作树dirty状态 | 管理metadata提交后clean |
| 工作分支状态 | in-progress |
| 检查状态 | TUI01A/B/C独审与必要组合通过并main；本次父状态核对，无新工程测试 |
| 已集成main状态 / HEAD | TUI01A/B/C已main；O12共享goal controller/历史公开入口已main362。终端goal模式与完整双端控制尚未实施。 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/tui, packages/interaction |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 1 |
| 当前产出 | 终端流式正文、按需工具详情和可靠回执已交付；共享目标会话现在可作为后继公开入口。 |
| 下一可用交付 | 让终端通过已发布的目标会话与控制接口查看计划、处理决定、恢复命令，并补跨客户端旅程。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| Claim | f6055d8a-356e-4dfa-8420-1eaf81874410 v1；仅plan/evidence |
| 架构影响 | TUI01C把已审Web纯stream/settlement规则提取为浏览器安全共享子入口；Web私有展示状态不迁移 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| TUI001-01 | completed | Execution Lead | [设计](plan.md)、[研究来源](../../docs/evidence/tui01/research-provenance.json) |
| TUI001-02 | completed | runner_owner / Mika独审 | [TUI01A唯一状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-conversations/plans/tui01a-conversations/status.md)；29b两项P2已闭，mainf181d84；原端到端/PTY和增量19不同用例边界保留 |
| TUI001-03 | completed | runner_owner / Execution Lead | [TUI01C](../../../tui-stream-activity/plans/tui01c-stream-activity/status.md)独审及焦点修复通过、main648e接收；[父回执](../../docs/evidence/tui01/tui01c-main-receipt.json) |
| TUI001-04 | pending | TUI owner / Mika合同 | 真实model能力仍逐项接通 |
| TUI001-05 | pending | TUI owner / Web合同 | 附件生命周期与context |
| TUI001-06 | pending | TUI owner | queue/steer/cancel/decision |
| TUI001-07 | pending | TUI owner | runner/plugin管理 |
| TUI001-09 | completed | runner_owner / Web独立消费者 | TUI01B与WPF-ACK01均已独审/main；共享v2附件回执df8也已mainfd132，完整双端旅程仍归08 |
| TUI001-08 | pending | 独立review / Execution Lead | 完整日用/PTY/双公开客户端共同中心/provider验收仍开放 |

本claim仅管理文档；TUI01A由runner_owner在独立tui-conversations树与0ba7e5d7 claim实施，复用R06交付后的同一槽。依赖固定1cec921，既有Web importer/package/snapshot保持，实际core仍0.3.22；lock移交已归还F01。首片9e5588原CHANGES_REQUESTED保持历史；29b已修复两个P2并获MikaAPPROVED，19增量含11重复及8新例，mainf181已接收。P3最大revision边界留共享ACK后继；无provider结论。唯一status进入dashboard；与GO只报真实大task blocker或完整Done。

本次仅收敛既有TUI001-08双客户端验收并分派TUI001-09；不新建大task或状态权威，不改TUI01A已审源码，不重复工程测试。

2026-10-06 11:32:04 UTC：父状态已按实际main接收更新，未复制子片审查或重跑检查。TUI001-03/09的局部交付关闭，完整日用、真实执行选项/附件发送/队列与双客户端验收保持开放；后台公开合同与headless/终端先验、Web并行，不互设所有开发的串行门禁。
