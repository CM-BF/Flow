# WPF-MATURE-02 Claude与Codex能力贯通

状态：in-progress。创建：2026-10-06 09:01:08 UTC；更新：2026-10-06 17:16:00 UTC。阶段M2。单一owner chatui01_owner / gpt-6-astra；co-lead mika。

## 完整目标

Claude与Codex可被发现、选择和运行；model/thinking/fast/access从中心、runner到Web同一真实语义贯通。账号状态、native续接、错误/取消/恢复明确；requested、actual、unsupported、unknown分别呈现，不能把low effort当fast或model目录当账号可用证明。FLOW-001/002及full-plan-matrix为原验收基线，不把首个fixture当完整交付。

## 既有能力与缺口

现有Claude SDK0.3.290与R05-A ConfiguredNativeHarness/descriptor已存在；共享host/中心合同由ExecutionLead/assignment_review在native-harness-host树维护，禁止本任务另造宿主或修改其main/config/contracts。Codex0.154.0默认stable schema已在E02归档；尚无本任务真实app-server运行、账号验证、native模型执行或跨端接线证据。Web子任务由d01维护并关联本大task。

## 已确认方案与首个独立片段

先在独立实验scope实现语义consumer、模型目录归一化与普通final事件conformance，通过注入本地确定性的已解码request结果/notification验证，不启动真实Codex、不读个人CODEX_HOME/凭据、不发网络/模型请求。固定schema而非latest文档决定本机字段；ReasoningEffort保留返回字符串，serviceTiers/id保持公开目录值，不发明fast枚举。serviceTier持续thread覆盖与serviceTierForTurn本turn覆盖分别记录，默认/继承不混淆。

首片Interface：caller等待R06 ready后，限页数/decoded字节/目录总数的model/list消费；正常final与failed/interrupted分开；错误身份、未知phase和超界拒绝。request/receive seam由R06提供并外部注入；初始化握手、EOF、未知RPC id、坏JSON、并发、超时和资源关闭归R06，实验不拥有host lifecycle、auth或生产profile发布。目录的accountAvailability固定unknown/unverified，实际配置需后继执行证据。

## TODO与验收

- [x] WPF-MATURE-02-01：独立树/领取、完整计划、固定schema与技能来源登记。
- [x] WPF-MATURE-02-02：零模型语义consumer、目录/effort/service-tier归一化和ordinary final合规片段；确定性故障检查与固定manifest。
- [ ] WPF-MATURE-02-03：提交隔离真实app-server initialize/model-list方案，Mika审运行路径后才执行0query探针；不得turn/start/auth/login。
- [ ] WPF-MATURE-02-04：对齐R05共享合同，贯通中心/runner模型consumer；需要正式scope与稳定合同后实施。
- [ ] WPF-MATURE-02-05：d01 Web选择、requested/actual/unsupported/unknown透明，thinking/fast/access独立语义验收。
- [ ] WPF-MATURE-02-06：账号状态、Claude/Codex续接、错误/取消/恢复，真实边界证据；执行许可另定。
- [ ] WPF-MATURE-02-07：独立review、每个小target及时commit/push/main集成与架构基线更新。
- [ ] WPF-MATURE-02-08：按完整跨端验收矩阵验收；不以目录或fixture替代真正模型运行。

- [ ] WPF-MATURE-02-09：同harness空闲会话支持下一条设置变更；CAS/unknown ACK/恢复可追溯，历史/当前/入队配置冻结，跨harness路径明确，新选择使04测量失效。
- [ ] WPF-MATURE-02-10：Claude产品core：兼容共享契约、中心CAS/幂等冻结message settings、既有Claude query传递；status_read/mika独立core首leaf已main，下一片按其精确接线请求完成现profile/中心/adapter，固定SDK注入与真实中心验收。
- [ ] WPF-MATURE-02-11：共享consumer：同中心版本化DTO贯通client/interaction/Web/TUI下一草稿设置与历史snapshot；独立WT/owner/精确scope由Lead协调，未知ACK保原intent；client精确selector/ACK/CLI与Web/TUI草稿冻结/恢复及直接验收见[consumer交接](../../docs/evidence/wpf-mature-02/claude-message-settings-consumer-handoff.md)。

## 依赖与交接

跨lead唯一需求文档：[interface](../../docs/evidence/wpf-mature-02/interface.md)。R05输入[共享接口](../../docs/evidence/r05/interface.md)，生产宿主/中心schema归其owner；Web d01读取本task状态与接口，不复制TODO。需明确harness声明、目录来源/有效期、能力枚举与unknown、requested/effective执行回执、失败分类和取消结束语义；本owner不抢公共路径。

## 授权与运行边界

当前只许local schema/确定性本地fixture。真实app-server启动先给Mika审隔离方案：专用空state directory、无个人凭据/配置、禁止网络、限定 initialize/initialized/model/list、总时限/输出上限/子进程清理，无用户服务影响。不得turn/start真实provider、auth/login、升级/安装或付费query。Pi不是Codex前置。

## 模块职责与设计规则

统一遵循[仓库modular-design](/Users/citrine/Projects/AgentHarness/Flow/AGENTS.md#modular-design)，不复制独立规则。目录归一Module隐藏raw catalogue语义；R06独占Module负责JSONL/stdio/ID/背压/timeout/child生命周期，本consumer不重复；普通final Module只管同thread/turn/item完成证据，不管任务调度/权限/进程。生产transport/adapter由ExecutionLead的runner worker实现；R05 owner负责中心profile/policy/session/final，Web d01消费正式合同。本实验不持有上述状态。

## 验证与架构

Node24/pnpm9.15.4固定；优先Node行为测试，源码/fixture绑定schema哈希，0测试不算通过。当前实验不改产品Interface/FSM/数据库；后继生产合同/依赖接线会影响架构，target/owner由Mika/ExecutionLead登记，不能把planned画成main事实。


## WPF-MATURE-02-03 隔离后继片段

纯语义target0d0524c已独审通过，approval metadata已单独提交1aead2e，仍等待集成。隔离片只生成[默认拒绝profile/canary设计](../../experiments/codex-app-server-conformance/isolation/README.md)，单列[manifest](../../docs/evidence/wpf-mature-02/isolation/manifest.json)与静态检查；没有执行sandbox、listener、R06组合或真实Codex。该静态片交付条件是可逐条审的路径/环境/七项合成canary及失败清理，不把静态设计当运行证明。后继按Mika明确许可执行一次，结果SIGABRT且无有效canary报告；失败后停止，未扩大profile。具体当前事实只在status和run report维护。

## WPF-MATURE-02-04 单一投影消费与03诊断后继

R05C纯投影已独审并集成已审main4391bbf9；本实验改为相对薄导出，27项原测试直接消费生产单一算法，已独审通过待集成，不代表中心/runner/Web完整贯通。03另设有界诊断阶段：最多3次自有合成子进程、总60秒含清理，逐次具体假设或诊断能力变化；先评估并交Mika审R06默认关闭、字节有界、宿主私有落盘方案与精确scope。不复制supervisor、不读取私人crash历史、无真实Codex/auth/provider/外网，不新增全盘或网络grant；原一次失败封存，不原样重试到绿。

Lead后继边界：C1只pinned Codex普通任务/typed final，不承诺conversation端口。后继versioned native catalog和unsupported conversation capabilities需与Lead协调server/execution-profiles，F01 client/index仍原owner单写；不放宽旧Claude-only reader或丢字段维持旧digest。具体诊断方案见[seam候选](../../docs/evidence/wpf-mature-02/diagnostic-seam-proposal.md)，当前仅文档，不改R06源码。

WPF-MATURE-02-03实施进展：合法writer v2追加精确R06五文件；五源seam已独审，诊断driver修复target7297986fbc879bb5040879daf97c7d5bb8b657ac待审，19+10零child检查与同树C1 strict通过。真实窗口最多3/60秒尚未消费，由Mika与S01窗口串行安排；当前driver第三次固定NOT_RUN，私有分类和清理均计入窗口。

WPF-MATURE-02-03唯一新诊断batch已在Mika窗口中执行并封存：控制样本捕获成功、原profile仍SIGABRT/父stderr空，清理与282.794417ms预算完成；实际原因/目录仍blocked。预算不重置，无第三次，后继仅有界只读源码研究，不阻塞已审共享模块交付。

## WPF-MATURE-02-04 versioned 配置目录独立片段

按[固定f181最小设计](../../docs/evidence/wpf-mature-02/native-catalog-seam.md)推进原生已配置profile的新reader与显式conversation unsupported；不等待真实目录探针。建议精确header+新DTO/新client method，legacy Claude-only、配置canonical bytes与admission保持。共享Lead分配contracts/server领域/F01 client精确路径后实施；不新建第三层task、不开provider、不扩大本owner原claim。直接验收覆盖strict合同、旧读者隔离、SQL-before-limit分页、坏数据/撤销、安全client协议失败与Codex会话拒绝。当前仅设计，不把它记为02完整能力已交付。


## WPF-MATURE-02-03 最小C文件描述符对照

新的独立授权上限为一次必要编译调用及其如实列明子命令、最多三个合成目标、同一60秒含清理/末次持久化、2MiB含binary/object等已量输出。旧窗口/失败证据不动，不重试。当前只交[C源码与一页合同](../../docs/evidence/wpf-mature-02/fd-canary/contract.md)，先控制socket、同profile socket、同profile普通file，只测自身fstat/fcntl；profile仅追加自有binary literal，无真实Node/Codex/provider/auth/网络探测。固定source和最薄host组合独审后由Mika安排串行窗口。当前C/host组合已固定cf69dddff65d31a821a6c13b984ea0ef6d5fa648，20 distinct零目标检查与Node24惰性import通过；[v2执行合同](../../docs/evidence/wpf-mature-02/fd-canary/execution-plan-v2.md)取代旧临时输出口径。保持0编译/0目标，Mika组合独审与明确窗口之前不运行；这不满足实际catalog或隔离验收。

## WPF-MATURE-02-03 最小logging/格式候选

旧窗口6d faithful FAIL已审且已消费。GO明确授权在同一scope做下一候选源码：编译器有限原stdout/stderr先持久化、失败阶段/检查固定枚举；LLVM固定printArg有界解析，不将源码格式问题当旧raw归因。固定v2 `851fd8c7a48b6ebec64cbf80ccda4eb6bcfaf845`完成26/26受影响检查、9未选，0新增compile/target。原C/profile/进程权限不扩，旧raw/manifest/accounting按旧target保持；新input/manifest独立目录。下一步仅源独审，实际运行须Mika以整项目阻塞新事实另申请预算，当前授权0。

WPF-MATURE-02-03当前后继为[固定regular-file对照候选](../../docs/evidence/wpf-mature-02/fd-canary-v3/README.md)：一编译/两目标，自动runtime证据与人工review时钟分开；当前仅零目标验证，源码固定后独审，未来仍需新GO预算与唯一窗口。不新增任务层级或改动旧失败结论。

WPF-MATURE-02-03后继rootliteral：沿GO明确单项许可，在已封存sandbox67基础仅追加精确根节点read/test；固定第三枚举复用已审host。最多1编译/2自有C目标、60秒自动运行全证据/清理/CLI、2MiB含人工archive字节；独审及Mika门禁前零实际运行。原窗口不复用，失败因果不推定。

## WPF-MATURE-02-03 Node rootliteral对照准备

沿GO新方向，先交[三槽小接口设计](../../docs/evidence/wpf-mature-02/node-rootliteral/design.md)：相同固定输出控制→rootliteral同输出→原七项owned canary/R06 synthetic peer；最多3自有Node目标、0compile、60秒自动证据/关闭/清理/CLI、2MiB含所有字节。无新grant、Codex/SDK/provider/auth或系统log；唯一网络测量限第三槽自有随机loopback。设计先审再实现与零目标验证，固定组合独审/Mika唯一门禁前不执行。C4757有限PASS与旧失败因果不混同，历史封存不追改。工程宿主的实际模型资格/强制file-only/全部writer撤销缺口另见[共享输入](../../docs/evidence/wpf-mature-02/native-engineering-authority-inputs.md)，不阻零模型fixture/checker。

### TODO-03后继：加载失败观察（2026-10-06 13:12:21 UTC）

旧Node结果已限定独审接收。新[单目标cause方案](../../docs/evidence/wpf-mature-02/node-loader-cause/interface.md)只补有界加载错误观察，复用生命周期，不改profile/目标输入，不把新宿主差异当旧协议完整复现。先固定设计/输入，再最小实现与零目标检查、独审，Mika明确OPEN后最多一次；当前NOT_OPEN。仍沿WPF-MATURE-02-03，不新增任务层级。

## 2026-10-06 Claude逐消息设置优先片

按GO新方向，当前私有诊断收束后，TODO-04/05/09并行交付Claude每条消息model/thinking或effort/fast，不等Codex全资格。固定SDK0.3.290声明起步，以注入SDK和真实中心验证；0付费/新安装。中心共享合同承载requested/observed/unsupported，历史、运行中及持久队列配置冻结，旧会话可读可续，Web/TUI共用；不将unsupported伪装支持。Mika另派≥Sol、独立WT两层子任务，Lead协调共享R05/配置与资源；本树只诊断与权威计划，不扩大产品写权。完整02 Codex及真实用户验收仍保留。

## 运行角色边界

Flow Node宿主、Node synthetic canary、固定Codex native binary是三角色；bootstrap-inspection的Codex依赖不含Homebrew Node/OpenSSL。本Node失败不证明Codex失败，也不成为所有harness永久前置。Codex自身启动/权限/模型/停止验收保留；Claude逐消息设置独立推进。

## 当前执行优先级与两层交接

GO明确优先Claude逐消息设置，按TODO-10产品core→TODO-11共享consumer两个直接子任务推进，沿TODO-04/05/09验收。具体独立WT、sibling管理路径、共享writer/migration与四路径可移交请求见[唯一handoff](../../docs/evidence/wpf-mature-02/claude-message-settings-handoff.md)。本parent管理owner保留；四profile路径已明确停写并原子交回，child仍须fresh amend现有claim后接收。首leaf已main22d5，下一片精确source-only闭包/共享F01接线/唯一migration请求以[child handoff](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/next-slice-handoff.md)为权威，不复制子TODO。OpenSSL ca6a checkpoint保持PENDING_RESOURCE，不继续扩诊断。完整Codex能力及真实用户验收不删减。

2026-10-06 17:16：TODO-03进入[真实native目录一次观察设计](../../docs/evidence/wpf-mature-02/native-catalog-probe/README.md)，GO授权准备，复用R06与原policy、最多1目标/45s/0turn；实际NOT_OPEN。ClaudeCORE已获限定批准，共享consumer/UI与完整能力验收继续推进，不以目录替代资格。
