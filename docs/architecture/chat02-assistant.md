# CHAT02 typed final 正文

既有adapter只保存Claude result artifact。首段在原有session→usage→artifact/verification链路后增加assistant-final，正文严格来自成功且is_error=false的SDK result.result；迭代到stream结束，忽略assistant/partial/tool/thinking/subagent正文，因此不重复拼接，也不依粗message ID去重吞tool。新adapterVersion为claude-sdk-0.3.290-v2，旧v1 artifact投影兼容限CHAT01旧记录。

runnerEvent扩展assistantFinalDataSchema：稳定messageId=SHA256(JSON.stringify([nativeSessionId,result.uuid]))，source='claude.sdk.result'，sourceMessageId=result.uuid，正文<=1MiB，settings拆requested与effective。effective只取SDK init明确报告model/permissionMode/tools；无init为null，thinking有效状态unknown。requested反映本adapter实际传入SDK选项，不证明服务端全部应用。stream delta、queue/steer和前端设置尚未接线。

中心在reportEvents既有事务/ordered序列/owner fence之后保存：必须claude task、已登记同native session且当前归属同task/runner；taskId/attemptId全部来自中心，不接受conversation字段。每attempt最多一条final；messageId跨attempt复用拒绝，重报相同event沿现有digest精确去重。先session再final，无session拒绝。final记录本身不宣布任务成功，不代替artifact独立核验；CHAT01按自己已绑定的task/currentAttempt读取且独立判断状态/verification。

009 migration保存assistant元数据，正文复用flow.details低层存储。轻列表只含正文引用与来源/设置，默认20最多100；正文按message ID读取。readAssistantFinal(client,taskId,attemptId)是CHAT01真实读取seam，最多一个1MiB正文。公开owner端点GET /api/tasks/:id/assistant-messages?after&limit，GET /api/assistant-messages/:id；不返回未筛选所有attempt正文。中心内部saveAssistantFinal使用同一transaction，不新增scheduler或第二归属账本。

测试：注入SDK iterator只控制外部事件，不mock内部存储；中文emoji、多个content block、重复delta/result、result后system、success+is_error、session不符与abort均可见断言。真实flow_chat02专库/动态HTTP测session-before-final、gap、重复/conflict、旧fence/attempt隔离、查询role、中心/runner恢复和错误无final。0模型/0云。schema与详情字节上限拒绝超界，不静默截断正文。
