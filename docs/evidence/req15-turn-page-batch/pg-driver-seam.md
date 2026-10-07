# REQ15 PG测量观察接缝

2026-10-06 21:57:19 UTC，仅静态读取本树既有donor，无import/连接/测试。pg8.23.1及其现成pg-protocol1.16.1来源/bytes/hash见[固定输入](pg-driver-inputs.json)；未增依赖或link。该接缝尚无可执行fixture，也不代表真实测量已发生。

## 来源与可测事实

- pg/lib/connection.js `attachListeners`（约140–148）：protocol parse产出msg后按msg.name发同名事件；可仅订阅dataRow、readyForQuery、rowDescription，无需监听泛message（后者会切换_emitMessage）。
- pg/lib/client.js:261/264注册driver自身readyForQuery/dataRow handler；:455–463将msg交Query处理，:388–395 ready状态完成当前query再推进队列。fixture普通on listener可在driver之后观察，Promise await的后续在本同步emit返回后的microtask恢复；测量期间不pipeline/不同时向该subject排多query。
- pg/lib/query.js `handleDataRow`与pg/lib/result.js `parseRow`逐field解析到新row，并不改msg.fields数组。JSONB在Result中解析为JS对象，但msg.fields仍保存解析前的SQL text值；观察对象不需要替换parser或拦截SQL结果。
- pg-protocol/dist/parser.js:228–236读取每字段int32长度，-1→null，否则reader.string(len)；dist/buffer-reader.js:8–9、35–38用utf-8 decode。对本fixture约束的UTF8连接/text-format字段，Buffer.byteLength(field,'utf8')等于原始字段载荷字节；DataRow null计0。不包含长度word、协议消息头、TCP/TLS、ReadyForQuery等控制消息，不能称完整网络流量。

## 实现边界（待fixture source审）

只为本fixture专用subject连接安装普通事件监听器。记录每个测量段query调用数、readyForQuery完成数、dataRow行数、字段载荷总UTF8 bytes，结合rowDescription.names单独累计typed prefix、legacy content以及其他元数据。只累计数字，不落敏感正文、URL或令牌；各类之和须等于总字段载荷。若出现非text field format、不支持值类型、非UTF8 client_encoding或ready/query计数不一致，测量标UNKNOWN而不填推测数。连接初始化先核client_encoding=UTF8，且在测量段外完成schema/seed/身份查询。

测量仅包一个公开turnPage生命周期，包括其BEGIN/SELECTs/COMMIT；正常公开代码逐query await，不使用pipeline/多语句batch，故query调用数与ReadyForQuery完成数可作为该样本串行SQL完成往返数；仍不得从此推断网络延迟或PG hash/TOAST成本。设置测量对象后到公开promise完成才关闭，ReadyForQuery的同步emit已发生。另记录JSON.stringify(page)的UTF8 bytes，这是响应投影字节，不是本片HTTP实际body。

RR barrier只在subject真实task读取query的Promise完成后、把该真实result交还产品前等待writer事务；不伪造rows，不release未settle的client，不改变driver私有状态。writer专用连接不混入subject计数；记录barrier一次与COMMIT ACK。清理仅remove本fixture监听器，保留driver/其他监听器，不removeAllListeners。client.connection为固定版本内部观察接缝，范围限证据fixture，不能作为新的产品Interface；版本/hash改变须重新静态核对。

## 已确认的case澄清

直接readAssistantFinalPreviews对same-prefix坏suffix断言error.code=assistant_content_mismatch；turnPage另断言该项unavailable/invalid-result与邻项健康。duplicate session指同task/attempt两条kind=session detail，不重复sessions PK。legacy歧义用不同artifact_id/version的两条产物，保持schema约束。第51项设置独立坏数据并断言首50未读取其task/projection；第二页才处理坏项。RR需真实query barrier与writer COMMIT ACK。所有这些在收到两SQL供给后落实fixture，再固定源码审查，不能用设计批准代替运行。

本工作段沿find-skills本地/clean-code/codebase-design：测试只观察外部包事件，不操纵PG私有队列/transaction状态；指标定义、错误/未知与observer生命周期明确。0项目产品修改、0安装、0types/collect、0PG。
