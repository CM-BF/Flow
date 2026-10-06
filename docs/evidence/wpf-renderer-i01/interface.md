# 实际App接线Interface

`plugin-integration/react.tsx`导出 `ConversationDataRenderers({ viewId, projection, visible, children })`，置于现有AssistantRuntimeProvider内。App在group.tabs处传 `!overview && pageVisible && group.activeId===id`，经ChatPane/ConversationThread转交；不用全局焦点判权限，两个split当前pane皆可读。现有native hidden和会话cache策略保留。

`data-renderers.ts`导出 `createConversationReplyBindings(session, viewId, projection)` 与P01定义工厂。session窄口只有id、signal、canReadReply；没有client/token。bind须本projection完整conversation/message/turn/task/detailKey匹配，再检查现session的view/message授权。每display lease捕获signal，hide后即使resume，旧port仍失效。快照只映射projection已有details，以原detail对象稳定引用；不复制正文存储、不制造新授权。

React桥的ready绑定当前bindings对象，layout effect确认可见后才注册；单一provider精确cleanup，不全局停P01。稳定ReplyBindingsProvider保存纯展开态；hide/show保留cache且不自动detail读。单纯隐藏不abort原projection HTTP，同连接同identity缓存可以完成；close移除桥令lease失效，App保留原conversation缓存。Session dispose同步closed/abort/registry.dispose后再await host清理；新连接拥有全新session/projection。

内建`flow.reply-detail`走既有P01 register/load/activate/disable。有实际truncated reply且registered时激活；disabled/failed不会因重新显示自动激活，用户从既有Extensions控制恢复。旧`makeAssistantDataUI`注册删除，避免同名first-wins。停用仍走已审模块的host-authorized fallback，正文一直由官方Thread渲染。

ConversationThread模块级纯identity converter是本片小清码；不memo整个adapter，发送闭包/queue intent/门禁实时更新，真实turns/history/isRunning变化照常转换。

后继ACTIVITY应在本片停写/转交后领取同ConversationThread及官方Thread footer；本片无MessageFooter改动，不能把模块Activity测试称当前App页签实现。
