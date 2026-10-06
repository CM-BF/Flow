# S01P01 有界 runner attempt pool

编号S01P01；创建/更新2026-10-06；状态in-progress；阶段M2。owner s01p01_owner / gpt-6-astra，lead Mika。base9c6fa9b100f04916f43b04280f05f497b28eeb0f，WT runner-attempt-pool / branch codex/runner-attempt-pool。

GO/Lead已批准最小核心：RunnerOptions.maxConcurrentAttempts默认1，整数1..16。一个claim/admission/recovery owner管理有限Map，每attempt保留现独立control/outbox/decision/steering；中心registered capacity与session锁仍权威。本地pool不等于provider容量。仅修改runtime、新journal及两个专用测试，主CLI/配置由CHAT09 owner独立接线。

## TODO

- [x] S01P01-01 固定base/claim/技能、现有恢复与错误接缝，初始化权威计划。
- [ ] S01P01-02 journal先行为红→持久领取意图/绑定，固定小Interface及失败保留。
- [ ] S01P01-03 有界slot实现、恢复安全停点与host/attempt故障隔离。
- [ ] S01P01-04 专库真实中心/局部HTTP故障测试、直接消费者及noEmit，绑定证据。
- [ ] S01P01-05 Mika独立技术review、Goal Owner接收范围，Lead main接收与停写/release。

## Interface与已批准保守边界

领取前持久in-flight意图，收到assignment后先持久task/runner/attempt/ownerVersion绑定再清意图，未记录成功不能开始执行；无assignment的明确响应才清意图。任务prompt/token不落journal。仅本次真实completed ACK或恢复原completed事件ACK可清known binding。崩溃遗留/unknown claim跨重启阻断，不能lease超时自动释放，也没有claim requestId/回执API；不重新执行已知assignment。

启动及active=0才由唯一owner运行原outbox+FinalProposalJournal全目录恢复。active存在时绝不扫描；某slot需恢复时停止新admission，等其它已知slot收束再恢复，通知recovery等待。confirmed-final不等于completion，仍保留绑定；无法确认的旧绑定保守阻断，需要owner/center核对后受控处置，本片不造解除/回执接口。

普通adapter失败、单slot cancel/ownership lost只收束该slot；host signal、401/403、EventStorageError停止admission并abort/settle全部已起slot，不能首reject遗弃SDK/心跳。AttemptControl吞heartbeat错误的行为保持，runtime本实例heartbeat包装先传达auth host失败并原样rethrow；不写其它owner scope。实际失败原Error保留，不用空catch当成功。

## 验证及资源

TDD seam为journal文件持久行为及runRunner公开Interface。先journal写入/崩溃残留红例再最小实现，随后runtime明确4重叠barrier红→pool。覆盖默认1、中心cap更低、auth/storage/全局abort、单slot失败取消、同session互斥、active outbox不replay、unknown claim与重启、意图落盘失败不发HTTP、uncertain/maintenance。真实PG专用UUID库、动态port、正常app.close/pool.end/零连接DROP，仅删除本fixture资源。合成adapter/注入transport，无SDK/provider/model/云，不重跑S01容量或P01矩阵。

Node24/pnpm9.15.4/Vitest4.0.18，显式路径与noEmit，旧直接consumer断言保留；所有失败/修复和实际selected/pass可审查。共享outbox/FinalProposalJournal、attempt-control、中心claim/SQL/迁移、CLI配置不修改。需要额外scope先amend。

架构影响：native runtime增加本地有限slot与持久admission guard，现attempt生命周期/中心锁不变。现架构运行并发与故障/恢复图需要Lead按固定target主线接收更新；owner只记录本证据，不写全局图。
