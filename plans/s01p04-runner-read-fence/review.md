# S01P04 独立审查

NOT_STARTED：当前只完成Interface/计划准备，没有生产实现target；Mika方法同意不代替实现独审。

base `c450c2da7e6185b88db9f46e0299ee504ee6f3e8`，worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-read-fence`，branch `codex/runner-read-fence`。现writer仅三scope，无runners.ts写权；固定实现后补完整Review target commit。

可复制审查任务：先读本地find-skills/clean-code/codebase-design与根/计划规则，核实际base/head/dirty和claim移交。只读固定target，对照[Interface](../../docs/evidence/s01p04/interface.md)检查FOR SHARE授权fence与强锁保留、runner→task→attempt顺序、maintenance与revoke差别、嵌套goal/protocol和016插入触发器无升级。核真实专用PG双事务交错/同attempt串行、owner/lease/revoke保护、claim容量与安全清理证据，实际选择/通过数与类型边界；不默认运行测试/PG/窗口。给severity/精确路径/触发序列/阻断/最小修法，修复交唯一owner；批准只覆盖固定target，不覆盖>100容量、SLO或完整未知恢复。
