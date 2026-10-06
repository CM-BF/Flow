# 实际附件生产接线 Interface

固定输入为 `1c4968354dabce1e6748f3301a2e6eecd33e77d4`。既有Input controller/recovery/adapter与公共DTO/client/matcher均未修改；Picker/CSS经v3显式授权仅修窄屏动作展示，公开接口/冻结语义不变。P01 是唯一插件生命周期，App/CACHE 是唯一 view 保留与回收 owner；本片没有第二 registry。

## 材料与收据

`freezeMaterialRequest`（旧 `freezeKnowledgeRequest` 为兼容别名）detach/deep-freeze knowledge/attachments，各自保序、共同 project 与四项约束。字节预算由已审 Input 的 metadata 和中心权威共同检查；不把正文注入 timeline。Outbox.begin 与 QueueCommands.execute 实际调用。Queue ACK 沿公共 `assertConversationContextMatches` 第三参 `{projectId, attachments}`；Turn ACK 沿 FlowClient 公共 decoder，未复制 v2 校验。

非空 attachments 使用已确认 conversation.projectId/capability 与 v2；空数组在正式 projection 入口省略，plain/v1 行为保留。新建 ACK 在本固定中心代码中保守广告 false，prepare 成功后真实 GET 刷新权威 snapshot，不自行设 true。该 GET 失败时保持原配置/草稿并要求用户恢复，不暗发。

一次 click/Enter 在官方异步 preparation 之前同步 capture delivery intent、profile、knowledge token、text、附件引用/IDs 与旧本地 receipt 身份。onNew 重新核 capture 和 scope，调用真实 projection/Queue，确认新本地 receipt 同栈拥有同一 intent/text/conversation/有序 refs 后 consume；网络 ACK 不清新稿。未知 ACK 永远原 key/body/ref 顺序。失败无 receipt 时保留 held 原稿；新稿非空不拼回旧 text。

## 私有绑定与插件

`ConversationAttachments(identity, options)` 接 App 私有 six-method Pick<FlowClient>、P01host、signal、current()、storage。固定 identity 为 connectionId/viewKey/projectId；Input.viewId 使用 stable view.key。current() 每次验证同一 projection 仍属于当前连接/view，再给当下 route、conversation、project、pane/page visibility、online 与独立 read/upload authority。route alias/CREATE 不重建 Input；IDs/manifest 本身不授予权限。

`flow.conversation-attachments` 提供真正的 Files button 和 composer.context panel。@file+Tab 走同一 P01 open command，选中后只在文本仍等于触发时删除 marker。paperclip/drag 复用官方 AttachmentAdapter；停用插件撤 adapter/读口且保留材料，非空材料不能静默转纯文本。上传 command 只调用 private raw write，不回调自己。

六个公共方法是薄 HTTP transport，并不保证 runtime shape。本片旧 Input 继续公共 schema parse。实际名称为 attachmentCapabilities / attachments / attachment / attachmentContent / uploadAttachment / attachmentUploadReceipt。只有明确 upload-receipt 404 code 映射 null；401/403/其他错误及坏200不吞成“不支持”。404不证明原POST没有提交。能力缺省/false拒非空材料，纯文本仍可用。

## 生命周期与保护

visible 是实际聊天 pane/page，不是 Dialog open；两个 split pane 分别有效。隐藏/离线/撤权使旧读和 capture 失效；离线清能力缓存，恢复后按显式操作重取。Dialog close 不改变发送资格。关闭 tab 沿 CACHE 保留有材料 view，不无条件 dispose；真正离开连接有用户提示/beforeunload尽力保护，旧授权同步失效。

private input facade 只拦官方 complete/准备过程的自动 reconciliation remove。官方准备失败/取消可能完全不调用 onNew：绑定订阅公共 submission/inTransit 终结，释放 pending 为 failed recovery。失败恢复到草稿后，真实 Remove file 仍删除 controller item；held 原材料只由显式 discard 或新本地 receipt 接手解除，不因隐藏或网络回执消失。

持久 journal 是跨 view 的有限恢复目录，不代表当前 draft。只有本 binding 实际 journal.begin 的 upload key 计入未知保护（即使 chip 后来移除）；同/不同 project 的新空 view 不因继承 unknown 被 pin。目录记录仍完整可见、可显式恢复、不自动过滤/删除。storage 拒绝/损坏在 binding 本地显示，保 raw/unknown，不让 Session/纯文本 Thread 构造失败。

## 恢复边界

本片实际浏览器 reload 验证的是已发 upload 的非敏感 key/scope/digest/filename 元信息恢复：相同授权 project/scope 下显式查询第六公共方法，成功只回元信息，不自动 POST/附新稿/发送。旧 namespace/404/损坏200语义另由定向消费者覆盖。已选 ready 草稿、Send/Queue unknown receipt 和正文不跨 reload 持久保存；跨 tab journal 原子性不在本片。新中心 URL 相同也不自动重用旧权力。

实际 factory 固定在本任务 base。后继 main 的 context-history producer × attachment-only 共享缺陷由其 owner 修复并在集成阶段验证，本片没有省略附件、禁用 history 或私拷 server 来绕过。无真实 provider/个人服务验证，runner-file、任意格式和大文件不属于 text-v1 首片。
