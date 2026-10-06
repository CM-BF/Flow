# CHAT06P01：同一正文的分片提交成本

一次真实 PG/HTTP 矩阵通过。相同32768 UTF-8 bytes正文在4/16/64片提交时，每片都读取此前完整正文并重新哈希扩展后的完整prefix；累计工作量与源码预测逐项吻合。这定位到重复正文传输与校验成本，尚未证明CPU、数据库或吞吐瓶颈，也没有测量任何优化收益。

固定实现4951ce63945ec6364be050de877715059402095f；实际执行HEAD72fd593c6c993e204c54b9b22f46f62642eb7992，产品base fa9a8288341d4f2bd8160e03fe9173dafa2de1a6。仅一次矩阵，0 warmup/重跑、0 SDK/provider/model/云调用，未改产品。3个真实注册runner身份用于HTTP claim/report，**没有执行runner进程**；3 tasks/attempts/sessions以明确completed(cancelled)收尾，不称模型任务成功。

## 实际字节与调用

| 正文patch数 | 原始输入B | 累计旧prefix返回B | 完整prefix SHA输入B | SQL调用数 | COMMIT次数 | 持久patch JSON B |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 32768 | 49152 | 81920 | 96 | 4 | 41100 |
| 16 | 32768 | 245760 | 278528 | 384 | 16 | 47668 |
| 64 | 32768 | 1032192 | 1064960 | 1536 | 64 | 73956 |

每个patch实测24个前景Client.query调用：13其它SELECT、1prefix SELECT、1BEGIN、8其它语句、1COMMIT；共2016调用/84COMMIT。另5个后台调用单列，仅发生在64片组观察窗口。失败查询与COMMIT尝试均会计数，本次前景/后台/观察器错误皆0。

旧prefix数字是pg返回的decoded content UTF8 bytes；合并decoded rows JSON字节分别68286/333946/1396730，二者均不是PG wire。完整prefix哈希4/16/64次，累计输入如表；另24/96/384次SHA输入分别83008/98576/160896B，未把认证/身份/canonical等其它输入误记为正文。3组精确正文digest相同，持久原始text每组恰好32768B。

固定B时重复字节随N线性增长，本矩阵不能称O(n²)实测。64片组单独旧prefix读取为原文31.5倍，完整prefix哈希输入为32.5倍；这是累计字节比，**不是速度比**。HTTP report JSON输入分别41536/49420/80988B，ACK分别124/504/2040B。包含CRLF/反斜杠的JSON转义和每patch metadata使JSON大小不等于原始正文。

## 带观察器的时延

| patch数（n） | HTTP ACK p50 ms | p95 ms | p99 ms | 全组HTTP ms之和 | COMMIT ms之和 | prefix SHA update/digest ms之和 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 13.578 | 22.693 | 22.693 | 62.330 | 9.932 | 0.161 |
| 16 | 10.048 | 15.523 | 15.523 | 170.042 | 36.169 | 0.598 |
| 64 | 8.158 | 11.195 | 13.689 | 534.981 | 107.449 | 1.999 |

nearest-rank；n=4/16的p99为最大值，n64为第64项。每组样本prefix长度不断变化，顺序固定4→16→64且每片输入大小不同，不是独立同分布/冷热对照，不能将较小单片p50解释为优化、容量或SLO。HTTP是发起到完整ACK的墙钟，含SQL、哈希、观察/JSON sizing开销；COMMIT仅该query完成墙钟，hash仅update/digest调用墙钟，均不是CPU归因。prefix SQL合计1.725/5.762/18.508ms，全部前景query合计43.711/126.303/393.412ms；不能相加当另一个独立总时长。

## 正确性、配置与资源

84个公开patch在1/2/8个有界页面中原样留存并独立重建，逐条offset/prefixDigest和最终正文一致；每组block完整正文、revision/bytes及持久patch行数一致。90个IPC进度记录（3task、3claim、84sample）保留，发生异常也不把缺记录猜成零执行。23个执行源前后hash相同，apps/packages/lock仍固定基线。

实际进程墙钟2026-10-06 07:47:01.727200→07:47:06.274015 UTC，外层约4.546秒，entry内部4.418秒；包含setup、claim等待、校验与清理，不能作纯提交吞吐窗口。126个HTTP请求小于256上限；自有child正常exit0，无强杀；app/pool关闭、hooks还原；自有库连接0后普通DROP、remaining=[]。最终库占用11739663B，加当时既有证据126331B与最终JSON2195798B，共14061792B，小于64MiB。最终三组的patch关系204800B、block关系49152B（含索引/存储结构）；这是整库现场占用，不是每组物理写入或WAL。

leaseMs=300000、automaticQueueScan=false，scheduler仍开启。已收到SVC02_OPERATION_CLOSED才启动，未要求全队静默，常驻服务/其它后台保留。16逻辑CPU arm64 Darwin；开始loadavg7.453/9.492/9.205，结束7.176/9.400/9.174。上述观察不能外推空闲主机或默认服务配置。完整导出见[result](result.json)、[重算摘要](result-summary.json)、[墙钟与背景](execution-receipt.json)、[条件许可](window-authorization.json)。准备阶段所有red/依赖/类型/入口解析失败继续保留，真实矩阵未失败或重跑。

## 最小后继候选（未实现）

可以优先评估专用写入校验SQL：在现有事务/锁内用完整string_agg与新patch，按`convert_to(...,'UTF8')`完整SHA-256，只返回计算摘要并严格比较。公共完整读取保持原样，不能用截断prefix或缓存猜测替代完整校验。该候选只减少重复正文跨PG/Node传输及Node正文hash；PG仍聚合/扫描/哈希全文，不保证CPU或总延迟改善。还必须保留session/attempt/revision/offset、late/conflict/replay/并发完整性回归。实际修复需要另协调产品scope。

当前还同时观察到24N次SQL与N次提交。是否另研究聚合写入/flush策略，应由延迟与语义预算决定；本实验不变更流刷新、完成顺序或持久化要求，不预估收益。本片先交付实证与候选。
