# S01 PG观察交付首片

范围：两个新增experiment文件 `pg-delivery.ts` / `pg-delivery.test.ts`。当前仅私有Module及直接受控调用已实现；完整driver/当前v2领取观测/chat轻读/cancel recipe尚未接入，PG/性能NOT_OPEN。原observe-pg、child/channel、ab默认、旧input/raw不改。本片不改变生产pool、SQL、调度器、HTTP或claim。

## 小接口与生命周期

`createPgDelivery({ mode, epoch, emit, invalidate, limits? })`只做数据交付，返回record/setPhase/finish/status。epoch在构造时冻结；phase只允许before→measure→after单向推进（中止可直接after）。事件phase在本进程record时记录，非IPC到达phase。record复制公开有限字段，不保留caller对象/SQL文字或额外私有字段；原PgObservation的startedMs/elapsedMs原值不变。

- per-query：每条有限sample同步交给emit，不新增队列、timer或重试；外层原reporter负责累计输出/IPC pending限额。
- buffered：acquisition/transaction各最多16384样本，SQL按phase/pool/有限category/outcome累计count和elapsed；最多256组、逻辑保留JSON预算4MiB。SQL热路径不逐条JSON.stringify或process.send，仅新group计一次预算；仍有callback/校验/分配成本，不是零开销观察。
- finish：由caller先停止观察来源，再调用一次有限flush。最大单message JSON64KiB，chunk有epoch和ordinal；重复finish不重发。phase逆序、close后late record、容量/数值非法或sink失败均保第一个有限fault，known=false并调用invalidate一次。失败后不猜全量成功，不自动重试部分已交付的chunk。
- `emit === true`只证明caller同步接受；outputMessages/outputBytes只计这部分JSON，**不证明IPC ACK/driver持久化**。真正child接入必须另外核原reporter.pending=0、dropped=0及外部进程/持久化结果。64KiB仅该message编码，不含childReporter添加的pid/childMs或IPC系统开销；外层responseBytes与总预算仍须核全envelope。
- retainedBytes是保留数据逻辑预算，不是JS heap/RSS硬上限；JSON编码临时副本/数组/Map开销与外部采样峰值没有测量承诺。模块没有PG连接、文件、timer、process/cleanup所有权；停止、unknown和资源仍由既有driver负责。

原observer的callback/promise/error/this和release原样透传：本片只是其report sink，无新release拦截、不移除SVC07 error listener。纯测试通过真实observePg seam模拟connect/query返回（没有pg实例），并把chunk送入现childReporter的注入process.send接缝，原channel/contract没有改动。后续当前v2 claim/HTTP/driver接入只消费这个小接口，不复制observer或另建监督循环。

## 本段实际证据

实施准备实际开始2026-10-07T12:29:55Z，fresh claim508f v2/5匹配、起点496016ef clean。三child：

| run | 实际UTC | exit / 结果 |
| --- | --- | --- |
| tests-1 | 12:33:44.131411→12:33:44.579134 | 0，11/11，330B raw |
| types-1 | 12:33:49.103352→12:33:49.208942 | 2，TS18003无输入；根exclude experiments被继承，467B raw保留 |
| types-2 | 12:34:05.307926→12:34:05.853303 | 0，专用config改显式files，strict选项不放宽，0B raw |

原3run JSON/raw为权威。旧config按run绑定bytes/SHA复原保存在pg-delivery-tsconfig-before.json；修复只改输入选择，未重跑11绿。实际child累计1088ms（443+103+542），不把它称整个工作段壁钟。每个真实outer工具调用完成已观测；没有从这些工具chunks推算完整external whole-wall，记录保持null。

复用固定OPS14单模块supervisor SHA725bad90…6092d；三组finalowned=absent/mergedEOF，原types非零first_failure与三次early EPERM unknown观测原样保留。三新TMP在停止后同dev/ino、有限inventory后删除；末样本138B/0/0不是active peak，记录未证明进程从未unknown。没有访问旧FKye9L等根。

资源先核原manager最低6237454336 + Original个人窗512MiB/raw2MiB + 本段TMP16MiB/raw512KiB/source-meta2MiB = 6795821056B；不可动reserve不另重复叠加。三次fresh free约21.76GB均超过该声明组合；0PG/网络服务/provider/原生/安装/性能，个人窗与本纯模块无共同DB/port/写入。actual于12:34:05归还本队ordinary，不因证据封存继续占用。

## 质量与下一步

沿原find-skills/codebase-design/clean-code固定基线：模块内聚于有限交付；输入与生命周期明确、首错误保真、无SQL/权限或资源控制扩权；两策略共用同record验证，不散落driver特判。11例覆盖promise/原rejection、callback/this/release原样、分代/外部可变输入复制、counts等价、样本/bytes/groups上限、chunk完整次序与字节、部分sink失败不重试、phase/late record以及现childReporter直接兼容。0工程全库/旧A/B/64重跑。

独审通过后才继续driver的最小合法接线；当前是模块局部证据，不是方法实验已运行、性能提升或S01整体完成。未来新run路径必须另amend，原raw/预算input保持原字节。
