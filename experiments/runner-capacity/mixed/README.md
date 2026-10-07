# S01 混合负载合同（准备，未运行）

固定生产基线 `4391bbf9f1785212d098ef6aa1c01a0320a003d3`。本阶段由 GO 独立授权最多40新 tasks、含清理60秒、传输加证据64MiB、0provider。driver 固定32 tasks、两组各16、不得补跑；旧 W1/W2源码与raw/hash及累计44/38/20.925025秒原封保留。Mika只批准本driver设计/纯验证，实际运行还须固定commit、独审及其明确窗口。

一个独有PG库、动态loopback真实中心与一个独有runner child；该child依次运行1个runtime×注册/local16及4个runtime×注册/local4，每runtime独有目录/token。保持center池8、scheduler池3和现有锁/调度器；不调产品。每组先以真实claim ACK→持久admission→fixture adapter活跃区间和单次DB快照的task/attempt/fence/未完成/有效lease匹配全部16，逐attempt保留有序event ACK与心跳。仅屏障人数、配置容量、IPC峰值或数据库总行数不作实际并发证据。

每组6.000秒混合窗口：前3秒16活跃，t3请求取消预定4，余12到t6停止周期message并返回adapter。message≤5Hz/256B、await emit；heartbeat1000ms、poll500ms、request1500ms、lease10000ms。轻读10Hz、最大2在途、snapshot/events(limit20)交替，满额计跳过不积压。observer100ms、最多一查询在途。t6只表示windowComplete；之后独立settlement最多1500ms，分别核正常12 completed ACK及取消4的受理ACK→heartbeat cancel→adapter停止→completed(cancelled) ACK，全部计入45/60秒。超过settlement限失败。

45秒停止新增，15秒专供收束。可归属Node流传输/IPC/证据保守合计64MiB，48MiB软停；证据记录/响应/IPC队列有硬界限。不扩超时取好结果。未知claim/admission保留、无自动重执；只TERM/KILL已登记自有child，异常停止计失败，确认本库连接结束才DROP，不停止55432共享服务。未能清理的资源保留标识与失败，不把预算到期当清理成功。

私有center child在dynamic import createServer前装饰实际Pool.connect与client.query，一client仅一次，保留this/返回值/error对象及callback exactly once；仅记录SQL枚举、pool实例/PID、时间/计数。acquisition含连接建立，transaction elapsed含锁，runner-row query elapsed含执行/往返，不能相减得纯锁时间。observer记录本库pg_stat_activity的Lock/blocker PID存在证据；100ms采样miss不等于零锁等待。scheduler实例归因不充分标candidate/unknown。报告观测开销/机器背景、实际样本数/错误/跳过，不作严格性能或provider容量结论。

入口计划：由Mika另给一次windowId及固定source target，`FLOW_S01_ADMIN_URL`仅接收既有受控本地PG配置，不输出凭据；一次性reservation阻止重跑。纯准备检查只运行本目录unit和strict noEmit，禁止借import入口启动负载。

字节计量：center自有HTTP与PG socket、driver admin/observer PG socket的bytesRead/bytesWritten按对象去重，关闭时取final counters；HTTP body、SQL/row JSON作为额外保守重复计数，IPC与证据另计。stream特征缺失、回退计数或超过256socket（driver8）上界使完整计量UNKNOWN并失败；不称TCP/IP重传或网卡流量。`runtime-dependencies.json`固定Node24.20.0、pg8.23.1/pg-boss12.37.0与stream相关源码hash，运行前验证pg-boss解析同一pg以覆盖其Pool。

职责：contract掌管固定参数/预算；observe-pg保持PG调用语义且只生成计量；stream-bytes掌管socket身份与完整性；child只组装生产center/runtime+确定性adapter；process掌管自有child/IPC；proof核权属、实际窗口和ACK/DB摘要；driver唯一掌管阶段和资源收束。后继拓扑只改固定合同及其调用，不增加产品状态机/第二调度器。

依据：[PostgreSQL行锁](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)；[node-postgres Pool](https://node-postgres.com/apis/pool)；[pg_stat_activity等待事件](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)。文档解释观测语义，实际版本取本窗SHOW server_version，历史PG16.13不冒充新窗实测。

故障收束采用阶段截止：children并行且最迟52秒结束等待；请求/observer drain53.5、observer关闭54、仅自有随机库存在性核查55.5/连接核查57/DROP58、admin关闭58.5、journal59、观测证据59.5/结果59.9秒。每步deadline前未开始则不启动；超时保留UNKNOWN，任何child未确认closed或observer未关闭禁止DROP。PG关闭超时仅destroy已登记自有流，字节完整性失效；OS操作若已经发出不能被Promise deadline证明取消，资源/写入仍按UNKNOWN记录，不宣称清理成功。CREATE发送前置creationRequested，丢ACK仍核自有dbName，未知不按未创建处理。CLI最终receipt包含最后证据写入耗时，晚于60秒失败。
