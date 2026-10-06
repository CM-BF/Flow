# K02 Interface（已批准语义，领域实现完成待组合）

contracts/conversation-context.ts为DTO源。conversation创建新增可选projectId，创建后不可变；turn/enqueue新增可选knowledge: KnowledgeCitation[]（<=4、无重复）。现有capabilities新增可选knowledgeContext?: boolean；旧中心缺字段视不支持，旧纯文本语义不变。

公共turn与queue item新增可选context: ConversationContextReference；只有id/digests/输入id/templateVersion/最多4项来源metadata，不含冻结text/compiled。原task.snapshot.prompt和user_text不改。新owner GET /api/conversations/:conversationId/contexts/:contextId → ConversationContextDetail，含固定text/冻结时与当前version事实，核双ID归属；实际JSON<=65536B。

migrateConversationContext(pool) 在7/11/15后、请求和queue scan之前；registerConversationContextRoutes(server,pool)在ready前、实际owner preHandler内。共享mount由F01接线。详情/发送/claim/queue/retry均已实现；生产自动mount与旧消费者组合待F01。

内部窄helpers：freezeContext(client,conversationId,projectId,userText,refs)→inputId|null；bindExecutionInput(client,taskId,inputId,conversationId)；executionInputForTask(client,taskId,rawPrompt)→private prompt+context metadata|null；copyRecoveryInput(client,sourceTaskId,newTaskId,originalPrompt,recoveryPrompt)→void。helper本身不创建pool transaction。runners.claim只调用读helper并覆盖返回assignment副本prompt，可附conversationContext只读metadata，不修改公开TaskSubmission。无context不新造记录。

contextDigest仅有序原citation+冻结text；executionInputDigest独立包括userText/templateVersion/最终中心prompt。retry两策略按现recoverySubmission重新编译，旧context不变；禁止新task丢binding或盲拷compiled。预算在send/enqueue/retry完成整个编译后检查16000 UTF16/49152 UTF8，原文ref合计8192 UTF8；当前原queue text16000 UTF8限制继续保持。公开JSON详情预算与raw bytes分开。

队列最多50项列表使用一次contextReferences输入ID批量查询；公开字段SQL显式allowlist，单item共用batch(1)。task/turn/queue非空input绑定不可清空或改绑，input FK与不可变context/input触发器保留失败关闭。runners.ts/runner.ts已固定7368497并由O07接收，K02 claim v2不再含其写权。
