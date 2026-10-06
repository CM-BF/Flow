# G01 独立审查

**状态：NOT_STARTED**

Review target commit：6394afad2480da369adb7e6156403bfc45097dfa。Base：8c57f2f97345167207fa0d2590e9ad6310c922d4；worktree /Users/citrine/Projects/AgentHarness/Flow-worktrees/project-graph；branch codex/project-graph。范围：packages/contracts/src/projects.ts、apps/server/src/projects/、packages/storage/migrations/004-projects.sql。后续 metadata 不扩展已测源码范围。

## 可复制审查任务

先读 AGENTS/plans 规则和本 plan/status，核验实际 base/HEAD/dirty，不沿用旧通过。按 Lead 本轮派工仅只读源码/合同/已保存证据，不运行 tests、数据库、模型或服务。核查新 contracts/projects.ts、apps/server/src/projects、004-projects.sql；检查公开注册/迁移 seam 与作者真实 flow_g01 HTTP/PG 证据是否覆盖 CAS、相反依赖并发、树循环、依赖循环、节点/父版本、幂等与 immutable history、task 唯一关联及执行状态唯一来源。确认没有全局图锁/自动调度/虚假多租户。报告 severity/blocking、复现与位置，修复交 owner，结论绑定完整 target。

## 检查 / Findings / 结论

作者在目标源码上执行 10/10 真实 HTTP/PG tests、全库 typecheck、diffcheck，通过；见 [证据](../../docs/evidence/g01/README.md)。独立检查未执行，findings 未评估，结论 NOT_STARTED。作者证据不代替独立审查。新修复提交需明确复审 target。未覆盖产品调度 gate、运行中版本失效决策、取消传播、CLI 接线或真实模型，不能从此首片段推断。
