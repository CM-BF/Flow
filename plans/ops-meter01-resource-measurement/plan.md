# OPS-METER01 — 目录资源计量

- 创建/更新：2026-10-07；状态：in-progress。
- 所属大task：[OPS-001](../../../plan-status-review/plans/ops-001-status-review/plan.md)；co-lead：Execution Lead。
- 本片已授权：标准库Python小模块，三个literal范围；不复制监督器或写Web caller。

目标是让既有资源采样以明确口径测目录，精确排除子树并把消失与不可观察分开。[Interface](../../docs/evidence/ops-meter01/interface.md)固定输入/输出、生命期、限额和未知边界；遵循[统一模块设计规则](../../AGENTS.md#modular-design)。

## TODO

- [x] OPS-METER01-01：实际两caller、独立source供给、fresh atomic take及小Interface。
- [x] OPS-METER01-02：标准库模块与有界目录/错误直接验证，保留失败原件。
- [x] OPS-METER01-03：固定源码/证据交独立review并受控main接收。
- [ ] OPS-METER01-04：两个Web原owner的新caller版本接入；本片仅接口交接，未接不勾完成。

未推进：进程/DB/文件删除、权限或source身份、cache恢复、个人服务、安装、PG/Chrome/provider。计量不是atomic snapshot/峰值/可回收物理空间。新增caller只依赖小measure接口，资源策略保持caller所有。
