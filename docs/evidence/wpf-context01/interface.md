# CONTEXT01 Interface

固定输入 b54de1dbb08e3ccc7d33a27295a318f2799e76ae。四生产文件selection/controller/ContextPicker/css；无App接线。

`createContextSelection({binding:{connectionKey,viewId,projectId},port:{search(query,signal),resolve(citation,signal)},readiness})` 返回固定绑定实例；`getSnapshot/subscribe/search/add/remove/expand/freeze/setReadiness/dispose`。host更新visible/online/authorized/knowledgeContext，实例binding不可改；新的connection/view/project建立新实例，旧实例dispose。所有读需全部ready，冻结非空引用同样复核。空引用可用于无知识的普通聊天。hide/offline/revoke保留本地选择与已授权cache，清请求loading并abort/拒迟到；恢复不自动发请求。宿主决定是否销毁被撤授权的视图，不能以本地cache作为新的访问授权。

只存最新20搜索结果+4所选，正文最多8项×4096 bytes LRU。并发最大1search+2resolve；达到正文并发上限明确要求稍后再试，无后台队列。相同citation请求共享flight。引用由public schema克隆且嵌套冻结，完整tuple去重、顺序保留、4/8192前置预算。冻结结果独立于下一轮编辑。搜索不trim/NFC正文或locator，hasMore不是分页或总数。选中不resolve；展开原文严格核project/source/version/digest/locator和UTF8字节长度，contentDigest是整版本摘要，不宣称chunk SHA验证。HTTP fixture通过本树真实FlowClient包的窄adapter。

固定出处：contracts/knowledge.ts:4–8,19–21,35–46；conversation-context.ts:4–22；client/index.ts:145–152；server/conversation-context/store.ts:14–17,33–43。中心还校userText+冻结元数据执行输入≤16000 UTF16/49152 UTF8，前端引用预算不保证接受；拒绝保留draft/refs，不截断/丢引用自动重发。

后继需另领现consumers：conversations/projection.ts:232–268，outbox.ts:8–13/39–45，queue/projection.ts:99，queue/commands.ts:10–15/37–54。它们目前只传text；须传knowledge并在schema.parse后深冻结原request、unknown ACK原key/原refs重试、ACK context.sources完整tuple与顺序匹配。不得把本模块helper通过称作实际Send/Queue已发送上下文。既有薄context reader不修改。
