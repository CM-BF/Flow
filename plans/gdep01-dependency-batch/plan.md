# GDEP01 目标依赖正文有界批读

创建/更新：2026-10-07。状态：completed。co-lead mika，owner b01_bounded_reads。
父验收 FLOW-001-T04-DEPENDENCY-READ-01，权威 [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)。不建立平行父目标。

目标：减少短依赖正文读取在项目写锁内的数据库往返，保持精确绑定和错误优先级。

- [x] **GDEP01-01** 单一dependencyContent(client, orderedBindings)读取Interface；空数组零查询，多项单次元数据ordinal窗口查询。按taskId/artifactId/version/detailId四键LEFT JOIN，选取此前累计UTF8<=48000B的行，完整正文留Node逐项sha256与UTF16累计16000。命令原事务/权限/CAS/项目锁/最终JSON限制不改。
- [x] **GDEP01-02** 有界纯行为与直接consumer局部noEmit；查询数、排序/重复/缺失/hash坏与大小首错、Unicode和原输入输出保真。纯fake不冒SQL执行证明。
- [x] **GDEP01-03** 独立source review与真实PG有限验收：本次精确8/8，真实SQL、48000等值/首跨界、199短项、四键错配、输出字节与EXPLAIN、同项目竞争通过。0provider；结果忠实性独审已批准，主线接收见GDEP01-04；未执行公共端到端消费者不冒通过。
- [x] **GDEP01-04** 受控main fe26cc936d3d645cd102035a1885394c1a48f680集成；中央收据五路径44890B精确接收，复用既有16pure/8PG与独审，0重跑。

## 已确认设计与Interface

新内部module只负责有序依赖正文读取与既有验证；调用方拥有事务/锁/授权。无缓存、并发Promise.all、pool或新生命周期。使用同一SELECT快照，不在中间CTE物化所有正文；正文读取至第一次UTF8累计越48000行（含该行），JS按原序先exists/hash再length。合法正文满足UTF8<=3×UTF16，因此越界后必已有大小错误；全量正文最多48000+1048576B仅适用于既有合法artifact输入，DB无长度CHECK，非法超大存储不在该硬界。未改变错误码/message及最终prompt.length16000。

本段25min自22:03:42至22:28:42，8MiB包含483固定供给3280152B、index2285069B、源码/meta/raw/TMP。<=5串行child/各30s/累计90s，raw512KiB；0PG/HTTP/Chrome/provider/install/build。SQL与PG工作量/性能收益未测，不由纯计数声称加速。

## 22:17:21–22:37:21 PG准备新段

原source/local获db22:13:34独审批准；新增dependency-content.pg.test.ts已原子amend至v2/exact6。新4MiB包括所有新增与index临时；不复制原供给。八例、仅admin1+aux2、140秒未来CLOSED候选见pg-preparation.md。仅新test局部types/collect允许，0PG/HTTP。真实SQL及最终execute/native/progression组合仍开放，不关闭GDEP01-03。

## 主线收口

2026-10-07中央intake观察23:47:33.071Z；owner核验与完成时刻见唯一status/main-receipt.json。历史准备段未运行声明保留其当时语义；当前本task已完成，不扩父FLOW-001验收、个人部署或未运行公共execute/native/progression端到端。
