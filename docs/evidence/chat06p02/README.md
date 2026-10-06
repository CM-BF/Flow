# CHAT06P02 写入摘要证据

固定实现 `b0090edd594d19e1a441ce54683af65f7e5dc26e`，base `84fdecebbb4939e43710fb17e48884cc49d1d030`；Mika独审待执行，main未接收。实际生产改动仅store.ts：既有reportEvents事务/锁内PG完整有序prefix+patch的UTF8 SHA-256，只返回小写digest。公开readPrefix、block/final/patch分页完整原文、session/revision/offset/replay规则不变。

真实PG16.13下10个专用行为用例通过，既有直接消费者选8/27、8通过/19未选，noEmit exit0，共18个不同用例。没有模型/SDK执行/provider/cloud，也未重跑P01矩阵。执行命令、时间、source及原始日志hash见[manifest](manifest.json)。专用4个唯一库最终remaining[]；首边界轮即时查连接失败留下的自有库已另正常DROP，见[修复清理](boundaries-cleanup-repair.json)及[最终审计](cleanup-audit.json)。两个旧consumer fixture各创建UUID库并在afterAll普通DROP；通过日志证明这些fixture完成，未保留其DB名/独立再查回执。

| 同一行为场景 | 原写校验（真实红例） | 改后写校验 |
| --- | ---: | ---: |
| 已存prefix UTF8B / 新patch UTF8B | 8192 / 3 | 8192 / 3 |
| 聚合查询返回decoded value UTF8B | 8192 | 64 |
| 返回rows JSON UTF8B | 9744 | 79 |
| 聚合查询次数 | 1 | 1 |
| 公开完整block UTF8B | 8195 | 8195 |

新SELECT还增加当前patch的3B text参数传入PG；INSERT/JSON等已有开销仍在。空旧prefix本来返回0B，新摘要固定64B，故不声称每个小patch均净减少总字节。只证明避免随已存prefix增长的正文回传；不代表PG wire、WAL、端到端流量/时延、CPU减少或吞吐收益，PG仍全文聚合/hash。

覆盖：固定空/NFC/NFD/组合字符/nonBMP/CRLF/反斜杠摘要向量；同事务多patch及empty close；坏digest整batch无session/patch/event残留；早期持久prefix腐坏拒绝；revision/offset/session/ownerVersion/strict小写schema、sealed replay、双并发same-revision单成功。已有消费者保留原断言，覆盖完整正文/幂等restart/final结算、旧task/events/SSE/workspace分页与隐藏流兼容。

失败保留：prefix-red按预期返回旧正文而失败；prefix-boundaries首9/10中一条错误预期写成invalid_request，真实既有route为invalid_events，另清理即时零连接断言失败；修fixture有界等待后完整10/10。types-first把运行JS入口误用类型路径，修仅本evidence配置后0。两历史test snapshot为事后重建，均与当次已保存hash严格一致，未倒改原记录。

技能与PG官方来源见[quality](quality.md)。architecture仅store内部写校验职责位置调整，公共协议/迁移/FSM/外部依赖不变；主线现有架构说明由Lead接收时按需同步。
