# O03 目标工具中心授权

状态：in-progress；创建/更新：2026-10-06。父产品目标 U11/O01；本任务是 O02 后继中心授权工程片段。

Owner 创建独立 planner task 与不可变 grant，runner 使用当前 attempt 的 fenced HTTP 接口访问固定 goal；不把 owner credential 交 runner/model/plugin。所有命令包括 replay 必须同事务重新授权。自然语言/query 挂载、自动拆图仍未实现；首片 fixture 可验证真实事务，所有 Claude/native admission 明确拒绝，直到新的显式 profile seam 可用。

- [x] O03-01 独立 claim、公共合同与锁序/复用 seam 固定。
- [ ] O03-02 持久 grant、owner 受理/撤销、有界 audit、runner 原子准入。
- [ ] O03-03 真实 HTTP/PG 验证授权/拒绝、撤销/取消/replay race 与重启。
- [ ] O03-04 clean-code、原始证据、固定 target 交独立 review。

验收：角色分离、跨 runner/goal/node 拒绝、过期/旧 owner/completed/cancel 拒绝、版本冲突、grant scope 不可改、maxCommands 有界、重报不重复扣额度、同 key 不同参数冲突、审计绑定真实 attempt/版本。错误不回显凭据；独立 DB/动态端口/0模型。新 planner task 由本模块 acceptTask 创建，不接受 existing taskId，因此不会混同其授权 child execution task。

[状态](status.md)、[审查](review.md)、[设计/质量](../../docs/evidence/o03/design.md)。共享 helper 由 Lead 提供，禁止复制现有 goal mutation 或嵌套事务。
