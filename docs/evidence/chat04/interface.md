# CHAT04 Interface v2 — 合同已锁定，模块已实现

DTO/schema 位于 `packages/contracts/src/conversation-queue.ts`。公共 exports/client、生产迁移/route/scan 生命周期和真实 Web 接线由相应 owner 完成，模块通过不替代集成验收。

| 方法 | 路径 | 输入 / 返回 |
| --- | --- | --- |
| POST | /api/conversations/:id/queue | {expectedQueueRevision,text} / 202 ConversationQueueAccepted |
| GET | /api/conversations/:id/queue?after=0&limit=20 | ConversationQueuePage，after 是 sequence；页上限50 |
| GET | /api/conversations/:id/queue/:itemId | ConversationQueueItemDetail，包括有界全文 |
| POST | /api/conversations/:id/queue/:itemId/cancel | {expectedQueueRevision} / 200 ConversationQueueCancelled |
| POST | /api/conversations/:id/queue/pause | {expectedQueueRevision} / 200 ConversationQueuePaused |
| POST | /api/conversations/:id/queue/resume | {expectedQueueRevision,expectedTaskId:string|null} / 202 ConversationQueueResumed |

四个 command 都必须 Idempotency-Key，沿用现有 digest/replay。重复相同 key/payload 返回原 receipt（replayed=true），旧 paused/state/currentTurn 不表示最新事实；GET 返回最新事实。不同 payload 同 key 409。

queueRevision 独立于 conversation.revision；前者表示队列/暂停命令与提升，后者仍只表示已受理turn。enqueue/cancel/promote/pause/resume 不得借一个 revision 当另一个 CAS。scan 检查时间不增加 queueRevision。

list 仅 waiting（含blocked）；terminal从readItem查。after只是分页游标，不是change feed；queueRevision变化应从头读取。pending≤100，全文UTF-8≤16000B，preview≤512B；SQL仅传前缀和截断标记，detail才传全文。每次list共用一次conversation门禁，不逐item查session/profile。

list/detail带 `paused:boolean`、`currentTurn:{taskId,taskStatus,turnId,turnNumber,queueItemId:string|null}|null`、`blocked`。currentTurn是最新真实turn/任务状态，可能已terminal，不承诺正在执行。queueItemId按unique turn_id取得；非来自queue时明确null。空队列也先判断paused，返回queue-paused。

pause与promotion同conversation→task锁。严格 expectedQueueRevision，若promotion先则409，UI读取最新revision/turn后用新key重试；不能假ACK。已paused仍严格CAS，但no-op不加revision。成功暂停的事务commit之后不再自动提升；此前已提升任务如实返回，不声称撤销或stop-all。UI先获得pause ACK，再对当前任务发既有cancel；迟到success不解除暂停。

resume严格queue CAS和最新taskId身份（无turn时null）。已有turn必须succeeded/failed/cancelled、known且空闲的session、runner未撤销、pin有效；active/uncertain/unknown拒绝。从未有turn时允许初次任务。首waiting与task/wake/turn/item在同事务直接提升并清pause，一次递增queueRevision；无waiting也可在同门禁下解除暂停，不预授权未来自动继续。auto始终仅succeeded；新的failed/cancelled仍要求新的用户resume。无授权marker。

普通follow-up在paused或有waiting时409；enqueue/cancel保持paused。cancel等待项执行CAS；already-promoted/already-cancelled是无变更的当前事实响应，可返回task引用，不假称撤回。未提供steer/edit/reorder或绕过uncertain的恢复。

`apps/server/src/conversation-queue/index.ts`：

- `await migrateConversationQueue(pool)`：在7/10后执行011。Lead已确认旧011未部署常驻库，允许本次直接加入queue_paused。
- `registerConversationQueueRoutes(app,pool,boss)`：唯一v2签名，ready/listen前调用，复用中心owner authentication/HttpError。
- `await promoteReady(pool,boss,conversationId)`：一次最多提升首waiting；promoted/blocked/empty。
- `await scanConversationQueue(pool,boss,limit=20)`：limit1..100，PG queue_checked_at公平轮转；单项失败errors，不伪装成功，也不饿死其他ready。Lead应避免本实例overlap并在onClose await in-flight。

锁序保持conversation→task；runner层已有runner→task，故队列新增runner未撤销检查只普通SELECT、不反序锁runner，最终执行仍由既有claim fence控制。四command在失败时回滚所有自身变化。
