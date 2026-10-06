# CHAT04 Web 消费研究与语义变更

本文件是父需求 WPF-REQ-44 的研究证据，不是第二份中心或 Web 实施计划。研究者 root / w01_owner 只读；中心唯一 owner 为 Mika 队，公共导出/client/生产接线归 Execution Lead。当前 Web 没有 queue 实现 claim，既有 disabled 控件不改。2026-10-06 04:33 UTC 归档。

## 固定来源与历史边界

固定首合同 `e423abb5f404334b4bb781de1fe1a429278762d4`，worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/conversation-queue`，claim `3be53dee-08c2-4c88-85ee-a29781842223` v1。此 SHA 的 commands/queries/promotion 仍为 stub，不证明生产可用。后续 root 转交 v1 实现短 SHA 6fc9df4 / metadata 3347e7a，v2 interface 继续演进；本报告不审 moving 源，也不称该旧 v1 已供 Web 消费。唯一中心接口文档为该树 `docs/evidence/chat04/interface.md`，引用时必须附固定版本。

w01 对照 Web `3319122ea2d225e96f587a86a0f5ff97a3191b0b`，安装 assistant-ui react 0.15.23 / core 0.3.22；只读本地 find-skills、assistant-ui、clean-code 和实际源码，官方 llms.txt 仅导航。没有新文件/生产改动、stub 执行、领域 tests、数据库、模型或浏览器调用。本归档由管理者写入自己的管理范围。

## e423 的已核事实

- `packages/contracts/src/conversation-queue.ts:3–51`：独立 queueRevision；enqueue `{expectedQueueRevision,text}`，cancel `{expectedQueueRevision}`。item 有 id/conversationId/sequence/state（waiting、cancelled、promoted）及 preview/truncated，promoted 引用真实 taskId/turnId/turnNumber。
- `apps/server/src/conversation-queue/index.ts:26–33`：POST conversation queue、GET queue 页、GET item、POST item/cancel，命令使用 Idempotency-Key。分页默认20/最多50，after 是 sequence。正文最多16,000 **UTF-8 bytes**，preview 最多512 bytes，waiting 总数最多100；不能沿用旧 turn 的 JS 字符计数。
- immutable replay receipt 只证实原命令；cancel 与 promotion 同锁，already-promoted 返回 turn/task 并不撤回。e423 无 edit/reorder/steer/pause/continue。`conversations.ts:35–42` 当时 queue/steer 仍 false，公共 client/barrel/入口不由 stub 名字证明已发布。
- Mika/root 后补明确 list 仅当前 waiting（含 blocked），不是 changefeed。queueRevision 变化须从 after=0 重读；promoted/cancelled 由 readItem/receipt 恢复。blocked 是当前会话门禁，可能在 queueRevision 不变时改变，缺席不能推为取消。

## 04:33 后继已授权决定：持久暂停与明确继续

来源是 Goal Owner 经 root 转交的产品决定，**覆盖未来方案，不改写 e423 历史事实**。Stop 要保留暂停后续的意图：Mika 将补 PG 持久 pause / 明确 continue，与 promotion 使用同一 conversation 锁。pause commit 之后不再 promotion；未来 Web 先取得 pause ACK，再调用已有当前 task cancel，两份 receipt/结果分开展示。pause 前已经 promoted 必须诚实说明，不承诺 stop-all、撤销副作用或撤回已执行任务。uncertain、revoked profile、unknown session 等门禁不能由 continue 绕过。新固定 DTO、实现、公共 client 与独立审查未到，不能把本决定写成已支持或先改按钮。

root 额外指出陈旧 task 竞态：pause ACK 拟带 commit 时 `currentTurn {taskId,taskStatus,turnId,turnNumber,queueItemId|null}` 快照；terminal 则不取消，active B 应取消 ACK 的 B，不能使用页面陈旧 A。ACK 之后状态仍会变化，取消结果单独报告。该 DTO 仍待 Lead 技术核定与固定 commit。

旧 e423 下 Stop current 请求可与实际 succeeded 竞争并合法提升下一项，因此旧研究只保证取消当前任务、不保证暂停。该历史限制仍真实，但不能拿它覆盖上述新的持久暂停目标。

Mika/root 后续补正（仍待固定 v2 SHA）：旧 key pause ACK replay 只是历史回执，另一客户端可能已经 resume。UI 必须 GET 最新 paused/currentTurn，不能把 replayed=true 当当前已暂停，也不能按历史 task 取消。resume 拟 `{expectedQueueRevision,expectedTaskId|null}` 同事务即时最多 promote 一个 FIFO item，不是未来长期授权。新增验收：pause ACK 丢失→他端 resume→原 key 重试→最新 GET；暂停命令 receipt、当前已观察事实与 cancel receipt 分开。GET 后仍可能他端改变，UI 只陈述观察时点，不承诺永久 stop-all。

## 最小 Web 旅程候选（未实施）

1. 只有中心已经发布、验证的 queue 能力才开放 UI；保持官方完整 Thread、真实 isRunning 与同一个 composer draft。建议 queue-capable 会话所有新消息经中心 enqueue，避免普通 follow-up 越过 waiting；空闲首项也由中心提升。最终路由政策待新合同冻结，旧 queue:false 保留旧 follow-up。
2. waiting 不渲染成已执行 user/assistant turn。promotion 使用真实 task/turn 链接刷新会话；列表消失不等于取消。取消 waiting 有独立 pending/unknown 状态；already-promoted 显示已经开始，不能暗中再取消运行 task。
3. blocked 原因可见，sameRevision 也刷新门禁；停止/暂停/继续、取消运行 task 语义按新固定合同分别呈现，不能靠 SDK 内存队列暂停冒充跨客户端 PG 门禁。

## 回执、分页、草稿与恢复验收

- 独立 queue outbox 冻结 conversationId、operation、key、expectedQueueRevision、原文或 itemId。不能把 conversation.revision 当 queueRevision，unknown 重试原完整 body/key；everUnknown 保守保留，后续 401/409 不能抹除旧不确定性，不自动换 revision/key 重发。
- ACK 校验 conversation/item/promotion 身份与形状。旧 waiting receipt 不覆盖已经读到的 promoted/cancelled。unknown 没有 itemId 时不能按同文或 preview 猜身份，只能重放原 key。
- 一轮页同 queueRevision，页间 revision 变化丢弃混合结果、从头有界重读并显示更新中；旧 generation 不跨 conversation/center。最多100 waiting，已结束引用用独立有界 receipt/cache，不永久累积到 waiting。
- 现有 Web outbox 是内存态。若后续承诺 reload 后 unknown ACK 可安全重试，必须在 POST 前保存有界 pending-command journal（原 key/body/连接范围，无 token）；存储失败不发不可恢复身份的命令。否则只能声明已确认中心 queue 可恢复，不能假称未知 receipt 跨 reload 安全。
- 提交捕获并分离那一份正文；旧 ACK/GET/retry 不能 setText/reset 后来的草稿。UTF-8 中文/emoji 边界单测，waiting100 限制与局部错误不丢新稿。

## assistant-ui 实装边界

`external-thread-queue-adapter.ts` 的 items/steerItems 和 enqueue/steer/move/edit/remove 都是轻量接口，callbacks 为 void，QueueItemState 不含中心 ACK/blocked/outcome。`external-store-thread-runtime-core.ts:305,702–714` 仅 adapter 存在就声明 queue 能力，普通追加转 adapter、不再 onNew；`message.steer ?? isRunning` 使运行中未指定意图的普通发送默认走 steer。`createMessageQueue` 的内存 advance/notifyIdle/steer 可驱动执行或取消，不可作为 Flow 的中心权威或提升器，不调用 __internal API。

如果采用薄 external adapter，只负责展示中心 waiting 和调用独立 queue commands；void 异步失败必须 catch 并通过可见 outbox 呈现，不 noop 不支持的 edit/move/steer。react `ComposerInput.tsx:234–272` 在有 queue 时支持 Cmd/Ctrl+Shift+Enter steer，而 Send/ComposerRoot 默认 send() 不传 steer:false；按钮、form、Enter、IME 必须统一明确意图，unsupported 快捷键拒绝并说明，不能假设只加 Queue 按钮就足够，也不能假造 isRunning=false。

root 固定4e只读补充：ConversationThread 当前 runtime 仅 onNew，没有 onCancel，Open task controls 是 task 层入口。官方 Thread 副本 `thread.aui.tsx:545–562` 已将 canCancel 分支替为 disabled Accepting / Waiting for durable acceptance，避免 HTTP 等待被误认为任务取消。未来 pause→task cancel 应用明确独立控制，不能恢复该 accepting 分支为 primitive Cancel，不能用 runtime 本地 cancel 宣称持久暂停。

最低验收区分消息 receipt 未知、pause receipt 未知、pause 已确认而 task cancel 未确认、task 已结束竞态；全程保留当前草稿。pause/continue 细节以新中心合同为准。

## 后继最小范围与检查（尚未领取）

可能新增 queue-projection、queue-outbox、ConversationQueue；现 ConversationThread/projection 仅能力/create→enqueue 接线，官方 Thread 若需 composer seam 必须单独 literal claim。shared client/barrel 只用 Lead 固定输入。专用 queue test/browser/fixture 可复用现 HTTP方法但不运行旧 stub 假装能力通过。

有意义场景包括：丢 ACK 后先 promote 再旧 replay 不复活 waiting；already-promoted 不暗取消 task；20/50 分页间 promotion/cancel/new enqueue 后完整去重；sameRevision blocked 更新；UTF-8/100限额；普通按键/按钮/IME/unsupported steer 一致无重复 POST；create 与 queue ACK 两阶段恢复；关闭/reload/换中心迟到 journal 隔离；只有中心提升，隐藏/关闭 Web 不触发取消；双主题390键盘/局部 alert。新 pause/currentTurn/continue 竞态验收随冻结 v2 补齐，不把本报告当实现完成。


## 后继固定 v2 合同候选79867（root只读核对）

root随后实际读取 `79867bdf1b094957c593dc0f142e6e676f2475df` 的 contracts/conversation-queue.ts 和 interface.md；controls 仍stub，生产未批准、public client待Lead。此为后继固定合同，不将旧e423内容覆盖。精确限制仍为页default20/max50、100waiting、正文16000 UTF-8 bytes；pause HTTP200、resume HTTP202，resume expectedTaskId可null。currentTurn.taskStatus可在同queueRevision下由queued→running→终态，GET不能仅因revision没涨就丢弃新的currentTurn/blocked。历史ACK不能回滚最新GET，与同revision接受新动态状态是两个独立合并要求；分页revision变后重新从头读取。root只读来源，无本队queue实现take或当前按钮变化。


## 04:42 已确认发布兼容门槛（不是本队整体goal受阻）

Mika发现后台能力将从queue=false变为true，而现Web `conversations/projection.ts` 的 assertCapabilities 将queue与steer/liveAssistantText/perTurn*一起强制等于false。管理者独立读唯一CHAT树clean HEAD `083978b318ede4bb1cabb5050f8d211b17bb9055`、约58–62行核实：queue=true直接throw，整个conversation snapshot失败。root已通知MainLead不得单独部署新true而没有配套Web；新合同将queue类型拓宽为boolean以兼容旧false，后台新能力仍为true。这是具体消费不兼容，不等于合同boolean本身即可修复旧Web，也不撤销历史7cb在false输入下的限定批准。

解除条件：后台完整独审固定输入、Lead公共client/export固定commit与明确发布顺序、受领Web能力迁移及相应队列行为检查同时就绪。旧false必须继续保留旧follow-up/unsupported路径，true需用实际公开queue/pause接口；不能只去掉断言就声称队列受支持。只读准备最小scope，不私改shared、不先take未知范围。PROFILE新模块继续独立执行，当前管理整体blocker仍NONE。

owner复用workspace_panels_owner，但新功能仍须旧CHAT08259c1d v2相关projection/ConversationThread/测试明确停写→当前版本amend移出→独立新tree与新claim committed后实施。同人或不同worktree不能跳过此移交；PROFILE接线也会修改这些路径，必须按ready输入串行，不能同时写。root已协调Lead输入与顺序，管理只维护本父状态与研究，不新增第二套queue状态。


后继解除策略已授权：WPF-QUEUE00 reader独立最小切片先行，不等完整queue UI/client，也不擅改shared。只接受实际boolean并维持false兼容，true的不可操作项必须明确而非默认宣称已支持。具体代码/行为边界由唯一owner冻结精确scope再领。MainLead按已审reader→contract/domain→mount成套交付，PROFILE App接线后排，PROFILE独立模块不受影响。Mika域impl ae9d7203c30bdf5ec6825cee0e6ce86231c34cb2 / metadata aef5c6fcd3d811673e8eeb8cd67f225ba0941b8e获其root54项独审，是backend范围证据，不替代Web消费验证。


## 04:49 固定输入与后继UI顺序

QUEUE00 reader固定5acc5b1bde23e9c587a4580da55a75340811ecdd/base75a已root限定APPROVED，独立35tests与固定diffcheck；final498b2cdc46eee484d8dd148715821ee800669965 clean，管理6md17links4TODO/源码差异0核验。仅reader兼容，旧Thread静态文案留后继范围；不等完整queue命令UI，不包含browser/build/DB/模型检查。source尚待Leadregistry明确通知后一次实采，不能以claim可见当已注册。

MainLead公共client实现83f7da6c6e366e3520c8373c7d21408dad5fb145、F01 metadata400ae113abcf4526a670f3100e8518ea834c04ed（管理git rev-parse核完整SHA）是后继受控输入候选，独立审查/准确base待Lead；允许未来完整merge受控foundation但不能进QUEUE00，更不能私改shared。后继顺序：reader成套集成→PROFILE真实App接线→完整queueUI；共享projection/Thread必须串行转交。

root再核ae9 DTO/83f7 client要求：等待页按queueRevision一致合并，但sameRevision GET仍更新currentTurn.taskStatus/blocked/paused；enqueue/cancel/pause/resume各自冻结body/key，未知结果原key核对，旧ACK只确认历史不盖新GET；already-promoted展示真实turn目标而非撤回运行；pause与task cancel分别报告，pause replay后最新GET若他端resume/promote不能按历史currentTurn取消。现ConversationOutbox只处理follow-up，不得无辨别复用于所有queue操作。

root已读本地AI Elements queue参考及[官方Queue](https://elements.ai-sdk.dev/components/queue)：它是Collapsible/ScrollArea/ItemAction可组合展示，可接中心waiting、不提供持久执行。官方[external-store runtime](https://www.assistant-ui.com/docs/api-reference/external-store/runtime)与queue-item仍要求steer/move/edit/remove且默认有打断；不能为列表可见伪接缺失命令。保持官方Thread，后继queue控制由public client事实驱动。项目已有radix-ui/Collapsible、没有Queue副本或ScrollArea封装；未来只取实际使用展示片段并固定上游来源，不全量CLI安装或擅改根依赖。本项已交owner只读设计，未take或实现。

## 04:55 后继UI只读设计与键盘接缝待冻结

workspace_panels_owner固定读ae9domain/83f7client提出QueueProjection sidecar，与ConversationProjection共享connection/conversation lifetime，专管waiting分页/blocked/paused/currentTurn；独立QueueCommandOutbox分别冻enqueue/cancel-waiting/pause/resume/task-cancel，不改旧follow-up outbox。App现有client/View足够，visible最多两pane轮询，hidden停止读但不取消已发命令。pause历史ACK后fresh GET确认paused及当前task，再独立明确选择取消该task，失败/false/terminal/变化不自动cancel；两种receipt分别展示。这是设计建议，未领取实现，publicclient批准与准确base仍等Lead。

候选12scope为既有projection.ts、conversation-projection.test.ts、ConversationThread.tsx，新增conversations/queue/{commands.ts,projection.ts,ConversationQueue.tsx,queue-elements.tsx}、test/conversation-queue.{test.ts,fixture.ts,browser.ts}、plans/wpf-queue01-ui、docs/evidence/wpf-queue01。PROFILEI01先消费，之后重新核实际claim版本再转交，不能依赖旧owner版本。AI Elements只取实际展示片段并固定source/hash；不新增根依赖。

root实际读@assistant-ui/react0.15.23 ComposerInput.tsx:254确认：isRunning=true且没有queue adapter，内置Enter直接return；core0.3.22 composer.canSend自身不查running。故候选单改sendLabel/onNew会产生按钮可入队但Enter不发送。已followup原worker做有界只读修订，可能需要官方thread.aui.tsx可选受控input handler/slot及新literal claim；未冻结12scope不变的假设。必须保留IME/Shift+Enter/defaultPrevented、unsupported steer明确反馈，禁止isRunning伪false、伪queue adapter或document级监听。不把设计阶段接缝问题称已实现产品bug，需先实证最小路线再受领。

只读修订已核：原12候选scope须增加官方`apps/web/src/components/assistant-ui/elements/thread.aui.tsx`，合计13，当前CHAT082v3拥有该路径。最小可选`composerInputOnKeyDown`经Thread内部context只传主ComposerPrimitive.Input；未传时旧调用者不变。已有Radix composeEventHandlers先执行外部handler，defaultPrevented挡后续库逻辑。先尊重defaultPrevented/IME/isComposing与229；ShiftEnter换行；steer快捷键明确拒绝且不清稿；仅显式Queue+captrue+running的普通Enter局部preventDefault并textarea.form.requestSubmit，和按钮同ComposerRoot/onNew最新门禁。保持真实isRunning/无假adapter、不手动清textarea或全局监听。未来要实际测按钮与Enter单发、IME/换行/热键、不同pane和unknown门禁；当前只有读码方案，没有产品验证。

05:22 QUEUE01当前切片边界由唯一owner明确：中心waiting/paused跨reload重新GET恢复；命令receipt延续CHAT内存生命周期，不承诺ACKunknown原key跨reload恢复，不按相同正文/列表缺席猜确认。UI将提示保持此页面至确认，reload会失去本地重试身份；连接dispose隔离同ID。稳定connection scope不在13scope已有接口，不擅造storage journal。原key/everUnknown仍覆盖本次页面寿命，网络/5xx/坏形状保守unknown。持久pending journal若后续要求，先正式接口/范围，不把提示文案当持久化实现；此限制已交root审阅。
