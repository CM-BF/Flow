# 已登记附件条目插件动作：最小授权接缝

固定来源 `9a815eca7b86791733a57b29c21a1a5cea58ec0a`。沿原 WPF-001-05 / REQ22–23 与 MATURE03-03；这是下一实施片的接口建议，不新增任务、不表示已经实现或获准写入。只读 7 个固定 Git 源文件，清单见 source-manifest.json。当前 I01 正在拥有 react/session，后继必须等明确交权及独立工作树，不抢写。

## 结论

新增一个 `attachment.item.actions` 插槽和一个有区分字段的 attachment 上下文，复用现有 PluginHost、AppPluginSession 与 ConversationAttachments。不要把上传附件伪装为 `artifact.actions` 的 task reference，也不要把 `AttachmentInput`、FlowClient、journal、ComposerRuntime 或任意回调交给插件。

先接两个真实位置：当前草稿行、当前项目文件列表行。两者的按钮声明、发现与执行必须经过同一 registry；不是再放一个外部按钮容器。恢复目录可先有明确类型和拒绝条件，未接入前标为未实现，不能因为新 slot 存在就宣布所有附件动作可插拔。

## 现有边界与可直接复用的部分

- `plugins/types.ts:7` 的 ResourceContext 没有上传文件身份；reference 只有 taskId/referenceId。`validation.ts:24` 也限定 artifact.actions 为 reference。
- `host.ts:339–370` 已在激活前后做资源授权，并校验插件 session；`bridge:400–420` 在 host 命令前重验权限、复制参数并传入插件 abort signal；`bind:580–591` 可拒绝旧插件实例回调。保留这些，不能新增绕过 host.execute 的行按钮执行路径。
- `session.ts:175–184` 目前 attachment.read/upload 只接受 composer；`331–342` 的有效性检查没有附件分支。因此只扩类型和 JSX 会继续拒绝，或者迫使错误的全局放行。新分支须在 taskId 分支前验证。
- `attachments.tsx:64–87,113–135` 已持有 connection/view/project、当前权限与失效 lease；客户端仍为私有输入。`176–188` 的 recoveryDraft/captureDraft 已区分实际草稿成员与恢复目录。
- `AttachmentPicker.tsx:34–52` 的 draft/project/recovery 三类行直接调用 onRemove、select/onAttach、recover/upload/forget；它们不是统一插件动作。
- `react.tsx:271–276` 才是实际 assistant-ui Composer 添加/移除的消费者。直接调用 input.remove 不能代替 Composer 同步；input.items 也不能代替当前草稿成员。

## 建议的最窄类型

ResourceContext 增加 `kind: attachment`，包含当前 `connectionId`（公开的本地会话身份，不是 credential）、`viewId`、`projectId`，以及 target 区分联合：

| target | 身份 | reference 含义 |
| --- | --- | --- |
| draft | itemId | 只有宿主当前确认的 ready 成员可有固定 reference；未验证成员必须显式无 reference |
| project-file | 固定 AttachmentReference | 必须存在于当前 binding 的当前项目 metadata/page，保留 kind/projectId/resourceId/version/contentDigest 全部身份 |
| recovery-record | 现有记录的稳定 identity | 记录存在不代表当前 draft 成员；unknown 不得被补造 reference；ready 也只能表示可显式恢复选择 |

不在 context 中携带可被视为授权的 canRead/canUpload、可调用函数、File、原始文件内容或客户端。状态和名称可以作为单独只读展示投影；执行时不信任捕获的状态。不要为 recovery 再建一份 ID→record registry：使用原 journal 的现有身份，经宿主查找验证。具体暴露哪个既有 identity 应由后继 owner 在同一控制器边界核定，不把原上传 key 当成重新上传授权。

现有严格字段校验要覆盖新联合、无效字段和完整 reference 形状，返回深度不可变值。嵌套 reference 不可只做浅拷贝后交给插件。新增 slot 只接受 attachment；旧 reference 插槽与行为不变。

## 授权与异步边界

每次入口、每个 await 后提交 UI/草稿之前，都从 AppPluginSession 查当前 binding，而不是相信旧闭包：

1. 会话未关闭，context.connectionId 等于当前 session；viewId 仍属于该 binding，projectId 与当前 conversation/project 一致。
2. 插件声明并获当前 capability；宿主插件实例/command signal 尚有效；当前 view 可见性、在线与服务能力按现有动作规则判断。声明不是授权。
3. draft 动作以 binding 的实际 draft membership 为准；项目动作核当前项目页面固定 reference；恢复记录按原 journal 与项目身份查找，不能自动加入任何草稿。
4. 读取不得解析成最新版本；过期资源是否还能只读由现有 AttachmentInput 规则决定，本研究没有读取 controller，不能新造过期读取政策。加入新消息仍须经过现有 ready/expiry/四项与大小限制。
5. scope/auth/project 或插件实例失效后，回调不能继续读取、写缓存或更新 Composer；丢弃晚结果不等于已经撤销先前的副作用。不要通过卸载一个扩展来 dispose 整个 attachment binding、删除草稿、取消 receipt 或清除恢复记录。

最小 host 命令建议从 `flow.attachment.preview` 开始，参数不重复可被替换的 resource，使用绑定上下文的精确 target；内部复用原内容缓存与原 read authority。若需要 add/remove，同一片中显式增加 typed host 命令并调用实际 Composer 消费者，不能给第三方 onAttach/onRemove 函数。

读取能力与草稿修改能力分开：preview 需要 attachment.read；add/remove 不能仅靠 attachment.read 冒充 composer.write。如命令要求多能力，host 必须逐个核插件声明与宿主当前授权；不把现有每命令单 capability 映射直接当成双能力已满足。

**实现前的一处必要确认：** 本次限定 7 源的公开调用形状为 `input.preview(reference)`，未证明能把单个插件 command signal 传到实际 HTTP/缓存提交。后继 owner 必须先只读核 `attachments/controller.ts` 的接口；若它缺这个入口，精确增补该文件及其行为测试的 claim，再做薄的 signal/提交守卫扩展。不能另建内容缓存或以 command 返回失败掩盖旧请求仍改状态。这是接口设计需闭合的点，不是已复现的现有产品 bug。

## 两个真实消费者的验收

A. 在实际 BrowserWorkspace 的项目文件列表通过一个已注册行 contribution 预览固定版本，内容只在点击后读取。切页、切项目或撤销读取授权后，旧行回调不能读另一文件，也不能填充新项目的内容槽。新 slot 单独的示例页面不算实际消费者。

B. 同一 contribution 在实际 assistant-ui 草稿行工作，引用来自当前真实 Composer membership；移除 A 后迟到回调不能把 A 加回来、删除 B、改变有序草稿或改动已由 receipt 接管的材料。卸载/重载插件后旧绑定回调拒绝；保留正文、模型设置、当前附件顺序、unknown upload key 与恢复目录。

此外保持明确负例：伪造/多余字段、跨 connection/view/project、不同 version/digest、ready 被伪装的 pending/unknown、已离开当前 page/member、await 期间 revoke/unload 均拒绝。恢复 receipt 检查不会自动 send/add；完整双主题/窄屏/键盘检查沿现有 UI 验证段合并，不为不可见的类型修改重复整套产品测试。

## 后继 owner 与 scope

建议由原 attachments/插件接入 owner 沿既有任务，在 I01 明确释放后领取独立源码段；至少以上 7 个源中实际需要改的 literal + 对应 host/integration/controller 测试 + 原任务 plan/status/review/evidence，不能用 apps/web/** 扩大范围。与 W01 overlay 不共享写树；AttachmentPicker 与视觉 Picker 是不同文件仍应以实际 claim 重验。不把本文列出的候选文件当成已授范围。

先交付两行真实消费者的 slot 与读取命令，再按同一 context/授权边界接草稿修改、恢复行与其他动作；所有未接位置保留 TODO，避免将一个 Files 入口算作全按钮插件化。无需新 registry/store/transport，也无需 root 或外部 lead 直接改 I01 记录。

## clean-code 与性能

应用已读本地 find-skills、codebase-design、clean-code：深接口放在 session/binding 的授权边界，UI 只提供宿主生成的上下文和 slot。复用 host 的稳定 slot snapshot 与现有 input 订阅，context 只在真实身份/成员改变时更新，不依靠每次输入重新注册按钮。未测量性能，不声称加速或设计第二缓存。发现是能力/成员/取消信号边界缺少通用条目接口；没有运行代码或复现缺陷，也没有修改项目。
