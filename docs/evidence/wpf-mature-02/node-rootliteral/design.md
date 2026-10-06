# Node rootliteral：小接口设计，待Mika审后才写源码

GO准备授权`go-node-rootliteral-once`：最多3自有Node目标、0编译；60秒从入口hash至全部自动证据/关闭/清理/结果/CLI，2MiB含prepared、capture/磁盘复制、结果与人工归档字节。实际窗口尚未OPEN，S01实际运行串行；当前0目标/0网络测量。此前C结果4757/e47仅固定C测量PASS，不能作为Node、完整隔离或资格证明。

## 唯一顺序与固定Interface

候选 `runNodeRootliteralBatch()` 无用户参数；入口只接受一个显式flag。复用旧diagnostics的reserve/capture/cleanup seam和R06唯一factory；profile选择仅新增固定枚举，不接收任意路径。旧目录/报告保持历史Git语义，旧raw/manifest不修改。精确inputs见design-inputs.json。

| 槽 | 唯一目标 | 放行后继的证据 |
| --- | --- | --- |
| 1 | 固定Node24运行现有immediate-exit.mjs，无profile；专属空cwd/env | 预期exit7、精确40B stderr/hash、capture完整及直属child关闭。R06 ready失败在本控制项是预期，绝不当RPC成功。 |
| 2 | 同一脚本/Node flags，rootliteral profile、独占control/state | 同样exit7与40B/hash，捕获/关闭/资源清理确证；其他结果停止，槽3 NOT_RUN。 |
| 3 | 原canary-preload.mjs + 固定R06 peer normal，同profile | 原七断言/同runId报告全部true、synthetic ready、listener healthy/accept0、固定marker未变、close/cleanup确证。无真实model/list/thread/turn/auth。 |

各槽wx预约fsync后才factory，预算在failed spawn也消费，不重试。三个槽均保留原`--jitless --no-addons`，不使用`--no-warnings`或猜测`--no-expose-wasm`。固定Node24.20源码的直接V8告警不受Node warnings开关保证，详[只读flags核验](source-check.md)；40B是本次完整输出的严格预期，不是对本机静默的预先证明。额外告警、截断或其他bytes均使控制失败，停止后继。环境仅PATH=/usr/bin:/bin、专属HOME/CODEX_HOME/TMPDIR、LANG/LC_ALL/TZ，不继承NODE_/DYLD_/LD_/provider凭据。父CLI的既有固定tsx只处理已审R06 TS，绝不传入目标env。

## profile与观测

新profile由rootliteral固定文件逐字复制，仅删除原C CANARY_EXECUTABLE exec/read/map grant和对应两行注释；其余67/root literal/文件/网络/进程限制完全不变，不添加任何bootstrap、Mach、sysctl、HOME或网络grant。旧profile中固定Codex executable allowance仅为遗留未使用字段，候选spawn只允许固定Node或sandbox-exec→Node，绝不启动Codex；不将此profile描述成“Codex禁止执行已证明”。根literal可含根枚举，非递归。

复用原七项：own state读写、另一个own根读拒绝/写拒绝、control写拒绝（0700排除POSIX混淆）、symlink读拒绝、hardlink创建拒绝、随机loopback连接拒绝。拒绝只接受EPERM/EACCES，refused/timeout是unknown。listener仅槽3在一个自有动态端口；创建即登记，失败listen也finally关闭，记录bind/healthy/accept/closed。只读写自有无敏感marker，不访问真实私人文件、外网或系统日志。

## 生命周期、输出与停止

一层批次时钟；每槽最多8秒，R06 initialize3秒/request1秒、TERM/KILL各500ms；启动前至少保留15秒用于收尾。不得用超时当关闭。准备root、sink、listener从创建即登记，未知inode/fd不猜删；仅确认child关闭与listener关闭后清除精确owned roots。每槽保存有限stage/reason/CloseReport、sinkhash/bytes/flush/close、七项或NOT_RUN。stderr每槽64KiB、0600私有sink；计入capture和文件副本，再hash/有限分类，finally按原方案删除或明确retained，不把原文放console/Git。

累计stdout按固定程序单独推导：槽1/2的immediate-exit只向fd2写40B，程序stdout为0；槽3只由R06一次initialize(id=1)与一次initialized驱动normal peer，生成123B初始化响应+59B ready通知，合计182B UTF-8（含两个换行）。无request/respond/重试/额外输入；消费一次ready通知并严格核内容。每槽启动前分别预扣stdout源上界0/0/182B，不称实际wire计量；R06 queue/peak只约束驻留量。解码异常、意外通知/response或未完成握手时不能证明本固定正常路径，stdout accounting记unknown并停止，该源上界不授予任意持续输出许可。该固定源码推导与两帧hash见source-check；R06没有独立累计stdout观测，不伪造该字段。

R06077的unconfirmed CloseReport可能仍有ref child handle，不能声称该路径自然令CLI退出或所有writer已停。候选entry在已fsync安全失败结果且stdout callback完成后，unknown路径只结束自己的CLI并留unknown/root身份；不另杀PID、不删资源、不升级settlement。此限定CLI退出处理也需本设计审批和零目标测试，不修改已交回R06。

2MiB共用一个计数器：prepared精确预扣、三sink捕获+持久副本、配置/复制输入/七项报告及全部结果/CLI均计；R06固定stdout有界预算按保守上限计，不把peak当累计总量。32KiB机器收据+128KiB人工archive提前保留；准备基线给后续至少24KiB余量，超界即不启动后继。结果在清理后持久化，CLI返回包括该次持久化后的elapsed；人工review/Git时钟外但实际bytes继续计量。同步OS IO不能硬抢占，任何超界照实失败。

## 精确实施/验证范围（目前仅设计）

原scope内：新node-rootliteral薄entry/profile/input/evidence；diagnostics/run-diagnostics.mjs导出最小既有sink/cleanup辅助供唯一新固定三槽组合，不复制R06 supervisor；isolation/compose-canary.mjs添加固定profile枚举、listener创建即登记与安全生命周期观测，原七项preload/peer字节不改。若实作发现共享helper需要广泛重构则停报，不增加通用矩阵/平台。

纯验证用fake transport/假listener和自有临时文件：槽1/2不符停止、先wx消费/再次拒绝、槽3只一次listener/factory、listen失败关闭、七项原断言/错误码、未知close/未知inode保留、总字节/时间/末次持久化/CLI gate。Node24惰性import与syntax；不执行旧真实child套件/编译/目标/PG/SDK/provider。固定源码+manifest再交独审，Mika串行实际门禁另授。

方法：本地find-skills→brainstorming bounded（GO明确方案方向，先交本设计）、codebase-design复用深Module与单一进程owner、clean-code sickn33固定bdacd76。无安装、无新运行。本设计是新的metadata阶段，不追改rootliteral e47封存计量快照。

本段技能来源：/Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code}/SKILL.md；clean-code固定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，沿已读本地版本，无重装。12:36:54 UTC安全点复核命名/单一owner/unknown/资源关闭/重复：删除no-warnings保证推断、把stdout总量改为固定两帧推导；不复制supervisor，待审不提前实现。
