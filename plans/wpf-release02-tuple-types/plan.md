# WPF-RELEASE02 构建矩阵类型收窄

状态：in-progress；2026-10-06 11:08:26 UTC。父[WPF-MATURE-01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-01-visual/plan.md)，沿[模块规则](../../AGENTS.md#modular-design)。

只将fixture中两个固定构建输入的数组声明为readonly tuple，修根strict/noUncheckedIndexedAccess下解构可能undefined。运行值/旧新版本/releaseId/PG/旅程不变；不加env guard、不改SVC或产品。

- [x] RELEASE02-01 窄类型修复，根tsc noEmit与静态运行矩阵等值核对。
- [ ] RELEASE02-02 固定source独立review与主线接收。

旧RELEASE01定向tsc未启strict/noUncheckedIndexedAccess，通过记录保留其原范围；新根类型检查补上该边界，不归咎其他工程片。只类型静态检查，0浏览器/PG/provider/个人发布。
