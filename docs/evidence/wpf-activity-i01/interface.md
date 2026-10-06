# 聊天活动 Interface 与固定来源

输入：86a36eaeffbf09f0a3772c3d1509c17dc0a76f92。此片是实际App接线；HTTPfixture验收不代表真实模型或中心。

- `ConversationActivities` 位于当前已审 renderer provider 内，消费显式 visible。App现有native `hidden` 不清effects；visible由两个split各自当前tab决定，与focused不同。layout effect只在visible/bindings变化结束lease，TaskSummary通知单独sync，不因每次poll中断正文。
- `MessageFooter` 在官方MessageRoot内、ActionBar外，用户锚点`conversation-user:${turn.id}`在pending/running/assistant available三态都稳定。用户grid footer显式跨整行。
- P01唯一`chat.message.footer` typed slot接受message，真实button/menu/panel均走原host。按钮Open task controls、菜单Copy task ID；默认面板属于`flow.conversation-activity`。安装/激活/停用事实不复制。native和generic共享单一用户disclosure，只有当前选择的source活跃。
- 私有`ActivityIdentity`含connection/view/conversation/turn/task/message。App依当前view投影复核真实成员；session使用P01同一authorizeResource policy，列表要task.activity.read，正文另要reference.read。当前builtin受信权限没有持久grant产品界面；不把active注册本身称授权。插件不取得FlowClient/token/global任意ID读取口。
- native projection只存轻headers及已读body。页原始after保持；当前页TaskSummary updatedAt/status/verification变化合并一次refresh，加载中更新最多续一次新观察。其他页stale，用户回看才读，hasMore不自动drain。跨attempt sequence不排序；前后页不得重叠，既有观察身份与顺序不可静默变化。
- hide/fold/换source使projection请求generation失效并结算loading；nativefetch支持AbortSignal，generic events公共client未有signal则只停止等待并丢弃迟到结果，不能声称底层HTTP全部终止。hide/resume缓存不自动重读；changed task的当前页可更新轻header。session dispose在await插件清理前同步closed+abort。
- `nativeActivities(taskId,{after,limit:20})`和`nativeActivity(id)`使用真实publicclient。正文逐字段匹配加载header的task/attempt/session/source/tool等身份；派生status可变不作为immutable identity。≤65536 UTF-8 bytes，truncated JSON按文本；sha是原文标识，仅显示digest标识，完整或截断正文均未在本片进行独立SHA校验，不与产物验证状态混用。redacted thinking不读正文；unsupported明示，text observation不当assistant final。

## 固定源码

- `packages/contracts/src/native-activity.ts`：body上限/截断/严格data schema/轻reference/page。
- `packages/client/src/index.ts`：60–66 native routes；conversationDetail用于generic已加载引用。
- `apps/server/src/native-activity/store.ts`：14–17最新工具phase，63–88全attempt ordinal分页/终止unknown/全局body route；不能误将sequence当全局cursor。
- `apps/server/src/events.ts`：81–86批次写task updatedAt。conversation revision只表示受理，不当活动水位。
- 通用模块源自61b9349af390c137cc4cfeabd38bad058ec69cb5；已受控纳入C03原目标889f433ef6972e4feee95aa878f0dbaf7da30448为独立输入07da10c37f50b5e787e21bbd45ceeda1fe539766，仅两文件hash完全一致；owner未实现修改，不扩为native或CHAT06stream reader。

## 官方组件

Tool取自 https://raw.githubusercontent.com/vercel/ai-elements/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/tool.tsx ，原件[tool.upstream.txt](tool.upstream.txt)，[Apache-2.0](LICENSE-ai-elements.txt)。保留Tool/ToolHeader/ToolContent结构，省未调用Input/Output/CodeBlock/ai类型以避免新依赖；本地native真实status替换AI SDK状态，不把input-ready映为running，无伪流动画。Reasoning复用本树官方assistant-ui元素，streaming=false且无duration；不暗造provider thinking。

## 组合边界

通用阅读器源自61b并精确纳入上列已审C03输入，未在本片自行修改；conversation projection/messages/queue/contracts/client/root锁完全只读。CHAT06stream后继不在本片；Lead负责旧timeline兼容。当前native活动body可能包含工具入参和结果，是中心既有授权数据，不是本地PTY或磁盘浏览器。React.Activity开发fixture与实际native-hidden分别验证，不能互相替代。
