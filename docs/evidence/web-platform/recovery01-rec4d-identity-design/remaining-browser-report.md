# Recovery 4d330 剩余 browser 流程只读预审

固定对象：`4d3303d7e107b400ebe8ecae62b8d843c0d1d4cb`，worktree `web-conversation-recovery`。审查 browser 398–524 及真实 App/Thread/附件/对话框接缝；12 个固定项目源的 blob 与 SHA-256 见 `audit.json`。外部仅只读现有 Radix Dialog 1.2.0 的 package/dist 字节，没有 import。本文 **SOURCE ONLY / NOT_RUN**，不是该子集行为通过。

## 新增有效发现：P2 — Recovery 对话框缺少外部插件按钮回焦接线

- 测试 `apps/web/test/conversation-recovery.browser.ts:367–372` 先 focus 真实 “Saved drafts and receipts” 按钮，再按 Enter 打开对话框；`:508–514` 在 390 两主题中按 Escape 后要求该按钮仍 focused。这个断言有明确键盘验收目的，不应删除或改成手工 focus 后再断言。
- 真实 `apps/web/src/recovery/binding.tsx:400–404` 把入口注册为 P01 `sidebar.footer` button，command 只调用 `workspace.open()`。`:295–296` 的 open/close 只更新状态/刷新，没有保存或恢复 DOM invoker。
- `apps/web/src/plugins/react.tsx:49–63` 实际渲染的是普通 `<button onClick=execute>`。`App.tsx:846` 单独挂载 RecoverySurface，`:946` 单独挂载 AppSlot。这两个入口没有共享 DialogTrigger。
- `apps/web/src/recovery/binding.tsx:406–416` 的受控 `<Dialog><DialogContent>` 没有 DialogTrigger，也没有 `onCloseAutoFocus`。`components/ui/dialog.tsx:9–15,32–45` 是 Radix Root/Content 的薄封装，没有替这个组件补回焦逻辑。
- 已装 `@radix-ui/react-dialog` **1.2.0** 的 `dist/index.mjs:37–39` 默认 `modal=true`、初始化 `triggerRef=null`；`:74–78` 只有 DialogTrigger 给该 ref 接按钮；`:174–176` modal 关闭回调先 `event.preventDefault()`，再 `context.triggerRef.current?.focus()`。这里 ref 未被赋值，因此默认路径既不会 focus 外部 P01 按钮，也取消 FocusScope 的 fallback。`:254–255` 确认此回调接到了实际 FocusScope unmount。

**可发生路径：** 前面场景顺利完成后，执行 themes390 的 Enter→Escape；打开会把焦点移进 modal，关闭缺少返回外部触发器的实现。固定源码与当前库字节已证明回焦接缝缺失，测试的 `toBeFocused()` 不能依赖 Radix 自动实现。**未运行浏览器，未声称观测到了最终 activeElement、错误截图或准确失败耗时。**

最窄处理方向供合法 owner 裁决：在现 RecoverySurface/宿主已有入口中显式保留并恢复真正 invoker（且检查仍 connected/有权限），或使用等价的现有 Dialog trigger 接口；不修改通用 PluginHost 权限、不造第二 registry。保留原 keyboard/geometry 断言。本文不授权或实施修复。

## 其余已核对应关系；不是运行通过

- 材料段 `browser:401–435` 的 `.aui-composer-attachments .aui-attachment-root` 对应 `attachment.aui.tsx:155,247`；完整 file 的键盘目标来自 `:167–186` 的 `role=button` / `File attachment`，tooltip 名来自 `:212` 的 AttachmentPrimitive.Name。`AttachmentPicker.tsx` 真实暴露 Files in this draft、Browse files、Use <完整name>。目前没有由固定源码证明这些名字必然选错的新增反例。
- `plugin-integration/attachments.tsx:174–179` 在 captureDraft 中对任何未 ready/metadata 缺失材料抛出原 “Verify every selected file...” 错误。`ConversationThread.tsx:161–180` 的提交捕获在实际 local receipt/network 之前进行，`:219` 保留 sendError alert。`attachments.tsx:184–199` 的 composer 同步按实际选择顺序，并阻止 later-ready 先越过 earlier-unverified。因此保留 `browser:404–435` 的 noPOST、no new command、A/B 顺序、仅显式验证后 chips 出现等断言；没有用正文读取或提前入 composer 绕过。
- `browser:462–468` 已使用公开嵌套 `turn.task.id` 并要求非空，与此前两个 undefined 假相等问题不同；原 key/body、turn/task、replayed、ordered attachments 断言不能削弱。
- 当前子集用 `.filter({visible:true})` 选择 Message input；其余 role 查询默认只取可访问树，且该片没有 split/merge 步骤。App 的 retained hidden Workspace、认证切换和离线到重新认证仍需 actual browser 验证；本次没有证实额外隐藏 view 的重名选择器问题，不把潜在异步时序当 confirmed bug。
- `pageOnlyAuthLoss` 的 IDB abort/401/retained draft、cross-tab CAS、真实 cookie SSE、离线提示以及 CSS/390 几何均保留待运行状态。本次只读不足以证明其时序全部成功；未调整任何断言、timeout 或 fault。

## 明确排除与限制

两处 draft row 身份/定位原因由 panels 原 owner 处理，本报告不重复计数；没有审 moving dirty 文件。未修改 Settings/Recovery 或其它项目，未跑 tests、Node/product import、类型检查、PG、Chrome、HTTP、空间采样或个人服务探测。既有 clean-code/webapp-testing 本地方法复用；没有安装/升级技能或依赖。外部库观察只绑定审计中的已存在只读 realpath/hash，不冒 immutable Git 源。报告仅 own `/private/tmp`。
