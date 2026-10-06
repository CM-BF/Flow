# CHAT04 Interface v1 — 接线合同，尚未实现完成

从 `packages/contracts/src/conversation-queue.ts` 导出 DTO/schema；公共 barrel/client 由 Lead 接线。现有 `ConversationSummary.revision` 继续仅指 turn admission CAS；queueRevision 从 queue response 独立读取。

| 方法 | 路径 | 输入 / 返回 |
| --- | --- | --- |
| POST | /api/conversations/:id/queue | {expectedQueueRevision,text} / 202 ConversationQueueAccepted |
| GET | /api/conversations/:id/queue?after=0&limit=20 | ConversationQueuePage，after 是稳定 sequence；上限50 |
| GET | /api/conversations/:id/queue/:itemId | ConversationQueueItemDetail，包括有界全文 |
| POST | /api/conversations/:id/queue/:itemId/cancel | {expectedQueueRevision} / ConversationQueueCancelled |

两个 command 必须 Idempotency-Key，沿现有 command digest/replay；响应重放保持原 queueRevision/item，replayed=true。GET 读取最新状态，避免把旧 ACK 当当前事实。cancel-promotion 同 conversation 锁竞争；已 promoted 的 cancel 返回 already-promoted 和 task/turn 引用，不撤回。

列表 preview UTF-8 ≤512 bytes，全文 ≤16000 bytes，最多100 waiting。list/readItem.blocked 为当前 conversation 共用门禁（每次读取只算一次），不是为每个 item 重复查询，也不是永久写死错误。空 conversation 首项可提升，存在前轮仅 succeeded + known session + 有效 pin 可提升。failed/cancelled/uncertain 显示冻结原因。未提供 steer/edit/reorder/resume 接口。

`apps/server/src/conversation-queue/index.ts`：

- await migrateConversationQueue(pool)：在 migration7/10 后执行；011 使用既有 migration advisory lock。
- registerConversationQueueRoutes(app,pool)：在 app ready/listen 前；复用中心 owner authentication 和 HttpError handler。
- await promoteReady(pool,boss,conversationId)：一次最多提升一项，返回 promoted / blocked / empty。
- await scanConversationQueue(pool,boss,limit=20)：limit 1..100，返回 inspected/promoted/blocked/errors；PG queue_checked_at 公平轮转，变化不递增 queueRevision。失败只报 promotion_failed、保留事实、继续其他 candidate。

Lead 在生产 index 的迁移链加入 migrate，在路由链加入 register，定时 sweep await scan，避免同实例 overlap，onClose await in-flight（沿原生命周期）。本 owner 不写 index/scheduler/exports/client。当前首 commit 的 command/reads/promotion 是显式未实现 stub，测试正确 red；只固定接线签名，勿将其当可用生产功能。后续实现保持上述 Interface。
