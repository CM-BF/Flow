# WPF-CHAT01 输入与运行语义

2026-10-06 03:36 UTC。独立树web-conversations/codex/web-conversations创建前确认不存在，从已审I01最终b5844442699733558a152c12392ea78f26c393a4初始化clean。正式[take](take-receipt.json)为08259c1d-3711-4f5f-bf21-ad355ffa4cf3 v1；[I01 v2 amend](i01-amend-receipt.json)先移出App、官方Thread、plugin-integration/session.ts与react.tsx。live核验一致，未碰旧树移出路径。

按root/MainLead明确授权顺序消费固定输入：4c2408e4db3595879f6471cb5fffccadec975b3d成功cherry-pick为bac6a6efe6fa4866bac4d777ee61b703a0e2c7e3；84117ca1c7446ee2e2b50f0526f3460dd42a2869在client/contracts index产生内容冲突。实际差异关联其main上下文已有projects/goals/protocol exports，此旧I01基线没有；本owner未自行裁剪/拷贝/解决，保留现场报Lead。自有文档无覆盖，需解除cherry-pick才能提交首metadata。

公共client固定方法：createConversation(input,key,signal)、conversations({after?,limit?},signal)、conversation(id,signal)、submitConversationTurn(id,{expectedRevision,text,mode},key,signal)、conversationTurns(id,{after?,limit?},signal)、conversationDetail(id,turnId,detailId,signal)。中心实现仍进行中。revision仅CAS，不随异步reply增加，正文更新不能仅比较revision。

实际已读本地core0.3.22 external-store-thread-runtime-core.ts669–714：queue默认route由message.steer ?? isRunning决定，运行中普通send可变steer；react0.15.23 ComposerInput.tsx238–247的Ctrl/Cmd+Shift+Enter显式steer。base-composer-runtime-core.ts302–474会先分离清draft；异步普通Error不恢复，MessageNotSentError只表示确定未发。CHAT首capfalse不挂queue，以独立outbox保证ACK未知不覆盖新draft；真实Thread输入用isSendDisabled门禁保编辑。公开makeAssistantDataUI可渲染typed data引用，不需假造tool-call。

本地TaskThread.tsx85–121此前把task.entries作为assistant并禁用已受理composer，只适用于旧单任务路径；新的ConversationThread独立替换持续聊天路径，不改旧任务truth。TaskProjection保留任务观察与detail职责；App连接scope、两pane预算、草稿归属复用，conversation消息的插件上下文按turn.task.id映射。

03:38 UTC 共享owner受控解法（替代完整main merge）：按指令仅abort正在冲突的841，HEAD仍bac6；7份自有docs逐字SHA256比对保留。实际读取Lead的[manifest](web-chat-transport-manifest.json)和[patch](web-chat-transport.patch)，核所有3文件before hash，git apply --check/原样apply，再核3文件after hash全部相同。独立输入提交a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0，commit注明841来源和bac6适配base。没有手动改共享内容，不合无关main/goals/server/rootlock。公共接口依赖解除，真实中心与模型验收仍待其ready。

03:54 UTC typed合同受控输入：Lead F01 881edabff8761b04e5b5edd5e8dc0bdf94a726f1提供[manifest](web-chat-typed-contract-manifest.json)与[原始patch](web-chat-typed-contract.patch)，patch SHA256 a506697f64f8eb8e2b8c25a27e320be0b8dfc01183a897f076b03860877ccf8d与两文件before/after全部核合，原样git apply后独立commit746364e；conversations.ts来源a780，assistant.ts来源2e109850。未改export/client/共享实现。typed detail按UTF-8正文SHA256校验；tools是init可用工具集合，非已执行调用，thinking unknown不推断。
