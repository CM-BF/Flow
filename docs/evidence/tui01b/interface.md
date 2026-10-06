# TUI01B client Interface（首冻结）

原FlowClient createConversation/submitConversationTurn签名与HTTP路径/key/signal不变。模块文件 packages/client/src/conversation-acknowledgement.ts，均从@flow/client导出：

```ts
decodeConversationCreated(raw: unknown, frozenCreation: ConversationCreation): ConversationCreated;
decodeConversationTurnAccepted(raw: unknown, conversationId: string, frozenAdmission: ConversationTurnAdmission): ConversationTurnAccepted;
assertConversationCreationMatches(expected: ConversationCreation, actual: unknown): void;
assertConversationContextMatches(knowledge: readonly KnowledgeCitation[] | undefined, context: unknown): void;
UnknownConversationAcknowledgementError extends Error; // code='conversation_ack_unknown'; message不携raw数据
```

两decoder仅确认必要shape+稳定请求身份；返回原typed receipt，追加未知字段兼容。创建按schema canonical默认/trim语义核title/harness/requested/profile/project与revision0。turn核conversation绑定、revision与number=expectedRevision+1、原文逐字、task/telemetry与reply引用归属。合法返回revision上界2147483647（输入expected上界仍2147483646）。context包括有序完整citation tuple、digest、range、byteLength、freeze版本与标记，不读取知识原文。

FlowClient两POST同步序列化body一次，从发送body取得脱离调用者对象的校验输入。成功HTTP坏JSON/shape/identity抛专用unknown ACK；不清intent、不隐藏重试、不换key、不包装确定FlowApiError为成功。JSON/语义错误信息不含raw正文或token。网络/abort继续原unknown流程。

Web/TUI真实消费者仍拥有请求journal/outbox与epoch：只在decoder确认后清除恢复身份。Web保留capability显示限制、known turn冲突、GET/history/当前creation比对、旧ACK不回退新状态；这些策略不进client。既有Web creation/context exports可薄转调共享helper（供GET/queue复用），不移走冻结selection。TUI删除重复局部规则；409不会自动按新revision发消息，保留draft且恢复只读观察。

检验直接公开HTTP与controller，不起provider、不操作个人服务。Web接线/父TUI001-09完整验收由外部owner完成，当前领域不冒充已DRY两端上线。
