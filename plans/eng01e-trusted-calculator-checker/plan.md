# ENG01E 受信 calculator 检查边界

状态：in-progress；owner native_center_owner / gpt-6-astra；co-lead Execution Lead。所属大task：[ENG-001](../../../engineering-delivery/plans/eng01-engineering-delivery/plan.md)。固定base 2c6df4754f4fea75fbb2e1e750cad89524b1f5fa，WT engineering-native-checker / codex/engineering-native-checker。遵循[模块规则](../../AGENTS.md#modular-design)。

两个纯模块：有限完整语法门返回算术表示；host解释并独占固定断言/报告，绑定host冻结内容与完整文件集合。只证明受限recipe，不执行模型JS或信stdout，不伪造writer停止，不改变旧fixture/v1/profile/runtime。详见[Interface](../../docs/evidence/eng01e/interface.md)。0provider，真实文件writer后继保持开放。

- [x] **ENG01E-01** fresh claim、技能、固定小Interface。
- [x] **ENG01E-02** 有界完整语法与攻击/未知拒绝用例。
- [x] **ENG01E-03** 完整内容集/版本绑定与host固定断言检查、类型验证。
- [ ] **ENG01E-04** 原raw/manifest、独审、main接收与release。
