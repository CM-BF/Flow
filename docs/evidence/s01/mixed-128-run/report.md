# S01 / REQ-18：128实际fixture执行单次结果

本次固定窗口 **PASS，待独立结果审查**。唯一调用 `s01-128-after-light-reads-once`，已审实现 `6de928d8092ba8c22ac2222ac7c16af3660be48a`，执行HEAD `70c92414d3f0fc90b256e857acf64ba3dba35b30`，固定生产输入main `1c4968354dabce1e6748f3301a2e6eecd33e77d4`（含P04共享fence与B01轻读）。没有warmup、容量预演、补task或重跑，0 SDK/provider/模型。

## 真实身份、并发与持续行为

独立最终DB计数128 tasks、128 attempts、128持久化fixture sessions；每个session经真实session事件/ACK绑定task→attempt→runner，最终`active_task_id=null`。八个runner注册身份，各16实际attempt；八个`runRunner`在同一runner OS子进程中运行。资源拓扑为1 driver进程、1 center子进程、1 runner子进程，不是8个OS runner进程、128个原生SDK agent或128个Flow conversation对象。

128个真实adapter enter→end逻辑峰值为128，共同区间6413.966708ms（含放行前部分等待）；不能把barrier等齐当持续执行证据。固定6秒窗口另有：

- 每attempt窗口内12次message event ACK，共1536次；network event-ACK首末跨度最小5426.648458ms、最大5709.631083ms，128共同首末ACK包络5380.155334ms。
- `emit()`返回时刻另测首末跨度5426.569666–5709.908667ms，共同包络5380.193875ms；这两个时点略有差异，不混为同一个计量。
- 每attempt窗口内至少一次continue heartbeat。全运行1344次heartbeat均continue，2304条persisted event逐项与ACK id/sequence/digest/ownerVersion/accepted对齐，每attempt seq1..18连续，128终态succeeded/verification passed。
- 最早adapter end减window start为6001.085916ms，故实际adapter均覆盖6秒；window-end timer标记5999.505708ms略早，未将其当作覆盖证明。
- 30个完全位于IPC保守窗口内的DB样本，每个128身份一致、running/live/fenced/session绑定。末query开始减首query结束为5780.707208ms，排除查询本身耗时。校验当时20个跨界/窗口外样本排除，校验后又归档2个样本；证明采样时刻，不能声称连续无间断lease。
- 最后completed ACK在6秒窗口后527.380416ms完成；windowComplete和settledByDeadline分别为true。最大barrier等待2738.673792ms另报，ACK包络不是连续CPU或token执行。

## 请求、资源与预算

全部3784次runner请求都有同ordinal的send/settled记录：setup1342、window2306、settlement136（phase按parent接收）；实际状态均200，记录的runner-http-error为0。owner请求61次200、128次202。停止的child单调时刻后没有新send、没有未结算请求；本次未观察到HTTP错误，结论来自完整记录而非PASS推断。未来错误仍须逐项保留status/类别/identity/stop关系；本次不能替代故障恢复验收。轻读实际53次，最多2个并发的门限跳过5次；DB观测才是single-flight。

8份journal均`inFlight:null/assignments:[]`，无unknown占用；runner与center两个自有child均自然exit0，非TERM/KILL强收束，专DB已普通DROP并确认absent，新工作目录已删除，无本次retained。旧失败窗口的retained journal没有打开/重放/删除。

外壳UTC start2026-10-06T12:31:13.682022Z，exit receipt12:31:28.419308Z，CLI exit0。`/usr/bin/time -p` real14.64s（user8.86/sys3.64）覆盖spawn/exec/import至进程退出；外层UTC receipt间14.737286s另含shell/Python收据开销。driver final14454.605125ms，CLI写入前14455.165834ms均是内部时钟，不冒充外层完整耗时。180秒自动窗口满足，人工离线review/Git封存不计容量执行时长。

完整运行计量88,323,950B，byteAccountingComplete=true；其中预扣最终CLI32KiB和后续归档1MiB。归档实际/保守重复计算见[archive-budget](archive-budget.json)。包括固定可见实验输入、自有Node流、IPC、HTTP/SQL/row保守重复、原始证据；不声称全OS模块加载IO、TCP重传或物理磁盘字节。observations为79,354条/28,841,267B，序列化/observer开销实际存在。

## 分层观测与限制

窗口phase的center pool acquisition（含连接建立）n4691：median12.927666ms、p95 203.427084ms、max632.255666ms；事务elapsed n2371：median6.026291ms、p95 22.496375ms、max189.537ms。p95使用nearest-rank。phase采用parent收到记录时刻，边界可能跨阶段，不能由HTTP相减推纯锁等待。

**FOR SHARE row elapsed=UNKNOWN。** 观测器的精确谓词写成`SELECT * … FOR SHARE`，固定P04实际为`SELECT id,revoked … FOR SHARE`，所以这些查询归入other。原source/raw冻结，不能从other反推share耗时，分类n0也不等于没有锁。全运行136个exclusive runner-row分类记录，窗口内0；全运行58次PG activity中13次有Lock/blocker正证据，窗口31次中0次正证据，后者不证明无锁等待。后继只可另固定observer修复，不追补本次测量。

采样RSS峰值：driver219,398,144B、center278,724,608B、runner315,080,704B；是各进程各自峰值，不相加冒充同时峰值。系统loadavg开始[4.626465,9.304199,14.370117]、结束[6.073242,9.388184,14.311035]，没有要求其他团队停工。没有未插桩对照，不能据此宣称P04/B01严格加速比、纯锁因果、容量SLO或128原生模型能力。

原始五份driver产物由[raw-freeze](raw-freeze.json)绑定，未重写。离线[analyze.py](analyze.py)仅读保存JSON，派生[analysis](analysis.json)可复核上述身份/事件/区间/计数；没有再次连接PG、发HTTP或运行runner。41纯检查属于准备实现，不与本次128运行累计为测试通过数。
