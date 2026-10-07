# S01：固定轨迹的观察交付策略成本诊断

2026-10-07T14:15:55.210Z fresh claim508f v3/6、本人/原WT；实际设计从该核验后开始。仅source-only方法/plan/status，无新观察器、测试、PG、HTTP、provider或性能执行。原失败结果bf881/packet46213232已由db于14:15:51Z忠实性独审通过，O1 FAIL/O2 NOT_RUN与所有原件/KEEP不变。

## 一个问题与明确零点

首片只问：**同一小段已观察样本，经现有 per-query 与 buffered 两种交付策略时，record/finish、编码消息、真实本地IPC与收齐排空各花多少成本？** buffered会聚合SQL、保留nonSQL，到finish才发送；两侧并非相同消息或相同信息量。因此这是“观察交付策略成本”，不是隔离IPC/JSON编码的微基准，也不能回答原pool根因、取消及时性或128容量。

原高并发验收完全独立：4秒ACK跨度、真实取消最终态、身份/fence、UNKNOWN/KEEP均不改。不为补O2而放宽validateWindow或queueVerified，不改pool/SQL、延长原6秒窗、删除保留根。本小诊断的PASS只表示输入/计量完整且自有资源闭合，不要求buffered更快；两侧均有有效成本记录才可比较本轨迹一次观测。

## 固定输入与可解释的选择

唯一来源是bf881固定 `docs/evidence/s01/pool-wait-run/O1/observations.json`（43858197B，SHA取已封a972结果manifest）。外层receivedMs/phase是driver接收记录，**不是原wire**。只从kind=pg-observation、sample.poolRole=center、sample.phase=measure的条目提取有限PgObservation字段，保持原sample.ordinal顺序及原phase；选该集合的**前2048条**，无按耗时/成功或结果挑选。原集合20952条（2983 acquisition、1425 transaction、16544 SQL），本片不是全71690观察或全6秒的代表性估计，不外推比例收益。

未来准备时只读源一次、核原hash，输出一个不可变小trace（≤2MiB），另绑定originalOrdinal→replayOrdinal与选中kind分母/hash；不复制43MiB原件。源sample.startedMs/elapsedMs只作为数值输入保持，不能当新DB或replay延迟。构造用同一固定新epoch、两侧相同input hash；只用显式字段，不带SQL正文、owner凭据、路径或原driverphase来伪造新wire。若未选足2048、排序/字段不合法或trace越界则准备失败，不临时换样本/缩到能绿。

同时预核所选nonSQL序列化保留≤384KiB、有限SQL groups≤256及保守聚合槽≤128KiB；连chunk/control/summary余量按128KiB，令本片预计一次finish发出≤640KiB，低于既有reporter.pending 1MiB。这只是准备上界，仍以实际完整envelope/IPC累计/排空检查裁决；不提升原4MiB保留、每kind16384或64KiB完整消息门槛。未满足该小输入界限即NOT_READY，不能在实际后截断掉drop。

## 复用与实际路径

直接复用固定67d0的 `pg-delivery.ts`、`pg-delivery-bridge.ts` 的 centerDelivery/deliveryReceipt、`channel.ts` 的 childReporter。已有record类型校验/输入复制、epoch/phase、SQL聚合、finish-once、首次失败unknown、pending/dropped权威保持。普通host/PG/runner/adapters都不加载；生产源4fdd只作为历史trace出处，不导出675文件。

实施预计一个本实验窄recipe（原mixed目录）组合上述接口，同时具有parent receiver与固定worker入口；它不是新的通用supervisor。顶层运行沿已有OPS14/explicit allowlist/Python-I-B与固定Node24/tsx，原queue-operator和实际原件不改。parent只负责固定输入、顺序启动、deliveryReceipt及count/hash结果；worker只负责重放/测量/report。fork与checkpoint/stdio/group由原受监督机制约束，无第二kill轮询/无限retry。不得为复用含PG的child角色偷偷创建连接。

两arm顺序固定per-query→buffered，各新worker一次，不在同worker重用已finish状态。先侧必须计量完整且closed，才开始后侧；如果缺消息/drop/pending未清等真实失效，第二侧NOT_RUN，不以诊断名义掩盖资源未知。顺序/冷启动/cache/背景混杂明确，一次对子不作统计显著性或稳定收益。

## 有界喂入与时钟

不能tight-loop灌71690条。两侧采用相同固定**每32条后一次setImmediate并等待至少1ms**的投递批次，2048条最多64批；记实际batch数、延后与累计等待，最后一批也同规则。这不是原生产到达时间重演，不能把定时/OS调度误差扣除后伪称裸IPC。不得因某侧pending高而临时改样本/节流参数；触原pending/bytes门槛即unknown并保全部事实。finish只一次，结束后等待真实send callbacks/pending=0/dropped=0和父进程receipt完整，不把emit=true当ACK/持久化。

分别记录：worker同一单调时钟的record阶段、finish同步段、finish→全部send-callback drain；process.cpuUsage差量（进程CPU，不是整个机器）、parent同钟的首消息→summary→child close、外层load→最终持久化/工具完成。跨进程原/新clock不相减，record与finish不拿不配对quantile相减。parent统计每条实际envelope的字节/消息数、唯一顺序与摘要，保原映射；per-query复算相同SQL group counts/sums对buffered，nonSQL有限字段逐项等价；不能只比总count隐藏丢样或重复。

## 候选资源和验收，尚未OPEN

- 一个ordinary逻辑段≤60s：预检/load≤10s，两arm各≤20s含worker排空，最后≤10s持久化/资源核对；公共绝对origin，不每child重置。预计3个Node进程（coordinator+两个串行worker，峰值2）；tsx/esbuild可能各至1个辅助进程，最多3额外helper候选，总最多6个自有PID，实际必须记录，不把“2arm”误作2个OS进程。多余/身份未知不得无条件删根。
- 原OPS14处理最后组/EOF/TERM/KILL事实；独立known process闭合与same-inode有界inventory后才删新TMP，未知KEEP。旧两个S01 root不读不删。无PG/端口/HTTP/browser/native/provider/个人配置操作。
- 新trace≤2MiB，ownTMP≤8MiB（含loader/cache，禁Node/tsx disk cache），raw≤128KiB，source+metadata≤512KiB；IPC实际累计单独计量≤4MiB，不当磁盘写入。候选新增总逻辑预算32MiB覆盖这些项和receipt余量；实际RSS/瞬时JSON heap峰值UNKNOWN，非OS quota。保留所有已知KEEP与一份cleanup reserve；经理future fresh完整sum另算，不把原9296871424或当前时钟当新的OPEN。
- 原source scope允许mixed和preparation；本片小trace/结果只放新的preparation专用literal并先列全路径/absence，不覆盖pool-wait-run或旧manifest。未来如需新run目录须先amend。现仅设计文件，没有创建新trace/运行入口或输出。
- 必须：同input hash与分母、完整语义等价/序号/phase、完整64KiB envelope、pending0/dropped0/单summary、首次错误保留、raw未截断、工具实际退出、各精确group/EOF/TMP闭合。失败计量照常保留，不删失效行，不用更快总elapsed定PASS。

下一步只在有界合法实施片固定这个真实consumer及必要pure反例后独审，ordinary实际仍需经理协调（当前Original有CORE普通potential，Web发布优先）。本设计不授权运行，也不替代完整128/ACK/browser/provider验收。复用find-skills/codebase-design/固定clean-code，选择既有深模块和同一reporter所有权；拒绝2×2大矩阵、第二PG平台或泛化trace框架。
