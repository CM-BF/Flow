# O05 有界目标图提案

编号O05；状态in-progress；创建2026-10-06。父产品需求U11/O01，当前仅owner受理/持久提案与原子apply，不把工程片段当自然语言拆图。

- [ ] O05-01 固定合同、来源/actor、独立claim与同事务G01接缝。
- [ ] O05-02 持久有界提案、轻列表/按需正文、原子apply与不可变receipt。
- [ ] O05-03 真实PG/HTTP验证重启、CAS/无环/额度/幂等/并发及旧grant拒绝。
- [ ] O05-04 clean-code、固定原始证据、独立审查交付。

批准范围：仅新增节点及其依赖，1..16节点/至多128边/编码64KiB，全图仍受G01 200节点/2000边限制。不删除/改旧节点，不执行task或写GoalInput，不扩旧grant。apply事务复用G01小helper，旧command外壳保持。

0模型/云，无Web App/runner/sharedclient/rootlock修改。下一次1query/4turns/SDK$.20/90s只是待批提案，前置O04+O05固定main独审/config；失败不补次，不挪封存预算。本任务只准备，未获执行授权。

[状态](status.md)、[审查](review.md)、[设计/质量](../../docs/evidence/o05/design.md)。
