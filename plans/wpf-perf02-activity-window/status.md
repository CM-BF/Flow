# WPF-PERF02 Activity 窗口状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 03:33 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / 已派发 gpt-6-astra ultra（运行系统身份 GPT-6） |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window |
| Branch | codex/web-activity-window |
| Base | cc33403cd9b357fcd85484b7bc6952dc1220d689 |
| Head / dirty | cc33403cd9b357fcd85484b7bc6952dc1220d689；启动文档与实现进行中，实际Git另核 |
| 阶段 | M2 |
| 优先级 | 3 |
| 当前产出 | 已核D04 v1 live；独立树/唯一三件套与回执就绪，开始Activity深模块 |
| 下一可用交付 | 可独立核查的窗口算法与浏览器完整性候选 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/workspace-feed/WorkspaceOverview.tsx, apps/web/src/workspace-feed/ActivityWindow.tsx, apps/web/src/workspace-feed/workspace-feed.css, apps/web/test/workspace-window.test.ts, apps/web/test/workspace-window.browser.ts, apps/web/test/performance-probe.ts |
| 检查状态 | NOT_RUN |
| Review | NOT_STARTED；[review.md](review.md) |
| main集成状态 | 本优化未集成；不继承M02/PERF01 approval |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| WPF-PERF02-01 | completed | w01_owner | [回执](../../docs/evidence/wpf-perf02/take-receipt.json)，原claims已先移scope |
| WPF-PERF02-02 | in-progress | w01_owner | bounded window实现中 |
| WPF-PERF02-03 | pending | w01_owner | 新证据目录，不覆盖PERF01 |
| WPF-PERF02-04 | pending | reviewer/Lead | 无新target，不继承历史审查 |

架构影响：Activity渲染内部深模块，公共HTTP/中心/DB/依赖不变；最终target交Lead登记。Dashboard：唯一source已准备，发管理者登记后只读核聚合。边界：普通production synthetic fixture并非真实用户INP/模型容量，projection数据驻留本批不变。
