# S01 单 buffered 臂：FAIL / 活动资源已归还

唯一窗口 `s01-queue-buffered-once` 已消费，没有重试或第二臂。Execution `c7519722ea8464558b74183b888e934350b7ac83`；caller ece924、core839a、新 incremental packing均为固定已审输入；生产固定4fdd。自动caller仍为 **FAIL_OR_UNKNOWN / processClosed=false / UNKNOWN_RETAIN**，不能用后验活动资源归还替换该原件。本结果尚待独立忠实性审查，未集成 main。

## 首个失败与可证边界

`buffered/result.json` 的 case.failure 是 `insufficient_window_ack_span`。固定 proof.ts:52–57 按同attempt、emit开始≥runner窗口开始且ACK≤开始+6000ms筛选：128个attempt共有707个eligible emit；其中3个ACK跨度不足4000ms。128个跨度 min3973.262 / p504881.646 / p955092.982 / max5138.226ms（nearest rank）；逐身份明细见analysis.json。断言保持，不能把接近门槛当通过。

同runner时钟下首ACK相对窗口开始延迟p50886.357/p951160.982ms，最后ACK距窗口结束p50518.401/p951016.957ms。这是边界位置描述，不能归因纯pool等待、IPC或packing，也不能从不同历史窗口的失败数量推导改善。

`windowComplete=true`、`settledByDeadline=true`是部分事实。driver.ts:304在validateWindow失败，后续final/queue cancellation/完整session与journal成功链未完成。真实原件含19次轻读结果、4次cancel ACK/4次control abort及129 tasks/attempts/sessions快照，均不等于全部最终验收通过。

观察交付也不完整：仅16个pg-observation-chunk（ordinal0…15，4100nonSQL样本，0SQL聚合行），没有pg-delivery-summary。runner child-settled dropped0；center的内部observationDropped0但child-settled dropped1、exit1。因此全量PG指标和字节账均UNKNOWN（原byteAccountingComplete=false），不得计算可信的完整SQL/获取连接分布。channel.ts:7–19可能因完整envelope、pending/总量、IPC发送/回调等分支丢失；本次raw未记录具体首错分支，不能写成已证明pending超限。最小后继诊断入口是同固定centerDelivery.finish→childReporter的有限发送与回调收尾边界，先补可定位证据；本封包没有修复或新运行授权。

## 时间与资源

经理grant18:47:24.211Z→owned checkpoint18:52:37.342481Z为313.131481s准备/协调，包含本轮重新定位准入入口和只读核验，不能称SQL运行耗时。后继应在全队drain前准备可执行invocation，实际授窗只做紧前fresh+launch，无需新平台。

caller开始18:52:37.220238Z、terminal18:53:00.524057Z；persist后23,309.265ms、/usr/bin/time real23.36s、supervisor23,219ms、entry23,071.895ms分列。tool在18:53:09Z被观察已exit1；精确外层whole wall UNKNOWN，不能把poll的0.00000675s当全程。

准入host free19,474,763,776B、caller再次free19,474,718,720B均≥17,728,536,576B。cluster16.13/max100/reserved3/现10，13实验+16管理容量满足；协调池及准入管理池finally关闭。PG data/WAL同`/dev/vdb1`，当时available16,026,400KiB，WAL起始67,108,864B；结束及峰值未测，1GiB是规划余量非hardcap。个人自然后台UNKNOWN，未探停。

原件：runner30562 close0、center28188 close1（均无forced/signal/ipcFailed），outer27722 exit1/finalabsent/双EOF，1970B observed=retained；初EPERM历史保留。数据库CREATE ACK、OID1346843和marker90fc2d63-b56f-419c-89f6-8245898856d9与request一致，原driver记录普通DROP+absence。随后18:54:49.982Z仅一次只读确认该精确name/OID不存在、连接0并finally关闭pool；18:54:50.216335Z精确三PID及PGID27722 ESRCH、端口51778拒连61。此时活动资源RETURN；它不使业务失败/原processClosed=false变绿。

KEEP：`/tmp/flow-s01-mixed-Y01J0h`（原dev16777234/ino124414051，8份journal按失败路径保守unresolved）；`/tmp/flow-s01-ab-input-46f1cae6-a6e3-4aa8-b6f0-6b746405c8fe`（原记录只有path，dev/ino UNKNOWN）。封存没有访问/清理两个根。source-root留存和原byteAccountingComplete=false原样。

自动分类账最终88825297B，包含既有4MiB final reserve；这不是完整物理磁盘/WAL/峰值。新增离线metadata单独在manifest计量≤1MiB，使用已预留final预算，不补造完整计量。19个原件共16594207B，未复制原件或重跑绿色pure检查。

## 固定交接

原件、分析与transcript见result-manifest.json；工具返回对象由本conversation保留对象在RETURN后重建保存于outer-tool-transcript.json，明确不是runtime自动生成回执。123固定输入/current源码检查见source-integrity.json；旧O1 per-query FAIL、O2 NOT_RUN及旧KEEP不变。

仅私有实验/fixture，0provider/native/Chrome。旧main8e5仅offline packing/replay片已接；本单臂真实center实验未接收且完整S01未完成。沿本地find-skills、codebase-design、固定clean-code复核单一状态/错误/资源职责及历史不可变性，无产品/source改动。
