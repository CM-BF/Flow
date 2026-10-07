# GDEP01 目标依赖正文有界批读

创建/更新：2026-10-07。状态：in-progress。co-lead mika，owner b01_bounded_reads。
父验收 FLOW-001-T04-DEPENDENCY-READ-01，权威 [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)。不建立平行父目标。

目标：减少短依赖正文读取在项目写锁内的数据库往返，保持精确绑定和错误优先级。

- [x] **GDEP01-01** 单一dependencyContent(client, orderedBindings)读取Interface；空数组零查询，多项单次元数据ordinal窗口查询。按taskId/artifactId/version/detailId四键LEFT JOIN，选取此前累计UTF8<=48000B的行，完整正文留Node逐项sha256与UTF16累计16000。命令原事务/权限/CAS/项目锁/最终JSON限制不改。
- [x] **GDEP01-02** 有界纯行为与直接consumer局部noEmit；查询数、排序/重复/缺失/hash坏与大小首错、Unicode和原输入输出保真。纯fake不冒SQL执行证明。
- [ ] **GDEP01-03** 独立source review与真实PG有限验收（待新窗口）：真实SQL、48000等值/首跨界、最多199短项、四键错配、输出字节与EXPLAIN、同项目竞争。0provider，尚NOT_RUN。
- [ ] **GDEP01-04** 受控main集成与真实验收收口。

## 已确认设计与Interface

新内部module只负责有序依赖正文读取与既有验证；调用方拥有事务/锁/授权。无缓存、并发Promise.all、pool或新生命周期。使用同一SELECT快照，不在中间CTE物化所有正文；正文读取至第一次UTF8累计越48000行（含该行），JS按原序先exists/hash再length。合法正文满足UTF8<=3×UTF16，因此越界后必已有大小错误；全量正文最多48000+1048576B仅适用于既有合法artifact输入，DB无长度CHECK，非法超大存储不在该硬界。未改变错误码/message及最终prompt.length16000。

本段25min自22:03:42至22:28:42，8MiB包含483固定供给3280152B、index2285069B、源码/meta/raw/TMP。<=5串行child/各30s/累计90s，raw512KiB；0PG/HTTP/Chrome/provider/install/build。SQL与PG工作量/性能收益未测，不由纯计数声称加速。
