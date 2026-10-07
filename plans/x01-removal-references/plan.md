# X01-REMOVAL-REFERENCES01

所属大task：[X01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/plans/x01-plugin-management/plan.md)。co-lead Mika；owner architecture_read / gpt-6-astra。2026-10-07，accepted/in-progress。

目标：让 owner 按登记与精确材料查询卸载阻塞引用，区分 active/uncertain/historical。仅观察，不授物理删除，不调用宿主、不删除数据、不改变原 X01-02/03/04/06/10 未完成验收。

- [ ] REMOVE-01 有界合同与中心只读入口、直接行为/类型。
- [ ] REMOVE-02 专库真实 SQL/owner HTTP 准备、独立审查；实际 PG 另窗。
- [ ] REMOVE-03 审后 HOST 前置窄集成与必要组合检查。

Interface 及资源见 [设计](../../docs/evidence/x01-removal-references/interface.md)。基线 a4ebb279 为已审 HOST 后像，非 main；窄接收必须先/同批接 HOST，不覆盖 client/Web。引用状态复用 task/未完成 attempt，历史来源仍由 binding/artifact/audit 读取。session/compression 尚无对应插件引用模型，本片明确仅 tool-task 引用，不假称已覆盖未来类型。
