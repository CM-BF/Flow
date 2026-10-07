# TODO11 真实 App 消息设置：最小接线设计

**结论：不能只挂 Picker。无需新增 HTTP/public DTO；必须补齐 App 草稿 → Send/Queue 原始回执 → Recovery 完整草稿这条现有链。**

固定输入：main `8c92e64520ba7496b507d08cb4abe9c8d83e37a1`；Quick `7e9f0582a88e2ede7e10576a420a47970575d2cf`（组件 fe6，浏览器 dde）；Recovery `344f12cc9407a1cce8d17e2d9371cf8d0fb9a4b5`。完整 blob/SHA256 在 sources.json。main catalog/selection 等于 Quick，但 Picker 不同；main App 尚无 Recovery。因此首先需合法集成 owner 提供包含三者必要已审变更的固定基线，不能用旧 App/Thread/session 整文件覆盖 main。

本段只读，未领取写权，未运行工程检查、Node/import、HTTP、PG、Chrome 或容量采样。Quick 7e9 clean；Recovery 正在修改的两个测试不在审查内。方案与验收均 NOT_IMPLEMENTED/NOT_RUN。

## 1. 已证实的关键缺口

| 固定源码/行 | 事实与必要改动 |
|---|---|
| Recovery `recovery/binding.tsx:34–69`；`App.tsx:653–664,696–724` | CompleteDraft 只有 text/intent/creation profile/steering/project/knowledge/attachments，**没有 messageSettings**。decoder 重建时不会保留此未知字段；App 保存和同步恢复也没有它。须同时补可选字段、公共 codec 与原子 prepare/apply。 |
| Recovery `ConversationThread.tsx:80,101–145,161–179` | pending capture、Send/Queue 调用和 submit schema 输入没有 settings。须在 official composer send/清空及任何 await 之前，与意图和材料一起捕获本条完整快照。 |
| Recovery `conversations/projection.ts:294–307`、`outbox.ts:93–103`、`queue/projection.ts:111–120` | 显式输入构造只复制 text/knowledge/attachments；UI 选值仍会漏发。必须逐入口传递，retry 仍使用原 key/body。 |
| Recovery `conversation-context/receipts.ts:12–23`、`queue/commands.ts:46–50,106–121,129–137` | 现 helper 深冻结材料，其余嵌套对象只是 spread；public schema 解码/克隆不等于嵌套只读。建议在原 receipts 文件增加小 `freezeConversationRequest` 包住材料冻结及 settings codec/深冻结，仅原 outbox/queue 回执入口复用。不要把 live catalog 校验加到原 key restore/retry。 |
| main `contracts/conversations.ts:29–35,47–62,134–144`、`conversation-queue.ts:15,32`；`client/index.ts:397–402,531–535` | 已有 optional `messageSettings` payload/capability/A-B 回读以及 client 校验。`turnSettings.choices` 是 catalog 的声明，不是消息 payload 名称。复用绑定 closure 的 claudeMessageSettingsProfiles；不新增 DTO/header/API。 |
| Quick `ExecutionProfilePicker.tsx:89–173`、`selection.ts:140–154` | required Symbol、同步 live-host CAS、每 opening 撤销和写后异常 unknown 已实现。omit 的 capture 提前返回，因此仍必须先核宿主 ownership/授权，不能直接 setState(undefined)。 |

## 2. 唯一 authority 与模块接口

**Applied C 的唯一 owner 是 App 已有每个 View 的草稿领域**，与 intent 同层：增加 `messageSettings?: Immutable<ClaudeTurnSettings>` 及非序列化 `settingsOwnership: symbol`。React render、catalog 和插件 binding 都不另存一份 authoritative C。catalog 只拥有授权列表；A/B 只读原 receipt/public GET 的 frozen snapshot，不从当前 C 推导。

私有 adapter 接口只需 `readCurrent(viewKey)`、`commit(viewKey, expectedOwnership, next)` 和订阅/失效通知。commit 复用现 `commitMessageSettingsChange`；真正提交栈同步核 stable view 存在且归属当前 workspace、connection generation/授权、visible/editable、当前 plugin activation lease、ownership、最新 negotiated profile/capability/catalog。无 await；写入 C 后同步换 token、通知 Recovery.changed，再渲染。通知写后抛错仍保现 unknown 语义，不能声称 C 未改或自动重试。

以下失效在真实宿主事件处处理，不等 props 更新：新稿/同值替换、完整 restore apply、view 释放、连接退出/切换、plugin disable/re-enable、creation profile/授权身份改变；draft route 改为 conversation 不自动等于新稿（App:433–466,603–620）。新稿即使保留相同 tuple 也换 token；隐藏/merge/split 要撤销旧开口及旧焦点权限。现每次 opening 的 close/cancel/details/unmount/success liveness 保留。token 不能进入 public PluginContext、命令 JSON、journal 或服务器。

新稿值策略需明确：建议保留用户显式选择供后续消息使用、但换 ownership；不从 A/B 或 profile.baseModel 自动填值。这是 **host 新增行为建议**，当前 leaf 没有发送后消费语义；若原 TODO11 已规定一次性消费，以该约束为准。不论策略，不能把“省略”解释为重置/继承/实际生效。

Thread submit 捕获有名对象中的 settings，与现 pending intent/text/creation/material 同步冻结；onNew 只传该 capture 到 Send/Queue，不在 ACK 后读 C。不存在 settings 时继续省略 JSON 字段，保持旧中心纯文本可用；存在但不再授权时阻止新提交、保稿并说明，不静默 omit。新会话尚无 negotiated GET 时复用 projection.prepare + refresh，不能单凭 catalog/baseModel 授予 requested model，也不能给未声明 adapter/Codex 假造 Claude capability。

## 3. Recovery 与原回执

- CompleteDraft 可选字段缺失兼容 undefined；存在时用公共 claudeTurnSettingsSchema 解码并脱离/冻结。非法值拒绝整份 restore，不悄悄删字段。保存单个 ≤1024B 公共快照，不存 catalog/filter/token/完整 ACK。
- App.recoveryHost.draft 读取同一 C；protectedReasons 与恢复前“当前稿为空”判定纳入 settings-only draft，避免关闭/覆盖仅选择了设置的 view（App:559–575,680–692）。
- 仍走现 restoreConversationDraft：await 后 lease 全稿核对，全部材料 prepare 完才同步 apply C/text/intent/profile/ordered materials；apply 换 token。draftIdentity 已 JSON 序列化 host draft（binding:383–394），加入字段后自然参与比较；每次 settings change 都要通知，恢复等待时 A→B→A 也不可隐藏已发生的编辑。
- 合法保存值遇 catalog 缺页/失败/能力尚未读取可恢复为“保留但未核验”，不删值、不自动 POST；新 Send/Queue 须当前授权。原 receipt retry 则保原 key/body/settings，不被新 C 或目录重写，public decoder 决定 accepted/unknown。
- beginHandoff 前完整稿须包含 C；失败保原稿，原 receipt 已冻结后下一稿不被 late ACK/恢复覆写。保创建两阶段、journal transfer/CAS、accepted/rejected 原语义。保存 requested 不宣称 observed。

## 4. 现 P01/Thread 复用与紧凑 UI

真实 ComposerActions 已通过 `plugin-integration/react.tsx:120–122` 挂 `chat.composer.actions`；Thread components 已使用它。`plugins/types.ts:134–148`、`validation.ts:254–258` 限制 custom panel 只能放已注册的 `chat.composer.context` 等 slots，**不能塞到 actions**。actions 按钮标题是 manifest 静态值（plugins/react.tsx:50–62）。

推荐新私有 `plugin-integration/message-settings.tsx`，复用 Knowledge 的按钮命令 + context panel 模式（knowledge.tsx:139–143）：静态“消息设置”动作打开同一浮层；context panel 显示紧凑 applied C 模型/思考力度/速度摘要与同一个 Picker。现 PluginView/PluginHost 执行及 dispose 都使用，不用裸 data-extension-slot 冒接线。Picker 只补可选受控 presentation open/close/合法 focus-return，供动作和紧凑入口共用；它不接管 C/commit，不模拟隐藏按钮 click，不重新实现第二套选择器。

adapter 只持 opening/activation lease 及 host port。activation signal abort 即失效；不能只检查 list().state===active（disable/re-enable ABA 会复活旧闭包）。可沿 ui.layout 呈现/打开，但真正写 C 仍需 App 私有 CAS；它不是泛插件 draft 写权限。插件不得获得裸 FlowClient/token/CSRF；不加 public slot、host command、全局 registry 或第二 host。

root6729 紧凑要求：短模型/思考/速度主入口；目录、说明、工程身份下钻 details；header 与 Apply/Cancel 留在可见操作区、正文独立有界滚动；ep 局部样式复用现圆角/阴影/材质 tokens，不改 shared Dialog。普通标签和180字符/equal-prefix 长名分别验收；视觉可限高但键盘/触屏可查完整身份并区分同前缀，不仅 hover title。requested/observed 分离。已有两图是压力 fixture，不覆盖这个新布局或真实 App。

## 5. Exact literal 候选：NOT_TAKEN

完整真实 App/恢复/紧凑 UI 的最小建议集合，须 manager fresh 交权：

| path | 必要职责 |
|---|---|
| apps/web/src/App.tsx | sole C/ownership、catalog closure、prepare/restore/protection |
| apps/web/src/conversations/ConversationThread.tsx | capture/handoff、真实 private PluginView mount、能力文案 |
| apps/web/src/conversations/projection.ts | send snapshot 传递 |
| apps/web/src/conversations/outbox.ts | request/settings 冻结与 restore |
| apps/web/src/conversations/queue/projection.ts | enqueue snapshot 传递 |
| apps/web/src/conversations/queue/commands.ts | enqueue/restore 共用冻结，原 retry 保真 |
| apps/web/src/conversation-context/receipts.ts | 小 freezeConversationRequest，材料算法不改 |
| apps/web/src/recovery/binding.tsx | CompleteDraft codec/摘要 |
| apps/web/src/plugin-integration/session.ts | 单 builtin 注册与私有生命周期 |
| apps/web/src/plugin-integration/message-settings.tsx（新） | host port/贡献/presentation；不 owns C |
| apps/web/src/execution-profiles/ExecutionProfilePicker.tsx | presentation 窄接口、header/body/actions |
| apps/web/src/execution-profiles/execution-profiles.css | 局部 compact/long identity/viewport |
| apps/web/test/conversation-recovery.test.ts | 真 host/receipt/restore 函数回归 |
| apps/web/test/conversation-recovery.fixture.ts | 现 actual App fixture 合法 catalog/capability 输入 |
| apps/web/test/conversation-recovery.browser.ts | 实际 App 完整链及正常/长名截图 |

另加原 TODO11 唯一 owner plan/evidence；若继续 WPF-MESSAGESETTINGS02 即 plans/wpf-message-settings-quick-controls/**、docs/evidence/wpf-message-settings-quick-controls/**，不得重复建父计划。是否同 feature 后继 WT 由 manager 根据固定组合决定，不沿旧停写 scope 直接实现。

App/Thread/projection/Recovery/session 及仍在改的两测试属于 Recovery 共享交接重点，必须先固定和 exact handoff；Picker 原 Quick 停写范围也需后继授权；CSS 单独核权。只读保留 catalog/selection/public contracts/client/Thread primitive/plugins host/types/validation/shared Dialog/global tokens/server/lock/registry。若已有 PluginView 无法满足需求，先报具体接口缺口，不暗扩这些保护文件。

## 6. 最小有效验证（尚未运行）

1. 用实际 host CAS 验旧 queued callback/props lag/same-tuple 新稿/双 pane/disable-reenable/logout/details 后重开，旧 Apply/omit 均不能提交或抢焦点；开口失效与真正写 guard 分别验证。
2. 真 App Send A、Queue B 后编辑 C，settings + 有序 knowledge/attachments 一起冻结；lost/unreadable ACK retry 原 key/body/settings 一致，C不回滚，GET A/B 不随 C 改。复用实际 fixture/零 provider，不用 mockrestore 自证。
3. reload/close-reopen 恢复全稿；settings-only 保护；旧字段缺失/非法值；后页 profile/未知 capability 保值但新提交受限；deferred restore settings/omit/ABA 编辑冲突和原 slot CAS；零自动 POST。
4. 实际注册 action/context panel；普通名及180字符/同前缀、双390主题、键盘、可见主操作、close/refresh/focus；原生 Unicode 是 Chrome trusted CDP 输入，不冒 physical IME/OS popup。
5. 已审 leaf 26 direct/6组/2PNG 保原版本事实，不能充当新 host 完成；新增布局和 pipeline 只补直接相关检查，不重复历史大矩阵。

## 技能/质量记录

本地 find-skills 定位后复用 codebase-design（小私有 port 隐藏 live authority）、clean-code（唯一 C、统一冻结、无静默 fallback、unknown 与失败分开）、assistant-ui（现 runtime/Thread 分层，不替换官方 composer）。实际技能 SHA 在 sources.json，无安装/更新；不以技能最新 API 猜固定依赖行为。安全点发现并落实到设计：遗漏字段、嵌套 freeze、P01 slot 限制、activation ABA。无新通用框架、第二 store、公共契约或执行批准。
