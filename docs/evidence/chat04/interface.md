# CHAT04 Interface — v1已实现；v2草案待Lead接线核定

从 `packages/contracts/src/conversation-queue.ts` 导出 DTO/schema；公共 barrel/client 由 Lead 接线。现有 `ConversationSummary.revision` 继续仅指 turn admission CAS；queueRevision 从 queue response 独立读取。

| 方法 | 路径 | 输入 / 返回 |
| --- | --- | --- |
| POST | /api/conversations/:id/queue | {expectedQueueRevision,text} / 202 ConversationQueueAccepted |
| GET | /api/conversations/:id/queue?after=0&limit=20 | ConversationQueuePage，after 是稳定 sequence；上限50 |
| GET | /api/conversations/:id/queue/:itemId | ConversationQueueItemDetail，包括有界全文 |
| POST | /api/conversations/:id/queue/:itemId/cancel | {expectedQueueRevision} / ConversationQueueCancelled |

两个 command 必须 Idempotency-Key，沿现有 command digest/replay；响应重放保持原 queueRevision/item，replayed=true。GET 读取最新状态，避免把旧 ACK 当当前事实。cancel-promotion 同 conversation 锁竞争；已 promoted 的 cancel 返回 already-promoted 和 task/turn 引用，不撤回。

list 仅返回当前 waiting（含 blocked），terminal 从 readItem 查询；after 是分页游标，不是变更 feed，queueRevision 变化应从头读取。cancel 对 waiting 执行 expectedQueueRevision CAS；已 terminal 时返回 already-cancelled/already-promoted 和当前事实，不再变更，故可处理 promotion 获锁在先的过期 revision。列表 preview UTF-8 ≤512 bytes，全文 ≤16000 bytes，最多100 waiting。list/readItem.blocked 为当前 conversation 共用门禁（每次读取只算一次），不是为每个 item 重复查询，也不是永久写死错误。空 conversation 首项可提升，存在前轮仅 succeeded + known session + 有效 pin 可提升。failed/cancelled/uncertain 显示冻结原因。未提供 steer/edit/reorder/resume 接口。

`apps/server/src/conversation-queue/index.ts`：

- await migrateConversationQueue(pool)：在 migration7/10 后执行；011 使用既有 migration advisory lock。
- registerConversationQueueRoutes(app,pool,boss)：在 app ready/listen 前；复用中心 owner authentication 和 HttpError handler。
- await promoteReady(pool,boss,conversationId)：一次最多提升一项，返回 promoted / blocked / empty。
- await scanConversationQueue(pool,boss,limit=20)：limit 1..100，返回 inspected/promoted/blocked/errors；PG queue_checked_at 公平轮转，变化不递增 queueRevision。失败只报 promotion_failed、保留事实、继续其他 candidate。

Lead 在生产 index 的迁移链加入 migrate，在路由链加入 register，定时 sweep await scan，避免同实例 overlap，onClose await in-flight（沿原生命周期）。本 owner 不写 index/scheduler/exports/client。最早接口提交 e423abb 的显式 stub 已在 77168ccabfe5aaf6c11f7d3a7b2aa8168aab5310 实现。模块真实 PG/HTTP 验证通过；生产 index/client 接线仍由 Lead 完成并另验。

当前自动提升依据实际 task terminal state。Stop 与 success 竞态的产品表述正由 Goal Owner 锁定；本模块没有暂停队列/停止全部的额外意图接口，不将 succeeded 推断为用户从未发出停止请求。

## 2026-10-06 04:34:22 UTC v2 补充（已固定签名，controls暂为显式stub）

- POST /api/conversations/:id/queue/pause，body {expectedQueueRevision}，response {conversationId,queueRevision,paused:true,currentTurn,replayed}。已paused仍严格CAS，可no-op不增revision。
- POST /api/conversations/:id/queue/resume，body {expectedQueueRevision,expectedTaskId:string|null}，response {conversationId,queueRevision,paused:false,currentTurn,promoted:ConversationQueueItem|null,replayed}。resume原子提升最多首waiting并清pause，只增queueRevision一次；无waiting同门禁unpause，不预授权未来auto。
- currentTurn={taskId,taskStatus,turnId,turnNumber,queueItemId:string|null}|null；list/detail也带paused/currentTurn。
- resume仅已终态成功/失败/取消且known空闲session、runner未撤销、pin有效；active/uncertain/unknown拒绝；初次空conversation/null例外。自动提升仍仅succeeded。
- pause成功后再发当前task原cancel；promotion先于pause时回真实已提升引用。命令ACK重放是历史receipt；UI先GET确认事实。普通follow-up paused=409；enqueue/cancel不清pause。
- 011新增queue_paused，禁止许可marker；register需要boss供resume复用现有原子task/wake路径，技术签名已锁定为 registerConversationQueueRoutes(app,pool,boss)，生产接线由Lead。

旧v1源码与37项检查不表示此v2合同已实施。
