# K01 一次集成查询诊断结果

本次测量 PASS；db_transaction_owner于2026-10-08T00:56:16Z限定独审为 **RESULT_FIDELITY_APPROVED_WITH_ADMISSION_DEVIATION**，0新增P1/P2；不授完全合规PASS。原两次失败不改。准入有一项记录偏差：D04账本观察00:45:48.309Z距离主体START116.463253秒，启动调用没有再次读取账本，不把事后核验当紧前事实。

12金样本、项目/current/旧引用/每source winner/排序/hasMore/JSON语义通过；10 EXPLAIN和30 timed SELECT完成。61次HTTP共157664B，零模型/runner/task。种子共1644 chunks、5347454B原文；D16当前80/历史80 chunks，D128当前640/历史640 chunks，另有隔离项目和金样本。17595旧历史容量不是本搜索扫描数。

| Sources | Query | Materialized current rows | Filter out | Driver median ms (n=3) | Guard median ms | EXPLAIN execution ms (n=1) | Returned text B |
|---:|---|---:|---:|---:|---:|---:|---:|
|16|`知识 `|80|79|0.715|0.152|0.183|4096|
|16|`READY `|80|64|0.851|0.224|0.253|65536|
|16|`%value_\ `|80|79|0.668|0.310|0.174|4096|
|16|`alpha beta `|80|64|1.029|0.387|0.347|65536|
|16|`NO_SUCH_TOKEN_72931 `|80|80|0.654|0.511|0.151|0|
|128|`知识 `|640|639|1.813|0.532|1.388|4096|
|128|`READY `|640|512|2.399|0.595|1.788|86016|
|128|`%value_\ `|640|639|2.273|0.814|1.764|4096|
|128|`alpha beta `|640|512|3.426|0.775|2.522|86016|
|128|`NO_SUCH_TOKEN_72931 `|640|640|1.851|0.944|1.419|0|

GIN索引存在；D16的五份计划含knowledge_chunks_pkey，D128的五份计划没有Index Name节点，十份均未使用GIN；current_chunks MATERIALIZED分别产出80/640行，再做字面/FTS过滤。只说明固定数据与查询的观察，不证明所有数据都不会用GIN，也不承诺改写收益。NOT MATERIALIZED/拆分分支仍仅未实施候选，须维持字面、project/current、winner和预算语义。

耗时口径：driver roundtrip排除同步budget扫描；guard另列；EXPLAIN ANALYZE TIMING OFF服务器字段另列。n=3/n=1、cache未知、scheduler背景未隔离，不做稳定尾延迟/CPU/吞吐/SLO结论。Child120秒预算是150秒caller内部70work+40cleanup+10result；caller另有130/140/150收尾门禁，原result字段不改。

资源：单次预检available91≥35且adminclosed；primary73533正常exit0/MERGED EOF，outer73532 exit0/reaped后PID/PGID ESRCH。OID1373524同marker、全部启动/listen已settle与close、零连接普通DROP/absence；精确综合RETURN观察00:48:30.512887Z，不倒推terminal为归还时间。新scratch仅保留不可变原件（KEEP_PG_RECEIPTS），原旧KEEP不读删。DB末样本14434831B不是峰值；配置18+observer1不是实测峰值，observer因可信child清理而未运行。

本段只封结果/状态；产品与实验源码无改动，无重跑。

时间来源补充：operator-terminal.json原terminalAt为00:47:49.282494Z；外层stdout观察与原summary outerTerminal为00:47:49.282866Z，后者晚372微秒。以原terminal回执解释终态记录，两个观察均保留，不回写原件。完整RETURN仍是owner后续00:48:30.512887Z观察，不是审者新probe。
