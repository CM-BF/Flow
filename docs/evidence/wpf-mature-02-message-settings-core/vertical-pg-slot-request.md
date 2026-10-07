# 纵向专库 PG/HTTP 最小槽位请求（NOT_OPEN）

2026-10-06 16:30 UTC；owner status_read/gpt-6-astra；补充固定的 `vertical-source-checkpoint.md`，不改其历史内容。请求 root/Lead 安排同机专库串行窗口；本文不是运行授权。

## 固定输入与唯一入口

- source `ea276572c3c99fb8400808a93efc69ce530d55a4`；局部证据packet `1671ed6cffed2e393f938a60f30ed75be1ffbe7b`。21 distinct 分别为contracts16与注入runner5，两项contract/focused strict exit0；不重复这些检查。
- `vertical-local-validation-manifest.json` SHA `22be50f204f5125371c06ba1cf8b0d318b31cc04c615ca28f88d5565ddd448ad`，含34source、194readonly和16raw。155只读源已Lead物化，完整闭包现可见。
- 仅 `apps/server/src/conversations/message-settings.test.ts`，静态8组；Node24 + Vitest4.0.18、单worker、`--configLoader native`。使用 `vertical-pg-vitest.config.ts`（SHA `4cce7a0f8a768febc85ac2421e911cd9f4febdf4cceae7b222fb1bf238c385c6`）；`.ts`导入修复只经静态核，PG配置从未加载。
- 既有admin入口候选沿批准本机映射：只source `/tmp/flow-coordination.env`，将既有 `FLOW_COORDINATION_DATABASE_URL` 赋给 `FLOW_M02_SETTINGS_ADMIN_URL`，不输出值。fixture只接受localhost/127.0.0.1:55432并自行改path=/postgres；不找其他凭据/不改协调DB。实际映射仍随唯一窗口指令确认。

## 有界行为与结束事实

一随机专有 `flow_message_settings_<UUID>` 数据库、一loopback动态HTTP端口；测试worker内app及其池/自有PgBoss，0runner runtime、0原生SDK/provider/model。仅8组migration/旧reader/冻结重放/队列promotion/空unpause/final-context/retry；实际选择数、失败与未达断言照实记录，不补跑。

work门限120s、afterAll cleanup80s（各动作8s），保守整体槽位200s。HTTP最多256次、每次7s/响应128KiB；DB最终总task必须≤32，receipt≤32KiB。独有stdout/stderr合计上限1MiB、自有cache/temp合计预算32MiB，输出新文件不覆旧raw。所有限额是原fixture/执行外壳所述口径；Promise deadline不证明底层IO取消，未确认close/连接归零不得DROP或声称已清理。

CREATE发送前creationRequested=true；原pre-032迁移与旧行→32→createServer，二次迁移不重建。结束明确app/boss/pool/admin关闭、专库连接0、普通DROP后精确absence。unknown保留，禁止FORCE/终止其他连接、停止共享55432、重试未知CREATE或claim。仅自有cache在结束后清理。

## 空间准备估算（不是已测上界）

| 类别 | 槽位规划预留 | 证据与限制 |
| --- | ---: | --- |
| 新专库含全部factory schema/少量合成行 | 32MiB | 按≤32短prompt tasks规划；尚未实跑，不能证明数据库物理硬上界 |
| 共享PG/WAL增量 | 32MiB | 仅规划余量，不可归属的后台/WAL增长UNKNOWN，不把DROP当WAL回收 |
| 自有Vitest cache/temp | 32MiB | 执行外壳按既有局部检查预算；本次实际另记录，不借用此前峰值当上界 |
| stdout/stderr + receipt +准备metadata | <3MiB | 1MiB raw +32KiB receipt +小metadata；不复制安装/仓库 |
| 余量 | >29MiB | 总计预留128MiB，不为未知增长伪造可证物理界限 |

建议fresh准入至少 **1GiB保留 +128MiB规划余量 =1,207,959,552B**，并由Lead/OPS确认同机PG串行与共享增长条件。最近局部检查结束可用1,128,894,464B低于该建议值；不据此反复采df或启动探容量。此floor只是规划准入，不能保证其他队不会消耗共享盘；不能满足/无法协调则NOT_RUN，不降门槛求通过。不创建新PG集群或磁盘观测框架。

## 交付边界

本片专库自行调用owned migration helper，不证明F01生产factory已挂载032；client ACK/export/header与Web/TUI消费仍待各owner接线。任务dispatch_ready的测试SQL只控制既有scheduler readiness，不验证自动调度或native执行。旧queue.test具有跨scope证据副作用，本窗口不运行。通过也只证明固定source专库行为，不升级为模型资格、性能/容量或完整用户端交付。
