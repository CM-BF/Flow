# F01 消息设置生产直接消费

2026-10-06 17:29:14 UTC，新写source `0ee2494ed4298169c56ac3a6950fa1910ed62a7a`，scope仅index与专测；CORE34源ea276与C01最终9源6d114均独审后精确受控输入，禁止编辑domain或重新设计client。前一O14片已main bd14，原批准不覆盖本片。

唯一factory新增import/await migrateClaudeMessageSettings：030后，authentication/package worker/scheduler/任何scan之前。现profiles/conversations/queue继续同一全局auth和既有route注册，不加timer/transport。

唯一生产专测调用真实createServer，不手动迁移032。公开FlowClient发布合成configured tuple、协商新catalog并核旧reader隔离。create ACK明确无动态messageSettings；当前GET返回profile绑定能力，create原key重放保持原receipt。发送A/入队B后变更草稿，receipt/current read/SQL仍各自冻结；多字节preview精确。已收到ACK后重启，以原key/body恢复send/enqueue，异body409；1task/1queue/0attempt，无runner/SDK/query，配置不代表账号资格。

一个随机marked DB；exclusive0600 checkpoint先记录DB/marker/creationRequested。关闭app/pool后最多3s观察pid/state，逐次有限查询、安全错误事实；仍非零或异常保留，不FORCE。marker+零连接后先fsync checkpoint再正常DROP。证据<=32KiB。fresh门槛/实际独占窗口由Lead安排，计划总增量32MiB、work120s/cleanup30s、raw<=2MiB/cache<=8MiB，不是已测峰值。

实际闭包179源、29SQL（2/4..30/32，含12/13与17/19数组，inline1/3）、15包入口、11配置；missing=[]，全部@flow本树；[预检](claude-message-settings-production-preflight.json)绑定两来源和当前新写target。无安装。旧source/raw不重复测。

仅focused types已执行：首次per-query query_timeout字面量不匹配@types/pg（exit2原样保存），沿已安装pg8.23.1真实支持的同query对象修为类型推断，未cast或去除超时；最终exit0。创建capability测试预期由Lead只读纠正到现CORE契约，未改CORE。PG/生产旅程仍NOT_RUN。
