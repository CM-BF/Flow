# S01 / REQ-18：128 实际 fixture 执行准备

2026-10-06 12:08:19 UTC；owner status_read / gpt-6-astra，co-lead mika。此页是既有S01后继设计，当前0新负载；须固定实现独审、Mika点名唯一执行HEAD后才运行 `s01-128-after-light-reads-once`。

**追溯与固定输入。** [FLOW-001权威plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md) §12第360/375行与T04，第[REQ-18](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/full-plan-matrix.md:24)要求128持久session且分别报告会话/执行/真实模型并发。沿S01-04/05/06；不新建benchmark任务。main `1c4968354dabce1e6748f3301a2e6eecd33e77d4`含P03、P04、B01，受控无冲突合入 `07c8a0b6396903fd82b4cac45313ca804e71061d`；原172文件已[冻结](prior-freeze.json)，旧unknown journal不打开/重放/删除。现writer8e4660a6 v3三个scope不变，integration回执独立take/release。

**最小Interface。** 复用 `experiments/runner-capacity/mixed/{driver,child,proof,observe-pg,channel,process}.ts`，新增一个固定profile枚举 `after-light-reads-128-v1`（无自由拓扑/任意参数CLI），由原identity选择后透传driver/child/proof及预算。旧legacy/after-drain profile值不变，旧Git targets可重现；不复制整套driver，不改产品pool/锁/runtime/schema。独立准备目录为本目录，唯一输出 `docs/evidence/s01/mixed-128-run`，目录存在即拒绝重试。

| 固定项 | 本片候选值与口径 |
| --- | --- |
| 拓扑/任务 | 一个case，8个已注册runner、每runtime最多16；8个runRunner同一个owned runner child，另1个center child+1个driver进程。恰好128新task/attempt，最多128，不warmup/预演/补数。 |
| 会话 | 真实createFixtureAdapter发唯一fixture nativeSessionId，经session事件/ACK/recordSession持久flow.sessions，核128唯一session→task→attempt→runner及ownerVersion/lease。它们不是128原生SDK/model或Flow conversation对象；旧128空conversation背景也不替代本次事实。 |
| 持续行为 | barrier前fixture完成准备，DB同时128 running/live/fenced且各已有session/事件ACK/continue heartbeat才释放。固定6秒；每attempt await emit 2Hz/256B；heartbeat1s、poll500ms、request3s、lease10s；不加入取消子场景（旧32mixed已有独立取消证据）。 |
| 有效执行证明 | 分开记录adapter-enter→end逻辑峰值、等待barrier区间、每次emit start→ACK与heartbeat时间。要求全部128正常adapter至少覆盖6秒，窗口内每attempt至少2条message ACK且首末跨度≥4秒、至少1个continue heartbeat；报告全128首次ACK最大值到末次ACK最小值的实际公共跨度，不拿等齐128或timer标记当持续执行。DB窗口内每个样本保持128 live/fenced；缺任何身份/行为/终态即FAIL。 |
| 请求/观察 | 轻读10Hz、最多2个并发，交替snapshot/events（原行为）；DB活动/attempt快照200ms单flight。memory每进程1s：RSS/heap/external/arrayBuffers与资源maxRSS，区分center、一个runner进程及driver，不当8独立OS进程。 |
| 时限 | 180秒含hash/启动/证据/cleanup/CLI；150秒停新增。单case gate最多45秒且保留6秒window+5秒settlement，明确windowComplete与completedACK。cleanup截止从profile逐项传递：child162s、HTTP/observer165s、observerclose166s、DB存在168s/连接170s/drop173s/核absent175s、adminclose176s、journal177s、observations178.5s、result179.5s、CLI180s。发出的OS操作不可由Promise timeout假装取消。 |
| 字节/对象 | 总256MiB、192MiB软停+64MiB cleanup/evidence reserve；当前archive计入。Node自有HTTP/PG流、IPC、保守payload重复计数、raw/结果/最终归档均计；不是TCP重传/网卡或物理磁盘IO。160000 observations、每record≤256KiB、IPC pending≤1MiB、owned streams≤1024，计数/特征未知不能PASS。接收前预留最终compact observation JSON字节，防止末次落盘才发现超界；不存正文/凭据/错误message。 |

**计量依据与界限。** 旧32tasks两case共1027事件、30061 records、36,092,931B运行计量，最终归档保守49,489,224B。新2Hz×128×6s最多1536窗口message，加128×6基线/terminal约2304事件；按原约29 records/event约6.7万，额外setup heartbeat/DB/memory估约7–11万、约110–160MiB保守总量。此为设计估算，不是性能预演或成功保证；硬限160000/256MiB触及即FAIL，不能丢记录后PASS。不调产品pool，Lock正样本才证明等待；miss不证明零锁等待，query elapsed不是纯锁时长，背景负载/观察开销单列。

**必须补的小实现。** 消除本路径literal16/2cases与52…59.9s散落deadline，使用固定profile taskCount/cases/cleanup表；proof增加session唯一/DB fence/连续seq与每事件id+digest+ownerVersion+accepted/lastSequence绑定，全128正常完成及8journal null/[]。observePg仅有限分类runner FOR SHARE与FOR UPDATE（旧runner-row保留历史值），不把other叫无锁。私有runner fetch记录枚举operation、request ordinal、task/attempt/runner可核映射、HTTP status或脱敏errorClass、send/settled/stop monotonic时点；原error对象原样throw，未知claim身份明确null，不推断未受理。只在自有child装饰，不改产品log；测试用fake fetch/clock/streams，真实负载只有唯一正式调用。

**失败与清理。** CREATE前creationRequested，专用随机DB/动态loopback/自有目录；最多2自有child且已登记才发TERM/KILL，必须等close。子进程/观察者连接无法确认关闭则不DROP；精确库名查询0连接后普通DROP并核absent，无FORCE。所有unknown admission/outbox/资源保留并使FAIL，不删journal取成功。8 journals/会话状态与全事件证据在drop前提取；drop/admin close/归档均计180秒。禁止触碰61227/61228、旧资源、个人服务、provider/SDK/auth。

本片可验证真实fixture会话与确定性执行/持久化；原REQ-18真实model/tool组合、浏览器断开、完整故障恢复与部署SLO仍单独开放，不能由本片勾完FLOW-001。
