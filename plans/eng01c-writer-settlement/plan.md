# ENG01C 工程写入停止合同

状态：completed。所属大task：[ENG-001](../../../engineering-delivery/plans/eng01-engineering-delivery/plan.md)；co-lead Execution Lead；owner native_center_owner / gpt-6-astra。固定base648e331c58043cf7ee307300521ab1c628cb2ee1，独立branch codex/engineering-writer-settlement。遵循[模块规则](../../AGENTS.md#modular-design)。

目标：在现受信fixture工程路径中，将写入结果与写入停止分开；只有明确stopped可进入检查或释放workspace。复用唯一工程adapter/工作区/checker/runtime/outbox。旧v1配置与receipt JSON/hash保持，不实现native provider、公共v2或模型预算。

- [x] **ENG01C-01** 独立claim、最小Interface与技能/限制记录。
- [x] **ENG01C-02** typed writer settlement与现fixture/直接消费者适配，异常保守unknown。
- [x] **ENG01C-03** 必要局部与真实PG恢复验证，固定原raw/manifest。
- [x] **ENG01C-04** 独立review、受控main接收、原子release。

范围为status列明8个literal；workspace.test.ts为Lead批准的直接消费者追加。Native B/C身份与checker隔离缺口明确在[Interface](../../docs/evidence/eng01c/interface.md)，不因后继扩大本片。

本片已独审并main53ce2ec2接收；后继native能力不包含在本片完成结论内。
