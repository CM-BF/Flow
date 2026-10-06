# WPF-ACTIVITY01：按需执行活动模块

创建/更新：2026-10-06；状态 completed；owner workspace_panels_owner / gpt-6-astra ultra。U11 / REQ43 已批准的首片，独立模块先交付，真实App接线由后继唯一Thread owner另领。

目标：从真实turn.task显示执行/验证状态，展开后读通用timeline，点击引用再读详情。single host拥有connection/view/conversation/turn/task身份与权限。没有CHAT05 typed client输入，不能按title推工具/思考/partial，也不能把活动text当assistant final。

基线固定3d4985fca060155435b159e0467815bf8e88b8b8。精确scope见status；不写App/Thread/旧conversation projection/selection/shared，不依赖K02/renderer/CHAT05。不新增依赖、模型或DB调用，不停止既有服务。

方案：独立projection接受冻结scope、host动态TaskSummary与两个bound readers。按active/online控制读取，显式分页/刷新，不开SSE/interval；列表/正文分页限制DOM规模，来源与loadedAt/stale明确。EventPage task身份/cursor/reset校验，旧events.task永不覆盖宿主状态。reset清旧游标与缓存重建，异常/倒退cursor报错不循环。reference二次读取必须是当前scope已读成员，detail有AbortSignal；旧client.events没有signal，隐藏仅忽略迟到且停止新请求，不能声称底层HTTP已取消。MAX_DETAIL_BYTES是1MiB，视图分页不是服务端64KiB限制。

## TODO

- [x] WPF-ACTIVITY01-01：领取、技能和固定接口设计。
- [x] WPF-ACTIVITY01-02：独立读取/缓存/身份生命周期与直接行为测试。
- [x] WPF-ACTIVITY01-03：通用活动视图、独立HTTPfixture、键盘/双主题390/边界验证。
- [x] WPF-ACTIVITY01-04：clean-code、固定目标独立review、聚合与交Lead；main集成单列。

后继：唯一Thread writer在运行中也可见的message footer接入；现ActionBar hideWhenRunning/autohide不适用。pending turn仅真实user消息→turn，单一折叠入口避免重复Execution details，默认常用profile/queue与技术footer收拢留主组合；CHAT05后按明确Reference.activity接 typed，不猜测。不把独立fixture当App已上线。
