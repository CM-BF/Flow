# I01 最小接缝与状态归属

只读基线：M02 metadata `c526c1c889437ee39155d669921577995195c74e`；P01 类型参考固定 `e5341915ebbffd9a667f68f7d1ca9c45c14c7c52`，后者尚未整体批准。2026-10-06 03:00 UTC，workspace_panels_owner。本文是实施映射，不声称已挂载。

## 状态归属

- `App.tsx:319` Workspace 继续拥有 chat groups/activeGroup、views、drafts、overview、panelOpen 与 `panelTabs[taskId]`。`select`（385）、`setPanel`（442）、`WorkspacePanelMount`（795）已有真实导航/面板/详情 callbacks；新模块适配这些能力，不拥有第二份任务状态。
- `plugin-integration` 管连接级稳定 host/ports、navigation/theme/workspace 窄 store 与 declarative slot 包装。publish 只在对应值实际变化时发通知；不能把每次 JSX 新 object 当稳定 snapshot。App 组合时同步快照，不向插件暴露 Map、FlowClient 或 token。
- 原生 `WorkspaceTabId`（files/terminal/detail:id）由 App 每 task 的 `panelTabs` 控制；WorkspacePanels 自有 Map 保存 openDetails/tree/follow。插件 contribution 的面板选择只控制扩展容器，不能另管这些原生 tab。保留 mounted view 或已验证布局缓存以跨 task/贡献切换；依赖 PH-R4 修复，不通过复制旧面板实现绕过。
- 连接会话持有单调 epoch/closed 标记。断开或替换 client 时立即令 bridge 无效并调用 host.dispose；所有 bridge 副作用检查 epoch 与 meta.signal，await 前后都核对。旧 closures 不可使用最新 callback 指向新中心相同 ID。普通断网只改连接状态，不能因暂停 SSE 取消已发送命令/清幂等键。
- 2026-10-06 03:04 UTC 补充：整个 plugin view lifetime 必须 key 到 host/connection scope；只替换 host prop 不保证清除 renderer 局部 state。切中心卸载 active 与 hidden visited panels，丢弃旧 tabs/tree/cache；新中心相同 task/reference IDs 也重新建立。正常 task/贡献切换保持缓存，和此销毁规则分别验收。旧 host dispose 后 bound commands 必须拒绝；迟到 activation/command 不得跨 epoch；不向 context 发布 token/client 或未经授权原始数据。

## Slot 映射

| Slot | 当前位置与最小改动 | 局部 context / 既有命令能力 |
| --- | --- | --- |
| activityBar.primary / bottom | App 485/527，现竖向 rail 加真实 ExtensionSlot | global 或当前 workspace；flow.chat.open / flow.workspace.open / flow.theme.set，按 manifest capability 授权 |
| sidebar.header / footer | App 544/616，常驻容器独立于 fixture 文案 | global；ui.navigate 或 theme.write，不放 owner token |
| sidebar.item.actions | App ChatListItem 153，移到每一行独立 action 容器，不能套在整 nav 或嵌套 button 内 | task(task.id)，行 B 保持 B；flow.chat.open |
| chat.header / task.actions | App 626 / ChatPane 223，修正状态条旧 message 标记为 task slot | task(view taskId)；ui.layout 导航。决定/取消仍原 projection 明确 UI，不新增未声明插件命令 |
| chat.message.actions | 官方 thread.aui.tsx 的 AssistantActionBar 669、UserActionBar 778（必要时 SpokenActionBar 362） | message(taskId, useAuiState 实际 message.id/role)；不能把 TaskThread prompt/entry guessed index 当身份；原复制等官方动作保留 |
| chat.composer.actions | thread.aui.tsx ComposerAction 467，脱离 Input 上的纯属性 | composer(viewId,isDraft)；默认 composer.write 不授予，insertText 显式 unsupported |
| workspace.header / tabs / actions | WorkspacePanels 133 的 header/真实原生 tabs，App 的扩展容器组合贡献 | workspace(taskId, native tabId)；flow.workspace.open/close。不得创建竞争的 Files/Terminal/detail 状态 |
| artifact.actions | 当前 WorkspacePanels 164 的 activeReference 区域附近，使用已领文件内 composition，不改未领 panels.tsx | reference(taskId,referenceId)；flow.reference.load，必须匹配该 task.entries；不提前取内容 |
| settings.sections | 新 plugin-integration 设置/诊断视图，App rail 打开；Connection 846 只保留连接表单 | global；主题与插件启停/list/diagnostics，不暴露凭据，不将连接表单当插件管理完成 |
| theme registry | themes.ts 的 applyTheme/initialTheme | flow.theme.set 接 host 验证的 ThemeDefinition，清旧 token；禁用回 light/dark 并更新稳定 theme store |

真实消息 seam 可给官方 Thread 添加小型 `MessageActions`/`ComposerActions` component override，仍在其 runtime scope 渲染；TaskThread 提供 task/view context，插件组合在 `plugin-integration`，避免将 host imports 塞进通用 Thread。保留原官方 Thread、外部 runtime 和 ReferenceUI。

## Bridge 行为

| Host command | 现有 callback / 必要核验 |
| --- | --- |
| flow.chat.open | select(taskId)；核 catalog/已打开 snapshot/已知 workspace 索引的 task 身份，允许局部 B，不仅 active A；未知 ID 明确失败或显式加载核验，不伪成功 |
| flow.workspace.open | select(taskId)+setPanel(tab,taskId)；detail:id 必须属于该 task 快照；等待切 task 后的真实 panel/tab 挂载保留现有 focusRequest 机制 |
| flow.workspace.close | setPanelOpen(false)，只隐藏视图，不 cancel、不清草稿 |
| flow.reference.load | 已有 TaskProjection.loadDetail；匹配 task 与 reference、按需/cache；错误以 bridge throw 向 host OperationResult 传播，不能吞错 |
| flow.theme.set | themes.ts 支持已验证 descriptor；清前主题 tokens，更新 App theme/窄 store；host fallback 同一路径 |
| flow.clipboard.copy | 浏览器 clipboard.writeText；权限/API 失败明确错误，不能静默成功 |
| flow.composer.insertText | 当前无安全注册能力，显式 unsupported；不伪造成功、不 querySelector 改 textarea。若后续实现须真实 runtime 与 view 生命周期注册并另测 |

Runtime/PTY、任意磁盘、提交/决定/取消等未在 P01 HostCommandArgs 内的能力保持不支持。普通文本输出仍标 Task output；引用树仍限中心返回范围。

## 实施前风险

PH-R4 证明 `PluginView` context key 重挂会丢 WorkspacePanels per-task Map，修复归 P01。theme descriptor 与 default palette 的适配在 I01 受领 themes.ts 内；禁用贡献后的焦点回到相邻原生 tab 或 rail 入口。最小回归包括 B 行命令、双 split 两个 message 上下文、同 referenceId 跨 task、不在线错误、同 taskId 跨中心、8 chat 连接预算及未展开 0 detail；不为 metadata 重跑产品测试。

03:04 UTC：PH-R4 修复 6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6 已由本 owner 只读复验建议关闭并回 root；不在本目录复制 P01 进度事实源。I01 尚无实现。跨连接回归需两个中心复用同 task/ref IDs，覆盖可见和隐藏已访问 panel，以及迟到 activation/command；测试不能只验证普通 A→B task 切换。
