# R05C Codex 普通任务 adapter

- 计划编号 / 状态：R05C / in-progress
- 所属大task：[FLOW-002](../flow-002-provider-harness/plan.md)；co-lead：Execution Lead
- Owner：native_center_owner / gpt-6-astra
- Worktree：/Users/citrine/Projects/AgentHarness/Flow-worktrees/codex-native-adapter
- Branch：codex/codex-native-adapter；base：3418fe682944145494463dca9e09f89c8b9c2295

目标：复用已审宿主与R06 transport，完成注入真实JSONL peer到公开HTTP/PG普通final的纵向路径；不启动真实Codex、auth或provider。遵循[模块化规则](../../AGENTS.md#modular-design)。

## TODO

- [x] **R05C-01** 固定来源、scope、Interface与claim。
- [x] **R05C-02** C0明确settled/unknown错误合同，复用宿主既有lost/admission/outbox路径并独审。
- [x] **R05C-03** C1 factory/普通final/逐项deny与JSONL peer纵向PG验证；共享projection与Mika协调单源。
- [ ] **R05C-04** 固定manifest、独审、必要直接消费者检查及受控main集成。

范围以[claim](../../docs/evidence/r05c/claim.json)的11项literal为准。R06目录、runner configuration/main、中心、client/export、UI不在本owner范围；公共接缝由Lead处理。stream/resume/steer/goal/context unsupported。native实际conformance与模型预算另行定义。

C0先独立可审提交；C1可先准备不依赖C0的映射/peer，未经独审不提前集成。普通异常保持原失败语义；已发送外部执行只有本地子进程退出时仍可能unknown，禁止伪装已停。

最近更新：2026-10-06 09:51:14 UTC。C0与projection独审已main；C1固定7127b5bfda3135670e1595dd4b6e90c4c9ea416c，95项不同检查有通过证据、tsc0，等待独审。真实provider能力不在本片验收。
