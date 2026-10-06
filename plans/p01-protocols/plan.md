# P01 协议接入

状态in-progress；创建/更新2026-10-06；owner assignment_review / gpt-6-astra。
Worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/protocol-adapters`，branch `codex/protocol-adapters`，base `e845eb069c594989117fadf380335650efef27a2`。

目标：按固定官方规范实现A2A双向HTTP客户端与Flow server bridge，MCP client的发现/逐请求能力/tools/resources/prompts/取消/错误及Tasks能力检测/明确不支持边界。Flow保持权威状态，身份/取消/验证语义不由协议流覆盖。写入范围packages/protocols、必要的apps/protocol-gateway、本计划、docs/architecture/p01-protocols.md和docs/evidence/p01；共享契约/client/rootlock由Lead单写。

## TODO

- [x] **P01-01** 核实规范/技能，记录固定版本、Interface、能力与限制矩阵
- [x] **P01-02** 复用官方SDK实现有界HTTP/JSON-RPC/SSE与A2A client，验证重连快照、错误与不确定投递
- [x] **P01-03** 实现A2A→Flow持久bridge，任务/人工决策/取消/产物/进度映射及真实PG重启证据
- [x] **P01-04** 实现MCP2026 client发现、能力、tools/resources/prompts/elicitation和Tasks能力检测/明确不支持边界，真实HTTP固定fixtures验证
- [x] **P01-05** 类型/针对测试、clean-code、证据与提交，独立review和main集成分开

## 已确认与限制

0模型/0云，独立动态端口与flow_p01。A2A固定1.0.0规范，wire major.minor 1.0；不以messageId推断远端幂等，ACK丢失保留uncertain并要求查权威状态。MCP固定2026-07-28，不以旧initialize或旧tasks实验API冒充兼容。Tasks扩展目前只检测且不advertise；兼容SDK缺口明确记录，尚未实现，不把cancel空ACK当停止。没有跨协议持久外部binding时只交付真实客户端能力，不宣称中心已经调度外部agent。

## 验证

TDD在已授权的公开HTTP/FlowClient Interface验证，先失败后实现逐片推进；真实HTTP fixtures固定为官方版本，加入失败/重复/取消/断流/版本/能力/大响应负例。适配不直接读写中心表。设计与能力矩阵见[架构](../../docs/architecture/p01-protocols.md)，状态见[status](status.md)，独立[review](review.md)初始未执行。

- [ ] **P01-06** 后续必须验收： 外部agent持久binding、runner执行/恢复/人工等待、预算与ownership，接入业务决策；当前库阶段不替代完整协议接入。Tasks全路待兼容SDK/有界shim另行实现与互操作验证，当前明确不支持。
