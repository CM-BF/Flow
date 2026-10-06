# CONTEXT02 receipt interface

Fixed implementation `5e8213a564bd76e58feddb0c6470faa74bae1d66` / base `fc113945ff73d1a43092d0a70b51e901aa4be1e2`。此片为纯接收模块，实际 App/Send/Queue UI 未接知识引用。

## Export 与调用

`apps/web/src/conversation-context/receipts.ts`：

```ts
freezeKnowledgeRequest<T extends object>(request: T & { knowledge?: readonly FrozenCitation[] }, projectId?: string): Readonly<T>
assertContextReceiptMatches(knowledge: readonly FrozenCitation[] | undefined, context: unknown): void
```

freeze helper 接受已经公共 request schema.parse 的输入：克隆 request，复用 `selection.freezeContextSelection` 克隆并冻结每条 citation/locator、数组和顶层。未传 knowledge 不添字段；显式 `[]` 保留且冻结。为了直接交给当前 mutable DTO 类型的薄 client，存储类型不强行改公共 DTO 的 readonly 定义，但运行时全部引用层均冻结。它不冻结无关任意嵌套字段。

可选 projectId 是调用者给出的项目约束。缺省只用首 citation 建立列表内部同项目一致性，**不是会话授权**。已建会话的 project/capability/connection 校验由后继宿主完成。本片 Outbox 在新建且非空引用时要求冻结 creation.projectId，并校对引用；其他创建行为不变。

`OutgoingConversationTurn.knowledge?: readonly FrozenCitation[]`、QueueCommand enqueue input 的同字段可接受已冻结选择。两调用者先 schema.parse 再 freeze；schema 的副本不能绕开深冻结。未知回执重试保留同一 request / creation / 原 key；引用变动只进入下一次显式提交，不覆盖发送中/unknown receipt。

## ACK 核对

Guard 是额外条件，调用者仍先校验会话/turn/queue/item/revision/text 身份。它逐项比较完整有序 tuple：projectId、sourceId、version、contentDigest、locator.kind/start/end。来源数必须完全相等；缺失、增加、错序、任一 tuple 变化均抛普通 Error，使现 QueueCommands 保留 unknown 原请求。

还校验 context id / executionInputId 符合公共 idSchema、两 digest 为 64 位小写 hex、templateVersion=1；每 source.byteLength 等于 locator span，currentVersionAtFreeze 为 1–16 且不早于所选 version，isCurrentAtFreeze 与该次 freeze 版本事实相符。可以接受当时已过时的固定版本，不能自动升级引用。这里只核公共元数据一致性；没有 source text，不计算 source/version/context/execution digest，更不把摘要存在当内容验证。

零引用兼容：省略 knowledge / `[]` 接受无 context，或结构合法且 sources=[] 的 metadata；拒绝附加非空来源与 null/malformed metadata。依据：固定公共 `ConversationContextReference.sources` 类型允许空数组，原 `conversation-queue.test.ts` 已有空 metadata replay 兼容案例；固定中心 `apps/server/src/conversation-context/store.ts` 的 freezeContext 对零引用直接返回 null，所以空 metadata 兼容不声称中心会主动生成空 context。

Queue 已在 receiptMessage 的现 identity/text 检查后实际调用 guard。**Send 尚未调用**：后继 `conversations/projection.ts` dispatch 在验证 accepted turn 后、应用 snapshot / outbox.accept 前应调用：

```ts
assertContextReceiptMatches(entry.request.knowledge, accepted.turn.context);
```

这不改变旧 receipt replay 与最新 GET turn 的优先级；helper 无网络或状态副作用。

## 后继消费者仍需实施

- `conversations/projection.send` 与 `queue/projection.enqueue` 仍只接 text；须显式传同一冻结 refs，并在已绑定项目/能力可用时送出。
- 项目显式选择、create-only prepare、P01 唯一 host 授权、App/Thread UI 均不在本片。不能从首项目/API存在推 knowledgeContext=true；旧中心纯文本仍可用。
- CREATE sending/unknown 后冻结 project/profile，与唯一 creation key 共享恢复，不发占位 turn。新增项目不能改变已有会话。
- 中心还有整体 execution 输入 16000 UTF-16 units / 49152 UTF-8 bytes 预算；拒绝保留 text/refs，不能截断、丢引用或自动新 key 重发。前端无法从 metadata 预先精算执行 prompt。
- 新草稿/新选择与旧 receipt 独立。core0.3.22 的异步 MessageNotSentError 会 prepend 旧文本到新草稿；后继 UI 不盲用它处理异步预算拒绝，也不因旧 ACK 清新稿。
- 本片仅 4 引用/8192 locator bytes 预校验，UTF-8 codepoint 边界与 source/version/digest 是否真实存在由中心权威判断。
