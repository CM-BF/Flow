# Recovery 7244242 worker 用例窄审

固定输入：`724424237962ed8563db08f5ea8597ee6e7eb11d`。
根目录：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery`。
逐字读取 12 个固定对象，hash 见 `sources.json`；没有读取 moving dirty 作为证据。

**结论：发现一处 materialDraft 验收缺口及其对应的源码反例。它应在运行窗口前收口；没有实际运行失败，也没有给完整 harness APPROVED。** 父进程 resource/PG/process supervisor 不在本次范围。全部 runtime/browser/PG/import/tests/noEmit 为 **NOT_RUN**。

## R1：materialDraft 只核 Input 行，未核实际 composer 接管；ready 后存在缺失同步的源码路径

建议优先级 P2（验收有效性及材料不应被静默漏送），但以下产品行为是固定源码推导，不伪称实跑复现。

### harness 的确切问题

`apps/web/test/conversation-recovery.browser.ts:280–288` 打开 Files，断言其 `Files in this draft` region 有文件名、unverified，再点击 Browse，看到 `ready` 后直接将 `coverage.materialDraft = "PASSED"`。这里的 region 来自 AttachmentPicker 的 `input.getSnapshot().items`，不是 assistant-ui composer 的 attachment 列表：

- `apps/web/src/attachments/AttachmentPicker.tsx:14,34–37` 直接显示 Input items。
- 实际消息表单使用另一个 `ComposerAttachments`（`components/assistant-ui/elements/thread.aui.tsx:463–481`）。

因此“目录恢复为 ready，但实际 composer 没有 file chip/发送捕获中没有 ref”的状态能通过 materialDraft 当前全部断言。后续 sameKeyTurn 第 301 行确实检查 request.attachments，所以整个串行 suite 不会据此无条件全绿；它可能把前置材料恢复问题拖到 lost-ACK 场景才暴露，而 materialDraft 的局部 PASSED 已错误表达完整接管。

### 同一固定源中可达的关联反例

1. `App.tsx:700–708` restore 调 `binding.restoreDraft(saved.attachments)` 并恢复文本/intent/profile；attachment 进入 controller。
2. `plugin-integration/attachments.tsx:194–196` 仅调用 `input.restore(items)`。
3. `attachments/controller.ts:196–205` 将原 ready 文件恢复为 `state:error`、明确 unverified；这符合不能自动信任持久 metadata 的要求。
4. `ConversationThread.tsx:148–158` 把 ready Input item 加入官方 composer 的 effect **只依赖 `[attachments, runtime]`**。首次恢复时 item 尚是 error，会跳过。
5. `attachments/controller.ts:147–163` 显式 Browse 重新确认同 ref/name/mediaType/byteLength 后只改变 Input item 为 ready 并 publish。
6. 该 Input publish 会经 private binding 导致 React 重渲染（`plugin-integration/attachments.tsx:103,109–111`，`ConversationThread.tsx:78`）；但在 binding 与官方 runtime 身份稳定的正常路径，步骤 4 的 effect 不会因 item ready 变化重跑。`AttachmentComposer`（`plugin-integration/react.tsx:265–292`）也没有恢复 metadata→composer 的订阅；其 `add` 仅由显式 picker onAttach 调用，而 Browse 不调用 onAttach。
7. `ConversationThread.tsx:163,170–172` 依据 **composer.getState().attachments** 决定是否 capture materials；如果 composer 仍为空，它不会根据 Input 里的 ready item补入 ref。故可以出现 Files 显示 ready，随后普通提交携带零 attachment 的反例。

本次未导入/运行官方 runtime，未重新核其内部稳定对象实现。因此不把“7244 浏览器一定在某行失败”当实测事实；明确的是缺少 ready 状态同步依赖及测试只看了另一个 authority。不能通过让 harness 再点击 Use、再次 select 或故意 remount 来掩盖真正的 restore journey。

### 最小修正/验证建议

- worker 在 Browse 确认后、写 materialDraft PASSED 前，断言真实官方 composer 有且仅有该恢复附件（用稳定的现 DOM attachment ID/accessible chip；不私读 controller 冒 composer）。保 exact ref、无正文 GET、无自动 POST 的现断言。
- 若证实上面的正常 stable-runtime 路径，生产应让已恢复且重新验证的 Input item 通过已有 composer 同步入口接管一次，保原 ID、避免重复/把旧提交材料附到新稿。具体修复属当前 Recovery writer，不由本报告修改。
- 当前 sameKeyTurn 的首 POST 附件断言必须保留；不要为先跑 lost-ACK 把 attachments 断言删掉。最好先单独确认 material handoff，再执行原 key 场景，使失败归因明确。

## pageOnlyAuthLoss：未找到确定错误通过/必然失败的 selector

`browser.ts:311–338` 的故障注入有实际对照，不能只称空模拟：

- 313–323 仅覆盖当前 page 的 `IDBDatabase.prototype.transaction`，针对真实 journal 名及 readwrite，微任务 abort；readonly 的 `records()` 仍可读。
- `recovery/journal.ts:155–186` 的真实写确用 readwrite transaction，onabort 拒绝为 commit error；harness 326 的错误正则含 transaction/save/abort，能匹配这一实际错误。
- 327 确认目标文字未进持久 record；328 fixture 直接过期专库 browser_sessions；329 通过浏览器 focus 触发真实公开 read（`App.tsx:1203–1212`），而非直接控制私有 controller。
- 330–331 验证连接页出现、原入口不可见；332 在重连前恢复 IDB method；335 核原 page-only 文本，336 timeOrigin 不变，337 没有业务 POST，finally 再恢复 patch。
- `App.tsx:1244–1247` 的 retained Workspace 是 native hidden，符合“同页面保稿”检验；不能将结果解释为 browser reload 的 unsaved 恢复或跨 namespace 恢复。

可进一步让 raw 归因更精确：记录注入期间确切 public session GET 的状态/响应类别，区分真正 unauthorized 与偶然网络 offline。但现有 fixture 确实 UPDATE expires_at，并且该测试没有宣称验证第二 center；没有因此新增 blocker。

## sameKeyTurn：有效检查与未覆盖边界

已核 `browser.ts:298–309`、`fixture.ts:107–121`：

- fixture 将浏览器实际 Idempotency-Key/body 记入 wire，仅对匹配 turn POST 且 upstream.ok 时丢 ACK；不会把未受理 4xx 标成 committed fault。
- worker 首次须见 Receipt unknown 与 fault；重新加载后不应有额外业务 POST；只有点击真实 Recovery “Retry original request” 后才期待第二条 turn POST。
- 第二条 key/body 逐字等于第一条，且持久 command phase 变 accepted。没有换 key/body 的宽松 matcher。
- IDB saved next draft 在 retry 后仍存在；这是持久 next-draft 独立性，不等于它已自动恢复到新 composer。当前源码设计为显式恢复，不应把“自动恢复文本”额外写成已验。
- `coverage.cookieSse = PASSED`（309）只由某个 `/stream` cookie/no-bearer HTTP 200 wire 推导。wire 在响应头到达时就 push（fixture113–114），没有验证 SSE 事件内容到达/被 UI 应用；应将结果限定为 cookie-authenticated SSE handshake，不能称完整 SSE delivery/reconnect 已测。fixture 119–120 源码确实 pipe SSE，但不等于 worker 已验事件消费。

这些是现证据的精确边界，不新增 server 幂等算法或 SSE 行为缺陷结论。

## 其余 selector / 覆盖限定

- Use saved.txt 的 accessible name 在 Picker:40 通过 aria-label 保留，短可见 Use 文案不会使此 locator 必然失败。
- Files Dialog 标题与关闭后焦点恢复在 plugin-integration/react.tsx:287–290；浏览器使用 exact role/name 与之匹配。
- Recovery dialog/row/button 文案见 recovery/binding.tsx:287–296，和 openRecovery / restore / retry locator 一致。
- Offline 文案在 App.tsx:1144，与 browser343 完全一致；此前连接页的通用内部 error 文案不能替代这个 role=status 字串作反例。
- themes390 用鼠标 click 打开恢复面板，然后 Escape 并核焦点返回；它能证明关闭键盘/焦点恢复、几何和截图，不证明从页面其他位置 Tab 遍历/Enter 打开全过程。命名 “keyboard reachable” 比实际断言略宽，报告应限定或增加真正 keyboard-open 行为。此为覆盖表述，不是本轮 P2。

## 审查方法与未做事项

复用既有本地 find-skills / codebase-design / clean-code：区分 Input 与 composer 两种真实 authority、沿实际 public UI→private binding→request 追调用，关注断言是否跨越正确 seam、失败归因与异步顺序。不安装、不联网、不新增测试实现。

没有检查父进程 supervisor 的时间/空间/进程组/DB 清理正确性（root 独立负责）。没有运行产品 import、types、Vitest、IDB、浏览器、PG 或任何服务；0 项目写、0 claim。本次报告不可替代 fixed harness 的运行准入或完整 Recovery review。
