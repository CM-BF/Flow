# ENG01D 真实身份与单Codex回合接缝

状态：in-progress；owner native_center_owner / gpt-6-astra；co-lead Execution Lead。所属大task：[ENG-001](../../../engineering-delivery/plans/eng01-engineering-delivery/plan.md)。base固定53ce2ec2c95b489aa7a2a2eaa49849821af00c16，独立WT engineering-native-seams / codex/engineering-native-seams。遵循[模块规则](../../AGENTS.md#modular-design)。

只实现现宿主assignment只读身份与现普通Codex单回合的保持行为提取；不实现工程模型写入、host-applied替代验收、文件工具、公共v2或生产factory。不占server runners.ts，不修改Mika诊断。

- [x] **ENG01D-01** fresh claim、Interface、技能与限制固定。
- [ ] **ENG01D-02** runtime只读身份及其局部实际HTTP/多attempt验证。
- [ ] **ENG01D-03** 单turn提取、旧普通Codex直接消费者及types验证。
- [ ] **ENG01D-04** 原raw/manifest、独审、main接收与release。
