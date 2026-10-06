# CHAT06C02 Interface

`registerConversationRoutes(app, pool, boss, options = {})` 新增可选 `options.assistantStreamReadable?: boolean`；旧3参数保持原false。Lead生产挂载须在022迁移及三个stream routes注册后传true；不改创建命令/已保存幂等receipt。

仅 `GET /api/conversations/:id` 做协商：原始HTTP header中名称大小写不敏感、恰好一项 `X-Flow-Assistant-Stream: patch-v1` 才候选开启。缺失、未知值、数组合并值或重复原始header返回false。还检查显式选项、三个task-bound read route及022已登记/流表SELECT可读；缺迁移/权限不明示true，其他DB错误维持正常请求失败语义。响应始终 `Cache-Control: no-store`，不覆盖既有Vary。

true表示当前连接能读patch-v1，既非runner/provider生产保证，也不随lastTurn/native session变化。旧runner无patch仍使用既有最终正文。创建ACK保持stable false，header不参与命令input/hash/replay；GET逐连接返回新capability对象，不改共享capabilities。

`legacyTimelineEntries(items, entryOf)` 为唯一纯legacy投影，过滤 `reference.stream.kind === 'assistant-stream'`，其他text/reference原样保留。task snapshot、eventPage、workspace使用同一policy；SSE复用eventPage。cursor/hasMore/previousCursor全部先从未过滤raw rows计算，空输出页可正常推进。PG timeline/workspace feed/patch原文保留，不制造通用detail副本。

固定依赖：CHAT06已审实现5ff8880b3518992121216998c169dd01ab44cee0/metadata1a4c63c；公共optional boolean合同86fc3af54eb500d24416121b4f36e701ea9fd3c4单文件受控pick。shared exports/client/server index由Lead单写；本片无模型、无Web展示验收或现服务操作。
