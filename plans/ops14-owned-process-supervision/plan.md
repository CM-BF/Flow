# OPS14 — 自有进程监督

状态：in-progress
创建 / 更新：2026-10-06
所属大task：[OPS-001](../../../plan-status-review/plans/ops-001-status-review/plan.md)；co-lead：Execution Lead。

目标是供两个现有 Python 外层 operator 共用启动、有限输出、期限与停止报告，减少阻塞日志导致监督失效的接缝。遵循[唯一设计规则](../../AGENTS.md#modular-design)及[权威方向](../../../plan-status-review/docs/quality/operator-supervision-next.md)。本片不迁移正在冻结的 SVC05H / SVC07 包装器，不改变 O16 / F04，不操作个人服务。

- [x] OPS14-01 固定 claim 与小 Interface。
- [ ] OPS14-02 标准库实现及两种原调用形状的受控故障验证。
- [ ] OPS14-03 固定证据、独立审查与 main 接收。
- [ ] OPS14-04 双方 owner 移交后迁移两个真实消费者并验证。

接口、输入输出、资源/错误和责任分工见[Interface](../../docs/evidence/ops14/interface.md)。只接受本次自己 spawn 的 child，不接受外部 PID。数据库、连接观察、resource ownership、source binding、许可与持久证据是调用方职责。有限过程组并非任意后代隔离；已 detached 的服务不在 signal 范围。

局部验证仅 Python 标准库受控子进程；0 PG / Chrome / provider。fresh 1 GiB + 4 MiB，私有临时 ≤1 MiB、局部检查 ≤15 秒。先按精确接口验证正常、超量、挂起报告、退出后继承 pipe、未知观察与次生错误；不得用测试通过宣称两生产调用方已迁移。
