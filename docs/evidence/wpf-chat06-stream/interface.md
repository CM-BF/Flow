# 消费接缝

三个模块：patches.ts集中公共wire校验与原子patch累计，projection.ts封装current metadata/增量请求与生命周期，messages.ts纯适配既有ThreadMessageLike，不安装runtime adapter或换用会合并相邻assistant的converter。

拟导出 createConversationStreamProjection(scope, ports)；scope包含connectionId/viewId/conversationId/turnId/taskId。ports为私有绑定的readMetadata({after?,limit},signal)与readPatches({attemptId,after,limit},signal)，宿主保持FlowClient/token并每次核当前turn/task成员。模块不提供全client或任意URL接口，不读full block/detail。

updateHost({turn,capability,protocol,visible,online,finalContent?})；getSnapshot/subscribe/invalidate/refresh/dispose。capability true与protocol patch-v1缺一则零读取。host的轻量task/turn水位或现有推送触发invalidate，不用conversation CAS revision作为唯一水位；无每消息轮询/SSE。可见读取单flight，分页有界，hasMore分批续读；错误后有界退避并允许显式重试。隐藏/离线Abort+generation，connection切换dispose整模块，旧命令/响应不能复活。

正文只从metadata确认的attempt/stream身份和校验过的patch构成。runner sequence可跳跃，block revision/fromBytes精确连续；空terminal patch更新状态。每patch8KiB、attempt1MiB，256blocks/4096patches；原子页失败不部分覆盖。最终typed assistant-final由宿主既有turn传入；truncated时只有宿主已有按需完整finalContent才允许替换，模块绝不自动抓detail。验证UTF8 digest/身份后，再按完整显式settlement的replace/retain分区原子替换，unavailable不猜。最终消息只出现一次，保留user和早期block独立ID。

本接口用于后继正式App消费者；未接App不宣称实时聊天已上线。接线需ActivityI正式handoff，关闭/切连接卸载整个模块；最多可见pane的宿主预算不另扩。
