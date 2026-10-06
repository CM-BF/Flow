# ACTIVITY01 Interface

固定基线3d4985。`createConversationActivity(scope, task, port)`返回projection，scope冻结connectionId/viewId/conversationId/turnId/taskId。`port.readEvents(after):Promise<EventPage>`由宿主绑定 `client.events(taskId,after)`；`port.readDetail(id,signal):Promise<Detail>`绑定 `client.conversationDetail(conversationId,turnId,id,signal)`。不传client/token给视图，不使用全局detail弱绑定路径。

projection：getSnapshot/subscribe/updateTask/setActive/setOnline/refresh/loadMore/loadDetail/dispose。TaskSummary来自host动态输入；events.task仅验证身份/记录读取水位，不能倒写宿主。active展开才首次读；refresh与loadMore串行，cursor/reset明确；no polling/SSE。缓存随scope lifetime，dispose必须由host跨connection/turn切换执行；相同ID新中心必须新实例。hidden取消detail信号并忽略不可abort的events迟到，下一展开可显式刷新，0自动detail。

`ConversationActivity`是内容视图，不添加第二个折叠入口，props接受projection；宿主动态updateTask、setActive/setOnline并负责外层single折叠及真实消息→turn。独立fixture演示外层宿主而不改产品Thread。后继接线必须always-visible message footer，不能依赖hideWhenRunning的ActionBar。

当前仅通用TimelineEntry text/reference。参考id/title不说明tool/thinking种类；CHAT05初稿ae4cc5c仅研究无publicclient消费。详情1MiB公共上限，正文视图分页显示并明确剩余，不注入HTML、不预加载详情。
