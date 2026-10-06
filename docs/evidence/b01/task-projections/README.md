# B01 任务轻读投影证据

eventPage 与 tasks.list 只向 Node 返回所需任务字段，共用七字段摘要映射。snapshot 的原 prompt、loadTask/FOR UPDATE、鉴权、RR 只读事务、分页和事件 cursor 保留。第三 assistant-stream reader 未改。基线 fd1322f9c0c1d085d5e343e39f6216b20d26c264；固定实现与所有 hash 见 manifest.json。

主要样本通过真实 `POST /api/tasks` 创建：15999 UTF-16 code units、37331 UTF-8 bytes，位于16000字符公共限制内。另一个128KiB prompt仅SQL合成压力样本，越过公共输入上限；附件/context正文没有混入submission。

| 任务行场景 | 旧完整 row JSON bytes | 新投影 row JSON bytes | 实际 SELECT 数 |
| --- | ---: | ---: | --- |
| 合法 POST，eventPage | 37899 | 367 | 2（task+timeline），不减少 |
| 合法 POST，list 单任务 | 37899 | 229 | 1，不减少 |
| 128KiB SQL 压力，eventPage | 131615 | 342 | 2，不减少 |
| 混合5任务，list | 171236 | 1020 | 1，不减少 |

所有字节都是私有 pg client 的**已解码任务 rows 再 JSON.stringify 的 UTF-8 字节**。event 旧值是该同任务实际 loadTask 完整行，完整旧 event 查询数也在 red-event 保留；合法 list 旧值来自 red-list 的实际旧 list，当前值来自最终运行的同形合法样本，不是同事务对比。压力/list5旧新在最终同一fixture静态样本上对比。实际 HTTP 另作响应等价/鉴权检查：11次请求，不记录生成prompt/凭据，响应字节单列。私有 query observer测生产 domain Interface，未注入产品全局 Pool；HTTP另用真实 createServer 路由验证。HTTP原本不带prompt，不能拿HTTP响应字节证明PG减载。

最终 `final.stdout`：Node24.20.0 / Vitest4.0.18 / PostgreSQL16.13，8/8不同测试全过；覆盖真实合法POST/两reader字段、等timestamp分页及末游标/非法cursor、隐藏stream条目rawcursor、空页/reset/404、无新timeline的状态/decision/usage及succeeded/uncertain摘要、snapshot完整prompt、owner401/runner403、loadTask真实行锁阻塞、独立SQL压力与等价。`strict-receipt.json` exit0，继承root strict/ES2023/noUnchecked/skipLibCheck不变，4直接roots及imports；不是root-wide通过。

TDD原始保留：red-event1失败；修event后red-list为1过1失败。两个red都因目标结果仍含submission而失败。它们重复了最终8项中的用例，不累计成10项。两次strict预检0只作为当时检查记录，不替代最终源hash绑定；没有零测试“通过”。原源码可在0e3ac1454fabf6ad158e69674ad50ebe3211f02a / c855e33f86e6caed52aaf43b9142bca49672747e重现。

最终运行 2026-10-06 11:44:08.190155至11:44:10.977130 UTC（命令2.787s含Vitest加载）；fixture初始化至清理1499.934ms，5tasks，decoded+HTTP383182B，报告3356B，自有连接关闭且精确数据库确认不存在。两次red各1task，两库也关闭/不存在；累计7tasks、fixture4273.5865ms、decoded+HTTP535645B，远低于32tasks/60s/32MiB。全部测量输出另由manifest计量，保守追加1MiB证据预留后仍<32MiB。清理只普通DROP随机专库、无FORCE/kill或共享schema；0模型/SDK/provider/真实runner执行。注册的1个合成runner只核读权限。

本机后台负载见final-receipt；observer本身有计数和JSON序列化开销，顺序样本没有延迟或吞吐比较。查询数及轮询频率不改。JSONB提取仍可能PG detoast/解压（官方依据见interface）；不声称PG wire、磁盘、CPU收益/SLO/执行容量。源码固定后不重复PG，只独立只读复核。旧B01证据保持原样，新权威来源迁移由Lead登记，尚未在本owner确认dashboard聚合。
