# G01 独立审查

**状态：NOT_STARTED**

Review target commit：待实现提交。Base：8c57f2f97345167207fa0d2590e9ad6310c922d4；worktree /Users/citrine/Projects/AgentHarness/Flow-worktrees/project-graph；branch codex/project-graph。

## 可复制审查任务

先读 AGENTS/plans 规则和本 plan/status，核验实际 base/HEAD/dirty，不沿用旧通过。只读核查新 contracts/projects.ts、apps/server/src/projects、004-projects.sql。通过公开注册/迁移 seam 和真实专用 flow_g01 HTTP/PG 检查 CAS、相反依赖并发、树循环、依赖循环、节点/父版本、幂等与 immutable history、task 唯一关联及执行状态唯一来源。确认没有全局图锁/自动调度/虚假多租户。报告 severity/blocking、复现与位置，修复交 owner，结论绑定完整 target。无模型，不能改其他数据库或停止他人服务。

## 检查 / Findings / 结论

独立检查未执行，findings 未评估，结论 NOT_STARTED。作者证据不代替独立审查。新修复提交需明确复审 target。
