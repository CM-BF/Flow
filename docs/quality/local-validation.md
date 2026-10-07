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

同范围局部检查由 co-lead 在既有资源和累计预算内自主准入，不逐条向 GO 申请。共享 PG/Chrome 仍由两 lead 明确交接，fresh 准入与实际清理不可省；源码、小检查和完整构建的资源界限分别适用。记录复用唯一 owner status 与原证据，不增加每文件审批或第二账本。已通过且未受改动影响的检查不重复。

### 资源恢复后的有限并行（2026-10-07，原 OPS-001-12）

低空间时“所有验证串行”的临时安排不再作为常态。现先允许 **一个实际 PG/Chrome 旅程 + 一个无共享端点的有界局部检查**；共享重窗口仍只有一个 holder，第二项用原 owner status/准入回执明确类别、固定来源、配对窗口与清理，不另建调度器或账本。此调整不改 Vitest 全局 fileParallelism、不增加测试选择/断言/模型调用，不用并发运行结果宣称性能基准。

- 原 owner 开始前核源码/claim/实际依赖和所有可写路径。局部项只能写本任务排他 tmp/cache/raw；不得共用 DB、监听端口、服务、可写源/安装/store 或同一输出名。只读 donor 可复用，双方不得在期间重写它。无法确认隔离即串行，不以“0PG”推断无子进程或无资源开销。
- 准入同时核原各项门槛和组合预算：每个已存在任务的启动线保持；加入局部项时，在重项原门槛之上再保留该局部项**全部已声明新增字节预算**，并满足局部项自己的启动线。tmp/cache、raw、元数据与收尾分别计入，不能把两份 1 GiB 保留额重复视为可支出；未知峰值不纳入并行。任一项总时间/输出/进程上限、停止与 unknown 规则仍原样，磁盘观察不是后续运行许可。
- TUI01G 当前只有 controller/Ink/类型直接检查，原每命令 30s、cache+raw≤8MiB，0PG/HTTP/PTY/Chrome/provider；它可作一个局部项。X01 Stage A 包含 17 个计划用例及 **11 个真实 tar 子进程**，原 30s、own tmp/cache≤32MiB、全部 raw≤512KiB（其准入材料另按原8KiB界限）、唯一 namespace/进程收尾；不能标“纯fake”。两项不同时占局部槽，实际 selected/pass 与清理分别记录。
- 若原固定包明确禁止并跑或未计必要副作用，先由合法 owner 在原方案追加最小修订，写明本次配对、真实隔离和合计预算，按变更范围复核后才运行；不得静默绕过旧 gate，不能改旧失败/NOT_RUN或已审原件。普通同范围准入由 co-leads 自主完成，不为单命令再向 GO 申请。
- 共享 DB/端口/长期运行服务、可写输入、个人发布和性能测量继续显式串行。完整安装/build与未量化负载不属于这次并行口径。局部项归还只释放自己的类别；重项必须以原实际清理回执归还，unknown不得自动腾空。

2026-10-07 02:16 UTC 调整依据为 GO 新观察 26,129,276 KiB 可用、64GiB/16CPU；本段不再采样硬件或归因空间增长。SVC07原HTTP已1/1并归还，C02后继按自己的原packet；TUI原局部检查由原owner接续，X01由Mika在局部槽空闲后核固定包。这里只改变协作排队规则，不代替任何实际检查结论。

精确供给与实际执行分别记准入：已有授权的少量source/ignored symlink准备，可在其独立小额预算内继续，不能把后续type/test/PG/build的余量门槛套到纯链接创建。先核唯一operator、固定request、原文件/父链与donor身份，exclusive创建；真实写失败立即停止并保留部分结果，不借此安装、导入、补宽依赖或降低后续运行线。X01本次实例为7链接/752B target文本，含必要收据逻辑≤64KiB，原Stage A的1GiB+32MiB门槛保持；首次HOLD保留，不回填成成功。

## 待实施：复用有限连接观察（2026-10-06 17:50 UTC）

TUI01F与Recovery已遇到pool.end后单次查询的收尾问题；attachment-integration fixture的同类模式目前只是静态风险，不冒称已有失败。固定pg8.23.1→pg-pool3.14.0会先从本地clients移除再异步client.end，await pool.end不能当远端pg_stat_activity零连接的同步屏障；这不证明某一次unknown的根因。

当前固定旅程先收口。后继由独立owner在合法scope检查已有TUI45709c的observeConnections小接口（query/clock可注入），按两个实际消费者决定是否提取test-only共用模块。它只观察有界zero/busy/unknown，不拥有数据库删除权限、资源归属或完整supervisor。新检查复用；不迁移全部fixtures、不造新平台、保留原失败证据。只对直接消费者做必要验证，排在F01/hash/RELEASE解阻之后。

## 固定依赖视图的实际加载（2026-10-06 19:13:01 UTC）

R01 首次隔离旅程在真实 center 已启动后，runner 的 outbox 导入 @flow/client 失败；0 页面报告，清理完成。原 backend-dependency-view-input 仅列 contracts，静态manifest不能证明所有实际工厂入口可加载。保持固定 af51 源和原失败后，只补同树 client 与已装固定 SDK 两个 ignored alias；对实际 center/runner 的四个入口先只导入并核 export，未调用 createServer/runRunner/query，1002ms exit0、0PG/Chrome/provider。正式页面兼容仍需下一原旅程，不由此取代。

后续仅在已核顶层无启动副作用的入口做廉价加载检查；使用正式执行的相同依赖视图，包入口与动态资源分别核。失败给具体缺件和合法 owner 处理，不生成通用依赖扫描器、不自动安装或借移动主线 workspace alias。额外探针也保持有界输出、时间和自有资源清理，不把导入等同于产品或原生模型验收。

## 待实施：复用独立进程期限（2026-10-06 19:45 UTC）

O16与SVC05H中心恢复初审都发现期限依赖operator自身或证据写盘的问题。当前中心恢复的2项定向修复保持其固定审查边界；恢复后沿OPS-001-14安排独立owner，用本地codebase-design/clean-code检查最小可复用的test/operator Module，先覆盖这两个真实消费者。Interface必须明确监督一个PID还是自有组、哪些detached服务永远不由它停止、期限相对何时开始、父进程先退/证据阻塞时如何收尾，以及停止operator不等于外部效果已停止，结果仍可能unknown。

只复用这项生命周期职责；DB删除权、资源归属、源码绑定及OPS-001-13连接观察仍独立。不造通用测试平台，不为了抽象重跑产品或抹掉历史失败；真实复用价值由两个直接消费者和局部故障证据决定。

## 失败事实与资源收尾分离（2026-10-06 21:02 UTC）

失败的行为结果保持失败，但不因此永久保留已确认归属的整套浏览器缓存或专库。删除前必须先持久保存所需诊断，特别是停止期间才产生的子进程输出；再 fresh 核 exact namespace、marker、dev/ino、全部自有组停止及远端零连接，使用正常 DROP 和精确目录收尾。任何证据/归属/停止状态 unknown 继续 KEEP；不扩大到旧未知目录，不用 FORCE、通配路径或通用清盘器。必要私有诊断限量且0600，凭据不进Git。原 FAIL/KEEP与后续收尾分别留证，不回改历史。

F04首验26,512ms在terminal-request-capture失败，0task；20:59:20另行有界cleanup核完整归属与空连接后正常DROP并移除精确私有目录，3组absent。此次原报告只保存停止前的bytes0/events[]，未再次保存shutdown期间可能产生的PTY输出；不能证明该输出存在，也不能从已删临时目录恢复。该诊断缺口必须如实保留并在后继原owner小修中闭合，不能由cleanup成功推断行为通过。原cleanup wrapper的PG:0标签错误另记录更正，实际有PG观察与正常DROP，不重跑操作修metadata。

### 限定 source operator 委派

MATURE02C02此次仅新树codex-conversation-continuity由Mika作为受控source operator，从固定eae85567按已核291项/现有精确依赖链接准备，owner仍须fresh原子take。Execution Lead未创建该树；委派不含main、其他树、共享Git配置、个人运行源或共享PG/Chrome窗口。小源码准备与运行余量线分离，不为此新增审批往返。

<a id="bounded-local-iteration"></a>
## 普通本地实现的连续有界迭代（2026-10-07）

co-lead在既有scope与资源约束内给一个工作段总预算：明确受影响模块/直接消费者、允许的本地动作、累计时间与新增字节/子进程上限，以及必须停下的共享资源、外部副作用或unknown边界。owner可连续修改→局部检查→修失败→定向复测；通过后一次独立review/受控集成。预算未尽、范围与副作用未变的普通迭代无需逐命令准备批准、one-shot许可或结果转录批准；预算不足或范围变化先由co-lead调整，不自动扩大。

复用既有运行器与一份结构化运行记录，记录固定源码、实际选中/通过/失败、每次起止、累计资源、原始输出引用、primary failure与cleanup状态。按风险绑定必要source/直接输入，不重复多套大manifest或复制原raw；失败原件与后续修复分开，未受影响且已通过的检查不重跑。简单纯函数检查不必包上面向副作用operator的全套监督记录，涉及自有子进程时复用OPS14。

真实PG/Chrome/迁移/个人服务仍需必要隔离、fresh身份、准入与恢复审查；未知资源不能自动回收，模型调用不随局部预算新增，已有已消费特殊现场窗口不追溯复开。本段不改变当前共享窗口/并行上限、磁盘门槛、claim、固定target或用户服务控制权。时间与等待仅写唯一status的[时间表](../../plans/AGENTS.md#task-timing)，不建新调度器/第二账本。
