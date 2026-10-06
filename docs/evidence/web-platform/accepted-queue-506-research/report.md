# Accepted queue receipt：固定源码只读研究

状态：只读建议，未实施、未动态验证；不签 source/product APPROVED。归现有 MATURE06-03、MATURE01-03/04 与 CHATREAD/REQ43，不新增任务、状态权威或领取。

## 输入与方法

固定项目对象 `5069586a9f17332de526e101eca3a4250cbc8d91`，仅六个项目源码（末表）；SHA256 与字节数见同目录 sources.json。未读取 moving Recovery 实现。未运行产品、测试、import、HTTP、PG、Chrome、空间采样或 claim 操作，未改项目/截图。应用已有本地 find-skills 方法（优先已装技能）、codebase-design 的事实权威/呈现接口边界、clean-code 的职责和错误分支检查、assistant-ui 的官方 Thread 宿主组合边界；本段无安装/联网查技能。

复用来源：管理 `docs/evidence/web-platform/app1750-product-acceptance-followup.json`（2026-10-06T17:54:16.876136Z，frontend=本固定506）是原任务验收要求；`chat-queue-research.md`、`queue-live-ux-observation.json`、`/tmp/root-short-chat-visual-83f535/report.md` 是历史语义/视觉背景，版本不同，不冒充本次506实测。171109因果报告研究 body-loss/retry，旧 workspace-cache研究回收，均不能代替本次状态与动作核对。root既有 WAI disclosure 依据继续适用；未重新检索网页。

## 结论与最小呈现边界

可以把**已 accepted 的 enqueue 命令收据**做成一个可发现的紧凑摘要与按需详情：例如“已加入队列 · 查看收据”。折叠只改变本地显示，不调用 dismiss/dispose，不改变原 key、冻结 command、材料顺序或独立 conversation 上下文。收据详情仍可查看原材料/原文和显式 Dismiss。默认摘要不重述整段已发送正文，不为判断可折叠而发请求。

`accepted` 不是“执行完成/无待办”的通用判据。最窄首片不把所有 accepted 控制收据一并折叠为成功，也不按相同标题合并。需要动作由原 queue projection 的当前事实和原 command authority 判定，不能从英文 receipt.message 反推业务状态。

区分两层：

- **收据紧凑**：已确认 enqueue 本身不再需要 retry；若当前 queue 有 stale/error/offline/unavailable/blocked/paused、sending/unknown/rejected 或确认中的取消动作，其摘要/动作仍显著，不能被折叠规则吞掉。已有 waiting 项可以与紧凑收据并存，摘要必须承认仍有等待项。
- **整个队列的安静入口**：只有当前可用、在线、成功加载、非 stale、无错误/阻塞/暂停/未决收据，且已加载 waiting 为空、nextCursor=null 时，才有依据呈现简短的空队列入口。仍须保留实际 current task 的取消决策入口；“有执行但没有 waiting”不等于全部工作完成。无 page、部分页或陈旧空列表都不能称无待办。

这是一条保守的呈现建议，不是新 admission 规则。当前 schema 没有统一 `noActionRequired` 字段；若后继希望自动概括 accepted cancel/pause/resume，应先在原 authority 内保留需要的 typed outcome 或维持其具体说明，不能增加第二个 receipt decoder 或用 message 文案作协议。

## 六源事实与行号

下列路径均相对 Flow 仓库，行号均来自固定506。

### A. 状态不能混为一谈

`queue/commands.ts:23–30` 的 QueueReceipt 只有 slot/key/command、`sending|unknown|rejected|accepted`、everUnknown/message。用户口语的 dispatching/failed 在此不能冒充新枚举；显示层必须对应真实 sending/rejected，网络未知仍是 unknown。`commands.ts:41–48,89–110` 由原 authority 冻结 command，分配一次 UUID，并按 slot 保存；pause/resume 共用 control slot，cancel-item/task 分别按真实 ID 分槽。Retry 只允许 unknown，继续原条目/key/body；Dismiss 只允许 accepted/rejected。

`queue/projection.ts:7–24,27` 的 page/loading/stale/online/error 与 receipt 独立。page 验证 conversationId、queueRevision、严格递增 sequence、waiting 状态与 cursor。`49–53,70–99`：accepted 的 settled refresh 可以失败；隐藏时仅标 stale。不能把成功 ACK 当“现在已刷新”，也不能用历史 receipt 代替当前 queue 的 paused/currentTurn。

`packages/contracts/src/conversation-queue.ts:27–49,58–84` 区分当前 task、waiting/cancelled/promoted item 和幂等原回执。list 缺项不证明取消；accepted/replayed 不代表 current item/task 状态。

### B. 各类 accepted 的真实含义

| command | 固定代码 | 可安全陈述 | 不能隐藏/推断 |
|---|---|---|---|
| enqueue | commands.ts:58–64 | 原请求已存中心队列，ACK身份/预览/材料与原请求匹配 | 不代表已晋升、执行完成或模型采用材料；当前等待/阻塞另读 page |
| cancel-item | commands.ts:66–68 | 中心确认 cancelled / already-cancelled / already-promoted 中一种 | already-promoted 明确执行未取消；不能改成泛化“已取消”或藏其提醒 |
| cancel-task | commands.ts:52–54 | 对匹配 task 的取消请求已被接受，附返回 task.status | 不代表副作用撤销、任务已终止；仍运行/取消中的状态必须如实可见 |
| pause | commands.ts:70–73 | 此命令的暂停回执被确认 | 不能以旧 receipt 暗示当前仍暂停；当前执行取消需刷新/明确选择 |
| resume | commands.ts:75–77 | 继续命令被确认，可含本次 promoted 身份 | 不代表执行成功；当前推进/阻塞和可行动状态仍来自 refreshed queue |

目前 receiptMessage 校验完整 ACK 后只留下字符串，QueueReceipt 没有 typed outcome/currentTask 的副本。因此单独用 receipt.state===accepted 无法证明后三类无待办；解析自然语言也不合法。

`commands.ts:112–132` 的确定4xx/超时路径有区别，everUnknown 保证先前 unknown 不因后续4xx洗白。折叠不能改变此恢复语义。accepted 后的具体消息可按需查看，但影响下一步动作的结论不可只藏在详情中。

### C. 原按钮与可见性清单

`ConversationQueue.tsx:31–76`：主 queue disclosure 默认折叠，而 receipts 目前在其外逐条显示。这正是 receipt 正文重复的独立呈现接缝，无需重写投影/命令。

| 入口/事实 | 位置 | 最小保留要求 |
|---|---|---|
| queue 错误与本地操作错误 | 68 | role=alert 继续在折叠外；不能用 accepted 收据遮盖刷新失败 |
| blocked / stale / paused / waiting reason | 69；37,45 | 摘要保持可辨与可操作，不与 accepted 统称成功 |
| Refresh queue | 41 | 在队列入口可达，保 online/loading 禁用理由与原 refresh(true) |
| Pause queue / Continue queue | 42–43 | 留在 queue 自己的详情，保 actionDisabledReason/current task 门槛；required-action 摘要必须能到达它们 |
| Cancel current execution… | 47 | 暂停且 active 的原目标路径保留，不能从 accepted pause 回执直接执行 |
| Confirm execution cancellation / Keep execution | 48 | 已开启确认必须显著且保持真实 target ID；折叠不能默默确认或取消用户决策 |
| Read full message / Hide message | 57 | waiting item 自己的展开入口，仍按 item.id，不归并到相似标题的 receipt |
| Cancel waiting message | 58 | 仍为该 item/queue revision 的原命令，不能被新紧凑入口改成 task cancel |
| Read message again / Retry message detail | 60 | 内容被回收/出错后仍有明确恢复入口，展开不显示无说明空白 |
| Load more waiting messages | 64 | cursor 存在时保留，loaded 数不冒充总数 |
| Retry same {kind} | 74 | unknown 警示和原 key 重试必须显著；不能以新的正文/最新 revision 重建请求 |
| Dismiss {kind} receipt | 75 | accepted/rejected 显式操作可放各自收据详情；绝非自动过期、取消中心 item 或清业务未决 |

sending 没有 Dismiss；其进展须可辨，不能获得 accepted 的安静摘要。rejected 保留错误说明与显式 Dismiss，不能抹掉以腾界面。unknown 保留“可能已受理”及原身份恢复；本固定506的 reload/page-local 文案属于该版本事实，不借本研究宣称后来 Recovery 已上线或继续失效。

`ConversationQueue.tsx:37` 显示“waiting loaded / more available”，49–50 区分未加载与成功空快照。显示优化必须延续这些措辞边界。`15–20` 已有移除按钮后回本队列 Refresh 的焦点恢复，不能因新 disclosure 丢失。

### D. 懒加载与身份

`queue/projection.ts:58–69` 绑定独立 conversationId，不能在现实例改绑另会话；visibility/offline 操作读取生命周期，不代表取消中心命令。`103–134` 保 capability/online/page freshness/slot 门槛；resume 与 cancel-current-task 都先取得当前快照并核真实 target。不能用“accepted 看起来无事”绕过这些门槛。

`140–162` 仅在显式 loadDetail 时取全文，已有限制的 cache/flight/generation/错误分支。摘要只用现有 frozen enqueue command 或 queue metadata；不能自动预取 waiting 正文、Task output 或 attachment/knowledge 正文来决定压缩。`commands.ts:44–48,58–64` 保有序材料与 exact 原请求；同标题/同 preview 不能当同 item/key。

### E. 真实插件接缝

`ConversationThread.tsx:191–215` 的 PluginThreadScope 保 viewId/taskId/messageTask，并组合现有 Streams/Activities/Attachments/Knowledge；`206` 把 ConversationQueue 作为官方 Thread 的 afterMessages sidecar，随后是 pending/unavailable reply 与独立 MessageReceipt。后者见 `36–44`，是 Send/outbox 的另一命令 authority，不能与 queue receipt 按标题“Sending/Accepted”合并。

`plugin-integration/react.tsx:88–106`：MessageFooter 基于实际 message→task membership，为 user message 构造 `{kind:message, taskId, messageId, role}`，panel 继续走 PluginView(host, contributionId, context)，其他贡献走同 slot。assistant stream draft 的 interrupted/paused/truncated/non-final 信息在97–99有专门分支，不能被普通完成摘要隐藏。

`react.tsx:108–122`：AppSlot 复用本 session.host 的 ExtensionSlot；MessageActions 使用实际 message/task/role；ComposerActions 使用 viewId/isDraft。不得按 title 把贡献复制进 queue、直接调用插件 callback、改用 global context，或把不同消息/不同 pane 的动作合并。当前六源中 queue 本身没有新的 queue plugin slot。只收拢它自己的 receipt 显示不需要新增 slot、registry、HTTP 或 authority；若更大 CHATREAD 详情同时收纳现有 message 贡献，应保原 PluginView/ExtensionSlot、原 context 和 capability 判断，不借 receipt 方案绕过它们。

## 候选验收（本段全部未运行）

1. accepted enqueue 紧凑摘要/展开/收起/显式 Dismiss：原 conversation/key/body/ordered materials 不变；折叠不产生 POST，不 dispose authority。waiting/current task 仍有独立、准确状态。
2. sending、unknown、rejected 和 accepted+refresh失败分别检查；unknown 同 key 重试，经历后续4xx仍不伪装确定失败；下一 draft 不被历史 receipt 改写。
3. accepted cancel-item already-promoted、cancel-task 仍 active、pause/resume replay 与 stale/paused/blocked：关键例外和需要动作默认可辨，不能仅看 accepted label 判无事。
4. 空未加载、成功空、partial cursor、含 waiting、暂停且 active、取消确认中分别检查。loaded 数不当总数；Keep/Confirm 保真实目标，取消不等移除收据。
5. 双 pane 相同标题/正文但不同 conversation/item/key：展开、重试、取消、Dismiss 与插件动作均只影响原上下文。收据折叠不会改变 message/task membership 或权限。
6. 键盘 Enter/Space disclosure、Tab/ShiftTab/焦点返还与刷新后身份稳定；普通详情不伪装 ARIA menu。真实错误继续程序可读。1280与390双主题再做实际视觉验收；本研究没有测高度、百分比、DOM、响应耗时或截图。
7. 首屏/折叠/展开普通收据不触发新增 full-body 请求；waiting 的 Read/Retry 仍是显式独立按需读取。现有插件的异常/恢复按钮必须保留，不能以“更多”静默藏掉。

## 边界与后继

这份报告只是原 TODO 的呈现拆分依据，未领实施 scope。最小候选位于现 queue 展示层，不建议借文案改动修改 commands/projection 或迁移状态机。要概括更多 accepted 控制结果时，必须先明确现 authority 的 typed evidence 是否足够；当前字符串不足不能假装已有统一无待办标志。

没有证明完整 P01 authorization 内部、真实中心行为、动态焦点、无障碍全合规、持久恢复或性能通过；本段仅核六个固定 consumer/schema blob。Recovery 继续停止，现有运行门槛和各 owner 写权不变。

## 固定源码清单

1. `apps/web/src/conversations/queue/ConversationQueue.tsx` — 8924 B — SHA256 `b435794fac3c4f5006919f6f07e440b21ffa829aa2be41ee7f4d70b7072505d1`

2. `apps/web/src/conversations/queue/commands.ts` — 11653 B — SHA256 `34e813ff627be9a40bc079a4f99670c0b0b7bf364022a16842985d60c985a523`

3. `apps/web/src/conversations/queue/projection.ts` — 13034 B — SHA256 `652fe3a4ef22ed4b17d00981090a42213a91a23fc9a21290679e7c9b4ae44f65`

4. `packages/contracts/src/conversation-queue.ts` — 3951 B — SHA256 `c803720f5958ec25febc5e5e1f3b6222f609c2c1e7217e7ad0a5bd2694027414`

5. `apps/web/src/conversations/ConversationThread.tsx` — 22770 B — SHA256 `e1e98f00c2450224e2ce619c8a8d8a9a03b844361bee627df25b07b89cfe004c`

6. `apps/web/src/plugin-integration/react.tsx` — 23725 B — SHA256 `b5e787139198cfd31ac3436856f9a8acea7f8b57ee73eda92edac80e8ff4dc95`
