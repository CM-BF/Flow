# WPF-PERF02 Activity 窗口状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 03:39 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / 已派发 gpt-6-astra ultra（运行系统身份 GPT-6） |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window |
| Branch | codex/web-activity-window |
| Base | cc33403cd9b357fcd85484b7bc6952dc1220d689 |
| Head / dirty | cc33403cd9b357fcd85484b7bc6952dc1220d689；实现已提交，当前仅证据metadata变更，实际Git另核 |
| 阶段 | M2 |
| 优先级 | 3 |
| 当前产出 | 有界窗口实现固定；1040变高记录逐窗hash一致，最大16行，焦点/锚点/主题功能通过 |
| 下一可用交付 | 协调安静窗口后smoke与1/16/128生产矩阵、固定target独立review |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | a87f64f48a3b7e8d03429ab0673c210076a2df0d |
| 实现范围 | apps/web/src/workspace-feed/WorkspaceOverview.tsx, apps/web/src/workspace-feed/ActivityWindow.tsx, apps/web/src/workspace-feed/workspace-feed.css, apps/web/test/workspace-window.test.ts, apps/web/test/workspace-window.browser.ts, apps/web/test/performance-probe.ts |
| 检查状态 | PASSED：13局部/直接projection tests、Web typecheck、8生产浏览器行为组；target a87f64f48a3b7e8d03429ab0673c210076a2df0d。正式性能尚未跑 |
| Review | NOT_STARTED；[review.md](review.md) |
| main集成状态 | 本优化未集成；不继承M02/PERF01 approval |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| WPF-PERF02-01 | completed | w01_owner | [回执](../../docs/evidence/wpf-perf02/take-receipt.json)，原claims已先移scope |
| WPF-PERF02-02 | completed | w01_owner | branch实现 a87f64f48a3b7e8d03429ab0673c210076a2df0d；尚待独立review |
| WPF-PERF02-03 | in-progress | w01_owner | 8功能browser组/13tests通过；正式矩阵待协调窗口 |
| WPF-PERF02-04 | pending | reviewer/Lead | 无新target，不继承历史审查 |

架构影响：Activity渲染内部深模块，公共HTTP/中心/DB/依赖不变；最终target交Lead登记。Dashboard：唯一source已交管理者登记，聚合闭环待核。边界：普通production synthetic fixture并非真实用户INP/模型容量，projection数据驻留本批不变。
