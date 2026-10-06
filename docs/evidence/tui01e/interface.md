# TUI01E Interface

公开命令：`{type:'queue',next?:boolean}`、`{type:'pause'}`、`{type:'resume'}`。slash/help/completion与headless共用现typed command目录；现 `createInteractionController` 可选 `queue` port 为 FlowClient 的 conversationQueue/pauseConversationQueue/resumeConversationQueue 三方法。没有port或中心capabilities.queue不为true则unsupported，不能从按钮推断能力。

queue snapshot保留一个20项页、queueRevision、paused、blocked、currentTurn、nextCursor；只引用/preview，不请求item正文。仅显式进入队列后沿现有观察节奏刷新，使用同ObservationReads界限/AbortSignal/epoch，旧会话读取不额外拉全queue。

pause/resume属于现单一IntentStore，旧create/send version1原结构继续可读；新kind绑定connectionId/conversationId/key/strict input。resume的expectedTaskId来自当前queue页，不接受任意用户taskId。复用现save-before-POST、unknown保留、显式recover、dispose等待；不新增第二FSM。协议receipt严格核固定conversation/queue revision/paused/turn/item形状，不能将旧receipt覆盖最新观察。成功再读中心当前事实；确定新命令409拒绝后保草稿继续观察且0自动重投。恢复中的未知仍保留原身份，不能随新观察换body。

pause仅阻止后续提升；resume可能受当前task、native session或profile门禁拒绝，也可能提升队列。已受理≠执行完成/已停止。旧普通send、goal模式、凭据/私有journal位置与退出0cancel保持。
