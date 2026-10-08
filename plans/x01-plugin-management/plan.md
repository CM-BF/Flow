# X01 完整插件管理与上下文扩展

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | X01 / in-progress；计划已交付，可信工具公共链、真实启动与管理CLI已交付main，完整生命周期未完成 |
| 创建 / 最近更新 | 2026-10-06 / 2026-10-08 |
| 父计划 / 追溯 | [FLOW-001 §10](../flow-001-architecture/plan.md)、[完整矩阵 REQ-11/12/13](../flow-001-architecture/full-plan-matrix.md)；同时消费 REQ-08/09/20 |
| 唯一计划/status owner | architecture_read / gpt-6-astra；co-lead mika（原runner_owner已释放） |
| 后续实施协调 | Execution Lead；各实现 writer 须另行领取独立 worktree/精确 scope，不由本计划虚构已派发 |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding / codex/plugin-enable-binding |
| Base | 原计划3773db5；本轮设计受控main7cbda706合入c837853829f0344634df78ed7195ee7255f6b832 |

## 目标与当前事实

用户能在产品 Web 的插件管理页和 CLI 中，对同一中心持久化的插件执行安装、配置、授予权限、启用、停用、升级、回滚、移除，并了解当前版本、实际能力、作用范围、运行中引用、错误与审计。客户端只调用公共中心 commands，不各自保存另一份权威安装/授权状态。Web 的管理页不能成为业务的唯一入口。

本计划跟踪完整X01，而非以单片通过结束目标。中心安装/授权/冻结binding、v3领取、真实runRunner/semver、来源产物、终态报告恢复、可信私有启动配置与管理CLI均已有main回执。2026-10-07真实两server/两runner进程及管理HTTP单旅程1/1独审通过，验证正常ACK后重启与旧pin不变。第三方隔离、完整升级/回滚/移除、Web/TUI生命周期和上下文扩展仍开放；逐项事实与边界见[验收差距](../../docs/evidence/x01/acceptance-gap-20261007.md)，原验收要求不降低。

已只读核对 [WPF-P01 权威计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host/plans/wpf-p01-plugin-host/plan.md)：trusted Web host target 6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6 已有独立批准，范围是可信贡献与 fixture；[WPF-I01 权威状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration/plans/wpf-i01-plugin-integration/status.md) 与后继WPF-X03I01已交付主App挂载；当前事实见[owner接收](../../docs/evidence/x01/owner-acceptance.md)。这两项只是本计划 Web 前置，不能替代全 X01 验收，也不要求它们等待中心完整生命周期完成。观察时间/HEAD/dirty 见 [事实记录](../../docs/evidence/x01/README.md)，后续以各 owner 状态为准。

2026-10-08当前事实：AV center/client、VAR/CENTER、verifier runtime及身份确认SDK均有受控main回执，详见唯一status与其固定来源。下一[真实verifier进程设计](../../docs/evidence/x01/verifier-real-process-design.md)复用既有driver，1case串行3tasks验证invalid-json/failed与passed；目前NOT_RUN，不改变X01-04～10开放验收。旧semver通过、领域PG/局部mock与发布工件T7范围分别保留。

## 模块与权威数据

采用小的公共 Interface，分开实现职责，不另造插件市场或通用远程执行平台：

| 模块 | 负责 / 不承担 |
| --- | --- |
| 中心 Plugin Registry + Commands | PG 持久化安装、版本、配置、实际授予、运行引用和不可变操作审计；鉴权/CAS/幂等；不在 HTTP 事务内执行第三方代码 |
| Package Resolver / Loader | 固定 npm 包版本、来源、integrity/digest、许可与 host API 兼容检查；分发不等于信任，不接受浮动 latest 作为运行身份 |
| 执行端 Plugin Host | 消费中心下发的固定版本/配置/授权与任务身份，执行前重查当前许可，报告实际加载能力；不自授权限、自升级或另起未登记任务 |
| Web Host / Renderer | 消费经过验证的声明和窄上下文，发公共 commands，处理贡献/错误/清理/安全 fallback；不持有服务端凭据、任意 FlowClient 或任意服务端包入口 |
| CLI / 公共 client | 与 Web 相同命令语义、鉴权、错误、幂等与 operation 查询；不用直写 DB 绕过中心 |

完整目标的概念模型（registry、install、034 runtime子集已实现；以下仍包含未完成的完整生命周期要求，不把概念名当全部现有DTO）：

- `PluginInstallation`：稳定 ID、所属 workspace/project、revision、期望启用状态、当前可用版本、安装/错误状态。
- 不可变 `PluginVersion`：精确包版本+内容 digest、来源/许可、host API major、声明能力、贡献类型、支持的宿主/恢复模式。配置 schema 与版本绑定。
- 版本化 `PluginConfiguration` 与独立 `CapabilityGrant`：授予的资源/任务/执行位置 scope、授权 revision、授予者和时间；manifest 的 requested capabilities 不是权限。配置公开部分与服务端秘密引用分离。
- `PluginExecutionBinding`：task/attempt/session 绑定 package digest、config version、grant revision、host/runner 与 compression owner。活跃任务固定版本；授权当前状态在每次工具或命令动作前仍核验。
- `PluginOperation/Audit`：commandId/idempotencyKey、经认证 actor、expected revision、输入摘要、before/after、状态/错误类别、操作关联。所有历史与产物来源可追溯；查询分页/字节有界。

操作受理用同一插件/作用域内的 revision CAS 与 DB 事务，避免 Web/CLI 并发覆盖。相同幂等 key+相同输入重放同结果；异输入拒绝；旧 revision/身份/作用域拒绝。包下载与宿主加载是事务外的有界操作：先持久受理，再执行与回报；ACK 丢失或结果不明保留待核对状态，不凭超时宣称卸载/安装已完成或自动重复任意副作用。中心重启后恢复操作记录与审计。

凭据只属于对应 center 或 runner 的受保护存储/原生登录。插件列表、详情、公开配置、浏览器、日志、错误与审计均不得包含值或可回取值的秘密句柄。前端只显示“已配置/缺失/失效”及归属；秘密设置经相应服务端/本地 runner 的受控入口，不放入 npm manifest、Web 表单状态、普通 command JSON 或示例 fixture。跨 runner 不自动复制本机登录。trusted server 插件需要某项秘密时通过窄能力执行，不获得整个环境或 credential store。

## 公共命令与状态语义

当前公共registry/install/runtime与管理CLI已冻结入main；下表保留完整生命周期目标，升级/移除等不能仅凭已有命令子集判完成。Web 与 CLI 消费同一受理结果/operationId 与进度，无前端私有安装后门。

| 命令 | 最小可观察行为与拒绝条件 |
| --- | --- |
| install | 精确包版本/完整性和 manifest 校验后成为 installed/disabled；默认不执行安装脚本、不自动启用、不自动授予 capabilities；任一阶段失败可查询且不留下可调用半安装 |
| configure / grant | 校验版本化配置和具体作用范围；修改配置/扩大能力产生新 revision；超出调用者自身权限拒绝；当前运行保留旧配置版本，权限收紧在新动作 gate 生效 |
| enable | 校验已安装版本、host API、配置、授予与宿主实际支持；启用只影响符合条件的新受理/激活；加载失败回报 failed，不显示可用 |
| disable | 持久阻止新激活与新任务绑定，撤本地 UI dispatch/订阅；运行中绑定不静默热替换或标完成。若明确请求收紧运行中权限，在下一动作 gate 停止新动作并进入可见决策/核对，不伪称已撤回过去副作用 |
| upgrade | 新版本先 staging/校验，再 CAS 切换未来绑定；旧运行固定原 digest/config，旧宿主未确认释放前保留资源；不跨未声明 major 自动迁移 |
| rollback | 显式选择保留的兼容旧版本与对应配置，影响未来绑定；保留升级/回滚历史，不声称逆转外部写入或恢复不可逆的数据迁移 |
| remove | 先 disabled；仍有活跃 task/session/compression 引用时拒绝物理移除并列出有权查看的阻塞引用。保留审计/产物来源，受保留策略约束清理包数据；不删除任务或顺带删除共享凭据 |

停用、任务取消、权限撤销、外部结果核对是不同动作。未知副作用按既有 [C02](../c02-reconciliation/plan.md) 的核对原则保留 uncertain，不能把停止派发或 lease 过期当外部机器已经停止。计划不增加“force remove 后自动安全重跑”捷径。

## 类型、信任与产品界面

保留 FLOW-001 的 harness / provider-auth / protocol seams；首批可验证扩展类型为 `tool/connector`、`renderer`、`verifier`、`context policy`。每种声明输入/输出 schema、版本、事件/错误、取消、权限和恢复能力，未知 major fail closed。verifier 输出必须绑定实际 artifact version/input digest，插件“返回成功”不能直接绕过中心验收状态。

可信 npm 服务端扩展是明确 operator 授予的信任级别，在固定宿主接口运行；第三方未知 npm 不加载到中心进程或可信浏览器 realm，必须走隔离进程/容器、窄消息协议与文件/网络/时间/内存限制。JS context、隐藏 token 参数或 same-realm React ErrorBoundary 不是安全隔离。包预检也不执行未知 install hook。第三方 renderer 使用独立隔离文档/消息桥且逐次校验来源与 schema，不能读取宿主 DOM/连接凭据；无法建立隔离时保持不可启用，显示原因。

产品 Web 增加“插件”管理页：按状态列出名称/版本/作用范围，详情展示声明与实际授予差异、运行中固定版本、配置状态、操作进度和审计；配置表单只呈现公开字段。安装/升级/回滚前展示精确版本与能力变化；移除被活跃引用阻止时可跳到相应任务或会话。无须切换到工程 dashboard 处理产品插件。

未知 renderer/type、失效包或 renderer 错误仍展示 escaped ID/title、media type、版本和通用详情/下载入口；安全文本/有界数据 fallback 不丢产物。disable 清理 contribution/listener/timer/焦点/主题，只撤属于该插件的内容，保留草稿和中心记录。按钮、菜单、快捷键与 CLI 均到相同公共业务命令；宿主纯布局/主题命令可本地处理，不能扩成前端唯一业务状态。

## 上下文扩展与 billion-context 兼容片段

`billion-context` / `billion-context-pi` 候选已定位，固定研究输入见[候选附件](candidate-inputs.md)，但尚非用户亲自确认所指身份。CTX01已授权先核acp-kernel0.0.101纯core，不等待该身份确认；Pi/proxy与完整兼容仍独立未测，不承诺原生十亿token窗口或依据作者节省比例选型。

沿用既有矩阵，不新造压缩平台。模块输入是目标、约束、验收、剩余预算、授权范围、固定来源版本/locator 和增量；大结果先在工具侧过滤，原文可按版本追回，source 更新使相应摘要/下游证据显式失效。每个 session 只有一个 compression owner，Flow 与宿主/插件不能同时独立 compact；压缩、工具和任务委派能力可分别启停。更换 owner 必须在明示安全点保存 checkpoint/lineage/原文引用后交接，不能因 disable 丢失解压/历史读取能力。

候选验收须包含：compact 后暂停/恢复/fork、授权 Flow session ID 与 lineage、相同 prompt 的不同 session 隔离、原文位置和引用还原、附属存储导出/迁移、缺失/损坏 store、未知 major拒绝、跨 runner/机器支持边界。相同 session ID 不证明跨机恢复；主循环 token 降低不代表整个流程省钱，检索/压缩/重试/验证开销与信息遗漏分开测，未知用量保留。真实模型实验另交预算，不挪用封存 R02 5/5。

## TODO、owner 与依赖

下列复选框只表示完整项完成。X02已交registry/公共CLI片段、X03已交只读模块；其具体进展见唯一status，均不能勾完整生命周期。各后继writer仍须独立领取精确scope。

- [x] **X01-01** 完整计划、现有能力核对、稳定验收/依赖与三件套。Owner：runner_owner；本轮文档交付。
- [ ] **X01-02** 冻结 manifest、安装/版本/配置/授予/operation 公共合同与 client。Owner：Execution Lead（共享入口）；依赖 X01-01；交付精确合同及拒绝语义，不先扩平台。
- [ ] **X01-03** 中心 PG registry、commands、鉴权/CAS/幂等/审计及重启恢复。Owner：Lead 派发中心 writer；依赖 X01-02。
- [ ] **X01-04** 固定 npm 包 resolver、可信 loader、活跃版本 pin、六项生命周期与 config/grant；除零依赖自有 fixture，至少一个来源/许可/版本固定的现成 npm 能力经明确 build-time bundle 或受控依赖方案接入 Flow Adapter。Owner：Lead 派发宿主 writer；依赖 X01-03 和实际 runner 能力接口。
- [ ] **X01-05** 第三方工具/renderer 隔离与能力 gate、超限/取消/停用清理。Owner：Lead 派发隔离 writer；依赖 X01-02/04；隔离不足不得启用第三方。
- [ ] **X01-06** 产品 Web 管理页 + CLI 同公共 commands，未知类型通用展示、状态/进度/审计。Owner：Lead + Web 管理 owner 派工；依赖 X01-02/03、已审 WPF-P01 和实际 WPF-I01 挂载。
- [ ] **X01-07** 实际工具、renderer、verifier 扩展示例与更换版本证据；现成 npm 能力须经公开 enable→冻结 binding→真实 runner→有来源产物验证，并证明上游能力来源与升级身份。Owner：Lead 派发集成 writer；依赖 X01-04/05/06；不能仅注册空 manifest或以自有 fixture 代替完整 npm 复用。
- [ ] **X01-08** 通用 context Interface 与唯一 compression owner、来源失效/恢复矩阵。Owner：Lead 派发 context writer；依赖 X01-02/04、G01 版本/项目身份和 usage 账本；不等待具体候选身份才设计窄接口。
- [ ] **X01-09** 确认具体 billion-context 候选后，固定源码/许可并做上述兼容实验。Owner：Goal Owner 确认需求身份，Lead 派发 E01/context writer；依赖 X01-08 + 精确候选身份 + 实验预算（需要时）。
- [ ] **X01-10** 独立 review、中心/CLI/Web/runner 整体验收并受控 main 集成。Owner：Lead 协调独立 reviewer/集成 writer；通用管理验收与集成仅依赖 X01-03～08 的明确交付与限制；X01-09 候选插件另做后续兼容验收，不阻塞本项。

## X01-06 的只读先行子段：X03

Goal Owner 已批准 Mika 在 [X03 唯一计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-management/plans/x03-plugin-management-view/plan.md) 中先做“中心登记的包 / 当前浏览器扩展”窄视图。依赖 X02 中心 registry、F01 consumer095 公共 client、WPF-P01 trusted host 与 WPF-I01 挂载；它是 X01-06 的可读子段，不等待或代表完整安装/启停/升级/回滚/移除生命周期。

输入仅为只读 client registry 与当前 host.list/subscribe。不能新增 npm 加载、自动授予或绑定；尚未证明某中心 package 对应 trusted definition 时，两份事实分开展示，不推断中心登记即浏览器已加载。主 App 接线已由WPF-X03I01外部owner交付并入main；本计划不改变其写入范围，完整写命令UI仍未交付。

子段验收保留：两个来源的身份/状态标签、无映射时的分开展示、host 更新订阅、空/未知/失败通用状态、凭据不进入列表、只读请求与真实浏览器证据。完整 X01-06 仍待 Web/CLI 公共写命令及生命周期验收，不能因该子段通过而勾选完成。

## 可检查的验收矩阵

| 验收 | 必须保留的证据 |
| --- | --- |
| 持久、同一权威 | 专用 PG/动态 HTTP：Web 与 CLI 发相同命令；中心重启后版本/配置/授予/operation/audit不丢；前端退出不打断受理 |
| 并发/鉴权 | 未认证、跨 scope、旧 revision、并发 enable/disable/upgrade、相同 key 重报/异输入；最多一个有效 revision，不半写状态 |
| 活跃版本 | 任务A固定v1，升级后B用v2，rollback后C用v1；A恢复仍原digest/config；未知/缺包拒绝，不悄换版本 |
| 停用/移除/副作用 | 新动作被 gate 拒绝；在途外部写 ACK 丢失不标撤回；活跃引用阻止物理移除；清理失败可见且不跳过剩余清理 |
| 隔离/隐私 | 受控第三方越权读/网络/进程/DOM请求被拒；列表/配置/错误/日志无合成secret marker；真实凭据不进入测试 |
| 实际扩展 | 精确 npm fixture工具完成一次任务；renderer真实展示产物且未知类型fallback；独立verifier校验指定artifact版本，换版本不伪复用旧通过 |
| 现成 npm 能力复用 | 至少一个真实有用的现成包固定来源/许可/版本/integrity与Adapter构建身份，经明确bundle或受控依赖方案完成同一真实runner旅程；升级用新身份，旧任务仍pin原版本；不放开任意安装 |
| Web/CLI 旅程 | 安装→配置/授权→启用→任务→停用→升级/回滚→移除同语义；两主题/窄屏/键盘/进行中错误与重试可读 |
| Context | 原文/版本/lineage/唯一owner及压缩前后恢复/fork/引用正确性；成本与信息遗漏分开，候选身份与支持边界固定 |

每片段用公开 Interface 进行必要局部检查；公共合同/迁移/资源行为纳入直接消费者影响。真实 PG/HTTP、浏览器、执行端生命周期证据分别固定 source target；mock fixture、隔离试验、真实模型和产品系统验收不混写。没有以上实际证据的 TODO 不勾选。

## 取舍、当前决定与后继

已确认：中心 PG 权威、同公共 commands、全生命周期与 Web/CLI、版本固定/权限不自授、凭据服务端归属、唯一 compression owner。初步设计：上述最小持久模型/命令名称及隔离方式，待 X01-02 冻结；不自动采用新库。候选项目与固定版本已定位，用户具体所指仍待未来确认；各宿主实际兼容/恢复边界未测。CTX01零模型core实验已授权，不受身份阻塞。

本轮使用本地 find-skills/codebase-design/clean-code，应用记录见 [证据](../../docs/evidence/x01/README.md)。文档链接/事实/一致性检查即可，不为计划运行产品测试。独立 review 从 [review.md](review.md) 的 NOT_STARTED 开始；进度只写 [status.md](status.md)。全局索引、registry 与 REQ-11～13 更新由 Lead 单写，本 owner 不越权。

2026-10-06 04:39:30 UTC 事实同步：本计划已入main75a33；X02 registry与公共CLI已入main，X03独立只读模块已入main，主App挂载归WPF-X03I01。既有拟定完整模型/生命周期仍是后继设计，不因registry存在声称npm安装/启停/升级/回滚/删除可用。

2026-10-06 12:32:03 UTC 接续：WPF-X03I01主App只读挂载已main，原等待描述仅历史；见[owner接收](../../docs/evidence/x01/owner-acceptance.md)。首纵向片仍需install/config/grant/enable/真实runner load-execute/有来源产物verify/disable新binding。所有X01-01～10和原完整验收保留。

## 首个真实npm包纵向片（原TODO子段）

已授权同机、workspace级、显式trusted自有包方向，具体[Interface](../../docs/evidence/x01/vertical-interface.md)和[scope/依赖请求](../../docs/evidence/x01/scope-request.md)供Mika/Execution Lead冻结。共享安装材料模块只承担有界解包/静态manifest/receipt，runner host真实import/invoke，中心权威复用原revision/command/fence。产品scope/唯一DDL未分配前不写实现。原X01-02/03/04/06/07获得这个可交付子段，全部10TODO及完整版本/撤销/移除/renderer/verifier/context/隔离验收保留。

2026-10-06 16:09 UTC 验收补充：静态安装与host双gate已在main e8077303，`invokeInstalledTool`仍无真实runRunner production caller；当前已交付slice保持delivered，完整X01开放。GO要求把现成npm能力复用落实到X01-04/07，详见[唯一后继准备](../../docs/evidence/x01/enable-binding-preparation.md)。现package-store拒dependencies/node_modules仅首片限制，不宣称完成通用npm复用。本轮只归档需求，不选择/安装新包或领取产品范围。

## 历史 startup 交付设计（2026-10-07，已main6aa并通过实际进程旅程）

X01-04/07 continue through [the existing center/runner process entry](../../docs/evidence/x01/cli-startup-interface.md). Terminal20b report-only recovery is independently reviewed and may integrate now. Operator-owned private-file composition, default-off compatibility and current journal identity precede a separate real process PG acceptance; management CLI/three-end user experience and unknown invocation recovery remain open. No new plan authority or second runner.

2026-10-07T10:46:30Z 当前验收更新：startup与management不再是缺失入口；后继小片以[差距核对](../../docs/evidence/x01/acceptance-gap-20261007.md)为准。02～10原checkbox保持开放。Web两旧literal已正式STOP/amend交回，后续由Web独立owner fresh take；本更新不领取新scope或批准新PG。

2026-10-07 后继用户验收：用户从中心授权候选按已注册可读名称选择执行后端，无需查日志UUID。候选是有限只读提示，启用重新核验授权/材料/配置，不能显示为在线、已加载或可调用证明；[当前接口](../../docs/evidence/x01/host-candidates-interface.md)。归入原X01-02/06，不新增第二管理事实源。
