# TUI01E Interface

公开命令：`{type:'queue',next?:boolean}`、`{type:'pause'}`、`{type:'resume'}`。slash/help/completion与headless共用现typed command目录；现 `createInteractionController` 可选 `queue` port 为 FlowClient 的 conversationQueue/pauseConversationQueue/resumeConversationQueue 三方法。没有port或中心capabilities.queue不为true则unsupported，不能从按钮推断能力。

queue snapshot保留一个20项页、queueRevision、paused、blocked、currentTurn、nextCursor；只引用/preview，不请求item正文。仅显式进入队列后沿现有观察节奏刷新，使用同ObservationReads界限/AbortSignal/epoch，旧会话读取不额外拉全queue。

pause/resume属于现单一IntentStore，旧create/send version1原结构继续可读；新kind绑定connectionId/conversationId/key/strict input。resume的expectedTaskId来自当前queue页，不接受任意用户taskId。复用现save-before-POST、unknown保留、显式recover、dispose等待；不新增第二FSM。协议receipt严格核固定conversation/queue revision/paused/turn/item形状，不能将旧receipt覆盖最新观察。成功再读中心当前事实；确定新命令409拒绝后保草稿继续观察且0自动重投。恢复中的未知仍保留原身份，不能随新观察换body。

pause仅阻止后续提升；resume可能受当前task、native session或profile门禁拒绝，也可能提升队列。已受理≠执行完成/已停止。旧普通send、goal模式、凭据/私有journal位置与退出0cancel保持。

固定实现 target `d4478653918144377696ce83ace128fcf4213961`。

| Module | 责任与边界 |
| --- | --- |
| interaction queue-control | 静态两类intent schema、20项轻投影、请求绑定的ACK解码；只依赖已存在FlowClient三方法 |
| interaction controller | 唯一epoch/观察连接/草稿/intent生命周期；save-before-POST、未知恢复、释放；不拥有中心queue状态 |
| Ink / JSONL | 使用同一typed command catalogue和snapshot，只处理呈现/语法；main传现client为可选queue port |
| Center既有queue模块 | CAS、原key幂等、promotion与task状态权威；本片逐字不改 |

receipt版本按固定中心协议：pause仅同版本no-op或+1，resume恰+1；无promotion的resume必须保留请求中的taskId/null，promotion须自洽item/turn/task身份。无port/能力false为unsupported；未知或 malformed ACK保留原请求，不隐式降级成成功。metadata/branch检查不称main已发布。
