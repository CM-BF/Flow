# B01 首片可独立集成

实现 c96a6bb867bfa83b8ce26f79236ff13b14b63e65，Mika / gpt-6-astra 于2026-10-06 11:48:15 UTC正式APPROVED，0P1/P2。首片已固定，可独立接收，不等待第三reader后继。原始[manifest](manifest.json) SHA ae65ca8837505e329169b79888ef91161ba33ca09395130715a1b41fd44f52c3，独审实际核50current+9red+19legacy全部78绑定。后继如改assistant-stream/queries.ts，仅使该readonly输入的WT不同；c96的旧Git输入与manifest永久保持，不将旧批准套到后继。

base fd1322f9c0c1d085d5e343e39f6216b20d26c264。生产精确3路径 apps/server/src/tasks.ts、queries.ts、task-read-projection.ts；新测试task-read-projection.test.ts与实验fixture、局部tsconfig和证据一并交付。8不同PG/HTTP检查和strict0已完成，2次red保留；不重复运行。兼容summary/cursor/404/auth/RR/写锁/snapshot，合法及SQL压力样本严格分开，查询次数不減，无wire/TOAST/SLO声明。

权威owner status_read/gpt-6-astra；co-lead mika；大task [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)。WT /Users/citrine/Projects/AgentHarness/Flow-worktrees/task-read-projections，branch codex/task-read-projections，唯一status plans/b01-bounded-reads/status.md。claim190bd45e-ffc6-4248-aca9-0ebd282c26b0 v1 ACTIVE，review修复/后继阶段保留；B01权威迁移请求在authority-request.md，由Lead登记，owner未声称已聚合或已main。首片source/raw冻结，main接收需Lead固定receipt。
