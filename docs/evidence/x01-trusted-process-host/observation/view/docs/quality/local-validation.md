# 局部验证与交付速度

2026-10-06 02:32 UTC。使用本地 find-skills / codebase-design / clean-code；方法依据固定 pnpm9.15.4 / Vitest4.0.18 与现有 manifest，不推断未来版本能力。

| 改动面 | 可执行入口与直接影响 |
| --- | --- |
| 中心业务 | `pnpm exec vitest run apps/server/src/<affected>.test.ts`；命令/ownership/迁移改动加 server.test.ts 中对应路径 |
| Runner | 显式 `apps/runner/src/` 内受影响测试路径；outbox/control/adapter 变化覆盖其公开行为 |
| Contracts | 显式 `packages/contracts/src/<domain>.test.ts`，再选 server/client/runner/CLI 中直接消费行为；只类型检查不替代 SQL/运行时协议 |
| Client / CLI | `pnpm exec vitest run packages/client/src/client.test.ts apps/cli/src/cli.test.ts`；若只改一侧，按依赖选相应文件 |
| 协议 | `pnpm exec vitest run packages/protocols/test/<affected>.test.ts`，真实官方peer与专用PG按影响选择 |
| 产品Web | 已存在 `pnpm --filter @flow/web test` / `typecheck` / `build`；浏览器只跑相关旅程和真实共享接口集成 |
| Dashboard | 该包已有 Node tests；聚合/证明逻辑与实际临时 HTTP 验证，样式才需相关真实browser/截图 |
| 文档 / 状态 | 链接、task ID、事实/target/范围、diff，不跑全库 |

上表不是一律要运行全部命令。每次记录实际命令、选中数、通过/未选中数、专用DB/动态端口、耗时和已知边界；零测试失败，不能把无包script当通过。根fileParallelism:false暂时保留，未凭推测全局并行。后续先按耗时拆纯逻辑与独占DB集成组，再决定调度改变。

本段实例：M02因果投影修复先红1项，修后模块6/6约4.15秒，独立review选择201task/latecommit2/2；公共接口未变，没有重复全库93项。clean-code检查关注新不变量局部表达与不引入无关抽象。

2026-10-06 05:01 UTC汇总维护：find-skills本地clean-code/codebase-design复用同一管理任务，核权威owner/实际main；仅文档/相对链接/diff检查，不重跑产品或B02/CTX01负载。完整原要求未删，summary以用户可获得能力表达。

## 运行窗口前的入口核对（2026-10-06 16:59 UTC）

在已有局部验证准备中，先从**将要实际启动的固定入口**做小范围静态核对：除了 TypeScript import，还检查迁移固定数组/模板 URL、fixture 与配置文件、包入口及实际文件读取路径。只核本次执行闭包和确定路径，不做全库扫描或新验证框架；缺件由合法 owner/唯一 Git operator 补齐。静态齐备不等于 import、迁移或运行通过。

浏览器旅程在实际挂载视图中检查 locator 的角色、范围与唯一性，区分工具栏、会话标题及重复名称；已有真实 DOM/固定 App 证据可直接复用，不能把定位器异常报告成产品行为失败。修改定位器只补受影响旅程，不重跑未变的 HTTP 前置。

2026-10-06 两个实例：CORE 的 beforeAll 因两组动态迁移数组中的 4 份 SQL 未物化而使 8 例全部 skipped；补齐 5,539 B 后独立只读核真实 28 SQL/175 本地源/10 包入口，原失败保留，实际 PG 在新串行窗口验证。RELEASE03 已通过两个后台历史场景和普通发送，随后同名 Files 定位严格性错误；保留原清理/累计预算，修定位不改过去结果为 PASS。

后续新特征树按实际所属模块一次供给有限的 src/直接测试、fixture、动态 SQL 与包元数据；相关共享包按真实 Module 闭包供给，先量化固定 Git 的逻辑字节，再定小额本树预算。不要为省几十 KiB 反复逐文件/AST 往返；AST import 检查仍不能覆盖 new URL/动态资源。node_modules、build 和其他任务历史 raw 不随源码物化；逻辑字节不称物理配额，也不改变运行余量线。既有树只补明确缺项，保留全部现有 dirty/untracked/固定hash，不重设初始 sparse 或覆盖 writer。S01P07 的33源186,913B与后续 main入口22源93,543B是本次直接实例，后轮全部319份已物化文件保持，0安装/执行。

同范围局部检查由 co-lead 在既有资源和累计预算内自主准入，不逐条向 GO 申请。实际PG/共享服务与独立0PG浏览器分别由两lead明确交接，fresh 准入与实际清理不可省；源码、小检查和完整构建的资源界限分别适用。记录复用唯一 owner status 与原证据，不增加每文件审批或第二账本。已通过且未受改动影响的检查不重复。

<a id="ready-validation"></a>
### 资源恢复后的有限并行（2026-10-07，原 OPS-001-12）

低空间时“所有验证串行”的临时安排不再作为常态。现允许普通零模型功能验证在核实隔离后 **最多两个独立PG段、浏览器合计最多一个段，加三队各最多一段相互隔离的有界局部检查（局部合计最多三段）**；两PG准入条件见下方专节。局部段由各co-lead在原owner status记录固定范围、累计预算、实际起止与清理并自主执行；不再竞争全项目单一local槽，不逐命令准入或另建账本。每个独立PG段有唯一holder；共享数据库、个人服务更新、安装/完整构建、性能测量和unknown资源仍排他，0PG浏览器和离线artifact按下节协调。此调整不改 Vitest 全局 fileParallelism、不增加测试选择/断言/模型调用，不用并发运行结果宣称性能基准。

- 原 owner 开始前核源码/claim/实际依赖和所有可写路径。局部项只能写本任务排他 tmp/cache/raw；不得共用 DB、监听端口、服务、可写源/安装/store 或同一输出名。只读 donor 可复用，双方不得在期间重写它。无法确认隔离即串行，不以“0PG”推断无子进程或无资源开销。
- 准入同时核原各项门槛和组合预算：每个已存在任务的启动线保持；并行时，在重项原门槛之上保留全部活跃局部段**合计已声明新增字节预算**，并分别满足各局部段自己的启动线；无重项时同样合计新增预算并保原收尾余量。tmp/cache、raw、元数据与收尾分别计入，不能把两份 1 GiB 保留额重复视为可支出；未知峰值不纳入并行。任一项总时间/输出/进程上限、停止与 unknown 规则仍原样，磁盘观察不是后续运行许可。
- TUI01G 当前只有 controller/Ink/类型直接检查，原每命令 30s、cache+raw≤8MiB，0PG/HTTP/PTY/Chrome/provider；它可作一个局部项。X01 Stage A 包含 17 个计划用例及 **11 个真实 tar 子进程**，原 30s、own tmp/cache≤32MiB、全部 raw≤512KiB（其准入材料另按原8KiB界限）、唯一 namespace/进程收尾；不能标“纯fake”。两项若归不同执行队伍且确认资源隔离，可各占本队一段；同队仍最多一段，实际selected/pass与清理分别记录。
- 若原固定包明确禁止并跑或未计必要副作用，先由合法 owner 在原方案追加最小修订，写明本队段与已知并行段的真实隔离和合计预算，按变更范围复核后才运行；不得静默绕过旧 gate，不能改旧失败/NOT_RUN或已审原件。普通同范围准入由 co-leads 自主完成，不为单命令再向 GO 申请。
- 共享 DB/端口/长期运行服务、可写输入、个人发布和性能测量继续显式串行。安装、完整build、PG/Chrome、个人服务与未量化负载不属于普通局部段口径；无共享端点的边界不等于所有本地检查都没有子进程。局部项归还只释放自己的类别；重项必须以原实际清理回执归还，unknown不得自动腾空。

2026-10-07 02:16 UTC 调整依据为 GO 新观察 26,129,276 KiB 可用、64GiB/16CPU；本段不再采样硬件或归因空间增长。SVC07原HTTP已1/1并归还，C02后继按自己的原packet；TUI原局部检查由原owner接续，X01由Mika按其本队局部段核固定包。这里只改变协作排队规则，不代替任何实际检查结论。

2026-10-07 02:57:55 UTC，GO只读观察可用25,923,972KiB、64GiB/16CPU、memory_pressure系统free63%，据此明确解除全项目单一local槽，改为上述三队各一段；本Lead未重采硬件或将该时点当后续准入。当时heartbeat记录10为历史；当前用户授权每Lead 1+3、三队总12，实际仍受threadlimit与ready工作约束，不为凑上限加人；若出现实际资源竞争，按证据收紧。历史失败和未知残留不改，放开并行不要求重复已通过检查。

<a id="future-disk-budget"></a>
#### 后继准入只累计尚可能新增的空间（OPS-001-12/16）

每个新工作段沿现有唯一资源记录核对：fresh可用空间须覆盖**仍活跃或未知资源的剩余新增上界 + 候选新增峰值 + 一份清理/收尾保留额**，并分别满足必要的单项安全下限。逐项说明原packet的floor已含哪些部分，避免把同一峰值或保留额计两次；在途固定段的gate不途中改动，后继纠正组合算式由原owner在安全点记录依据。

历史累计时间/调用数与未来磁盘峰值分开。已确认结束且scratch/cache为ENOENT的段，不再占未来新增预算；有身份和停止/封存依据、已留存且不再增长的KEEP占用已经反映在fresh可用空间中，不再叠加原最大cap。仍可能增长或生命周期未知的资源保留有依据的保守上界，无法界定时该组合不准入。仅有进程exit或未观察到写入，不足以推断封存；需要的现有身份/清理证据直接引用，不另扫全库或重抄历史。

只在当前账本更新后继需求及证据引用，旧floor/原失败/KEEP/已消费预算保持。这是避免重复计数，不是磁盘回收、时间退款、删除授权或新增模型额度；不削弱单项停止线、资源归属、unknown保留及清理界限。2026-10-07的直接实例是已FULLRETURN的I01两段与兼容C1/C2仍重复加入后续组合floor；本轮SVC09A R3始终使用原19,363,266,560B gate，归还后才核后继。

#### 两个独立专库功能段（2026-10-07 08:34 UTC决定）

普通零模型功能验证最多同时两个PG段。各段须已完成原准备审查；co-leads核固定只读输入、不同的专库名称/marker、动态端口、输出/缓存/写目录与进程归属，没有共享可写source。实际合计连接上限必须包括每个center的business pool（现默认8）、pg-boss pool（现默认3）、admin/fixture与其他实际连接；对照当前集群上限、已占用及管理/个人服务余量，不能只数admin max1。合计新增字节加原收尾reserve满足且各段原fresh/live gate保持；无法确认连接或资源余量就按原顺序完成，不为追求并行制造新的准备阻塞。

浏览器合计仍最多一段，包含连接专库的浏览器；三队local上限和agent/model预算不变。安装/完整artifact构建对PG及共享重项继续排他，原离线artifact加独立0PG浏览器窄例外保留；性能测量、个人服务更新、共享数据库或unknown资源继续排他。旧packet若明禁并跑，在安全点由原owner一次最小修订，核真实隔离和合计预算；已打开的固定窗口不途中放宽，已消费预算/失败不追溯改变。沿各owner status和既有holder记录协调，实际清理后释放自己的占用，不建调度器或第二账本。

决策输入是GO 08:34只读资源观察23,483,868KiB、64GiB/16CPU、free62%，以及O16与Recovery的独立候选；不是两项已运行/通过或后继准入证明。O16已按原排他段启动，维持该段原条件，后续ready组合再采用新规则。

#### 离线产物、实际PG与隔离浏览器（2026-10-07规则增量）

在普通三队local之外，最多允许 **1个离线artifact构建 + 1个隔离的0PG浏览器段** 同时执行。亦允许 **1个实际PG/迁移/共享服务重旅程 + 1个完全独立的0PG浏览器段** 同时执行；不再因类别名称把两者全局互斥。浏览器必须使用专用profile、动态fixture端口、独立输出/cache，只读固定输入，不连接PG、真实中心或个人服务，且不与重项共享可写scope。离线artifact与实际PG之间的原真实依赖/互斥不因此放开，不据此推导三重并跑。各co-lead沿原status/持有记录直接协调，不增加调度器或逐命令审批。每项按其原授权执行；离线artifact与0PG浏览器不操作个人服务或迁移，也不能包含性能基准。并跑项的固定输入只读，输出、安装/store/cache、进程、浏览器profile和临时目录无共享写。两项的全部声明新增预算加同一份原收尾reserve须满足，且分别保留原启动/持续采样/停止门槛；其中一项不能消耗另一项的保留空间。峰值或共享依赖未知则这对串行。

原packet禁止并行时，由合法owner在安全点作最小修订并核对隔离与组合预算后才采用；已打开的固定窗口不在途中扩权，原失败、未运行、selected与清理边界均保持。普通两个专库功能段仅按上方新条件并行；共享数据库/服务、共享端口/可写源、main冻结、安装/完整构建、性能测量和unknown资源继续排他；不影响这些资源的独立0PG浏览器不因PG类别而排队。此例外不增加agent、模型预算或三队local上限。每段以实际进程/资源收尾归还自己的占用，不能仅凭工作进程exit或metadata交付释放unknown。

依据是GO 03:33:39Z只读资源观察25,730,644KiB/64GiB/free63%，以及SVC06固定源/独立产物HOME/cache/store、0PG/Chrome/服务和Timing独立profile/fixture的256MiB+8MiB预算。数值是历史观察，非后继准入证明。本次SVC06仍沿原排他包于03:34:34.540–03:34:59.865Z执行；已实归还后Web才接ACCESS，未追溯并行。

精确供给与实际执行分别记准入：已有授权的少量source/ignored symlink准备，可在其独立小额预算内继续，不能把后续type/test/PG/build的余量门槛套到纯链接创建。先核唯一operator、固定request、原文件/父链与donor身份，exclusive创建；真实写失败立即停止并保留部分结果，不借此安装、导入、补宽依赖或降低后续运行线。X01本次实例为7链接/752B target文本，含必要收据逻辑≤64KiB，原Stage A的1GiB+32MiB门槛保持；首次HOLD保留，不回填成成功。

## 待实施：复用有限连接观察（2026-10-06 17:50 UTC）

TUI01F与Recovery已遇到pool.end后单次查询的收尾问题；attachment-integration fixture的同类模式目前只是静态风险，不冒称已有失败。固定pg8.23.1→pg-pool3.14.0会先从本地clients移除再异步client.end，await pool.end不能当远端pg_stat_activity零连接的同步屏障；这不证明某一次unknown的根因。

当前固定旅程先收口。后继由独立owner在合法scope检查已有TUI45709c的observeConnections小接口（query/clock可注入），按两个实际消费者决定是否提取test-only共用模块。它只观察有界zero/busy/unknown，不拥有数据库删除权限、资源归属或完整supervisor。新检查复用；不迁移全部fixtures、不造新平台、保留原失败证据。只对直接消费者做必要验证，排在F01/hash/RELEASE解阻之后。

## 固定依赖视图的实际加载（2026-10-06 19:13:01 UTC）

R01 首次隔离旅程在真实 center 已启动后，runner 的 outbox 导入 @flow/client 失败；0 页面报告，清理完成。原 backend-dependency-view-input 仅列 contracts，静态manifest不能证明所有实际工厂入口可加载。保持固定 af51 源和原失败后，只补同树 client 与已装固定 SDK 两个 ignored alias；对实际 center/runner 的四个入口先只导入并核 export，未调用 createServer/runRunner/query，1002ms exit0、0PG/Chrome/provider。正式页面兼容仍需下一原旅程，不由此取代。

后续仅在已核顶层无启动副作用的入口做廉价加载检查；使用正式执行的相同依赖视图，包入口与动态资源分别核。失败给具体缺件和合法 owner 处理，不生成通用依赖扫描器、不自动安装或借移动主线 workspace alias。额外探针也保持有界输出、时间和自有资源清理，不把导入等同于产品或原生模型验收。

<a id="generated-input-preflight"></a>
## 生成器与入口使用同一输入合同（OPS-001-12/16）

大字节复制或实际服务旅程之前，在原有限局部工作段用真实生成路径产生最小自有输入，并交给实际 work、cleanup 和校验入口；路径、参数与工具环境尽量复用唯一小 Interface。覆盖实际生成字母表及直接消费者，不只用手写 fixture 字符串相互证明；保留越界、symlink、身份变化和已消费 namespace 拒绝。系统工具须在正式有限环境中可解析，加载检查仍不能证明后续产品行为。

SVC09A R1实际已启动center但就绪未确认；工具PATH缺项是事后静态发现，原运行没有保存lsof首错，不能据此确认其失败原因。R2实际mkdtemp名称含下划线，机械clone后两个entry在读取输入前拒绝，第三相同guard仅静态发现。此处记录改进输入，不重写旧FAIL/KEEP、不认定无数据创建就自动可删，也不重建未改的产物。当前原owner修同一合同，局部结果与总周转记录到其唯一证据；本方法不增加扫描器、审批层或全旅程重跑要求。

## 待实施：复用独立进程期限（2026-10-06 19:45 UTC）

O16与SVC05H中心恢复初审都发现期限依赖operator自身或证据写盘的问题。当前中心恢复的2项定向修复保持其固定审查边界；恢复后沿OPS-001-14安排独立owner，用本地codebase-design/clean-code检查最小可复用的test/operator Module，先覆盖这两个真实消费者。Interface必须明确监督一个PID还是自有组、哪些detached服务永远不由它停止、期限相对何时开始、父进程先退/证据阻塞时如何收尾，以及停止operator不等于外部效果已停止，结果仍可能unknown。

只复用这项生命周期职责；DB删除权、资源归属、源码绑定及OPS-001-13连接观察仍独立。不造通用测试平台，不为了抽象重跑产品或抹掉历史失败；真实复用价值由两个直接消费者和局部故障证据决定。

## 失败事实与资源收尾分离（2026-10-06 21:02 UTC）

失败的行为结果保持失败，但不因此永久保留已确认归属的整套浏览器缓存或专库。删除前必须先持久保存所需诊断，特别是停止期间才产生的子进程输出；再 fresh 核 exact namespace、marker、dev/ino、全部自有组停止及远端零连接，使用正常 DROP 和精确目录收尾。任何证据/归属/停止状态 unknown 继续 KEEP；不扩大到旧未知目录，不用 FORCE、通配路径或通用清盘器。必要私有诊断限量且0600，凭据不进Git。原 FAIL/KEEP与后续收尾分别留证，不回改历史。

F04首验26,512ms在terminal-request-capture失败，0task；20:59:20另行有界cleanup核完整归属与空连接后正常DROP并移除精确私有目录，3组absent。此次原报告只保存停止前的bytes0/events[]，未再次保存shutdown期间可能产生的PTY输出；不能证明该输出存在，也不能从已删临时目录恢复。该诊断缺口必须如实保留并在后继原owner小修中闭合，不能由cleanup成功推断行为通过。原cleanup wrapper的PG:0标签错误另记录更正，实际有PG观察与正常DROP，不重跑操作修metadata。

<a id="source-operator"></a>
### 本组新树的常规 source operator

co-lead常规自助创建本组新的独立worktree并作有界源码物化，不再让普通可逆供给排队等待原Git operator逐片委派。开始前固定已审base、唯一绝对路径/独立branch、实际所属模块src/直接tests/fixtures/固定SQL/包元数据及逻辑字节预算；fresh检查目标不存在且无其他operator已在执行，存在或归属未知即停下核对，不重复创建/重置。原子scope领取仍在产品编辑前完成；同树现有dirty/untracked/固定输入保持，增补只写明确缺项，不重新套初始sparse规则。

复用已有模块闭包与每worktree配置，逻辑体积不冒物理配额；若准备需要改变共享Git配置或遇实际冲突，回原归属协调，不自行放宽。此自助范围不含main集成/切换、已有他人树操作、共享Git配置、依赖安装/完整构建、个人运行源或跨owner scope移交，不增agent/模型预算。它只解除新树纯源码供给的集中串行瓶颈，不增加扫描器、逐文件审批或第二账本。

历史MATURE02C02 fixed eae85567/291项与ACCESS fixed943a/27项的单次委派保留原事实；从本规则起同类本组新树无需重发专项许可。准备与后续运行门槛仍分别核对，少量source/ignored link不自动授权import/test/PG/build。

<a id="bounded-local-iteration"></a>
## 普通本地实现的连续有界迭代（2026-10-07）

co-lead在既有scope与资源约束内给一个工作段总预算：明确受影响模块/直接消费者、允许的本地动作、累计时间与新增字节/子进程上限，以及必须停下的共享资源、外部副作用或unknown边界。owner可连续修改→局部检查→修失败→定向复测；通过后一次独立review/受控集成。预算未尽、范围与副作用未变的普通迭代无需逐命令准备批准、one-shot许可或结果转录批准；预算不足或范围变化先由co-lead调整，不自动扩大。

复用既有运行器与一份结构化运行记录，记录固定源码、实际选中/通过/失败、每次起止、累计资源、原始输出引用、primary failure与cleanup状态。按风险绑定必要source/直接输入，不重复多套大manifest或复制原raw；失败原件与后续修复分开，未受影响且已通过的检查不重跑。简单纯函数检查不必包上面向副作用operator的全套监督记录，涉及自有子进程时复用OPS14。

真实PG/Chrome/迁移/个人服务仍需必要隔离、fresh身份、准入与恢复审查；未知资源不能自动回收，模型调用不随局部预算新增，已有已消费特殊现场窗口不追溯复开。本段不改变当前共享窗口/并行上限、磁盘门槛、claim、固定target或用户服务控制权。时间与等待仅写唯一status的[时间表](../../plans/AGENTS.md#task-timing)，不建新调度器/第二账本。

### 普通专库 / 浏览器验证的工作段（2026-10-07）

对用户已授权、0provider、完全自有专库/浏览器且不触个人服务的普通功能验证，co-lead可依据实际启动、检查和正常清理成本开新的**有限工作段**。旧feature曾使用的90秒/60秒是那一已固定段的预算，不是feature终身额度；新段明确自己的总deadline、输出/临时字节/子进程上限与必要清理余量，沿同一owner status登记，不要求GO逐轮批准。原运行/失败/已消费预算永久保持，不追溯延长已开始或已结束窗口。

运行器的身份、权限、资源所有权、停止/清理以及验收语义没有变化时，owner在该段合法scope连续修复→相关复测，通过后一次独立review/集成；无需每轮重做同一准备批准或结果转录批准。若改变这些安全或验收条件，按真实变化面审查，不能借预算更新弱化断言或释放unknown。每个普通独立PG段保留唯一holder，共享数据库/服务仍排他，浏览器合计最多一段；每次开始均核原fresh资源门槛与组合预算，只有实际清理后才归还。新工作段不扩模型费用、安装/全量负载、个人服务操作或旧特殊现场许可。

Recovery的已保存事实显示某轮首组前初始化约7.6秒、认证场景约145ms即因fixture SQL约束失败；它支持将准备与清理纳入新段预算，不解释全部等待壁钟，也不将原失败改绿。修复范围及下一段由Web原owner负责，其他co-lead按同方法自治；不为采用本规则重跑未受影响的绿检查。

<a id="own-status-parse"></a>
## 只读核对自己刚修改的状态

提交前，只把本owner本轮修改的status交给已安装主线的权威 `parseStatus(markdown, taskId)`；不运行全看板聚合、产品测试或复制解析规则。下面从主线仓库根目录运行，替换任务ID与唯一status绝对路径；特征树解析器较旧时不要借此恢复旧实现。

```sh
node --input-type=module - OPS-001 /absolute/owner/worktree/plans/ops-001-status-review/status.md <<'JS'
import { readFileSync } from 'node:fs';
import { parseStatus } from './apps/execution-dashboard/src/status.mjs';
const [, , taskId, file] = process.argv;
const parsed = parseStatus(readFileSync(file, 'utf8'), taskId);
console.log(JSON.stringify({
  taskId, errors: parsed.errors, humanMissing: parsed.human.missing,
  timingIssues: parsed.timing.issues, taskLinks: parsed.taskLinks,
}, null, 2));
if (parsed.errors.length || parsed.human.missing.length) process.exitCode = 1;
JS
```

先核本次字段和任务关联的实际结果：无阻塞只填`NONE`，说明移到下一步/证据；有阻塞填`ACTIVE: 描述`，用户决定同理遵守既有枚举。新的字段格式错误由原owner修，不让parser猜。时间issues须逐项解释：历史开工缺证据继续`UNKNOWN`，尚未完整完成用`NOT_COMPLETED`；不为消除提示填造时间。纯解析只验证声明形状，不验证链接目标、review覆盖、主线集成或实际部署；这些仍对本次diff与原证据核对。记录复用本次status或检查记录，写明所用parser固定来源和遗留unknown即可，不新增第二schema、全局hook或每文件manifest。

2026-10-07：GO新增实际PG与独立0PG浏览器并行决定，依据当轮25,024,600KiB/64GiB/free64%的只读历史观察；后继仍fresh核合计预算与原reserve，不用此历史数值准入。D06/DPERF等待事实仅为流程改善输入，不将间隔都归因为窗口。旧packet若禁并行，由原owner一次最小修订并按变化面核隔离，已消费窗口不追溯复开。

## 资源计量的复用边界（OPS-001-14 后继）

资源快照不是原子事务。调用方应显式排除自己的scratch子树，不能连续扫描scratch与包含它的父目录后相减来声称同一时刻的retained量。logical bytes与allocated blocks分列，不当实际可回收量；运行中临时项消失可按声明的观察语义记录，根身份变化、越界或无法读取仍保守unknown，不能一律吞ENOENT。Quick b2与ACCESS是两个实际消费者输入，原错误与退出结果保持；在下一合法scope变更提取小计量Module并局部验证增长/消失，不接入进程supervisor callback，不拥有删除或资源授权。当前原owner定向修复不被此后继阻挡，也不新增运行许可。

本段本队实际组合类型检查exit0/9139ms；caller要求空TMP才删除，Node24生成1,357,764B编译cache后保留，wrapper exit1独立记录，未把类型结果改红或重跑。后继普通局部调用显式禁Node compile cache或在spawn前持久记录自有TMP身份；未知原件不通过补写现在的身份冒充旧证据。


<a id="focused-status-reading"></a>
## 先读当前事实，再按问题展开历史（OPS-001-16）

协作续接先定位registry指定的唯一owner status，读取前部当前字段、相关TODO、当前等待及其固定证据；只有本次问题确需追溯时才展开对应历史段。不要为得到当前状态宽搜全部历史或重复载入完整交接。owner正常更新仍须让前部当前事实完整；同一事实以已有原件链接复用，历史仅追加实质新事件，不跨段重复转录完整技术交接。

本方法不删除历史失败/raw、不清空真实等待、不批改其他owner，不创建第二手填摘要或模型摘要服务。GO已核193份status原文约1.58MB，仅是文本规模，不能据此声称token、网页流量或磁盘瓶颈收益；本次只是阅读与记录方法修正，无新工程检查。


<a id="fixed-input-provenance"></a>
## 固定输入只记必要来源，原始运行证据保存一份（OPS-001-16）

后续新交付优先复用一份现有运行/交付记录：分别固定产品提交与本次实际输入。能够持续取得且保留的 Git 输入，记录 origin commit、仓库相对 path、mode、size、digest，审查时按需用 `git cat-file` 读取固定 blob；不能用 moving HEAD，也不能只填一个旧 base 代表来自多个提交的组合。实际内容必须与记录吻合，来源无法可靠保留/取得、转换后内容和非 Git 外部材料仍保存必要原件。参见 [Git cat-file](https://git-scm.com/docs/git-cat-file)。

失败原始输出、真实运行结果和非 Git 输入只保存一份，由检查、审查与接收记录引用；按风险增加必要 provenance，不再复制完整源码快照或多套相同 manifest。隔离运行确需物化的输入保留其来源、归属和受控生命周期，不能以此方法删除仍需运行/恢复的材料。现有已审包、失败/raw、冻结输入均不重写、不删除；不增加证据平台、扫描器或审批层。

下一合适小片由原 owner 在正常交付中采用，独审仍能取得实际全部输入；以同范围传统复制清单对照实际保留清单，记录避免重复的文件数/逻辑字节及未能省去的输入。尚未采用前写待验证，不把少文件/少行推成 token、速度、Git pack 或 APFS 回收收益。2026-10-07 已审 X01 启动组合的历史观察（6aa2d42e）为71份相同主线 blob/mode 的副本、307,366逻辑B，只有56份与原c8ba输入一致；它说明须保真实组合来源，不是本方法已产生收益。

2026-10-07 I01首次采用记录：main `5592f9d83f43dc1b1026fdfcbeaaeed7f07f71e3` 的 `docs/evidence/i02/i01-runtime-app-intake.json` 固定六个产品Git输入及五份已有审查/接收原件的origin commit/path/mode/bytes/digest；主线只应用六个产品路径，不再附镜像源码或重复制浏览器raw。原始失败/运行材料仍完整保存在唯一canonical与固定Git，接收前六个主线前像均与声明base匹配。此处是实际采用事实；未做同范围传统复制清单对照，不宣称已量化token、速度、Git或物理磁盘收益，也未改变冻结发布产物。
