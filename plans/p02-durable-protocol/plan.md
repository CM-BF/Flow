# P02 持久外部协议调度

创建/更新2026-10-06；状态in-progress。Owner assignment_review / gpt-6-astra。继承P01-06的持久出站要求；SDK首段通过不替代此验收。

目标：A2A 1.0.0 Task-based远端的真实持久出站纵向闭环。中心保存prepared/sending/bound/uncertain intent与ownership；runner本地endpointRef配置含凭据，中心不保存token。官方SDK复用，不自写wire。

## TODO

- [ ] P02-01 固定domain/公开HTTP/runtime接口与状态不变量，接入共享基础
- [ ] P02-02 PostgreSQL持久intent与fence、一次发送许可、binding/uncertain/同runner有效租约恢复
- [ ] P02-03 独立protocol runner、单调租约deadline、远端取消与重启GET、artifact lowerstore/独立verifier
- [ ] P02-04 官方peer+真实PG+独立runner进程验证成功/重启/ACK窗口/过期ownership/实际取消/产物验证
- [ ] P02-05 clean-code、原始证据、固定target提交与独立review交付

范围：apps/server/src/protocol-dispatch、apps/runner/src/protocol-dispatch、packages/contracts/src/protocol-dispatch.ts、packages/storage/migrations/005-protocol-dispatch.sql、本计划、docs/evidence/p02、docs/architecture/p02-dispatch.md。shared indexes/client/main/enum/rootlock由Lead单写。0模型/0云，动态端口、专用flow_p02，无4320操作。

## 已确认设计与验收

Architectural子系统按已授权方案落盘实施。独立runProtocolRunner用于真正不同的远端取消/恢复语义，复用FlowClient/outbox/verifier。prepared→sending原子ownership fence，只有第一次响应有maySend；任何sending无remoteTaskId恢复均uncertain，不凭messageId重发。bound恢复先GET权威Task。过期/uncertain不能GET复活，使用C02人工安全核对。取消ACK不表示停止；只接受远端明确终态停止。

任务唯一status在[status](status.md)，独立review见[review](review.md)，设计见[架构](../../docs/architecture/p02-dispatch.md)。当前仅A2A Task-based纵向范围；MCP Tasks扩展、中心MCP elicitation、通用预算尚未通过，不会因本slice完成静默删除P01-06剩余要求。
