# TUI-001 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:14:34 UTC |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| 单一status owner / model | Execution Lead / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-client |
| Branch | codex/tui-client |
| 工作基线 / HEAD | 77c420cf9ee5de0291ea93014b6ea11aead6fab5 / 初始计划待提交 |
| 工作树dirty状态 | 仅本计划与研究证据 |
| 工作分支状态 | in-progress |
| 检查状态 | NOT_RUN；仅设计/来源/文档核对，无产品实现 |
| 已集成main状态 / HEAD | 尚未集成本计划；启动main77c420c |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/tui, packages/interaction |
| 阶段 | M2 |
| 本片段交付阶段 | planning |
| 优先级 | 1 |
| 当前产出 | 已规划独立终端客户端，命令与后端共用契约，首个会话交互片准备中。 |
| 下一可用交付 | 可选择会话、发送消息并安全断线重连的交互式终端。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| Claim | f6055d8a-356e-4dfa-8420-1eaf81874410 v1；仅plan/evidence |
| 架构影响 | TUI呈现与共享typed交互层，中心仍是持久权威；当前planned，固定实现后更新图 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| TUI001-01 | completed | Execution Lead | [设计](plan.md)、[研究来源](../../docs/evidence/tui01/research-provenance.json) |
| TUI001-02 | pending | runner_owner（R06安全交付后） | 实现尚未take，无产品修改 |
| TUI001-03 | pending | Execution Lead派工 | stream/详情尚未实现 |
| TUI001-04 | pending | TUI owner / Mika合同 | 真实model能力仍逐项接通 |
| TUI001-05 | pending | TUI owner / Web合同 | 附件生命周期与context |
| TUI001-06 | pending | TUI owner | queue/steer/cancel/decision |
| TUI001-07 | pending | TUI owner | runner/plugin管理 |
| TUI001-08 | pending | 独立review / Execution Lead | 完整日用/PTY/provider验收仍开放 |

当前领取仅管理文档；生产候选scope不构成写权。当前两worker分别R06和R05B，首TUI实现复用R06交付后空槽，不绕工具cap。计划定义完成不宣称大task Done。唯一status进入dashboard；与GO只报真实大task blocker或完整Done。
