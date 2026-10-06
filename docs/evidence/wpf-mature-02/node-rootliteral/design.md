# Node rootliteral：已审方向与固定实现合同

设计ff927712由Mika/Astra于2026-10-06 12:37:56 UTC批准；本页为后续实现合同，组合尚待独审。GO准备授权`go-node-rootliteral-once`：最多3自有Node目标、0编译；60秒从入口hash至全部自动证据/关闭/清理/结果/CLI，2MiB含prepared、capture/磁盘复制、结果与人工归档字节。实际窗口尚未OPEN，S01实际运行串行；当前0目标/0网络测量。此前C结果4757/e47仅固定C测量PASS，不能作为Node、完整隔离或资格证明。

## 唯一顺序与固定Interface

批次 `runNodeRootliteralBatch()` 仅接受固定entry核验后的输入；CLI只接受一个显式flag，依赖注入只供纯检查。复用旧diagnostics的reserve/capture/cleanup辅助与R06唯一factory；profile选择仅新增固定枚举，不接收任意路径。旧目录/报告保持历史Git语义，旧raw/manifest不修改。精确inputs见design-inputs.json。

| 槽 | 唯一目标 | 放行后继的证据 |
| --- | --- | --- |
| 1 | 固定Node24运行现有immediate-exit.mjs，无profile；专属空cwd/env | 预期exit7、精确40B stderr/hash、capture完整及直属child关闭且close.reason严格为DISCONNECTED。R06 ready失败在本控制项是预期，绝不当RPC成功。 |
| 2 | 同一脚本/Node flags，rootliteral profile、独占control/state | 同样exit7与40B/hash，捕获/关闭/资源清理确证；其他结果停止，槽3 NOT_RUN。 |
| 3 | 原canary-preload.mjs + 固定R06 peer normal，同profile | 原七断言/同runId报告全部true、synthetic ready、listener healthy/accept0、固定marker未变、close.reason严格为CLOSED、cleanup确证。无真实model/list/thread/turn/auth。 |

各槽wx预约fsync后才factory，预算在failed spawn也消费，不重试。三个槽均保留原`--jitless --no-addons`，不使用`--no-warnings`或猜测`--no-expose-wasm`。固定Node24.20源码的直接V8告警不受Node warnings开关保证，详[只读flags核验](source-check.md)；40B是本次完整输出的严格预期，不是对本机静默的预先证明。额外告警、截断或其他bytes均使控制失败，停止后继。环境仅PATH=/usr/bin:/bin、专属HOME/CODEX_HOME/TMPDIR、LANG/LC_ALL/TZ，不继承NODE_/DYLD_/LD_/provider凭据。父CLI使用Node24内建transform-types及固定六模块.js→同目录.ts同步映射；R06唯一实现原地加载，不启动tsx/esbuild服务，loader/transform flags不传入目标。

## profile与观测

新profile由rootliteral固定文件逐字复制，仅删除原C CANARY_EXECUTABLE exec/read/map grant和对应两行注释；其余67/root literal/文件/网络/进程限制完全不变，不添加任何bootstrap、Mach、sysctl、HOME或网络grant。旧profile中固定Codex executable allowance仅为遗留未使用字段，候选spawn只允许固定Node或sandbox-exec→Node，绝不启动Codex；不将此profile描述成“Codex禁止执行已证明”。根literal可含根枚举，非递归。

复用原七项：own state读写、另一个own根读拒绝/写拒绝、control写拒绝（0700排除POSIX混淆）、symlink读拒绝、hardlink创建拒绝、随机loopback连接拒绝。拒绝只接受EPERM/EACCES，refused/timeout是unknown。listener仅槽3在一个自有动态端口；创建即登记，失败listen也finally关闭，记录bind/healthy/accept/closed。只读写自有无敏感marker，不访问真实私人文件、外网或系统日志。

## 生命周期、输出与停止

一层批次时钟；每槽最多8秒，R06 initialize3秒/request1秒、TERM/KILL各500ms；启动前至少保留15秒用于收尾。不得用超时当关闭。准备root、sink、listener从创建即登记，未知inode/fd不猜删；仅确认child关闭与listener关闭后清除精确owned roots。每槽保存有限stage/reason/CloseReport、sinkhash/bytes/flush/close、七项或NOT_RUN。stderr每槽64KiB、0600私有sink；计入capture和文件副本，再hash/有限分类，finally按原方案删除或明确retained，不把原文放console/Git。

累计stdout按固定程序单独推导：槽1/2的immediate-exit只向fd2写40B，程序stdout为0；槽3只由R06一次initialize(id=1)与一次initialized驱动normal peer，生成123B初始化响应+59B ready通知，合计182B UTF-8（含两个换行）。无request/respond/重试/额外输入；消费一次ready通知并严格核内容。每槽启动前分别预扣stdout源上界0/0/182B，不称实际wire计量；R06 queue/peak只约束驻留量。每槽要求stdoutBoundConfirmed=true：child已确认退出、ignoredResponses/inboundFrames均0、close.reason严格匹配控制DISCONNECTED或canary CLOSED。PROTOCOL/LIMIT/WRITE_FAILED等即使队列为空也失败；解码异常、意外通知/response或未完成握手时不能证明本固定正常路径，stdout accounting记unknown并停止，该源上界不授予任意持续输出许可。该固定源码推导与两帧hash见source-check；R06没有独立累计stdout观测，不伪造该字段。

R06077的unconfirmed CloseReport可能仍有ref child handle，不能声称该路径自然令CLI退出或所有writer已停。候选entry在已fsync安全失败结果且stdout callback完成后，unknown路径只结束自己的CLI并留unknown/root身份；不另杀PID、不删资源、不升级settlement。此限定CLI退出处理有纯故障验证，不修改已交回R06；实现组合仍需固定独审。

2MiB共用一个计数器：prepared精确预扣、三sink捕获+持久副本、配置/复制输入/七项报告及全部结果/CLI均计；R06固定stdout有界预算按保守上限计，不把peak当累计总量。32KiB机器收据+128KiB人工archive提前保留；准备基线给后续至少24KiB余量，超界即不启动后继。结果在清理后持久化，CLI返回包括该次持久化后的elapsed；人工review/Git时钟外但实际bytes继续计量。同步OS IO不能硬抢占，任何超界照实失败。

## 精确实现/验证范围

原scope内：新node-rootliteral薄entry/profile/input/evidence；diagnostics/run-diagnostics.mjs导出最小既有sink/cleanup辅助供唯一新固定三槽组合，不复制R06 supervisor；isolation/compose-canary.mjs添加固定profile枚举、listener创建即登记与安全生命周期观测，原七项preload/peer字节不改。不新增通用矩阵或平台。

纯验证用fake transport/假listener和自有临时文件：槽1/2不符停止、先wx消费/再次拒绝、槽3只一次listener/factory、listen失败关闭、七项原断言/错误码、未知close/未知inode保留、总字节/时间/末次持久化/CLI gate。Node24惰性import与syntax；不执行旧真实child套件/编译/目标/PG/SDK/provider。固定源码+manifest再交独审，Mika串行实际门禁另授。

方法：本地find-skills→brainstorming bounded（GO明确方案方向，先交本设计）、codebase-design复用深Module与单一进程owner、clean-code sickn33固定bdacd76。无安装、无新运行。本设计是新的metadata阶段，不追改rootliteral e47封存计量快照。


技能来源：本地find-skills/brainstorming/codebase-design/clean-code，clean-code固定sickn33@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。实际检查与历史失败见checks/result.json；最终55/55=39新+16直接旧，native惰性import确认0factory/0listener。测试工具准备进程不冒称实际诊断target，当前实际0compile/0target/0listener。

## 外层时间与计量

唯一外层execute-window.sh使用固定/usr/bin/time -p与UTC start/end文件，1个Node宿主和最多3个Node目标分开。内部performance.timeOrigin覆盖宿主启动/import；内部末次持久化/CLI前时点不代替完整exit。外层UTC end在host CLI/exit之后；秒精度差值+1为保守上界，time real有舍入，不声称纳秒精确。外层real或UTC保守上界>60均FAIL；另保存工具调用完成时点，诚实区分额外收据开销。同步OS IO无法硬抢占。

宿主transform警告与time输出只存0600 outer-time.stderr，禁止打印原文/入Git；它的实际捕获字节和文件副本均计预算。外层固定收据预留1024B，实际超界或未知即FAIL，不靠该预留冒称实际计量。人工review/Git时间在窗口外，实际bytes仍计128KiB archive；旧e47等快照只按固定Git解释。
