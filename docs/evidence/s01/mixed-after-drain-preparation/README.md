# S01 独立停止修复后窗口：准备合同

2026-10-06T10:42:12.735Z，owner status_read / gpt-6-astra，co-lead mika，所属FLOW-001/S01既有两层。当前仅准备；没有windowId，没有真实运行。

固定生产base 0cee7556befa1988e60bae94b510240122c34b88，受控merge 86297277e59f9ba8ffe62dd863e4259108caf5e2；包含已审P03 a677f2b8a22aa5ecdcc1be3709cd73a090f34702，两源须逐字绑定。原4391上的一次窗口继续FAIL，B为NOT_RUN；本窗是GO新授权的独立一次预算，不能补耗旧预算。详见[input-contract](input-contract.json)。

已按Mika批准实施的最小Interface是run identity枚举：legacy默认保持旧固定目录，after-drain-v1选择新base、mixed-after-drain-preparation和从未存在的mixed-after-drain-run。只改driver的输入选择/预核、reservation/result有效合同及main的显式identity参数；负载/child/proof/观测/停止/清理逻辑不变。原Git固定634/121/6a596 target及旧manifest/raw继续可重现，新manifest明确绑定输入适配的小diff，不能称旧manifest仍描述已变化的当前driver。新增纯identity/preflight检查，局部严格类型；不借导入启动driver。

仍A1×16后B4×4，同一个自有center与runner child；每组6秒，前3秒实际16在途，t3取消4，其余12t6结束emit后独立settle≤1500ms。windowComplete与completed ACK分开。32新tasks不补跑，总上限40，45秒工作加15秒清理，48MiB软停加16MiB清理余量，总64MiB。5Hz/256B/await emit、heartbeat1s、poll500ms、request1500ms、lease10s、10Hz/max2轻读、100ms observer均不变。

只有固定输入+源码独审、Mika点名唯一windowId与clean executionHEAD后才可执行。原真实attempt/fence/lease/adapter/event/heartbeat门禁、unknown admission保留和完整Node流字节门禁不减。失败即停，B可NOT_RUN；不调超时/缩窗口/清journal获取通过。仅新专用DB、动态loopback、自有child，没有provider/nativeSDK、共享服务/personal runtime/tab动作。

[prior-freeze](prior-freeze.json)固定原132文件；原FKye9L journal没有在本次准备中读取或操作。旧source允许仅经新target明确小改，旧raw/support/manifest保持原字节。preparation及本次raw/IPC/自有Node流全部计新预算；旧已封存证据不作为本次传输。保留phase按父进程接收时标、采样/观察开销、A→B顺序与warm-up/背景负载混杂；不作严格speedup、纯锁时间/因果、容量SLO或>100agent结论。

准备验证：新identity/preflight10个不同用例通过，原14不重跑；局部strict0。首次缺模块0tests与新增映射尚未实现时1项行为red均保存，不混作通过。当前仅2旧源码+2新源码变化，实际运行/PG/HTTP/provider为0；source-delta.patch和后续manifest固定审查范围。
