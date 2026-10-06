# TUI-001 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:26 UTC / main df29fb511df029a0922ace0f4973f3fe3736e502 |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| 单一status owner / model | Execution Lead / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-client |
| Branch | codex/tui-client |
| 工作基线 / HEAD | 77c420cf9ee5de0291ea93014b6ea11aead6fab5 / 27d6fef8d95261c1f286a3acdd3d524d907a2a29；本次仅管理metadata |
| 工作树dirty状态 | 管理metadata提交后clean |
| 工作分支状态 | in-progress |
| 检查状态 | NOT_RUN；仅设计/来源/文档核对，无产品实现 |
| 已集成main状态 / HEAD | 计划27d6fef已在main e785a29发布；当前main df29fb5。产品首片未集成 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/tui, packages/interaction |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 1 |
| 当前产出 | 终端客户端首片正在实现；交互界面与无界面验收入口共用发送和恢复逻辑。 |
| 下一可用交付 | 可选择会话、发送消息并安全断线重连的交互式终端。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| Claim | f6055d8a-356e-4dfa-8420-1eaf81874410 v1；仅plan/evidence |
| 架构影响 | TUI呈现与共享typed交互层，中心仍是持久权威；当前planned，固定实现后更新图 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| TUI001-01 | completed | Execution Lead | [设计](plan.md)、[研究来源](../../docs/evidence/tui01/research-provenance.json) |
| TUI001-02 | in-progress | runner_owner | [TUI01A唯一状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-conversations/plans/tui01a-conversations/status.md)；固定依赖和Interface已发布，端到端与独审未完成 |
| TUI001-03 | pending | Execution Lead派工 | stream/详情尚未实现 |
| TUI001-04 | pending | TUI owner / Mika合同 | 真实model能力仍逐项接通 |
| TUI001-05 | pending | TUI owner / Web合同 | 附件生命周期与context |
| TUI001-06 | pending | TUI owner | queue/steer/cancel/decision |
| TUI001-07 | pending | TUI owner | runner/plugin管理 |
| TUI001-08 | pending | 独立review / Execution Lead | 完整日用/PTY/provider验收仍开放 |

本claim仅管理文档；TUI01A由runner_owner在独立tui-conversations树与0ba7e5d7 claim实施，复用R06交付后的同一槽。依赖固定1cec921，既有Web importer/package/snapshot保持，实际core仍0.3.22；lock移交已归还F01。尚无端到端、独审或provider结论，不因首合同和纯controller检查勾完首片。唯一status进入dashboard；与GO只报真实大task blocker或完整Done。
