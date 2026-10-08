# WPF-001 Web 平台持续执行与需求账本

> 本文件的唯一持续维护权威是 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform`（branch `codex/web-platform-management`，owner d01_owner）。主线中的同路径是经独审、由Execution Lead同步的固定发布副本，不能据它推断当前进度；固定target、生成时间及同步规则见[发布说明](../../docs/evidence/web-platform/publication/README.md)。不得在main另建手填status。

| 字段 | 内容 |
| --- | --- |
| 计划编号 | WPF-001 |
| 状态 | `in-progress`；持续目标按轮交付，不声称“完美”或无限优化已完成 |
| 创建 / 最近更新 | 2026-10-06 / 2026-10-07 |
| 唯一管理 owner / model | d01_owner（本轮执行管理者）/ gpt-6-astra ultra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management` / `codex/web-platform-management` |
| 固定基线 | `d444608ab6c796c731e44e51a892868bf39bec2a`；2026-10-06 02:07 UTC 核验 main clean 后创建，不追逐 main 后续 HEAD |
| 独占写入 | 632a7149 v3：`plans/web-platform`、`docs/evidence/web-platform`、`plans/wpf-mature-01-visual`、`plans/wpf-mature-03-attachments`、`plans/wpf-mature-05-workspace`、`plans/wpf-mature-06-chat`；只有管理/计划，不授产品、其他owner或main写权 |
| 项目目标追溯（非第三层task） | [FLOW-001](../flow-001-architecture/plan.md)、[完整验收矩阵](../flow-001-architecture/full-plan-matrix.md)；W01为历史起点；当前实现按下方每片唯一owner/status与D04 scope推进 |

## 当前两层任务关系与通信

GO最新明确六项成熟聊天大task，完整用户原话、分工、验收与唯一目录见[成熟度来源与登记队列](../../docs/evidence/web-platform/mature-task-handoff.md)。WPF-001现在仅总需求/协调索引，FLOW/REQ也是追溯，不形成第三执行层。CONTEXTI直接归WPF-MATURE-03、STEER直接归WPF-MATURE-06；此前WPF-001父映射是被新指派替代的历史观察。四Web大task目录已合法amend，Mika负责02/04的唯一计划，本队只接其UI输入不复制计划。

每subtask唯一status写`所属大task`稳定ID+canonical链接与`co-lead`；普通进展/ready/review/merge/claim只status→dashboard，GO每完整大task仅需其裁决的独立blocker一次与完整Done一次。worker内部和co-lead具体依赖协调保留。实际原子take、独审、正常commit/push及主线唯一受控集成流程不变。

## 用户原话与来源轮次

这里持久保存本轮已传达的全部需求。引号中的原话由用户消息或 Goal Owner 逐字转交；没有逐字文本的轮次明确用“准确摘要”，不伪造引用。新消息到达后追加稳定 REQ ID，记录它改变什么、对应 owner/计划/验收；不能只留在聊天或模型上下文。既有要求不因新一轮 UI 修改丢失。

| 来源 | 用户原话或准确摘要 | 落地约束 |
| --- | --- | --- |
| U00 原始外部派工 | W01 产品 Web 与 D01 工程 dashboard 已授权实施；独立 owner 并行，协调者不直接写实现；优先 Astra Ultra，所有写入至少 Sol；原 squad 最多3活跃、项目总上限10，遵守实际运行时限制 | 初始基线 `eacee76fa7f1b6cc46b06b57ae68458637be4a26`，原 owner 独占树和范围，独立验证/提交，不 merge main，原 Execution Lead 集成 |
| U01 官方 Thread 整改（原话，由 root 转交） | “我不喜欢这个style，assistant ui没有其他style了吗？”；“你用了assistant ui的skill了吗？用的话你怎么会不使用Thread组件呢？完全不合格” | W01 从官方 registry 取完整源码、固定来源/hash、保留主要结构和行为、最小适配公共 FlowClient |
| U02 布局与交互（原话，由 root 转交） | “侧栏chat高度要窄，和arc浏览器一样的风格。可以split，merge到一个tab上。功能栏竖着放最左边和codex类似。AI elements里的termina，file system全部接上，接到右边tab格式，和codex一样。 Maximize你的subagents，你应该还有一个subagent栏位吧，派工” | W01 主 shell/split/merge；workspace_panels_owner 官方只读右侧面板；截图为设计输入，不冒充已有能力 |
| U03 角色分工（原话） | “你负责不停做research优化，你的一个subagent来负责管理” | root 持续只读研究/独立审查；d01_owner 执行管理；实现 owner 独立 worktree。原“4活跃/cap4”及后续cap3/项目10均为历史规则；root本轮转交用户后到9cce规则为每Lead最多1+3、三队总12，仍取运行时4槽与实际ready/资源约束的更小值，不靠claim数量推可运行人数 |
| U04 持续执行与插件（原话） | “记好plan，status，review，dashboard。然后你要不停的加plan，不停的增加新的功能，不停的优化性能，没有上限，只要不是完美就优化。并且确保我们所有组件都一定是被设计成可插拔的，我们要完整的plugin系统。所以所有的地方都要能随时加一个按钮之类的。” | 每轮形成可验证产出，持续记录下一功能/性能/研究队列；全栈 plugin 系统与所有适当 UI 扩展位置纳入计划，不把局部 slots 当完整 plugin 系统 |
| U05 需求持久化（原话） | “我和你说的话全部记进plan里，不要只靠脑子记” | 本文逐条追溯；每个新增 plan 都有唯一 status/review，未审查保持 NOT_STARTED |
| U06 Dashboard 视觉反馈（准确摘要，由 root 转交） | 用户不满意4320样式并提供 dashboard 截图，要求紧凑中性视觉；当时主线确认4320为17来源；03:17已实核30来源且原17保留 | 主线 D03 独占视觉与语义实现；WPF-D01仅协作需求/来源登记，不另派实现，不停/重启/覆盖原Lead4320服务 |
| U07 速度与验证（原总体 Goal Owner 经 root 转达，准确摘要） | 用户强调推进速度与 local tests；按实际影响范围先测本模块与直接依赖，共享接口变更才测链路，metadata不重复全库测试 | 保留真实行为、视觉、a11y验收，不为提速假连接；主线D03承担dashboard全部后续，M02提供公共工作/决策能力，W01保留消费接缝 |
| U08 多lead领取协调（原话） | “和你在一起工作的还有其他agent leads，一定要管理好执行dashboard，你们才不会overlap工作。take 工作最好也在dashboard上标清楚” | 主线D04维护唯一PG领取账本，多Lead按真实actor原子领取/显式转交；进度仍各status唯一，不凭旧源或缺失源当空闲 |
| U09 产品预览与架构tab（原Goal Owner逐字转交，经root传达） | “把产品Web UI打开留着可随时看，且工程dashboard增架构tab” | 原Goal Owner最终选择已审M02的49922并已打开保留用户tab，明确HTTP fixture；原owner保留服务，55049仅I01开发验证，不另起重复服务。工程dashboard架构tab由主线已承接，我方不改其代码 |
| U10 插件管理入计划（原Goal Owner逐字转交，经root传达） | “plugin管理写进计划里” | 主线维护独立X01全产品插件管理canonical计划；我方链接追溯并继续P01/I01前置，不重复建立X01或扩大已领生产范围 |
| U11 真实持续对话优先（原Goal Owner反馈经root转交，准确摘要，未提供完整逐字原话） | 用户在49922输入hi后只看到固定英文center/runner/result和Field notes/Verification卡片，要求真实Codex式持续对话；需要模型、thinking/effort、access权限、context、files、语音、发送、消息气泡、queue、steering、tool calls及可展示thinking；正文优先而详情按需 | 真实聊天核心优先于PERF02与工作台装饰；I01既有收尾继续，49922原tab/fixture服务保持且明确演示性质；真实中心能力与契约由主线唯一owner提供，不能用缺少持久conversation/turn/context lineage的任务拼接伪装追问，steering必须active turn/attempt确认生效 |
| U12 领取与跨Lead协作重申（用户逐字，映射U08/REQ37） | 和你在一起工作的还有其他agent leads，一定要管理好执行dashboard，你们才不会overlap工作。take 工作最好也在dashboard上标清楚 | 复用U08/WPF-REQ-37与现有D04事务claim；确认owner/Lead、worktree/branch、精确写入范围、state/version实际可见，不造第二手填进度或口头抢占 |
| U13 本机登录入口（GO经root准确转述，非逐字） | 4320提供打开Flow及按需掩码显示/复制登录凭据；真实本机安装验收 | [独立入口请求](../../docs/evidence/web-platform/dashboard-local-access-intake/request.json)；显式local-installation限定、可信固定来源，token不进日志/URL/聚合/Git；唯一operator恢复和发布，不代用户登录/刷新聊天 |
| U14 任务时间展示（GO经root准确转述，非逐字） | 展示任务开始、完成时间及进行中耗时 | 归已有REQ16/27/37与D01；唯一status明确UTC声明，结束未知不冒进行中，不回填历史；字段/枚举已由Lead固定79da规则并报告入main18144593，[限定合同](../../docs/evidence/web-platform/dashboard-task-time-intake/report.md)已由独立Timing源码72a实施，parser与5项浏览器实际获审；main/发布另计，后继易读层级沿同U14排队 |
| U15 日常文件附件能力（GO经root准确转述，非逐字） | 常用Markdown/代码文本按真实能力支持，大小与总context预算明确可配置；授权workspace/runner文件与中心上传资源分清，选后同版本材料经Send/Queue到实际runner | 沿[原MATURE03-02/新明确03-07](../wpf-mature-03-attachments/plan.md)；一份项目>8KiB Markdown和一份源文件是未来验收材料。复用storage/context/附件接口，先只读合同准备，不只改常量、不造第二上传体系；无provider/个人文件读取上传许可 |
| U16 恢复验收的真实依赖（GO经root准确转述，非逐字） | 不让无关材料/tooltip失败阻断全部认证失效、离线和窄屏检查；列真实依赖，独立者隔离context/服务数据与精确选择 | 归[原MATURE06-04/06](../wpf-mature-06-chat/plan.md)，保真实恢复链、最终E2E和所有原断言/失败/预算；不catch污染状态继续、不以局部PASS冒完整通过、不加provider或新框架 |
| U17 日用会话导航（GO经root准确转述，非逐字） | 默认可找回近期使用/活动会话，冻结排序语义和稳定tie-break；按中心/项目真实授权搜索全标题，不把已加载50条过滤称完整搜索 | 沿[原MATURE05-06](../wpf-mature-05-workspace/plan.md)独立后继；有界轻摘要/分页、旧cursor兼容及query绑定，保护聊天/草稿/焦点；覆盖>50、未加载页命中与快换query/中心，记录实际请求/字节/局部延迟。当前只计划/接口研究未take，恢复与设置优先 |
| U18 恢复列表日用可读性（GO实际观察经root准确转述，非逐字） | 默认UUID、accepted收据和长UTC抢占主层，多条No text难区分；主读可读标题、内容摘要与本地时间，技术身份和精确UTC下钻保留 | 沿原MATURE01-03/04、MATURE06-03；[来源与验收](../../docs/evidence/web-platform/quick-native1-recovery-review-20261007/incoming.json)。只用授权轻metadata或诚实fallback，不预取正文；不按No text自动合并、删除、重发；原材料/knowledge/intent/unknown语义保留，不阻已通过full7 |
| U19 快速设置弹层层级（GO实际观察经root准确转述，非逐字） | 180字压力标签重复占高、Apply在首屏外；真实host需紧凑model/thinking/speed入口、完整目录说明下钻、长名限高且完整身份可看可区分、主要Apply/Cancel易找 | 沿[原MATURE01-02/04](../wpf-mature-01-visual/plan.md)与既有MATURE02 TODO11；[验收来源](../../docs/evidence/web-platform/queue-full6-closeout-20261007/compact-settings-go-intake.json)。复用圆角/阴影/材质tokens，正常真实标签与长名分别截图，保exact授权tuple/显式Apply/ownership；原六PASS不撤，不新增task或接线写权 |
| U20 执行后端日用选择（GO/Mika经root准确转述，非逐字） | 从中心授权候选按可读名称选择执行后端，同名可区分，兼容/不可选原因和已知/未知可见；UUID手填仅临时高级入口 | 沿原WPF-001-05/X01-06和[唯一模块来源](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-runtime-management/plans/wpf-plugin-runtime-management/status.md)。候选不证明online/loaded/callable，enable仍中心重验；当前七scope可先实施，不猜未冻结字段、不用executionProfiles当宿主证明、不新增registry或探测。 |

U00 补充执行约束：dashboard 优先尽早交可查看版本；来源映射严格以完整 handoff 的 task→唯一 owner worktree 登记为准；临时样本覆盖状态变化、缺失、空 review、转义与路径限制，真实工作树只读核验，二者证据明确分开。U02 原文保留拼写，实施含义为官方 AI Elements Terminal/FileTree，不伪造PTY或任意文件系统。

视觉输入文件（已由用户提供；路径仅用于追溯，不复制到其他任务）：
- `/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/TemporaryItems/NSIRD_screencaptureui_NDMyZU/Screenshot 2026-10-05 at 7.01.44 PM.png`
- `/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/TemporaryItems/NSIRD_screencaptureui_Q7C3Y2/Screenshot 2026-10-05 at 7.02.26 PM.png`

最新用户逐字成熟度要求和Arc图说明已完整保存于[来源](../../docs/evidence/web-platform/mature-task-handoff.md)，图不提交。该要求拆为GO定义六个大task，不用原REQ有限列表吞掉新增功能或美学验收。

## 完整需求追溯

表内 owner 表示负责落实的角色，不表示已完成；事实和检查以该任务唯一 status/证据为准。新要求只追加 ID，不重新编号。

| 稳定 ID | 来源 / 要求 | Owner / 计划 | 可验证验收 |
| --- | --- | --- | --- |
| WPF-REQ-01 | U01 官方完整 Thread，拒绝旧自制壳改名 | w01_owner / W01 | 官方 registry URL、原始JSON、精确hash、许可和最小diff；Root/Viewport/Messages/Footer/Scroll/Composer/ActionBar真实运行 |
| WPF-REQ-02 | U00 现有 contracts/client；实际 assistant-ui，合理 AI Elements | w01_owner / W01 | ExternalStoreRuntime只适配中心投影，无浏览器模型直连；官方组件确实被import/render |
| WPF-REQ-03 | U00 前端只渲染、触发、缓存；持久受理/断线重连/人工决定/显式取消 | w01_owner / W01 | 新任务按幂等键受理、cursor重连；关闭/切换视图不cancel，人工决策与取消绑定任务ID |
| WPF-REQ-04 | U00 详情按需加载、ID/title引用、产物版本/验证/usage区分 | w01_owner / W01、panels | 首屏不读详情；首次展开读一次、重复缓存；执行完成与验证通过独立 |
| WPF-REQ-05 | U00 fixture与真实中心联调分开 | w01_owner / W01 | 所有证据标环境与提交，不把HTTP内存fixture声称持久数据库/真实模型 |
| WPF-REQ-06 | U00 新依赖精确版本；仅W01自己树可临时生成根lock，交付patch后恢复 | w01_owner / W01 | 根manifest不改、根lock不提交；版本/安装检查/patch交原Lead集成 |
| WPF-REQ-07 | U02 Arc式紧凑chat侧栏 | w01_owner / W01 | 32–36px为root工程建议、可调整的目标行高（非用户指定数值）、长标题截断/提示、键盘可用；以截图复核实际密度 |
| WPF-REQ-08 | U02 最左Codex式竖功能栏 | w01_owner / W01 | 约48px为root工程建议、可调整的竖栏宽度（非用户指定数值）、顶部/底部明确入口、可访问名称，窄屏不遮挡内容 |
| WPF-REQ-09 | U02 chat split与merge回一个tab组 | w01_owner / W01 | 只改变视图分组，绝不拼接任务历史；A/B同时观察、merge再split、关闭不cancel |
| WPF-REQ-10 | U02 右侧tabs集成实际AI Elements Terminal/FileTree及产物 | workspace_panels_owner / W01子交付 | 固定官方source/hash，真实引用/文本驱动，文件detail懒读，活动tab关闭后焦点合理 |
| WPF-REQ-11 | U00/U02 完整浅深主题与扩展tokens | 两实现owner / W01；主线D03 | 双主题截图、对比/焦点/状态/弹层完整；不能把terminal永久硬编码黑色当全局浅主题 |
| WPF-REQ-12 | U00/U02 窄屏、键盘、减少动画 | 两实现owner / W01 | 390px无页面横溢；tabs/tree/scroll controls可键盘操作；reduced-motion关闭pulse/自动smooth |
| WPF-REQ-13 | U00 D01独立于产品Web、本地可看 | D01已交付；主线D03后续 | Node内置HTTP+网页，无产品运行时依赖；不以日志堆砌首页 |
| WPF-REQ-14 | U00 dashboard首页用户视角：里程碑/owner/实际进度/下一交付/阻塞/用户决定/review/main | 主线D03；WPF-D01协作登记 | 用户能区分实现、检查、独立审查、main集成；不猜百分比/ETA |
| WPF-REQ-15 | U00 status唯一手填事实源；登记task→唯一owner worktree | 管理者、各owner、主线D03 | 无第二手填进度，JSON/网页只派生；保留原Lead17来源并显式追加新管理来源 |
| WPF-REQ-16 | U00/U14 来源与时间、HEAD/dirty及缺失/解析失败/过期明确 | 原D01/D03展示owner；字段由Lead统一 | 启动/完成独立UTC声明，含等待历时按同一可信snapshot截止；结束未知、明确未完成、stale/frozen分开，不从mtime/claim猜时间。旧检查/review/current语义不被新可选时间异常污染；[合同](../../docs/evidence/web-platform/dashboard-task-time-intake/report.md) |
| WPF-REQ-17 | U03 root持续research、subagent管理 | root / d01_owner | root不写实现；管理者持久化研究→owner→验证；不以研究替代ready实施 |
| WPF-REQ-18 | U00/U03 >=Sol、优先AstraUltra；root转述后到9cce用户规则每Lead1+3、三队12 | 管理者 | 仍遵运行时4槽与真实ready/共享资源约束；旧cap3/项目10只为历史，权威规则文档由OriginalLead窄审维护，本表不扩大任何功能写权 |
| WPF-REQ-19 | U04/U05 全部用户话进plan、持续维护plan/status/review/dashboard | 管理者、各owner | 每条REQ有来源/owner/验收，新增plan必有三件套；原话与转述清楚区分 |
| WPF-REQ-20 | U04 持续新增计划和功能 | root研究、管理者排队 | 每轮交付后按实际缺口选择下一ready计划；不把单批次或“完美”宣称完成 |
| WPF-REQ-21 | U04 持续优化性能 | WPF-PERF01 | 固定fixture/机器/build测基线及增量；证据支持改进，保持功能不退化 |
| WPF-REQ-22 | U04 所有组件可插拔、完整plugin系统 | 原Lead X01 + WPF-P01 Web子项 | 全栈生命周期、版本/配置/权限/隔离/CLI等价；UI统一扩展接口，内置功能也使用；真实conversation/sidebar、组合pane及preconnect/reauth连接页覆盖仍待验，见[固定研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md) |
| WPF-REQ-23 | U04 适当位置随时加按钮等扩展 | WPF-P01 | stable slot IDs+commandId，sample插件不改核心即可加button/tab/menu；真实ConversationList与组合pane菜单须用conversation/view身份验证，不能以旧task slot数量或data-extension-slot标记替代；preconnect/reauth真实贡献与禁用卸载、未认证能力边界须验，不暴露token/CSRF/client；不是每个DOM节点套Slot |
| WPF-REQ-24 | U00 独立worktree/branch，先核验不重建/重置/覆盖 | 管理者、各owner | 记录base/head/dirty与允许范围；冲突交唯一owner，管理者不并发写W01 |
| WPF-REQ-25 | U00 find-skills本地优先、固定来源，无重复安装 | 各owner | 每stack读本地skill并记录路径/hash/应用；assistant-ui/AI Elements/clean-code固定源 |
| WPF-REQ-26 | U00 每段/约30min安全停点/交付clean-code | 各owner | 实际命名、职责、接口、错误、重复、复杂度、行为检查发现/修复记录 |
| WPF-REQ-27 | U00/U14 启动/实质进展/阻塞/交付/review修复更新唯一状态与时间证据 | 各owner；Lead统一字段 | 不把更新时间、claim或分支完成当任务开始/完成；未记录保未知，不回填；分支/独审/main/部署各目标与时间独立，dashboard只读聚合 |
| WPF-REQ-28 | U00 独立review绑定SHA，未审NOT_STARTED | root或独立reviewer；owner转录 | 新实现不继承旧approval；metadata diff和实现target区分，不虚报当前HEAD通过 |
| WPF-REQ-29 | U00 feature分别提交/验证、不merge main、原Lead集成 | 各owner/原Lead | 完整SHA/branch/dirty/启动URL/checks/双主题图/技能/限制/plan-status-review回传 |
| WPF-REQ-30 | U00 共享改动交清单，不动共享contracts与其他owner记录 | 管理者/原Lead | 依赖lock、索引、registry、未来后端能力在handoff逐项列明 |
| WPF-REQ-31 | U06 紧凑中性dashboard且不打断4320现有17源服务 | 主线D03；WPF-D01仅协作 | 主线唯一owner实现与切换；我方不另派dashboard实现，提交来源清单，保留原17源及安全边界 |
| WPF-REQ-32 | U02 扩展视图不伪造终端/文件系统能力 | panels、原Lead | 现契约只有Timeline text/reference和Detail；标“任务输出/任务产物”，BR-01-A～D具体能力请求交Runner/M02/X01，由Lead登记owner及SHA；不称文本为stdout |
| WPF-REQ-33 | U04 与既有全栈插件/协议计划对齐 | 管理者、原Lead X01 | WPF-P01仅X01 Web host子项；原P01=协议接入不重用，M02公共命令不另造 |
| WPF-REQ-34 | U07 按影响范围做 local tests 并加快可审查交付 | 所有owner | 模块+直接依赖优先；共享接口才链路；纯metadata仅文档核验，保留必要视觉/行为/a11y |
| WPF-REQ-35 | 主线M02已交付完整接口；Web整改稳定后接入统一工作总览 | WPF-M02 / workspace_panels_owner（已独立交付） | 连续feed/attention原地决策、锚点/409/100+分页/懒详情/连接隔离，真实Web验收独立 |
| WPF-REQ-36 | 主线D03要求各权威status提供明确人读字段与实现范围 | 每个唯一owner自行写；管理者协调 | 阶段/优先级1–9/当前产出/下一可用交付/明确阻塞与决定/完整实现target与literal范围；不写其他owner状态 |
| WPF-REQ-37 | U08/U12 多lead避免重叠、take工作在dashboard标清 | 主线D04唯一账本；各Lead真实actor领取；各owner唯一范围 | taskID/owner/lead/唯一worktree与branch/精确scope、claim ID与version/状态/时间与交出接收方可见；候选NOT_TAKEN、正式receipt COMMITTED、RELEASED必须分开，pending provision不冒领取；PG事务拒绝同task及同/父子路径冲突，跨task部分转交先停写→amend→take，不靠口头抢占；[04:07领取视图与42源实证](../../docs/evidence/web-platform/assignment-visibility-verification.json) |
| WPF-REQ-38 | U09 产品Web打开并保留，可随时查看 | 原Goal Owner选已审M02 49922；原owner保留服务 | 已审M02 http://127.0.0.1:49922/用户tab已打开并保留，明确fixture及恢复方式；I01 55049仅开发验证，不能声称稳定main或真实中心服务已起 |
| WPF-REQ-39 | U09 工程dashboard新增架构tab | 原D06 owner d01_owner / 原Lead主线接收 | 原五图Interface不变；当前组合591/data5124/renderer a28e已获源码、22direct与5组20观察几何/键盘独审，已main02c880并静态资产发布，adf953 v3已释放；[唯一D06 intake](../../docs/evidence/web-platform/d06-second-actual-20261007/main-handoff.json)。390默认缩放文字可读性另为[原D01窄屏阅读后继](../../docs/evidence/web-platform/d06-second-actual-20261007/narrow-reading-followup.json)pending，现5/5不冒完整视觉可读验收。 |
| WPF-REQ-40 | U10 plugin管理写进计划里 | 主线X01唯一canonical owner；我方父计划关联 | 主线计划包含Web管理页和CLI公共center命令、持久版本/配置/权限/作用域、npm install/enable/disable/upgrade/rollback/remove、活跃执行版本绑定、可信/隔离边界；实际[X01计划](../x01-plugin-management/plan.md)已建立，文档888308d是全栈计划来源；X02持久registry及X03只读Web管理已有限交付，npm执行/完整生命周期与第三方隔离仍未完成。P01/I01本地Settings不冒充完整插件管理 |
| WPF-REQ-41 | U11 真实持续对话优先与明确演示边界 | [WPF-CHAT01 canonical](../wpf-chat01-conversations/plan.md) / workspace_panels_owner；主线center/runner | hi自然回应、同conversation追问、断线重连；49922不暗换/重启，固定fixture不冒充模型输出。Web已按[CHAT receipt](../../docs/evidence/web-platform/chat01-take-receipt.json)独立受领；[PERF02 canonical](../wpf-perf02-activity-window/plan.md)依[独立receipt](../../docs/evidence/web-platform/perf02-take-receipt.json)并行，不占CHAT范围或替代对话优先 |
| WPF-REQ-42 | U11 模型/effort/access/context/files与发送 | 主线capability catalog契约；Web真实消费 | 控件只展示中心支持的模型/能力和授权范围；unsupported明确，权限不由前端自授；context/files使用授权资源与版本，不能凭显示路径假接文件；K02固定736三contracts已按Lead受控输入消费，新八scope薄reader固定763已独审APPROVED，最终2bce clean已记录main115b、claim5ab v2释放，保持project身份/旧能力缺省与只读metadata；不开放context UI；后继实际App还须用现client.projects分页提供明确项目选择，未绑定旧会话保持纯文本，不可自动取首project，CREATE未知后锁定project/refs |
| WPF-REQ-43 | U11 消息气泡与正文优先、tool/thinking懒详情 | Web renderer与中心投影owner | 用户/assistant正文为主；tool及provider可展示thinking初始仅id/title/状态，初始响应/SSE没有大payload；鉴权展开前0detail，首次1/重复缓存，provider无thinking则不伪造；现有generic reference没有typed状态；已main CHAT05另有typed native接口，ActivityI消费真实工具/思考并保持generic fallback，未给thinking不造；不要求跳任务页。[CHATREAD固定源/动作与WAI补充](../../docs/evidence/web-platform/short-chat-visual-supplements-intake.json)保可发现footer、不同授权动作及异常外显，尚未实现。真正partial须native event→持久→read/projection，不用快poll或动画冒充；真实聊天/折叠详情链之后，主组合收拢为单一外层执行折叠入口，默认model/access/queue主要状态可读，其他技术语义可达，unsupported/unknown明确、requested不冒actual |
| WPF-REQ-44 | U11 queue和steering | 主线持久commands/runner；Web有权触发与渲染 | 中心队列持久、有序、可取消与重连；按固定main14c61公共合同，pause受理或原key重放后必须fresh GET最新paused/currentTurn，再由用户明确单独取消当前active task，两份receipt/结果分别显示，不称stop-all。same queueRevision也更新动态taskStatus/blocked/paused，旧ACK不覆盖新GET。Web实施见[QUEUE01](../wpf-queue01-ui/plan.md)；当前页面unknown key重试与中心状态重载恢复分开，原key跨reload/换连接恢复仍后继。steer仍不支持，须独立受理/送达/生效证据，不以HTTP超时当取消 |
| WPF-REQ-45 | U11 语音录音/转写与失败恢复 | 主线能力接口；Web受控交互 | 录音与转写分开、明确开始/停止/失败，失败保留文本输入；本轮不偷接付费语音服务，未支持明确，凭据不放浏览器/插件 |

## Owner 与唯一来源入口

管理authority不迁，原a5固定发布/33bd副本仍仅其时点。下表仅定位owner来源、独立worktree和branch，不另抄动态领取或技术进度。**写权必须fresh读取D04的claim ID/version/scope与COMMITTED/RELEASED；进度只由各owner唯一status聚合。** [当前跨lead交接](../../docs/evidence/web-platform/mature-task-handoff.md)保留已核原始回执和共享窗口；本表owner名字不授予已释放scope。旧过时分配段已原样归入[历史](status-history.md)。

| 工作 | 来源owner / 唯一WT / branch | 唯一status |
| --- | --- | --- |
| PLUGIN-RUNTIME01 → X01-06 | w01_owner / web-plugin-runtime-management / codex/web-plugin-runtime-management | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-runtime-management/plans/wpf-plugin-runtime-management/status.md)；[登记待办入口](../../docs/evidence/web-platform/recovery-second-center-preparation-20261007/plugin-registration-request.json) |
| RECOVERY01 → MATURE06 | workspace_panels_owner / web-conversation-recovery / codex/web-conversation-recovery | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery/plans/wpf-conversation-recovery/status.md) |
| MESSAGESETTINGS01 → MATURE02（已交付来源） | w01_owner / web-message-settings / codex/web-message-settings | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings/plans/wpf-message-settings/status.md) |
| MESSAGESETTINGS02 → MATURE02/TODO11 | w01_owner / web-message-settings-quick-controls / codex/web-message-settings-quick-controls | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-quick-controls/plans/wpf-message-settings-quick-controls/status.md) |
| DPERF04 → D01 | w01_owner / dashboard-summary-detail / codex/dashboard-summary-detail | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-summary-detail/plans/wpf-dperf04-summary-detail/status.md) |
| DPERF05 → D01 | workspace_panels_owner / dashboard-status-timestamps / codex/dashboard-status-timestamps | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-status-timestamps/plans/wpf-dperf05-status-timestamps/status.md) |
| RELEASE03 → MATURE01（已交付来源） | w01_owner / web-current-preview-compatibility / codex/web-current-preview-compatibility | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-current-preview-compatibility/plans/wpf-release03-current-preview/status.md) |
| PROFILEC02 → MATURE02（已交付来源） | w01_owner / web-profile-readonly-compatibility / codex/web-profile-readonly-compatibility | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-profile-readonly-compatibility/plans/wpf-profile-readonly-compatibility/status.md) |
| WPF-001管理 | d01_owner / web-platform-management / codex/web-platform-management | [状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform/status.md) |

## 已确认决定与工程方案

- 继续沿官方Thread和现有公共client，真实持续聊天、工具/思考折叠与增量正文优先；每片独立tree、固定输入、精确take、独审后集成。未消费的能力不因SDK存在而显示已支持。
- 现有`@assistant-ui/react@0.15.23`/core0.3.22源码是行为依据，不因最新文档存在API就升级依赖或使用不存在的接口；保留composer草稿、原key回执、queue和旧中心语义。
- split/merge只组织tabGroup，不合并消息；双split各自可见，与全局focused分开。隐藏、离线、关闭、换中心分别验证，关闭观察不取消任务。
- FileTree/Terminal与现有详情只据真实公共接口展示，不从UI推导PTY或任意文件读取能力。完整X01生命周期/第三方隔离/CLI等价仍归主线唯一计划；P01可组合slot不冒称全栈交付。
- dashboard由Lead唯一部署/登记；我方只管理本队source和已授权窄采样。性能需实际消费者/规模证据，合成probe不能宣称生产容量或用户延迟收益。


### 已审后继接口与显示边界

MATURE02/TODO11的[快速控件接口提案](../../docs/evidence/web-platform/message-settings-ownership-interface/report.md)及[root限定接收](../../docs/evidence/web-platform/message-settings-ownership-interface/root-review.json)已收敛：必填不透明草稿token交给唯一host，同步比较当前归属、live authority、完整tuple后写入；仅key/remount不足以保护旧callback或same-tuple新稿。每次打开另有私有liveness，cancel/close/details navigation/success/unmount同步撤销旧Apply/omit，即使草稿token未变也不得提交。两种校验互不替代，不引第二草稿store。组件设计可与真实App/Recovery交权分开；[精确 source-only provision 与领取回执](../../docs/evidence/web-platform/message-settings-quick-controls-provision/actual-intake.json)固定 c8e352输入/3,019,669逻辑B，独立六scope交唯一W01；动态领取继续以D04为准。新实现须独立固定源审及必要验证，原37/4不外推；不争当前Recovery/DPERF/SVC运行优先。

[键盘/读屏三个验收细化](../../docs/evidence/web-platform/message-settings-quick-controls-acceptance/keyboard-root-review.json)沿原TODO11：已应用C与局部待应用Y语义分开，原生分面键盘与显式Apply完整旅程，失效后的焦点只修复当前合法编辑面板。关闭、换稿或撤权须同步撤销旧Y/回调，不为保候选延长旧生命周期。REQ22/23与WPF-001-05的[生产插件接线研究](../../docs/evidence/web-platform/message-settings-quick-controls-acceptance/plugin-host-research.json)只复用现composer action/context槽：唯一host私有同步CAS，不公开raw setter/token；隐藏React Activity可能保留renderer，原激活signal必须在disable→re-enable后拒绝旧Apply，即便C/view未变。两个入口共用一个C/session/catalog。此为Recovery/P01交权后的原TODO集成验收，不扩当前六scope或阻组件实施。

U08/U12/REQ37的[领取显示固定源研究](../../docs/evidence/web-platform/dashboard-claim-presentation/report.md)及[root接收](../../docs/evidence/web-platform/dashboard-claim-presentation/root-review.json)确认一项派生可追溯性验收：任务卡应能区分曾释放历史与从未领取；新take之后突出当前owner、旧release只读。unknown/陈旧/行消失不推释放；active只表示已领取，不证明正在写。该行为原D04已接受过滤，不是原子互斥失效或新的逐字用户要求。后继仅归D04-03/D01-02/03，两个产品文件和两个消费者测试与现DPERF04范围相交，等原片交回后串行，不改45f8候选/账本或挪用其browser预算。

现有 MATURE02/TODO11、MSGQUICK-03/04 的[远程验证消费研究](../../docs/evidence/web-platform/ops-ci01-web-consumer-intake/report.md)固定比较 OPS-CI01 与 fe6。若后继选择远程验证，须选中同一不可变源码与真实 strict types / 26 exact direct 入口；浏览器显式调用原 fixture/check，保六组、两张390主题PNG、真实CSS、退出及清理证据。原 OPS 候选仅 contracts/handler，不覆盖此验收也不因此阻塞它的原独审；平台适配、结果留存与启用另需具体准备，不能直接搬 macOS 本地包。此研究归既有 TODO，不新增任务、claim、runner或预算，不继承旧37/4。

GO 既有 REQ17/Web性能与 CHAT06 的[有界测量接口](../../docs/evidence/web-platform/req17-chat06-measurement-interface/report.md)归本表 WPF-REQ-17/21 与 MATURE06-03，不新编号。后继复用真实 stream fixture/Thread，保持最终原文与完整SHA/replay/identity/unknown；分别量 actual digest bytes、parse输入/调用、真实commit与composer输入延迟，默认smooth/defer和终态显示追平分开。128/4096前缀求和仅算术，全部指标NOT_RUN；透明插桩须原shared/renderer owner协调，不改协议/依赖或引新框架。

原 MSGQUICK-04 的[portable strict→26direct 候选](../../docs/evidence/web-platform/message-settings02-portable-prepared/report.md)已由唯一W01在原六scope的证据目录固定，产品fe6四源不变，portable候选仅获限定静态独审；本地c1随后类型失败/direct未启动，当前原件与已补输入见集中handoff。它复用原真实检查入口，外层CI containment与启用归原owner/GO；本地c1/b1不因此重写或继承远程结果。

U14时间显示已由独立Timing树、9a677v1六scope实现并实际验证；当前72a源及parser/browser限定批准，owner080e已封存主线接收包。main bf7eca登记185不等实际加载，当前获审片继续正常接收，不等待下面后继。[原供给请求](../../docs/evidence/web-platform/dashboard-task-timing-provision/request.json)只保历史，不再称未take。

D01既有U14/REQ16/27/37的[时间信息层级后继](../../docs/evidence/web-platform/dashboard-task-time-intake/readability-followup.json)排队未领取：首屏仅开工、完成或进行中、含等待耗时和可读等待原因；采用简洁本地时间并明确时区。原UTC、来源、格式诊断收进可展开依据；等待表正常排版。保持未知/陈旧真实性和唯一status、不猜历史，不建立第二时间权威；局部验证。ACCESS优先，原72a不回滚、不修改；待原owner受控main收口及合法scope交还后再实施，当前不扩Timing6scope或抢app.js，无新运行预约。

## 执行顺序与交权规则

当前优先级、fixed输入、窗口和下一步统一见[集中handoff](../../docs/evidence/web-platform/mature-task-handoff.md)及owner status，不另维护第二份滚动状态表。Lead新OPS规则：普通可逆本地实现采用有界工作段总预算，owner连续修改→局部检查→修失败→定向复测，通过后一次独审/集成；复用既有运行器与单份结构化记录，失败原件保留，绑定按风险缩放，不逐条造准备/许可/结果审批链。普通无共享端点/安装/全构建/PG/Chrome/个人服务的局部检查按最新明确规则每队最多1段、全队最多3段自主运行；当前每Lead最多1+3、三队总12，仍取本运行时4槽与实际ready/资源限制的更小值；原项目10仅历史。PG/Chrome/迁移/个人服务仍保必要隔离、资源与恢复审查；旧特殊窗口不因此重开。项目写入仍先核D04精确scope与writer；源码、独审、运行、main、页面发布分别记录。[本轮规则来源](../../docs/evidence/web-platform/dashboard-task-time-intake/incoming.json)。

最新GO/Lead规则已固定于[普通专库/浏览器有限工作段](../../docs/evidence/web-platform/continuous-validation-segments-20261007/formal-rule-excerpt.md)：已授权0provider、完全自有PG/Chrome且不触个人服务的普通验证可由co-lead分配新有限段。旧90秒/60秒是已封历史段，不是feature终身上限；保所有失败/原预算，不追溯加时或转移未用旧额。合法scope内连续定位→修复→相关复测，通过后一次独审；只有身份/权限/资源所有权/停止清理/验收语义变化才按风险复审，不逐命令造同一审批链。每次实际PG/shared仍唯一holder，独立0PGbrowser依现并行合同，fresh输入/资源组合及实际cleanup不可省；既有runner gate仅作当轮输入校验，不再要求manager逐轮发短到期许可或转录结果批准。复用原runner及owner单份结构化segment记录，不增第二调度状态。

原MATURE06 Recovery新段150000ms actual累计，每run最多60000含15000cleanup；历史5FAIL/64134.08675和旧90000封套不改，parent防御240000只是旧90k+新150k，不能把旧余量加给新段。MATURE02 Quick新段90000ms actual累计，每run最多45000含15000cleanup；原3FAIL/30625及旧60k保持，初始diagnostic/full语义delta仍需一次独审。两项source/权限/原资源界限及完整验收保持；当前初始执行与实时holder看[唯一current](../../docs/evidence/web-platform/resource-window-current.json)。


历史阶段只有项目10的明确授权，旧Root4/Web4/Mika4=12当时不能作为升限来源。当前root已只读核后到9cce用户规则：每Lead最多1+3、三队总12；本运行时仍4槽，实际只开ready且资源兼容的工作，claim数量不等运行agent数。权威规则窄审由OriginalLead负责，不在本管理片重复改规则。普通进展通过唯一status聚合到dashboard。

## TODO

- [x] **WPF-001-01** 持久化全部已传达用户要求与原话/摘要、来源轮次、稳定ID。
- [x] **WPF-001-02** 明确owner/独占范围/接口/依赖，建立无编号冲突的后续plan/status/review。
- [x] **WPF-001-03** 接收官方Thread与panels独立提交，完成W01集成、回归与独立review闭环。
- [x] **WPF-001-04** 向主线D03交付管理来源登记清单并只读验证；02:38:47.600Z新版22源中3个WPF源完整无issues（仅登记验证，不表示实现完成）。
- [ ] **WPF-001-05** 诊断通知/真实fixture的小片见[既有插件诊断后继](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-diagnostics-minimal-design.json)，不另建大task。 已审P01/I01前置继续与X01/X02衔接完整插件管理，保留中心生命周期/权限/隔离/CLI与后续Web消费验收；REQ22–23的实际conversation sidebar与组合pane扩展入口关联MATURE05-02/03，preconnect/reauth连接页真实贡献另沿同一插件覆盖后继，见[静态覆盖检查](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)，待现writer交权后独立领取。[固定2498连接页候选](../../docs/evidence/web-platform/connection-plugin-2498/report.md)复用唯一P01 host、settings.sections和Appearance；preauth审定builtin与postauth私有lease/撤权分开，六产品+两专测仅候选、未授权take。 新增[固定插件槽消费研究](../../docs/evidence/web-platform/recovery-full-return-20261007/plugin-slot-research.json)归REQ22/23：composer.context声明尚无泛型consumer、assistant footer未泛型枚举，不把内建面板当完整可插拔。后继sample贡献须不改App/Thread即可呈现，双pane身份/启停撤权/隐藏不激活/键盘与双主题验收；复用现host/registry/PluginView，不新task/take或第二插件状态，也不挤当前Recovery/Quick。
- [x] **WPF-001-06** 建立WPF-PERF01生产基线及下一有证据优化轮：3d47基线/a87窗口获审、a87已实际集入main8f1481d；未来证据另开有限工作包，不宣称无限优化完成。
- [x] **WPF-001-07** 将完整M02工作入口交给独立Web消费owner，单独验证、review与集成。
- [x] **WPF-001-08** 收取两owner精确literal范围并交主线单点登记，验证D04领取/转交/冲突展示，避免多lead重复派工。
- [ ] **WPF-001-09** 优先推进U11真实持续对话：冻结center能力/会话/queue-steer接缝，分阶段独立派工并真实验收。
- [x] **WPF-001-10** WPF-X03I01：消费Mika已审X03模块，在真实App设置挂载只读插件管理；84acdc整体限定APPROVED/final4b7e0f，独立scope/docs通过，交Lead集成仍另计。
- [x] **WPF-001-11** WPF-PROFILE01：独立选择模块4f198576限定APPROVED/finale730，混合目录/显式聊天allowlist/冻结creation与pin校验完成；真实App接线另受领，U11完整目标继续开放。
- [x] **WPF-001-12** WPF-QUEUE00：最小boolean reader已5acc限定APPROVED/final498，false旧行为保持且不伪启完整队列；source字段已交root一次桥接ready与注册，Lead成套集成另计。
- [x] **WPF-001-13** WPF-PROFILEI01：2e4c限定APPROVED/finalc1dc，创建即锁/完整pin/未知回执/新草稿连接隔离已验证；管理scope/docs与实际看板目标一致，交Lead集成另计。
- [x] **WPF-001-14** WPF-DPERF01：5cd限定APPROVED/final4d7425，临时样本同target比较2→1、Git启动29→24，4新检查通过；关联旧registry计数失败明确保留，main接收另计。
- [x] **WPF-001-15** WPF-PROFILEUX01：紧凑摘要与原生details，固定55b/rootAPPROVED；60d8交付及本地链接/TODO通过，main14c61已接收，ef869记录后全六scoperelease。保持原公开Interface/权限/冻结语义。
- [x] **WPF-001-16** WPF-QUEUE01：已按固定14c61独立树与13scope正式受领，交付中心权威排队/暂停/继续/独立取消与真实键盘发送一致性；保持REQ44的回执、持久性、分页和跨连接验收，独审/集成另计。
- [x] **WPF-001-17** [WPF-RENDERER01](../wpf-renderer01-data-renderers/plan.md)：按固定fb906独立模块与八scope正式受领，交付确定性可信data-renderer注册和每provider隔离、按需详情的单一内建例子；App接线、完整X01生命周期另片，独审/主线另计。
- [x] **WPF-001-18** [WPF-K02C01](../wpf-k02-compatibility/plan.md)：原QUEUE已停写释放后，从已审3d4985新树取得八scope；仅消费Lead三contracts受控输入，完成project身份与旧cap/metadata薄兼容，不开放引用选择/发送，固定验证后独审。
- [x] **WPF-001-19** [WPF-ACTIVITY01](../wpf-activity01/plan.md)：按固定3d4985新独立树与八scope受领，复用真实TaskSummary与bound lazy events/detail交付执行活动独立模块；初始零请求、显式分页/刷新、身份与隐藏/连接寿命隔离，App接线另片，不把现reference伪作typed tool/thinking。
- [x] **WPF-001-20** [WPF-RENDERERI01](../wpf-renderer-i01-integration/plan.md)：消费已审renderer747并在115b独立树领取九scope接实际聊天；显式native-hidden可见性与display lease、真实按需详情、provider清理与原composer行为验证，完整X01/typedCHAT05另片。

- [x] **WPF-001-21** WPF-CHAT06C01：四scope独立a26树消费86fc单文件输入，仅兼容liveAssistantText缺省/boolean，身份与原回执/queue保持；不opt-in或启用增量正文，固定验证后独审/集成。
- [x] **WPF-001-22** WPF-ACTIVITYI01：同一U11/REQ43活动接线在固定86a独立树领取17scope，消费已main CHAT05真实typed工具/思考与generic fallback，P01统一message footer button/menu/panel、按需有界详情与生命周期；保留C01/61b/shared只读，完整CHAT06正文另片。

- [x] **WPF-001-23** WPF-ACTIVITYC01：独立86a树四scope兼容C02过滤页raw-scan游标，固定已过HTTP断言映射的contract fixture经真实61b reader验证，严格身份/排序/上界/reset/hasMore不放宽；独审后交Lead解锁发布，不混完整stream消费者。
- [x] **WPF-001-24** WPF-CHAT06S01：七新scope独立模块消费完整已审fa9的公开stream协议，严格patch校验、增量projection与纯message适配；隐藏/连接/attempt隔离，final仅按明确settlement，实际Thread接线在ActivityI交权后另领。
- [x] **WPF-001-25** WPF-PERF03：五scope独立30b树按不可变turn身份复用消息对象；同revision动态正文/来源/截断、历史排序与跨中心不误复用，真实installed core计数，不许宣称UI时延改善。

- [x] **WPF-001-26** WPF-CONTEXT01：固定b54九新scope独立知识引用选择模块；有限搜索/显式正文/完整citation身份/4项与byte预算/保序深冻/连接和readiness隔离，App与Send/Queue知识透传后继另领。

- [x] **WPF-001-27** WPF-CHAT06I01：完整已审6426基线领取十三scope接入增量正文；P01唯一启停/授权、当前turn有限读预算/连接可见性/单Thread语义/phase提示，实际App fixture验证。

- [x] **WPF-001-28** WPF-CONTEXT02（沿REQ42）：纯引用冻结/回执片，固定fc113八scope，5e8213/6cacc已审并入7106，66695c收口/b485 v2释放；[唯一canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-receipts/plans/wpf-context-receipts/status.md)。该receipt片main收口完成，Send projection与实际UI继续开放。
- [x] **WPF-001-29** WPF-CHATREAD01沿REQ43：527已审并入d7e，cd26404收口后c832 v2释放；[唯一canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-readability/plans/wpf-chat-readability/status.md)。
- [x] **WPF-001-30** D05FIT01四scope首次适配：0ac7已审并main9d6，0e52826收口且5dc v2释放；[canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-first-fit/plans/d05-first-fit/status.md)。
- [x] **WPF-001-31** WPF-STEER01沿REQ44独立控制模块：b2已审并入77c主线，01842收口后2bae v2释放，实际App另后继；[canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-control/plans/wpf-steering-control/status.md)。
- [x] **WPF-001-32** WPF-CONTEXTI01沿REQ42实际知识UI：d7e完整base，55fev1二十scope已开工；[canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-integration/plans/wpf-context-i01-integration/status.md)。
- [x] **WPF-001-33** WPF-DPERF02批量Git树证明与快照内重复工作：附件P1/已审发布及D06安全点之后，以独立临时Git/少量自有WT对16/64/128source做Trace2，先量process启动/峰值再墙时，总≤60秒含清理、证据≤32MiB；不压真实repo/4320。测后选快照内复用或已批准batch-tree，保2MiB/5s、完整record/缺失/unknown和每snapshot fresh dirty/claim，无TTL缓存假绿。无收益也保结果，合成128不当runner容量；沿FLOW-001原工程结果追溯，不新大task。详见[有界方案与结果](../../docs/evidence/web-platform/dperf02-proposal.json)；固定902c/aa715已独审并main da041三源一致；close8e9现remote一致/clean、1cb4 v2释放；推送失败/先release偏差见集中归档。此有界片完成，不延伸为生产稳定性能结论。

- [ ] **WPF-001-35** RS13既有首屏性能后继：固定RELEASE最终10:39:13.012/new artifact caa1e938的唯一loaded资源1,491,399B（旧1,426,477B，+64,922B），旧10条实为5个唯一asset；不把记录数/解码字节当网络压缩、TTI或收益。查实际index/modulepreload依赖图并按需延后chat chunk，联合测首屏资源/parse/可输入与首次开chat等待；同ExecutionLead/SVC唯一owner确认不可变URL与回滚保留，分别定义HTML/哈希asset/身份/API cache/encoding，保manifest完整，不全站cache或承诺立即撤销。已有artifact独立0模型冷暖/版本切换有界验证，个人服务不动；待关键路径安全后精确scope/fresh claim，不新大task。详见[RS13固定证据](../../docs/evidence/web-platform/research.md)。
- [x] **WPF-001-36** D01/DPERF既有工程看板fanout后继：CACHE/附件实际接线后，独立临时Git样本量化启动数/峰值，再决定同snapshot main观察复用或有界执行；GO静态139registry/133树×4=532构造调用不是实测峰值/CPU因果。保每snapshot dirty/claim新鲜、unknown/失败语义，不重做DPERF01/02去重与tree批量，不先跨snapshotcache、不压4320/真实repo、0模型；范围与预算另fresh受领。root只读1/4/8临时repo小样本4/16/32starts仅支撑启动量线性，区间峰4/3/4不当OS/CPU；另4task/1tinyrepo并发integrationProof为28starts，其中main dirty/untracked各4，提供同snapshot复用工作量依据，非生产峰值；候选同snapshot执行context/main观察一次复用需覆盖proof入口，不能仅限observeGit外层。详[准确研究归因](../../docs/evidence/web-platform/research.md)。原提案沿工程结果后继，不新增大task；随后实际领取与完成事实见本条末尾。 [只读第二意见](../../docs/evidence/web-platform/dperf03-readonly-proposal.json)提出六精确候选scope、每aggregate单context覆盖所有Git child及permit finally；captured HEAD/排队漂移保守unknown，不能混成原子观察；新增末尾HEAD核对后28→23初为算术预期，后来仅该隔离样本实测23。最终两方法Interface已root结构批准；临时Git≤45s含≥10s清理/≤8MiB。ATTACHI02首12实际派工后，DPERF03以eb95独立树fresh db0b7d25 v1六范围受领，12:14 v2仅加proof-snapshot分类helper为七scope，固定5609已root独立37/37批准/finalcc390，并main a8aef五源同；owner7cc5双端clean全停写后db0b v3释放；原23starts小样本/非原子限制见唯一证据，不泛化生产收益。

- [ ] **WPF-001-37** 显式页面版本与更新动作、保留用户展开状态的后继见[同一加载版本研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-client-update-research.json)，不自动reload。 跟踪既有D01的阻塞阅读后继：仅按当前有效且显式大task关系归组，组内逐条保留task/owner/原阻塞/详情来源，未知关系单列；不文本相似去重、不合成父状态、不增手填源。原DASHSUM01仅覆盖active/delivery前三去重，不能冒本验收完成。原D01合法owner后续fresh领取必要原六scope候选；先修本管理status用户摘要，当前新网页发布和已排视觉优先，详情见[同一后继记录](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-human-followup.json)。

## 验收、风险与持续方式

每轮只在其可验证条件满足时完成；持续总目标保持活动，新增用户要求/研究发现追加到本计划、排队并由明确owner实施。禁止为了持续工作堆无依据复杂度，也不能因“本批完成”就把无限优化声明完成。

风险：当前四槽全满；W01新依赖与旧build体积不可直接比较；多task观察生命周期、异步详情串任务、官方组件的默认键盘/自动滚动都可能退化。解决见研究台账与各子计划。

交付全量清单：完整SHA、branch/dirty、启动方式/URL、检查与scope、双主题截图、skills/clean-code记录、未验证、plan/status/review、共享变更及原Lead集成项。主仓库plans/README索引由原Lead维护，本树只给集成清单。

## 实质变更记录

- 2026-10-06：首版需求账本及后续三计划落盘；明确WPF-P01是X01子项，纠正早期14源/重复dashboard实现方案为主线17源/D03单owner；追加U07影响范围测试约束。

- 2026-10-06后续：root文档review绑定c075bb5 APPROVED；按主线请求细化WPF-REQ-32为BR-01定位/只读文件/日志/交互shell四项，交Lead接收，不改变当前W01冻结契约。

- 2026-10-06主线接口交接：M02完整e888862可消费，新增WPF-M02作为当前W01稳定后的下一ready功能；插件/性能保持队列，rootUI提案明确非用户原话。

- 2026-10-06 02:24 UTC：W01稳定可审cb4a392到位；panels完成复审后复用其owner正式派发WPF-M02独立新树，优先主线受控main，备用完整e888862合入已获主线授权。

- 主线准确base更新为108fddbd8261963f3d49088873b5a611b70a5dbf（完整C02+M02）；新树优先从此base合已审W01，已有树不重建/reset。W01整体review通过后复用owner实施WPF-P01可信host，安装临时lock例外由root/Lead明确确认，最终还原不提交。

- 主线D03新增人读status字段要求已登记REQ36并交各唯一owner，字段只作文档验证；主线因果修复已APPROVED并进入main8c57f2f，通知现有新树受控合入不reset。

## 多lead领取与转交规则（U08）

本轮用户再次强调与其他leads防overlap、take在dashboard标清楚，已对照U08完整原话和U12准确转述，仍归WPF-REQ-37，不新增平行需求。当前执行规则：每次开写先fresh D04按task/owner/worktree/branch与精确literal核冲突，收到COMMITTED receipt才可写；扩scope用当前version原子amend。唯一status继续承担进度事实，领取与release状态由账本聚合展示；owner完成正常push/双端clean并明确全scope停写后，管理fresh CAS release，原receipt进入集中证据。源缺失/陈旧或已释放不是默许抢写；跨lead共享路径必须明确交权。[固定main单一ledger展示链源码审查](../../docs/evidence/web-platform/dashboard-take-traceability-root-review.json)保留ID/version/owner/WT/branch/scope及unknown语义，不当实时部署验收。[18:45候选快照](../../docs/evidence/web-platform/web-current-claim-observation-1845.json)保留当时DPERF05 NOT_TAKEN事实；[最新18:49观察及原子回执](../../docs/evidence/web-platform/web-current-claim-observation-1849.json)记录DPERF05已COMMITTED并派工，其他active/RELEASED状态仍来自D04。未来开写仍查实时账本，不用历史快照授权。以下早期过渡记录仅解释历史，不覆盖当前规则。

以下仅早期交权历史：当时D04由原Execution Lead唯一承接。当前其明确委派的自有test lifecycle后继已由本管理者在原D04独立树fresh f61d v1五scope承接，不能扩至production ledger、D03或共享registry。过渡期新take和transfer先读dashboard、对应权威status与live Git确认占用，再由原Lead单点登记；缺失/陈旧/冲突不当空闲。记录领取/更新时间用当前实观登记，不能倒填开始。分配账本只存lead/owner/task/scope/claim/handoff，不存第二套TODO/check/review，后者仍owner status唯一。

M02当前精确范围必须排除P01独占plugins与plugin-host测试；P01不写App、TaskThread或既有workspace。稳定host提交后通过明确handoff/cherry-pick交M02挂载，需要改host则回原唯一owner或登记转交。不同worktree不意味着允许同一功能逻辑重复实施。dashboard本身是只读视图；主线D04新增PostgreSQL工程协调独立schema/DB与CLI take/list/release/handoff，实现事务task/父子路径冲突核验、version与双方handoff、receipt后开写且不自动过期抢占。既有M02/P01合法实施继续并迁移登记；展示冲突时保留依赖集成关系，不以不同worktree掩盖重复实现。

- 2026-10-06 02:41 UTC：两owner精确literal范围已收齐并回报原Goal Owner/Lead，登记时间不倒填；迁移输入见integration-checklist，D04 receipt与展示尚待交付。

- 2026-10-06 02:50 UTC：M02 d47固定候选进入独立review，P01模块PH-R1/R2修到3d812获scoped approval；新增WPF-I01独立主App挂载三件套，root同意新树与精确claim，既有两owner不扩写未登记路径。

- 2026-10-06 03:13 UTC：持久化经原Goal Owner逐字转交U09，追加REQ38产品预览保留与REQ39架构tab；前者最终选择既有M02 49922并保留用户tab/服务，I0155049仅开发fixture，后者主线唯一owner承接，我队不重复实现。

- 2026-10-06 03:19 UTC：U10逐字转交“plugin管理写进计划里”已新增REQ40；主线[X01 canonical](../x01-plugin-management/plan.md)已只读核验888308d文档，我队只关联已获授权Web前置，不重复实现完整生命周期。

- 2026-10-06 03:23 UTC：只读核主线X01 canonical888308d clean和D05 canonical dirty实施中，REQ39/40补真实路径；不代其给approval或重复产品实现。

当前独立轮：[WPF-PERF02有界Activity](performance-optimization/plan.md)，依据PERF三规模实际数据，已完成停写、逐文件amend/take与canonical转交；固定a87f64f/报告d891已APPROVED、最终172d交主线集成。原准备暂停和后续授权恢复时序保留，不改CHAT App。

- 2026-10-06 03:25 UTC：U11准确摘要及REQ41～45已完整持久化；真实持续对话优先。PERF02只有准备93889c3，无新tree/amend/take/生产写入；原probe停写意向保留但claim仍v1。I01继续现有交付收尾，49922原fixture不暗换。

- 2026-10-06 03:32 UTC：原Goal Owner明确U11已固定/合同未ready时允许八scope PERF02并行；实际03:30两次CAS amend后新take d36v1，旧M02 v3/PERF01 v2。I01独立APPROVED92a，b584 clean且实现停写，候选CHAT前端待合同/正式交接。新增Mika队2活跃，主线4+本队最多4总10；其B01后台snapshot/events/feed字节/长历史性能和下一X02插件中心工作不由本队重复。

- 2026-10-06 03:35 UTC：CHAT首合同4c240已固定、后台未全部ready；真实对话作为默认首页/可编辑composer，Work overview仅rail。I01 v2移App/官方Thread/两个消息身份桥接文件→CHAT新08259c1d v1/16literal范围已正式受领，canonical初始化中。首capqueue/steer/liveAssistantText/per-turn controls=false，后继REQ41～45不因此关闭；正文只adapter-final来源、requested/effective分开。

- 2026-10-06 03:44 UTC：刷新当前claim/队列/已交付事实；X02固定4054中心registry只读兼容研究进入REQ40依赖。root转中心2d3bb61独审通过及主线main ac4e34d，真实模型最终验收归主Lead，Web不重复调用或提前宣布通过。

- 2026-10-06 03:47 UTC：主线registry39源已实际核CHAT/PERF02唯一live来源/claim/worker一致、unregistered空；19activewriterclaims literal零重叠。PERF02唯一缺分支字段由owner修，来源注册不代表review通过。

- 2026-10-06 03:50 UTC：PERF02 a87独立APPROVED、最终172d clean且实现diff0；03:49实际dashboard检查/review/proof/字段全闭环，主线集成待执行。原worker转固定版本ACK语义只读调查，CHAT仍唯一实现owner，不扩scope。

- 2026-10-06 04:02 UTC：主Lead确认8f1481d实际push clean；rootorigin/main ancestor核与管理04:01:56 dashboard main current/scopeEqual实证吻合。完成有限基线+窗口两轮TODO06，持续优化愿望不宣称结束。

- 2026-10-06 04:08 UTC：U12准确转述重申映射既有REQ37（逐字原文见U08）；独立CUA实际领取详情和42源/当前21writerclaims literal0overlap留时点证据，新增X03待登记如实显示。D05架构刷新8f只排队、待正式移交；CHAT优先收固定7cb复审闭环。

- 2026-10-06 04:20 UTC：CHAT7cb最终331已限定APPROVED并dashboard验证，root一次交主线；PERF02集成后04:12正式release v2，无finding不长期占scope。REQ39后继D06按D05v2移出→新f619v1受领固定8f四scope，唯一canonical见[计划](../d06-architecture-refresh/plan.md)。主线4320继续其owner部署，不新造分配事实源。

U11当前queue工程验收以固定main `14c61b4062f8040ba6c7239860929366e5bd3fc1` 公共合同与[QUEUE01 canonical](../wpf-queue01-ui/plan.md)为准：pause受理或历史ACK重放后fresh GET最新paused/currentTurn，只有用户明确的单独动作才取消所观察的active task；暂停和取消保留不同receipt/结果，不能按旧ACK自动取消。same queueRevision仍接受新的taskStatus/blocked/paused；immutable ACK不回退较新GET。中心持久等待队列和本地未知命令receipt是不同生命周期，本片同页面重连原key保留；原key跨reload/换连接恢复后继pending。steering仍另项开放，SDK能力不等已接实现。

历史决策（e423首合同至v2冻结前）：e423确实无pause/continue；当时提议先pause ACK再按其currentTurn取消、v2待固定。这一早期提议已被当前fresh GET+用户单独取消规则取代，不再作为实现验收。完整[队列研究与变更](../../docs/evidence/web-platform/chat-queue-research.md)保存历史来源、UTF8限制、分页/journal及assistant-ui适配边界。

CHAT04 Web接缝研究补充：assistant-ui实装queue adapter会接管普通tail发送，运行中默认steer，且Interface同时暴露move/edit/remove；不能以dummy回调伪造未支持能力。未来queue-only显式入口或严格adapter需合同冻结后独立验收，durable ACK/unknown与库草稿/队列items分离。此为工程研究约束，不是新实现或主计划完成。

04:22 WPF-X03I01正式排队：MainLead授权真实两query期间固定main，结束后合X03/D06给含CHAT+X03准确base。worker=workspace_panels_owner，tree/branch拟web-plugin-management-integration/codex/web-plugin-management-integration；当前未创建、不从moving ref启动。owner完成CHAT主线metadata083978b318ede4bb1cabb5050f8d211b17bb9055 clean并明确三旧文件停写。管理04:21:43 live核身份/版本，04:22:08.820Z CHAT v1→v2移App/react，04:22:12.797Z I01 v2→v3移integration.css，原其余范围完整保留。新take待准确base/真实tree，任何冲突停协调，不能旧树恢复或新claim前写。七scope：App.tsx、plugin-integration/react.tsx、integration.css，两专用plugin-management-integration fixture/browser测试、plans/wpf-x03-plugin-integration、docs/evidence/wpf-x03。不改Mika模块/共享API，折叠展开才读registry，连接epoch/键盘回焦点/registry与本地extension区分必须验证。

U11/REQ41模型与权限选择候选：已有中心executionProfiles只表示runner配置声明、未探测可用性，不是任意模型目录。未来首draft选择整profile并在create锁定，follow-up沿pin；thinking fixed-disabled、effort unsupported等不能做伪选择。固定dd1只读研究与ACK/跨连接验收已归[证据](../../docs/evidence/web-platform/execution-profiles-research.md)，尚无新take/实现，不抢X03接线scope。

04:34 当前轮：X03I01七scope已正式开工；PROFILE01根据GoalOwner新切分只创建独立选择模块、pure pin helpers/局部tests与自身三件套，不转交现ConversationThread/projection/outbox/App。04:33 live ledger可读、拟9scope无literal冲突，等待新树实际核验后原子take。REQ44已更新PG pause/continue新决定，保留旧e423历史，不新增queue writer。

04:36:37.979Z PROFILE01新take已committed，claim17093c4c-a8fa-4e43-bc72-6bd54cab0795 v1，管理者独立核fixed4e/branch/clean后领取，原样[receipt](../../docs/evidence/web-platform/profile01-take-receipt.json)。精确9scope与X03无重叠，已派w01先唯一canonical后模块实施；未改旧CHAT/App/共享接口，0模型。


04:39 U11首连验收候选（GoalOwner/root观察，非新已实现能力）：SVC01真实Web http://127.0.0.1:61228 / center61227，由其owner保持服务；GoalOwner页面只预填center、尚未首次认证，0任务/模型。不能把“服务已运行”写成“可直接聊天”。root只读研究最小连接说明与安全本机取凭据流程，交Lead/SVC唯一owner；不塞token URL/localStorage、不弱鉴权、不抢X03 Appscope，当前PROFILE/queue优先。此接线候选未take，真实SVC与旧预览均不由本队重启替换。

04:40 X03I01最终4b7e0f6553025ba1dbb93e7e3c2b82a9958b92e3 clean，84acdcaaa9687a4ca75ebdb40a6efc7e5539029a获root限定APPROVED。管理6md/39links/4TODO、保护范围和实现diff0通过；全metadata diffcheck仅两原始log空白例外保留，不清洗证据。PROFILE01 canonical ae47c8a1f8feb7b0dec71435e868c3a262c53d06 已给root桥Lead注册，独立模块实施继续。

04:41 首连研究固定75a33dec228e17bbbd0d3be9fd01bc9ac18a0133：现URL留空可走本机/api代理，onConnect不等认证；未来表单说明候选与SVC owner显式本机copy-owner-token工具候选已记[研究](../../docs/evidence/web-platform/research.md)，无读真实凭据/剪贴板/实现，不扩X03或PROFILE scope。


04:42 CHAT04发布顺序已确认有消费不兼容：当前已审Web assertCapabilities只接受queue=false，后台true会使会话snapshot失败。root已交MainLead成套部署门槛，保持旧false兼容；等后台独审/Lead client固定输入和最小Web迁移scope，先不改按钮或shared。PROFILE独立模块并行不受影响；后继PROFILE App接线与queue同需旧CHAT Thread/projection正式移交，按ready输入串行，不因同owner跳过新tree/claim。候选具体scope与验收见[配置研究](../../docs/evidence/web-platform/execution-profiles-research.md)和[队列研究](../../docs/evidence/web-platform/chat-queue-research.md)。


04:42 GoalOwner与MainLead明确授权 WPF-QUEUE00 最小reader先行，PROFILE App接线排其后、PROFILE模块照常。拟独立web-queue-compatibility/codex/web-queue-compatibility，从明确固定75a33dec228e17bbbd0d3be9fd01bc9ac18a0133（或Lead后给精确base）初始化；仅projection/直接tests/必要HTTPfixture与自有plan-evidence，等owner精确scope与旧CHATv2停写后CAS，新take后才写。MainLead承诺不先启用queue=true，按reader→contract/domain→mount成套验证。Mika最终域implae9d7203c30bdf5ec6825cee0e6ce86231c34cb2 / metaaef5c6fcd3d811673e8eeb8cd67f225ba0941b8e据其root已独审54项；这里只转交来源，不当本队重跑或Web/生产接线通过。合同沿79867且queue拓宽boolean。

04:43:26.665Z CHAT v2→v3原子移出projection.ts/conversation-projection.test.ts，其他12scope未变；04:43:35.187Z QUEUE00 claim13185d8f-fcc4-453b-9ff1-4e4ca38f0666 v1正式take四scope，fixed75a新树实核clean后开工，[receipt](../../docs/evidence/web-platform/queue00-take-receipt.json)。Lead确认X03 main80e已push/clean，旧owner仅metadata一次核main再release，服务59473不动；PROFILE候选b2b七源码限定范围已审无越界，产品review由root进行。

04:47 X03旧owner提交05b92d30c953413ab66d8b69447c9b44c9121a6a记录main80e集成，正式a104 v2 released，七scope全停写；原receipt与后继研究保留。QUEUE00固定5acc/metadataafd已交root独审，最小读取兼容不等完整queue命令UI，注册待Lead通知。PROFILE候选a28仅补测试、4生产文件不变，等待整体结论。

04:49 PROFILE新正式02683合同引入goal-tools，按GoalOwner新要求在原九scope做DirectoryProfile只读目录与聊天Selection分离：goal-tools/unknown条目可见禁选，不阻同页合法项，显式聊天allowlist与非mode严格校验；旧a28批准不扩到新schema。QUEUE00 5acc已独审、final498只读scope/docs通过，优先交Lead，不等PROFILE。后继PROFILE App接线在完整queue UI之前，旧projection/Thread必须新claim串行转交；public client83f7/400ae完整输入仍待独审和准确base，不并入QUEUE00。

04:55 PROFILE最终模块4f1985769564eafad9218570411d5ce1114b4ec0/rootAPPROVED、metadatae7303b9aa4d666d6d694a1a60659db71431e43dc clean；管理20path/9scope、7实现零差、6md20links4TODO通过，读取作者04:53实际review.state=approved/target4f/双proof unchanged/claim匹配。QUEUE00 ready已root一次桥Lead，不重复通知；后继PROFILEI01→完整queue UI串行受领。queue只读设计发现running且无adapter时内置Enter直接return，单改sendLabel/onNew不能保证一致，需先核最小官方Thread受控输入接缝和精确scope，不能伪造isRunning或adapter。

04:56 GoalOwner现场看板反馈：人类摘要必须直接说实际能力/下一交付，不堆任务编号、SHA、schema或测试缩写。已将本status改为“插件入口已接入；聊天执行选项已验证，排队兼容已交付”/“把执行选项接到聊天界面，再开放排队操作”；技术target/claim/测试保留独立技术字段与下钻。已通知未释放的两owner按同法纯metadata更新；不重新写X03/D06已released记录，不跑工程测试。本约束属于现有用户可读看板要求的具体反馈，不新建重复需求。

04:57 GoalOwner明确授权既有U11/SVC首连帮助候选的小文案范围，沿原需求不新编号：空地址的本地含义、管理员远端地址、owner token用途/安全取得路径；原App唯一owner后续精确take，0query验证，无secret展示/自动复制/匿名接口/新服务。排现PROFILEI01/queue文件窗口，不阻当前交付。D07同snapshot proof复用获root准备指令，由已交PROFILE的w01复用槽只读设计；正式新tree/take尚未执行，当前仅候选，不以工具三次波动作为性能结果。

05:00 两新片正式受领：MainLead明确发布698ffcd94ae073b23bcc67f6665fb19f707a93e4含QUEUE00/CHAT04/client/PROFILE，管理git ls-remote独立核同SHA。QUEUE00与PROFILE各owner先主线纯metadata（d10b4b0/7f10889）再全scope停写release；CHATv3→v4仅移出Thread/outbox/outbox-test3文件，保留9。PROFILEI01新698树核clean后take7f1daa29 v1于04:59:25.825Z，10scope精确无冲突。性能小片正式身份WPF-DPERF01，旧研究临时代称D07保留历史映射，主线D07另做人类摘要筛选不能重号；新698树takebb7ef22f v1于04:59:56.342Z仅aggregate/直接test/plan/evidence4scope，无旧占用不需amend。两owner先canonical/source再实现，未有成品/审批，不动常驻61227的75a构建。

05:01 REQ37现场追溯补证：root独立CUA在04:59:56同步的4320页面看见两新任务领取状态及owner/lead/worktree/branch，处于“已领取，进度来源待登记”，并确认本父人类摘要已可直接阅读。领取展示与进度源注册分开；等两个canonical首SHA齐后一次交Lead登记，不另手填状态。

05:06 MainLead新增status可选字段“本片段交付阶段”，枚举planning/implementation/review/integration/delivered。该字段仍由唯一status owner手填：作者实现完成待独审为review、独审通过待main为integration、main接收为delivered；它描述当前片段，不要求把后继开放TODO全勾，也不替代checks/review/main证据。已通知两活跃owner安全点维护。D07 claim84f80ac0v1只负责human.mjs/其新test/资料，与我方DPERF aggregate四scope无重叠。

05:10 root CUA22在真实App HTTPfixture51832看到locked配置块约250px、UUID/digest常显挤压对话；这是实际观察触发的有限UX改善，不新增全栈插件/模型功能。新WPF-PROFILEUX01从698已核clean，旧PROFILE17093v2released、六scope无冲突，[05:10:12.187Z正式take](../../docs/evidence/web-platform/profileux01-take-receipt.json) d113be51v1，w01仅模块TSX/CSS/两fixturetests/自有plan-evidence。原生details默认折叠、摘要仍解释requested不等实际生效，Interface/catalog/selection/权限/CREATE冻结零变；不碰PROFILEI01八实现路径，独立动态服务与0模型验证。

05:19 已审PROFILEI01与PROFILEUX在main14c61受控合入，摘要/草稿组合typecheck由Lead完成，未推断真实SVC已升级。后继QUEUE01正式从固定14c61独立树受领，旧PROFILEI01停写release与旧CHAT官方Thread逐路径CAS先于take；先前13scope研究和原REQ44验收保留，不另造队列权威协议。

05:20 QUEUE01移交已执行：PROFILEI01全十scope release v2，旧CHAT officialThread明确停写后v4→v5 CAS，仅移出一文件，freshledger无其他相交；新b4ea85d0v1/13scope成功take后才派实现。独立canonical plans/wpf-queue01-ui由唯一owner建立，父目录不复制其TODO/check/review。

05:25 计划质量修复：root只读发现REQ44及无历史标题的U11段仍描述早期“按pause ACK currentTurn取消/v2待冻结”，与已固定合同和当前防旧ACK竞态规则矛盾。已更新当前验收为fresh GET后用户单独取消、两receipt分开/sameRevision动态事实，并把旧e423/v2提议明确标历史被取代；用户原话未改，0产品变更/测试。

05:33 U11/REQ42 context后继依赖预警（GoalOwner转Mika，非固定合同）：获批设计K02拟为conversation/queue增加optional immutable projectId及固定KnowledgeCitation context≤4/8KiB，目前未take/未freeze。等待正式exactSHA后才定reader/receipt兼容与用户选择UI，现QUEUE01/D06优先，不开放context按钮、不造私有ref。公共task/turn/queue/SSE初始数据不带引用正文，正文仅授权claim执行副本或按需detail。当前未实证回执失败，不能列现存bug。

05:42 当前状态文案质量finding闭合：root指出父status无历史限定的“当前按钮不变”已过时，已改为e423旧研究历史与QUEUE01固定309已审分支/待主线部署边界。05:37未固定、05:40固定通过按实际先后保留，不反写旧观察。K02在05:40:26.108Z freshledger已active（后台/shared），上段05:33未take仅该时点事实；仍须正式固定合同/批准后消费，不据领取开启context UI。

05:43 GoalOwner/root正式批准现有renderer候选独立模块实施，沿WPF-001-05/原插件需求细分：固定fb906，仅3新源码+3专测+自己plan/evidence八scope；不是App接线或X01安装/启停/赋权新权威。先独立web-data-renderers树preflight、freshledger与原子take，再派写；此时仍无新receipt。K02首DTO字段按上列固定1eef记录，产品未ready时不让移动共享schema挤占QUEUE已审交付。

05:49 K02薄reader进入下一关键路径准备：固定7368497ade6b80725e024d86541b87c971389476已实际把projectId/knowledge/knowledgeContext/context加到公开类型，详情/发送/claim首片已实装、queue/retry未完且整体未审。消费范围仍两生产+四test+plan/evidence，不拿整未审K02当Web基线；等Lead给含QUEUE01已审代码及受控schema的精确base，再核旧QUEUE停写/CAS amend/新take。同聊天tool/thinking与真实过程反馈优先级按上表REQ43更新，沿U11原剩余ID，不增加装饰片或调走renderer。

05:51 QUEUE309/D065ec正式main3d4985回执已到并由管理独立核精确实现范围；WPF-001-16本片交付完成，原REQ44跨reload原key/steer后继不勾。K02薄compat准确base同3d4985，唯一共享owner仅授权三contracts patch消费，原QUEUE释放与新八scope take仍须实际receipt。共享domain未整体审定、0context UI，renderer仍独立正常。

05:59 U11/REQ43后继界面整合观察（GO现场截图，经root转述；非当前验收失败）：[synthetic窄屏截图](../../docs/evidence/f01/queue-live-preflight/second-reply-dark-narrow.png)中两处Execution details、执行配置/legacy文字、Continue this conversation及技术说明挤压聊天高度。后继设计合为单一折叠执行入口，默认保留需用户选择的model/access/queue状态；unsupported/未知回执仍明确，fixture标识简短保留。该观察归原需求，不新建重复任务、不改当前两候选scope。

CHAT05 typed活动初interface已固定ae4cc5c630b88616fe75c72eff9fc276a9f84f6c；这是REQ43后继依赖，task轻metadata与lazy detail、phase/工具status分开，partial未含。PG/adapter/client/index未全部冻结前不作ready公共输入；当前K02/renderer交付不扩大到typed活动渲染。

06:04 原REQ43下独立活动模块获root/GO正式P1授权，准确base3d4985不依赖CHAT05/renderer/K02新shared；新treepreflight后freshledger八scope空闲，committed take51f962ee v1再followup实施。唯一canonical由workspace_panels_owner在web-conversation-activity维护，父文只追溯原需求和handoff，不复制新module进度。

06:07 GO经root给真实queue验收结果：窗口06:02结束、2/2 query封存；GO核原结果、两实际图和固定manifest，running入队、显式Continue、browser退出仍running及精确第二回复通过。该部分归REQ44真实旅程验收，不替代跨reload未知原key/steer后继；本队未执行模型。main冻结解除，接线仅等待Lead组合后准确base。

06:09 U11/REQ43新增真实截图证据（root人工目视，管理仅核manifest字段/文件hash）：[真实两轮窄屏图](../../docs/evidence/f01/queue-live/second-reply-dark-narrow.png)与05:59的synthetic preflight分开；manifest观测06:04:30.199828Z，web3d4985/centerRunnerfb906/caller0695bae，budget CLOSED 2/2。图中真实中文两轮可见，底部0 waiting loaded、两处Execution details、配置/legacy/禁用控件及长footer叠加，root估计约占底部三分之一。功能验收仍通过，不升为失败或输入延迟结论。后继沿既定顺序先真实聊天/折叠详情，再单一外层execution disclosure收拢；保留model/access/queue主要项和unsupported/未知回执，技术限定置可达详情；同390×844/键盘验收，unknown不当actual。见[归属与固定证据](../../docs/evidence/web-platform/queue-live-ux-observation.json)，不新建重复任务/模型调用。

CHAT05后继正文边界：超64KiB仅prefix+full原文digest，完整超限正文不提供恢复；截断JSON明确文本fallback，parse失败不当provider失败，不扩blob。当前generic活动detail上限1MiB独立；以未来冻结接口分别验收，不能互相覆盖。

2026-10-06 后继合同输入：[CHAT05P01 fixed7d075/Web60ca只读消费研究](../../docs/evidence/web-platform/chat05p01-web-consumer-intake/report.md)沿原 CHAT05P01-06 与 WPF-REQ-04/10/11/12。仅未来兼容新材料提供 task/attempt/activity/body-bound descriptor/chunks；旧prefix缺失尾部仍不可恢复。后继须经正式公共client/codec、按需有界共享reader与真实Terminal/body-tab接线，验证分片/完整摘要及跨chunk UTF8，保授权代际、字面正文、partial/legacy与tool状态区分。三项是原验收细化，不新增task/claim，不对domain/PG/mount作批准，也不阻塞backend准备。

## 跨Lead沟通节奏（本轮GO约定）

对外消息合并，只在四类实质变化发送：接口需要动作、实际阻断、固定candidate已可独立review、主线接收/准确集成输入。纯metadata dirty→clean和同事实确认保留唯一canonical，合并到下一实质回执；长SHA/scope清单放证据文件，不逐条刷外部消息。既已发送的来源登记/approval不反复催集成。真实queue验收只消费固定证据，不重跑求新时间；新部署/输入变化后按必要范围一次验证。此节仅降低沟通重复，不降低状态唯一源、固定review与正式领取要求，也不把未回执的main/部署猜成完成。

06:22 管理验收更新：ACTIVITY01固定61b模块已由root06:17:33Z独立批准，finalb024 clean与本地parser/proof审计通过，后继真实App接线仍开放。renderer App接线方案现为原八scope加App.tsx可见性窄传递，共九scope；固定3d聊天native hidden不触发React.Activity cleanup，原八scope假设保留为历史纠正。准确含747基线与freshledger/CAS/take前不写，现ledger唯一待转为CHAT session.ts。U11 typed Tool/Reasoning后继仍依据真实phase/unknown、授权懒详情与provider证据，不以通用组件默认状态伪造运行/完成或耗时。

06:25 main115b完整输入已到且独立祖先/六path核验通过，K02薄reader本片completed，原需求context选择/发送不勾完。Renderer模块也已含，App接线不再等base；九scope在原owner停写/CHAT v6移出session后从115b独立新树受领，具体receipt后记录。

06:26 root授权rendererI真实App消费，独立115b树完成preflight并取得ff62150f v1九scope，实际native-hidden方案与RS08窄converter验证沿既有REQ43/插件目标，不增加产品需求。D06原唯一ID下一固定115b刷新由panels准备四scope，旧source只读，新receipt+canonical后迁移registry；不追movingmain或把个人servicefb906等同图基线。

06:29 ACTIVITY61b已在mainacfd，独立六scope同源核验与owner delivered/release51f v2齐，父本片completed；App折叠活动入口仍为REQ43后继开放。rendererI与D06115b新轮均已take并首canonical登记请求，未将领取等同已部署进度卡。

06:38 原U11/REQ43兼容验收约束更新（GO/root）：前端应可替换、独立更新。本次liveAssistantText literal false迁移只能与最小reader和实际消费者验收后启用，不单独后台flip true；旧false/正式定义的缺省语义保留。身份/授权/正文合同错误继续拒绝；未消费的新可选能力广告不应破坏已有正文/queue，只禁相应控制，广告不等执行许可。source/wire/semantic兼容与字段缺省需分别定义，不能泛化undefined即支持；本片只改liveAssistantText，其他flag策略另有界后继。最小reader候选WPF-CHAT06C01限projection+直接test+自有资料，当前仅准备，无新tree/take，等待固定共享input与D06停写。CHAT06当前DTO749b含显式settlement，旧53e只留历史，不在rendererI/D06当前范围实施。

06:45 当前兼容决定覆盖06:38准备态：GO确认CREATE ACK及同key重放永远保留原receipt、显式liveAssistantText:false；GET snapshot只按X-Flow-Assistant-Stream: patch-v1连接协议协商，未协商/未知false，中心mount与消费门槛满足才true，不与lastTurn已有patch绑定、不保证provider delta。C01已获准确basea26与单文件shared86fc、四scope ca26v1后正式实施，仅接受optional boolean，不发送opt-in或自动读取正文。后继真正消费者仍等rendererI正式交权与冻结client/表示；旧Web兼容不能只靠新版JS上线。

GO管理审计规则：active claim按实际开发/持续管理、冻结待审/集成、已main待原owner收口分别列，历史数量不当agent并发。需固定祖先+保留scope+权威status事实后由原owner核尚有无写入、metadata停点、fresh版本release；不强制revoke，也不因历史基线状态过时恢复已转交路径。

06:49 GO更新既有U11活动接线优先级：同一WPF-ACTIVITYI01须同时消费已main CHAT05 typed工具/真实thinking，不能仅generic61b；不扩大为CHAT06流正文。准确base候选86a36eaeffbf09f0a3772c3d1509c17dc0a76f92，rendererI已released；原13scope未take，等窄typed接口/scope明确再fresh领取。实际provider证据、轻metadata/展开64KiB prefix、unknown/截断语义与真实水位合并是验收约束，不造thinking/耗时或每消息poll。

06:54 再次遵循U12对用户U08的准确转述重申“take工作在dashboard标清、跨lead防overlap”：每个新片先向现D04原子账本登记唯一owner/Lead、分支/工作树与精确literal范围，再交唯一canonical给Lead注册；已领取但来源未部署如实展示，不能把receipt当完整进度卡，不另写平行账本。ActivityI17scope fresh06:53:53.277Z无交叉（特别不含C01的conversations/projection.ts），122210f6 v1已committed。后继source部署收到后由manager唯一采样；其它Lead协调沿既有GO桥接及四类实质变化，不重复派工。

06:59 GO关键路径调整仍归U11/REQ43：panels优先兼容旧61b活动reader的C02 filtered-page raw-scan cursor，先于新stream消费者模块。Lead已固定公开语义允许无returned entries仍扫描推进、hasMore基于watermark；保留task身份/entry递增且<=nextCursor/nextCursor<=watermark/reset/after护栏。唯一管理已桥请求C02 owner固定实现与真实HTTP样本/准确base，来源未齐不猜协议/不先写；旧51f released、当前ActivityI17scope不含旧reader。新片只production projection+直接test+自有plan/evidence，精确命名待提案。

07:01 上条等待输入已解除：Lead固定C02 77f0/d9a/309be语义并接受contract fixture（非raw capture），root精确base86a；WPF-ACTIVITYC01四scope新树preflight/freshledger无冲突，5896b272 v1 committed后panels实施，source首交后登记。完整stream七scope下一ready输入已由Lead给ba908a2d84a05b336d74fbaccd7a36d3d254c501 + 5ff assistant-stream.ts精确文件 + 已审88a四filecommit；本片固定交付后再新tree/take，不让同owner同时两片写入。任何共享冲突交Lead，不整merge。


07:10 当前执行更新：C01/ACTIVITYC01已审且管理独核main fa9实现相同；ActivityI e930候选独审中。完整stream模块从旧ba908空树按明确授权ff-only推进fa9，七scope正式take d94ae4bb v1，先前5ff单DTO/88四文件输入方案保留为历史、当前无需再apply。其plan/status/review是独立唯一源，本父项只追溯U11/REQ43。用户U08/U12多Lead协作及take dashboard要求继续通过fresh literal冲突检查、committed receipt、首canonical一次SOURCE_READY落实，不另造第二进度账。真实模型与个人服务仍不由本队调用或重启。


07:21 U11/REQ43后继范围明确：stream实际App接线复用P01唯一host的独立trusted flow.assistant-stream生命周期，禁用零stream读取/旧响应失效且保留草稿退canonical，重新启用按有界缓存恢复。十三literal仅proposal，等已审模块+ActivityI main/release后精确take，conversations/messages.ts不占。GO新fixture验收后要求将稳定配置与协议长说明收进执行详情/帮助，需选择/失败才常显；input-ready/unknown不掩盖、身份/bytes二级。排在stream接线之后另领范围，沿现REQ不新建重复需求。


07:23 main接收闭环：ActivityI已审ba341/c9在253b主线17paths相同；owner只mainmetadata至9aa35096并全停写，manager fresh CAS release122 v2。原树只读，51454保持。w01转PERF03已初始化30b独立树，messages.ts对253b零差，五scope fresh take2ec58v1；后继stream App只读调用conversationMessages，不与该优化抢文件。原RS08计数研究现转有界验证，不新增性能目标或模型实验。


07:28 S01固定3ac/final63b已独立批准并一次交Lead，后继App方向获root明确批准；仍先等准确组合main/newtree/fresh13scope take，不先并行写。后继宿主只给active/待结算turn后台读权限；历史展示缓存有界、淘汰和用户按需恢复须明确，不能Thread.map全历史启动投影或恢复可见时全量刷新。

管理发布补漏（2026-10-06）：GO指出main旧副本缺后续需求，按唯一canonical原两目录生成固定发布快照，独审后由Lead同步；不是第二手填进度。原U11/SVC首连帮助授权亦在CHAT06I01现App范围内补极小文案：空中心地址为same-origin /api，远端填管理员地址；owner token来自中心管理员或本机受保护配置，不是Claude/Pi token。沿apps/web/README与personal-preview现有status --directory文档，agent不读取/显示/复制真实凭据，不新认证机制。低影响文案随接线验证。

U11布局后继继续排在stream接线之后：目前FrozenConfiguration常驻heading/summary/details三行，composerHeader还有Thinking/Tools/发送意图及footer协议说明；稳定requested/locked/permission/digest归一个可达details/help，只model/access摘要、可操作delivery和失败/unknown常显。保留创建前选择、创建后锁定原因、unknown原身份重试；该明确后继不扩当前13scope或CONTEXT01。

- [x] **WPF-001-34** 六大task计划与dashboard可见请求：四Web大task三件套、Mika02/04唯一链接、当前worker父关联和真实页面展示齐后集中验收；[唯一登记队列](../../docs/evidence/web-platform/mature-task-handoff.md)。本项是管理请求，不是第三执行层或六featureDone。

RS13既有首屏后继已补RELEASE最终artifact唯一asset字节与静态host cache/编码候选，[固定研究](../../docs/evidence/web-platform/research.md)区分解码字节/TTI、同URL不变与回滚，优先ACK/附件/实际发布，不新大task或擅改SVC。

GO首屏需求执行（11:44）：工程dashboard当前与下一交付应优先不同大task，子片从对应父下钻，长技术owner放详情；仅D08已确认显式关系，不猜层级、不合成父进度/Done，子blocker/decision和unknown始终可达。原D01直接父的WPF-DASHSUM01由w01在独立dashboard-human-summary/fixed2c6df取fe63511a v1六scope实施，registry/parser/aggregate不写；[明确Interface/预算与原始查重](../../docs/evidence/web-platform/dashboard-summary-proposal.json)。root结构批准、独审NOT_STARTED，90秒含10清理/8MiB临时浏览器；不抢CACHE/附件App或混DPERF候选。

原WPF-001-09的MATURE04-05依赖更新：main362已有contextHistory/owner GET/DTO公共输入，后续完整Web历史估算消费者待排程，无需再等contract；只读[current输入与语义](../../docs/evidence/web-platform/context-history-web-input.json)，原04大plan仍Mika唯一。保持unknown/null/权限与历史估算边界，真实detail按需；ATTACHI当前App窗口优先，不借此领取共享范围。

最新调度：附件贯通与已审dashboard安全点后，原MATURE06-04连接/刷新/未决发送恢复完整旅程优先Arc/装饰，沿既有10:24验收；[原指令与共享接口队列](../../docs/evidence/web-platform/connection-recovery-priority.md)。Arc保持未领，认证与发送恢复独立Module/Interface、中心权威、不因重新认证自动重投，0provider且个人服务不动。

历史U08/REQ37对照（D06 fixedaeb批）：用户最新重申“其他 agent leads…不要 overlap；take 工作最好也在 dashboard 标清楚”，沿已有规则与唯一D04账本，不新手填状态源。D06原树四literal fresh6cad30a2 v1，实际receipt与唯一source见[集中入口](../../docs/evidence/web-platform/mature-task-handoff.md)；领取、source登记、已审target、main和部署分别表达，释放也保持可读。

D01/DPERF原WPF-001-36后继（2026-10-06）：GO单次实读首页snapshot为156任务/1,879,706bytes/8545ms/no-store，不是p95/CPU/容量基线。用户结果是尽快可读摘要与按需详情/核验，正常刷新不反复阻塞首页；失败保上次内容、原时间与错误。优先级低于Recovery和可用预览、高于装饰。保持唯一status、作者声明/现场核验区别、fresh/stale/unknown、所有task/claim可达；claim授权仍实时PG原子take。root固定7源只读[结构候选](../../docs/evidence/web-platform/dashboard-summary-readonly-design/report.md)建议保完整snapshot兼容、摘要与单task详细proof分离、client刷新guard/旧详情丢弃，不做HEAD-only跨轮green缓存。已交DPERF01–03保持原完成范围，此后继尚无implementationclaim/实验，不新增通用负载观测框架、不重复4320GET。[单次原观察归因](../../docs/evidence/web-platform/dperf-home-summary-followup.json)。

DPERF同一后继已收敛为[WPF-DPERF04九literal候选](../../docs/evidence/web-platform/dperf04-summary-detail-proposal.json)：子task直接D01，w01拟唯一owner；状态摘要sourceCurrent与现场proof分开，保完整snapshot、单task按需核验与PG独立观察，失效/旧响应不得假fresh。Node内置≤30s含5s收尾，实际UI另≤60s含15s清理且待资源；源码44files/667441B估计，不当物理峰值。只读九scope当时无冲突；root已结构批准，SOURCE_REQUEST交Lead唯一Gitowner串行≤20MiB源码sparse预检/provision，之后fresh九scope COMMITTED才写，该提案时尚无take/新树/实验；现Lead已provision固定c837小树，但仍未take/实施/运行。既有DPERF01–03完成范围不回改，不新建第三层或负载框架。


DPERF04原九范围Interface消歧（固定c837，未领取）：[固定报告](../../docs/evidence/web-platform/dperf04-fixed-interface/report.md)明确summary/detail/assignments各自观察代际，summary仅sourceCurrent/status-source声明；完整snapshot/document与全部unknown/claim入口保留。每个await成功与失败均核选择、来源与文档generation，同task plan→review迟到覆盖在现app.js范围修；旧task-links浏览器断言转新route，共用原60秒后置预算。归原D01/DPERF后继，Node30秒、九literal和唯一owner不变；不新增第三层task、scope、claim或运行许可，RELEASE资源恢复优先。


连接页插件覆盖的本段接收（原REQ22/23、WPF-001-05）：[固定源核验](../../docs/evidence/web-platform/connection-plugin-2498-intake.json)确认十产品hash与两份ead94需求hash。候选由认证外层拥有唯一host，Workspace业务租期服从session/namespace/generation与retained guard；复用现slot的真实button/menu/panel，不扩public auth command。凭据始终私有，无参Connect只请求宿主form；禁用卸载、旧lease、保稿与实际preauth/reauth UI列入原TODO验收。此处归档不授产品写权，完整精确执行范围/fixture仍待plugin co-lead与Recovery交权后协调；不新增第三层任务或平行status。


原DPERF04领取可见性验收补充（U08/U12/REQ37，固定c837）：[三源P2研究](../../docs/evidence/web-platform/dperf04-claim-disclosure-c837-root.json)确认未登记active claim的卡片缺少claimId/version/精确scope/next/陈旧仍占用的可达详情，而aggregate已有完整事实。未来在原app.js范围复用已登记claim renderer，为所有未登记active/handoff记录提供有界键盘disclosure；保原时间/角色/来源匹配、长值textContent转义、unknown与旧观察分离。不造假task或第二status，不改PG原子写入口；页面不授take权、stale不释放。并入原synthetic assignment验收/同30秒Node和后置60秒browser预算，未实跑/未take，不表示实际overlap。

2026-10-06 15:32 发布安全点：固定362实际A两项history失败，完整raw/清理与余176.126秒见[唯一接收入口](../../docs/evidence/web-platform/release03-a-actual-intake.json)。Lead已接收，后继只等待原backend owner的immutable362+已审三行修复新HEAD/tree；先新A再B/全兼容后原受管发布，不重跑未变362或改旧期望，不覆盖原WT。DPERF04保持未take，当前个人版本不变。

2026-10-06 15:32 原REQ22/23、WPF-001-05补充[唯一host第二意见](../../docs/evidence/web-platform/connection-plugin-2498-second-opinion/report.md)：主题归app lifetime；只有有效业务lease发布navigation；精确registration disposer与按ID停用分开；用户disable/auth revoke/final dispose不同。纠正旧提案措辞：handler后仅activation-current，不再次auth authorize；旧global callback必须绑定原lease/form，不能借新权限requestSubmit。普通exact disposer未证误删新entry，不能机械报bug。均为未实施后继验收，不扩大Recovery21。

2026-10-06 15:41 固定审查接收：[02d5材料完整性/顺序与b298输入](../../docs/evidence/web-platform/source-review-02d5-b298-intake.json)。原06-04必须在receipt/HTTP前核完整current draft选择及保存顺序，未验证/部分ready不能静默纯文本或少ref；显式移除、旧held/inTransit与下一draft分开。24case未运行，正式review NOT_STARTED。新backend源预审不代A/B兼容，原累计3,874ms不重置，无新运行/空间采样。


2026-10-06 15:52 UTC 原REQ45/MATURE06-05：[installed core0.3.22 stop/cancel原研究](../../docs/evidence/web-platform/voice-stop-cancel-core0322-root.json)与[管理核验](../../docs/evidence/web-platform/gate-voice-intake.json)。core send会cancel并取当前text，不等待final；官方MediaRecorder示例若stop提前resolve可能先解除转写callbacks。未来同一composer adapter必须定义停止等待final后可编辑/明确SendQueue与取消丢弃，私有pane/auth/draft lease覆盖异步mic获取及每个await，旧回调不能清新session或改新稿。记录/转写状态、5秒有界结束与cleanup只作为来源/候选约束；不是已实现能力或已复现产品bug，无mic/provider/browser/新claim，不改变当前Recovery优先级。

2026-10-06 16:10 新GO优先级已落原DPERF04：[原9scope正式领取](../../docs/evidence/web-platform/dperf04-take-receipt.json)，W01在RELEASE A3安全收口后切独立树源码，不等整个发布/Recovery；无新task层、agent或运行许可。旧“未take”段落均为对应时点历史。新增[GO两个API样本](../../docs/evidence/web-platform/dperf04-go-source-priority.json)不当性能基准；原声明/现场proof/实时claim与disclosure验收不变。

2026-10-06 原MATURE02/TODO-11 Web消费准备：[唯一handoff intake](../../docs/evidence/web-platform/mature02-message-settings-consumer-intake.json)归既有真实能力与逐消息settings验收。独立catalog/纯capture/受控完整tuple选择可先准备，公共codec/client输入必须固定，旧creation语义保持；实际App/Outbox/Queue/Recovery须原authority串行交权。该段原八literal由WPF-MESSAGESETTINGS01/W01实施并独立交付：270c六源已主线c8e接收，限定类型/direct37与受控browser4通过，原父计数FAIL及旧失败原样保留；owner f80f收口停写后a5b v2已释放。[主线与领取原件](../../docs/evidence/web-platform/message-settings-main-reception/request.json)可查，完整MATURE02及实际App旅程不因此完成。[现派工与检查准备](../../docs/evidence/web-platform/mature02-message-settings-source-request.json)保持单一来源，未加第三层。原TODO11后续接线补[固定host研究](../../docs/evidence/web-platform/message-settings-host-integration-root.json)：codec重建后的wire需统一深冻结，Recovery完整草稿须设置roundtrip并拒坏字段；retry保持原设置/原key，不重选catalog或降级。未交权App/Recovery不改。GO后续[快速选择产品验收](../../docs/evidence/web-platform/message-settings-quick-selection-go-intake.json)沿原TODO11：按模型/思考力度/速度快速定位已声明组合，f3受控接口并不代表大量配置下的成熟体验；工程身份留详情、保旧分页选择/失败/窄屏键盘与A/B/C冻结恢复。[固定f3快速控件候选](../../docs/evidence/web-platform/message-settings-quick-controls-root-research.json)建议三简明区域，仅从当前授权profile的声明tuple筛选；未完成局部筛选不改C，明确Apply才capture，思考方式与effort/not-requested分开。640 radios/page只是契约上界算术，不是实测。[peer条件与root接收](../../docs/evidence/web-platform/message-settings-quick-controls-peer-addendum-root.json)补Apply/明确省略绑定opening connection/view/draft generation，使用最新availability/capture重验，零匹配保本地清筛选出口；原flatMap定位纠为104–106。这是后继设计条件，不是当前f3新缺陷。已释放的原8范围不因后继研究恢复写权；[管理排队结论](../../docs/evidence/web-platform/message-settings-quick-controls-queue-assessment.json)区分组件接口只读准备与消费者交权，新实施须合法独立领取。

2026-10-06 18:40 UTC：GO实际看板暴露合法UTC小数/+00:00时间误判，沿既有D01登记[WPF-DPERF05四范围窄修SOURCE_REQUEST](../../docs/evidence/web-platform/dperf05-utc-source-request.json)，独立树/唯一owner、先Lead物化再原子take；原DPERF04不扩围，其他任务status不改。固定parser输入安全拒绝非法日期且保真实陈旧/未来边界。18:48 Lead正式物化ec5/10files79472B后，18:49:44原四范围9a876001 v1已COMMITTED并派panels source-only；当前实施在途，检查/登记/部署仍分别待真实回执。

D01/D06既有后继已按GO/root明确指令在原树推进：[固定0da源码交接](../../docs/evidence/web-platform/architecture-snapshot-0da-intake/report.md)。原owner d01_owner新原四范围adf9539d v1，数据/直接验证源5124获限定source-only审查；不重做旧aeb验收、不新增父task/图框架、不改变renderer/CSS/server。新运行与main仍待，个人部署单列；旧20:11 queued记录[原样保留](../../docs/evidence/web-platform/architecture-snapshot-0da-intake/queued-intake-history.json)。

### U14后继的具体供给与权属边界

TIMING01已于03:56:00.608Z核齐完成、03:49:29Z实际4320/185发布，9a677v2已释放；不在已完成任务追加未完成验收。首屏易读性采用直接D01的独立有界 **WPF-DASHBOARD-TIMING02**，候选owner原W01、独立dashboard-task-timing-readability/codex同名；[固定source供给提案](../../docs/evidence/web-platform/dashboard-task-time-intake/readability-source-proposal.json)38文件599953B/base2f18，未建树/未take。[原owner具体设计](../../docs/evidence/web-platform/dashboard-task-time-intake/owner-readability-design.md)收敛status/app/styles+两定向测试+新ownplan/evidence七literal；04:02:45的五共享产品/test范围无冲突仅时点观察，开工仍需fresh全七scope。新计划TODO01呈现与隔离派生等待、02直接受影响验证、03独审/接收，旧TIMING01完成和历史目标不变。ACCESS真实安装交付优先；此段只规划，0产品写入/运行/预约。

D01既有首屏排序后继观察（GO入站，未复采）：同优先级按ID可能使D04/ENG/OPS长期占前三；仅登记待评估，不立即改排序或另建task，发布优先。

### WPF-REQ-39 / D01 既有窄屏阅读验收后继（pending，未take）

GO指出390默认42%使标题/说明/连线有效字号仅约7.56/5.46/5.88px（源码算术），图内可滚不代表可读。原591组合已接主线，保几何/键盘实际5/5范围；默认阅读模式与概览缩放需区分、文字实际可读，键盘选择详情保持可见，五图双主题390记录实际字号和截图且全页无横溢。复用renderer/data接口，当前只登记[来源与验收](../../docs/evidence/web-platform/d06-second-actual-20261007/narrow-reading-followup.json)，不改D06源、不复制图库、不新增task/claim或挤占真实聊天/ACCESS/Recovery/Quick。

已有CHAT06/C02消费后继：[公开stream v2接缝](../../docs/evidence/web-platform/quick-b1-actual-20261007/c02-public-stream-consumer-handoff.json)明确先固定公共合同与入口，再协调原Recovery21之外messages映射的精确新scope；不把Provider当renderer或把reasoning混作正文，不造第二store。当前source/claim均未扩大。

D06本片已[主线与资产发布收口并释放](../../docs/evidence/web-platform/d06-main-closeout-20261007/current.json)；默认阅读模式研究只挂既有REQ39，尚未take/实施。Quick原b1失败保留，b2仅TMP有界观察准备；C02 v2消费接缝需固定合同及精确scope交权，不派未授权UI写入。

本次GO效率纠偏准确转述已[落实为原owner有限工作段](../../docs/evidence/web-platform/paired-return-owner-segment-20261007/recovery-queue-owner-segment.json)：同身份、权限、资源所有权、清理及验收条件内连续定位→修复→相关复测，结束一次独审；以[当前main正式规则](../../docs/evidence/web-platform/paired-return-owner-segment-20261007/formal-rule-source.json)为来源。旧预算/失败保持，原owner唯一结构化运行记录；新增输出超过现有限额才一次说明真实预算变化，不通过复制准备包消耗留存空间。

个人发布须沿[原Lead依赖核对](../../docs/evidence/web-platform/paired-return-owner-segment-20261007/publication-dependency.json)：backend af51/v18缺新browser-session/message-settings/028/032，Web仍d629/v3。原SVC06-05准备backend4fe331与保留artifact兼容后，才评估新的Recovery实际App；Quick fe6未App接线、C02 native/LAZY未被当前Recovery消费各自分列，不用main事实替代部署可用性。

GO经OriginalLead/root新调度要求：[D04测试生命周期后继与OPS例行记录优先级4](../../docs/evidence/web-platform/queue-full6-closeout-20261007/priority-coordination.json)。D04唯一owner仍d01_owner、原dashboard-coordination树；此前仅经理排队未改owner，现已在fresh f61d v1合法原scope安全点完成[作者priority4与用户摘要修正](../../docs/evidence/web-platform/release-c3-actual-admission-20261007/d04-priority-author-update.json)，5955bba3双端clean；单ownparser确认priority4/human完整，历史开工UNKNOWN保留。保真实用户影响、独立blocker与UNKNOWN历史，不改聚合器/测试、不抢Recovery/Quick。

原MATURE02 TODO11 / MSGQUICK05 [真实App接线设计](../../docs/evidence/web-platform/access-sse-host-checkpoint-20261007/message-settings-real-host-design.md)及[候选范围/验收](../../docs/evidence/web-platform/access-sse-host-checkpoint-20261007/message-settings-host-followup.json)已接受方向，12产品+3现有Recovery测试仍NOT_TAKEN。CompleteDraft/App保存恢复、Thread同步capture、Send/Queue显式构造当前漏messageSettings；复用现public合同，以App每View唯一C和非持久Symbol/CAS贯通全链，P01 actions+composer.context按Knowledge模式接同面板，不新slot/store。发后保用户显式C供后续稿、每新稿换ownership，omit仅省略，不由A/B/profile自动赋值或冒observed。原TODO11 plan32与consumer Web段未发现明确一次性/发后必清C相反要求；capturedA/ACK不能清B、独立ABC保护仍保。先合法固定已审Recovery+Quick+当前main组合，再精确交权，不覆盖旧App全文件；旧leaf26/6不能算真实host通过。

原D01/DPERF04的ACCESS写权依赖现已解除：[57735v2部分amend](../../docs/evidence/web-platform/access-sse-host-checkpoint-20261007/access-partial-receipt.json)仅余README+ownrecords三scope。原W01 b554v3七scope与929b clean已fresh核；[server/app及Timing/ACCESS两browser四literal候选](../../docs/evidence/web-platform/access-sse-host-checkpoint-20261007/dperf04-reentry.json)root后续入站确认08:09:31.783Z原owner v4 exact11已COMMITTED/nooverlap；其后组合当前main输入，不新feature、不照搬旧server/app覆盖新功能。

原D01/DPERF04 [固定供给与组合验收历史](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/current.json)：aa9只供给7个固定9f314e输入/54807B、不扩v4十一写范围；cfd组合源审与当前九叶项+父项实际接受，浏览器/main/部署分开。唯一W01自主准备相关页面检查，不重跑未变ACCESS/TIMING整套，也不把旧Node3950ms通过套给新组合。

原REQ19/SVC09 [versioned context输入](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/release-policy-consumer-intake.json)来自OriginalLead经root转述：normalized publicOrigin+非秘密browser-policy digest，四兼容检查同context，旧v1只legacy读。四retained/192MiB/32reports仍保原三；新host先读取原三，再对第四CAS。4538660B只旧r3资产历史，不能作fresh资源观察；最终真实App固定后才冻兼容tuple。只等待原发布owner固定Interface，不另造发布系统、不重做已绿Web组件/恢复、不操作个人服务。

原REQ43/CHAT05 [正文公开接口已main](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/chat05p02-main-consumer-intake.json)：f5a13c FlowClient descriptor+显式page reader与完整性分开，Lead实际2/2含2225539B九页及跨task/role拒绝，0provider；runner默认关且仅显式singleattempt。Web仅在Recovery/Quick交权安全点消费原唯一decoder/authority，展开前零正文读取，receiving尾页不冒complete、旧无正文历史不能补造，UI/个人部署均未验。

原U19紧凑视觉补[固定T3 cfa4f765参考](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/t3-compact-reference.json)，仅评估控件尺寸/focus/粗指针命中、单层表面和fallback，沿原MATURE01/02 TODO11；不照搬复杂clip/theme、不换栈、不以composerSubmission替代本产品durable ACK/Queue/恢复。

本次原D01/DPERF与RECOVERY01 [浏览器接收安全点](../../docs/evidence/web-platform/browser-interface-checkpoint-20261007/current.json)记录实际而不继承绿色：看板summary首红8258ms保留，原生close事件窄修后summary9组/双主题图通过9085ms；task-links6/6与双主题相关图已root行为独审，窄屏浅色底部重复页首仍待补证，适配Timing/ACCESS未运行。Recovery完整草稿首轮在header定位失败、尚未CREATE/turn，15676ms及清理已接受，修正后的bc3已第二次真实复验仍整体失败，最后accepted回执undefined待定位，150s累计114654/余35346；不把恢复/材料部分步骤通过升级为完整通过，不重跑未受影响旧旅程或扩原claim。

REQ19/SVC09 [固定接口研究](../../docs/evidence/web-platform/browser-interface-checkpoint-20261007/svc09-fixed-interface-review.json)与OriginalLead经root新交main b2b5612b2a63106ad0e674ddf12b2e8f96cf3388已接收。实际context字段严格为`{format:1, publicOrigin, policySha256}`，browser-policy digest仅概念描述。四check须绑定同实际backendHead、descriptor和context；原三retained各自重新提供真实App证明、第四尚待固定，不以旧pointer或main替代当前个人兼容。4 retained/192MiB/32 reports是政策边界，4538660B仍仅历史。无本组个人操作或第二发布系统。

REQ43 [既有7f29正文研究](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/chat05p02-fixed-web-research.json)继续要求reader构造前聚合reservation、关闭释放、跨pane有界DOM。MATURE06-LAZY01公共client固定2949569/packet55dc已由chatui08:42独审批准（root转交）；唯一status/Interface仍指Mika原owner，db_owner只读Web映射不形成新writer。stream既定2/4MiB上限不抬，nativebody8MiB单独计量，并纳同次所有活跃reader/两pane总admission，不能静默混用缓存预算。尚无Web消费实现/验收或新take。

原OPS14 [caller输入](../../docs/evidence/web-platform/browser-interface-checkpoint-20261007/ops14-resource-caller-input.json)仅供下一安全点：OriginalLead拥有tools/owned-resource-measurement新Module，Web原owner在现有范围接后继caller；不改当前运行或历史封存runner。测量helper只管exact-ownedscratch排除、logical/allocated和unknown，进程/权限/DB/drop/deletion/时间/准入仍原caller负责，不复制整套supervisor。

本轮原D01/DPERF与MATURE06 [消费者适配/实际资源链](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/current.json)采用单一执行管理d01_owner向Mika报actual，root只读审查；OriginalLead直发受限通道不重试，Mika回执经root内部转交不产生双重发令。Timing0PG独立fixture首轮第二主题超时、9153ms与清理保留，原60s累计33617/余26383；[stale nativeclose源码风险](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/dperf-stale-close-research.json)由原app.js owner窄修并真实事件投递回归，未证该风险是此次超时唯一原因，原summary9/links6通过不撤。这是09:01历史安全点：Recovery回执身份修正当时仅源码接受；本批第三次selected2实际通过见下方独审，原1个202或材料中间步骤不独立当整组PASS。

REQ19/SVC06 [固定公开context](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/svc06-fixed-public-context-intake.json)绑定backend b2b5612、publicOrigin http://127.0.0.1:61228、policySha256 81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638。OriginalLead离线artifact09:02:10.132Z实际成功归还，artifactId c2c695e7da5a3b2efeaaa68bf407dda65c8e8a8afd5413657ab4b98a334509b7（不是descriptor文件SHA）；实际descriptor已发现，三retained及新App仍须各四check绑定同真实artifact/context，未个人切换，不以动态fixtureorigin冒固定origin。后到LAZY公共模块main e2b16924038d1215e5f9f389710d1e9b43636d02不使本artifact改基线。

REQ43的LAZY core60db/client294已由OriginalLead受控main e2b；组合3/3及strict0只属共享模块，唯一[client接收入口](/Users/citrine/Projects/AgentHarness/Flow-worktrees/lazy-reasoning-reads/docs/evidence/mature06-lazy-reasoning/client-integration-ready.json)与原Mika status继续权威。Web Thread/网络惰性/恢复组合未验、无新Webtake，不沿旧Chat06写权重开。stream2/4MiB、nativebody8MiB及跨pane总reservation规则原样保留。

OPS-METER01公共helper已由OriginalLead以source c169受控main1e12eaf13a02b45a99dfe126bc182c2ea45a8390，入口tools/owned-resource-measurement及其interface；20synthetic/raw/27bindings获独审为原Lead回执。DPERF/Quick两actual caller尚未接，只在当前冻结有限段结束后的下一prepared安全点由原owner在原scope接入；不改正在/历史raw，不为计量helper重跑已绿产品，不新增task或writer。

本段[Timing实际首红/修复复验独审](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/dperf-timing-actual-review.json)接受52cdf最小旧close保护及真实nativeclose事件回归，5组PASS/6934ms，全自有资源归还。原60s总40551、未用19449封账；不足启动的4449ms work不硬开ACCESS，新45s/15cleanup仅准备不取旧credit。截图未见实际时间正文，视觉仍OPEN；不把shell/焦点截图当时间用户验收。后续OPS-METER [精确consumer接缝](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/ops-meter-web-consumer-intake.json)要求导入零pycache、原rootdev/ino不重认、exactexclude、缺rootunknown与已证生命周期absence分开；双实际caller仍未采用。

LAZY selected protocol虽已main e2b，当前实际SVC06 b2b产物不含它。后继Web selected验收须固定支持e2b协议的真实backendtuple，不把main事实或旧b2b部署冒能力支持，不静默换codec/降断言；legacy保持，不阻或重做b2b原兼容交付。

REQ19 [b905实际descriptor核对](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/svc06-actual-descriptor-intake.json)已确认manifest/result-descriptor完整tuple一致；OriginalLead实际build/import独审APPROVED与作者RESULT历史pending措辞分列，不改原件。保留artifact目录F63Mk3，三retained真实App→b2b及context的format2兼容仍需原release继承交权/具体owner安全点，不手造report、不重build、不自动个人服务或挪用Recovery/DPERF当前scope。

原Recovery第三次[完整草稿选定实际独审](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/recovery-complete-third-actual-review.json)已接受2/2与清理，profile/knowledge/有序双文件/receiptcheckpoint/nextdraft均有真实覆盖；11793ms后新150s累计126447/余23553，原两红保留。无本次PNG，fullfeature/Steer/queuepromotion/第二center尚未验，不自动排新运行，owner正常封存。

REQ19沿原Release owner补具体只读供给：旧461a/caa1/d629三个实际descriptor与immutable资产根，已向Mika正式发送请求供其原Lead通路转交，未收到终接收回执。复用fixed7805b7的web-release-compatibility browser/fixture四check方法，但旧方法重build、动态origin及无policy不能原样冒作b2b固定61228/context验收。新方案须复用已有artifact、保持真实browser publicOrigin与policy，并隔离用户当前61228服务；仅待原owner设计，不启动代理、不读取个人凭据、不重build或操作个人服务。

DPERF下一原owner包仅PARTIAL_RETAINED_ADOPTION：retained BASE精确排除scratch后调用公共OPS helper，scratch保原regular/allocated扫描与64MiB cap；SPECIAL_FILE和可能UNIX socket仍是接口/平台候选，实际形状UNKNOWN，原OPS owner定政策。source98baf/metadata6e92f36已封存，未运行新45s段；Recovery27f2515封存但原21 claim未释放，LAZY消费者等独立树/组合base与明确交权，不把选定恢复通过等同全feature完成。

本自然批[当前入口纠正与主线接收](../../docs/evidence/web-platform/main-intake-handoff-checkpoint-20261007/current.json)实核D04选定账本后，将handoff中过期DPERFv3/7、ACCESSv1/10改为v4/11、v2/3；旧Quick/Recovery/DPERF动作摘要只保明确历史，当前入口只引用唯一owner status/resource，不新建手填进度副本。Quick组件已由63768046受控main接收，原W01在DPERF安全点后按fresh原claim收口metadata与释放，真实App/CAS仍原TODO11后继，不继承组件验收。

REQ19真实三App兼容仅排原Release owner：历史fixed7805b7和RELEASE03两个canonical status实核owner均为w01，不能凭旧已交付claim开工。SVC06固定产物已由[main9b27005接收](../../docs/evidence/web-platform/main-intake-handoff-checkpoint-20261007/svc06-main-artifact-intake.json)，私有policy/个人服务未变。待DPERF与Quick安全点后，再核独立树/精确范围与供给；[固定origin隔离设计输入](../../docs/evidence/web-platform/main-intake-handoff-checkpoint-20261007/release-fixed-origin-design-input.json)只是候选，须真实origin/cookie/SSE/ACK与生命周期证据，不启动代理、不把动态origin手填61228、不用完整缓存fulfill替代SSE/丢ACK协议。

本次[原SVC06具体接窗/原owner收口](../../docs/evidence/web-platform/svc06-window-quick-closeout-20261007/current.json)解除跨队资源不明：X01早已actual CLOSED并获独审，Web DPERF全归还，原SVC06 b2b/c2c可以自己的fresh输入/资源接180work+30cleanup、676MiB规划/2.5GiBfloor/0Chrome，未报实际开始不标RUN。只经可用Mika通路成功发送，受限Original直发不重试，canonical供其读取，不冒最终私信已达。Steer原两test的synthetic public actor/lifecycle集中源码审已接受，相关noEmit一次通过并清理，新的60s浏览器段尚未运行，若SVC先接须等实际归还。DPERF bc612最终16source+14明确非metadata闭包获审，metadata9f54已停写，11领取scope不变；原W01已fresh Quick原六scope作main接收/精确状态枚举/释放，实际release回执到达前保持占用；旧Release后继在其后准备，不重测旧绿色、不新writer或挪用旧claim。

[本次SVC实际归还与下一交接](../../docs/evidence/web-platform/svc06-return-steer-handoff-20261007/current.json)退休旧offer；Quick原owner b90f已完成main组件metadata并839e v2精确释放，真实App原TODO11未完成，七个旧wrapper通用proof UNKNOWN不漂白。原Release owner随后仅复用三App完整性证据准备原compat方法，SVC06 runner诊断可能改变backendtuple，等最终已审tuple再定actual兼容，不沿旧b2b自动运行或重建第二发布系统。

原Recovery Steer首失败及自有清理获[独立接收](../../docs/evidence/web-platform/steering-diagnostic-release-preparation-20261007/steering-first-actual-review.json)；后继仅首draft等待失败的有界只读观察，原5s/predicate/rethrow与actor/lifecycle不改，已[限定源审](../../docs/evidence/web-platform/steering-diagnostic-release-preparation-20261007/steering-diagnostic-source-review.json)，沿原60s已耗17332/余42668有限段接续，不转旧credit。Release原四scope[设计审](../../docs/evidence/web-platform/steering-diagnostic-release-preparation-20261007/release-fixed-origin-design-review.json)允许合法fresh take后先实现显式输入/proxy/harness/report；最终backendtuple仍必需，未分配任何真实服务验证。Chrome代理argv不配置Node APIRequestContext，禁止page.request/context.request/route.fetch访问61228；Node仅访问自有动态backend，真实Chrome页面relativefetch/response补证，三旧AppBearer与独立Cookie/CSRF分开。

本轮[正式接收/发布与原owner收口](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/current.json)补齐DPERF的main和实际页面入口，限定9own+7readonly/194source；原owner顺序为Release安全点STOP（保38b9写权）→DPERF原claim metadata收口/正常release→回原Release，不以同一worker绕过worktree或写权。管理仅六scope，主索引不另复制业务TODO。READBOUND固定main81b与194登记已收，消费接线仍归REQ43后继。

原MATURE06-04/RECOVERY01采用[route-fix新有限工作段](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/recovery-route-fix-segment.json)：静态证实长寿命hash listener捕获旧session，后创建projection可能缺recovery；先修current-committed callback并保view生命周期、durable-before-HTTP、原key/ownership，再做同document路由与原Steer旅程实际回归。旧90k、150k与Steer60k失败原件/余额全部封闭；新90k实际累计、每次最多60k含15k清理，不挪旧credit。固定源码/集中源审/实际共享窗归还前不运行；同边界原owner自行fresh输入与环境、定位修复→相关复测，段末一次独审。

历史设计输入（当前领取/供给见下方唯一模块来源）：沿原WPF-001-05/X01-06记录[Mika插件Settings后继输入](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/plugin-settings-followup.json)，NOT_TAKEN，不新增大task。Settings懒挂载既有PluginManagement，中心desiredEnabled与bindingAllowed/reason、精确安装身份可见；Browser extensions独立，enabled不冒loaded/callable。复用公共runtime接口，config/grant若入首片先与db owner对齐纯ACK helper；保409草稿/跨session晚回隔离/singleflight/冻结key-body/UNKNOWN，不用读重试重发写。候选独立树需fresh App范围与原Git供给协调，Release安全点后再定唯一owner，旧released X03权不重开。

历史设计输入（当前领取/供给见下方唯一模块来源）：X01-06的[固定九源接口研究](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/plugin-runtime-web-interface-research.json)补充：X01 startup已main6aa2d42e96c33b73e511e69e2984b5279ce4eb7e，但四runtime新methods仍原db owner实施。首Web可读config/grants，写它们的ACK codec是独立后继，不能用enable codec代替；首次enable所需targetRunnerId不在material receipt/disabled runtime，须原shared owner提供真实host选择接口。App仍由Recovery占用，候选NOT_TAKEN，不据接口研究抢写或触服务。

原DPERF受控main接收后的[owner元数据收口及b554v5释放](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/dperf-release-receipt.json)已10:19:55.499Z实际完成；78a双端clean且十一scope停写，无产品复测或释放后回写。后继实际App/Settings写权仍需fresh精确交接，现有Release38b9不因临时切换而释放。

GO实核DPERF完成时间展示缺口：作者别名字段未被现有精确三字段合同消费，原高精度+00:00值也不符合任务时间Z/至多毫秒格式。原owner仅新领取plan/evidence两metadata范围修规范字段；开工UNKNOWN不倒填，完成按真实原件以2026-10-07T10:19:14.492Z呈现，原.492580+00:00来源保留。只核known completion/unknown start及预期issue，产品scope、parser、固定审查target与旧结果均不变，修完正常停写释放。

上述时间合同修正已由原owner f47完成，records-only732f先v1正式领取、后v2于10:24:18.890Z释放；[单任务解析与summary检查](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/dperf-timing-parser-summary-check.json)证明完成known/sourceCurrent，开工UNKNOWN及唯一预期issue保留。首检查脚本DTO取值错误与原高精度时间均原样保存，无parser扩展或产品复测。

历史设计输入（当前领取/供给见下方唯一模块来源）：原X01-06插件设置后继追加[命令生命周期约束](../../docs/evidence/web-platform/recovery-route-fix-first-20261007/plugin-command-lifetime-addendum.json)：关闭Settings或折叠会卸载lazy管理树，新的UNKNOWN写命令/frozen key authority不能仅放该树useState。复用session拥有的窄controller/guard或明确保留机制，close/reopen同一会话仍展示并重试原key/body，跨session隔离迟到，不把abort当服务器拒绝，不造第二通用outbox。当前只读管理行为不是产品bug，W01仅固定接口/精确scope候选，NOT_TAKEN。共享4methods source9f5d61a1/deliverya85fa4cf已审但未main/PG，仍从原CLI owner唯一Interface接输入。

历史设计输入（当前领取/供给见下方唯一模块来源）：本轮既有X01-06的[只读接口提案](../../docs/evidence/web-platform/recovery-route-fix-first-20261007/plugin-report.md)与[候选精确范围](../../docs/evidence/web-platform/recovery-route-fix-first-20261007/plugin-scope-proposal.json)已保存：5路径只读组件或7路径启停组件为替代方案，另5条真实App接线路径需原Recovery交权。共享CLI9f5d/a85已审但未main；first-enable targetRunnerId公开来源、config/grant写ACK和Settings卸载后的session-owned命令身份仍须接口供给。此为原任务候选，未建树/未take，不新增业务进度来源。

原X01-06模块后继收到[固定共享CLI主线供给](../../docs/evidence/web-platform/recovery-second-center-preparation-20261007/x01-cli-main-intake.json)：main b675完整提交已核，operator显式exact runnerUUID由原commands/store验证；首片config/grants只读。遵[UNKNOWN重试语义](../../docs/evidence/web-platform/recovery-second-center-preparation-20261007/plugin-unknown-retry-addendum.json)，初次拒绝与先前UNKNOWN后的拒绝分开，GET成功不消除旧写不确定。初次预检两条X01占用的原件保留；其后[X01 v25交权](../../docs/evidence/web-platform/recovery-second-center-preparation-20261007/x01-ui-handback-receipt.json)与[W01七literal新take](../../docs/evidence/web-platform/recovery-second-center-preparation-20261007/plugin-take-receipt.json)均已COMMITTED。唯一模块owner/source见上表，App/session仍Recovery。195来源是此前共享CLI部署，不冒新模块已登记或实际App通过。

原U20候选合同仍由X01原owner准备[host-candidates-interface](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/docs/evidence/x01/host-candidates-interface.md)，v26/61三leaf为共享作者范围，当前未冻结schema。模块先使用公共合同允许的operator显式exact UUID，不自动register或读取私有policy；configure/grants首片只读。稳定合同/公共client供给后再接可读候选，保持session-owned原key/body及UNKNOWN重试语义，不造第二通用outbox。

原U20候选共享输入进展只关联[唯一host-candidates状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-host-candidates/plans/x01-host-candidates-client/status.md)：Mika经root报server7672090b/interface4c808b63、thinclient/CLI bc54d4f3/packetc5da46ee待独审且未main，手动分页需保空页cursor及revision409失效。当前模块不提前猜字段接线；config/grants写ACK另片已审待主线，不加入首七scope依赖或新增writer。

本次自然收口沿原task：Recovery固定2f8/metadata15833的原03/05组合独审接受，06仍需中心既有callerOrigin/迟到Clear-Cookie/重复Connect32slot合同来源及合法main/intake；Release固定settings已供给且原owner状态纠正，下一仅自有caller完整准备。插件有限local父FAILED/超82ms完整保留，后继direct证据完善不由当前30s自动续跑。外部O16R3已实际归还但KEEP，X01唯一NEXT fresh见[单一资源来源](../../docs/evidence/web-platform/resource-window-current.json)，不新任务或重复业务status。

[本次当前交接](../../docs/evidence/web-platform/x01-candidate-release-caller-20261007/current.json)收录X01真实归还后Original bootstrap唯一NEXT、ACCESS剩余三scope正式释放，以及原plugin caller最小修正设计。该设计已由root核10原输入，但未实施/未运行；W01须先完成Releasecaller安全STOP，再原7scope做direct-only后继，旧30082/30k失败不抹账。lateLogout原中心后继仅派≤6固定源/官方规范有界只读输入，不新增功能task或运行门槛。


原D01成熟看板后继补充实际界面更新语义：root现有IAB旧JS只刷新数据时作者时间更新，但新领取标签需一次reload才显示；[观察来源](../../docs/evidence/web-platform/release-caller-recovery-main-20261007/dashboard-claim-ui-observation.json)不是当前数据错误。后继考虑轻量“界面版本有更新”提示，严格区分数据同步时间和界面代码版本；不自动reload、不丢焦点/展开/表单/凭据状态、不引第二进度源，不新task或运行。


原MATURE02 TODO11真实App设置接线继续采用[Mika唯一consumer合同](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/docs/evidence/wpf-mature-02/claude-message-settings-consumer-handoff.md)的完整draft snapshot→材料await前freeze→Send/Queue原key→Recovery/CAS链。root已读c130仅有Picker/capture定义而无App消费；组件6组通过不能冒真实App可用。Recovery原owner完成main metadata与精确App/session交权后，再为原可用owner准备独立WT、合法exactclaim和唯一来源登记；Release优先，不等待lateLogout中心窄修，不新建第二FSM/store或重复设计。当前仅后继顺序，未授新writer。


原U20可读runner候选后继的共享输入已推进：Mika提供[唯一组合接收索引](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/docs/evidence/x01/host-candidates-combined-intake-index.json)固定a4ebb279dd8613497cf9757ac187c3df923d5b37，sourcea298/clientbc54/ACKae148与HOST实际d05b获独审；未声称已main。未来沿单FlowClient query消费，候选不证明online/loaded/callable，同revision GET可反映policy变化且不消除UNKNOWN写。W01当前Release优先，不因该输入重复设计/运行或猜未集成字段。

### 2026-10-07 本次自然安全点：既有后继输入与范围消歧

Release [c2实际失败独审](../../docs/evidence/web-platform/x01-version-return-20261007/release-c2-first-actual-review.json)限定Node前sandbox语法，410ms失败与全清理保留；后继只改localhost规则并新10s局部语法验证，不复用未用179590。Recovery原06共享合同已由[固定主线consumer对齐](../../docs/evidence/web-platform/x01-version-return-20261007/recovery-late-logout-main-consumer-intake.json)满足，由原owner两metadata收口，不新增browser门槛。

原MATURE02/TODO11沿既有真实host设计推进WPF-MESSAGESETTINGS03候选，panels唯一owner；原15代码路径补ConversationQueue.tsx，使历史turn与队列展示自己的冻结requested，共16代码/test+2metadata。独立web-message-settings-app树/branch需fixed供给及fresh原子take后才写；不新增selector/store/TaskThread范围。安装官方composer的同步detach先于onNew边界按[固定研究](../../docs/evidence/web-platform/x01-version-return-20261007/message-settings-official-composer-ordering.json)落实，A等待材料时同正文异settings的B不得被清掉。

插件HOST与严格ACK公共合同已[de547主线接收](../../docs/evidence/web-platform/x01-version-return-20261007/x01-candidates-main-intake.json)，不再等main；UI采纳留原owner后续自然段，候选不是online/loaded/callable，同revision GET仍可变化、GET不清UNKNOWN。

本次D04作者优先级4已在[12:02真实看板观察](../../docs/evidence/web-platform/release-c3-actual-admission-20261007/root-dashboard-d04-visible-check.json)显示：首屏前三不再由D04占据；旧展开领取卡保留焦点而明确已不在未登记列表，是焦点保留行为，不当重复领取缺陷。没有修改排序/聚合器或另跑浏览器。

原TODO11/MSG03沿[主线常规source-operator规则](../../docs/evidence/web-platform/message-settings-app-self-provision-20261007/rule-intake.json)已解除旧逐片供给许可前置；同一panels自助固定c130/369源、18范围原子领取，首唯一source与所属MATURE02见[登记入口](../../docs/evidence/web-platform/message-settings-app-self-provision-20261007/msg03-source-registration.json)。既有bounded-local-iteration允许原owner在段内连续修复与相关复测，保实际失败/清理/累计额度，不把ordinarysource或local改成逐命令准备批准。共享config、真实PG/Chrome、main和个人操作边界保持。


2026-10-07 本轮[主线收口与登记回执](../../docs/evidence/web-platform/release-main-registry-close-20261007/current.json)：Release e029/owner58562已完成并释放四scope，MSG03领取和唯一source登记均已确认，沿原MATURE02/TODO11实现，无新增任务层。Plugin沿X01-06准备原模块browser，真实App/session仍属MSG03。普通PG与完全独立0PG浏览器可按当前主线规则fresh组合，但Original本次个人更新明确排他，准备不冒actual。Mika REMOVAL client后继只source/ordinarylocal，接口尚未固定；REMOVAL R2 READY后置，均不新占Web写权或重窗口。


原TODO11真实App接线的新增[静态返回路径研究](../../docs/evidence/web-platform/plugin-browser-source-and-msg03-local-20261007/msg03-material-return-research.json)指出官方composer准备失败/cancel可绕过onNew回填A正文附件到B；原owner在已领取ConversationThread/private adapter内保A显式恢复并保护settings-only B，不改shared core、不建第二store/FSM。该推断不是已复现browser失败，direct成功不能替代失败路径验收。Plugin仅沿原X01-06模块准备[六组browser固定包](../../docs/evidence/web-platform/plugin-browser-source-and-msg03-local-20261007/plugin-handoff.json)，真实App/session仍归MSG03；source-only不借个人重窗运行。

该完整草稿恢复接缝的实际范围补正已[7e3f v2 exact19 COMMITTED](../../docs/evidence/web-platform/plugin-browser-source-and-msg03-local-20261007/msg03-amend-receipt.json)：只追加已有AttachmentComposer的typed可选restore/discard入口，默认旧consumer行为不变；先amend再编辑，不新增任务/局部信用或借共享模块写权。


本次自然批按[实际归还链](../../docs/evidence/web-platform/svc1230-return-plugin-removal-pair-20261007/current.json)解除Original个人1230排他并完成PG/独立0PG浏览器配对；运行失败与清理分开，未用额度不转移。原TODO11新增验收澄清：保住B之后，held A必须可经本次显式恢复的完整draft lease/CAS恢复，不能永久绑定旧send ownership或重连前generation；真实双主题须通过App现有主题入口并核effective theme，emulateMedia不能代替。原X01-06刷新按钮用现有aria-disabled与pending防重复模式保自然键盘焦点，不删除原焦点断言，不以首轮未报告的前五组补PASS；两项均原owner同scope修复，不新增任务、store或测试框架。


原MATURE02 TODO08/11新增明确个人可用交付依赖见[当前leaf与owner核对](../../docs/evidence/web-platform/svc1230-return-plugin-removal-pair-20261007/personal-turn-settings-next.json)：MSG03真实接线和backend部署不等于可信turnSettings目录已发布。Mika协调原CORE/preview配置/发布leaf与唯一parent chatui01_owner，panels只写MSG03自身下一交付；本管理六scope不含parent，不代写。新opt-in身份保旧session/history，当前SVC06维护不扩；Claude先0模型配置→目录→Web/TUI，provider后验独立小段，不借R02/O16，不新增大task或第二发布体系。


[Plugin模块精确main交接](../../docs/evidence/web-platform/plugin-module-main-ready-20261007/request.json)沿原X01-06，原owner8b315/a952仅五产品/test范围、模块六组和双折叠B图已审，main未接不释放七scope；既有实际App与可读host候选仍另接，不重跑模块。原MATURE02个人目录激活的[两槽与leaf权属](../../docs/evidence/web-platform/plugin-module-main-ready-20261007/activation-owner-boundary.json)已路由Mika：保旧身份/会话，opt-in受信choices；runners.ts v28原writer处理LIMIT前资格，preview家族正常新take，当前SVC维护不扩。

## 2026-10-07 13:08 原发布与材料恢复接续

沿既有REQ19/Release及MATURE01 TODO05，优先用户实际可见的新网页，不以完整Plugin/Codex或MSG03通过为前置。复用[固定共同source7272候选](../../docs/evidence/web-platform/mounted-app-and-personal-maintenance-next-20261007/visible-web-release-peer.json)，由原发布链供应两个新immutable descriptors；原Release owner fresh原四scope实现显式新App Cookie分支，保三旧App/Bearer四checks与tuple绑定，不覆写旧绿。源、main、Web资产应用、backend宿主及个人目录能力分别记录。

MSG03沿原TODO11/19scope收固定四源与两mounted journey，再集中source/native审及有限实际；当前局部53579/60000ms，旧失败/旧批准范围保持。已有[W01取消语义peer](../../docs/evidence/web-platform/mounted-app-and-personal-maintenance-next-20261007/msg03-cancel-peer-review.json)供该批复用，不新增研究层或runtime。

[激活分工](../../docs/evidence/web-platform/mounted-app-and-personal-maintenance-next-20261007/activation-assignment-request.json)已由Original接受原CORE/SVC09拆分，parent08/11 b4c已落；actual STOP/amend/take未到，不派重复writer。[D05请求](../../docs/evidence/web-platform/mounted-app-and-personal-maintenance-next-20261007/d05-registration-request.json)交现3a624v6合法writer，不在manager六范围之外写。

本次[原任务接续](../../docs/evidence/web-platform/msg03-mounted-browser-admission-20261007/current.json)保留原local60s53579/6421未用封账；worker继承env-file风险以固定loader白名单修复，独立假sentinel10s实际219ms通过且归还，不读真实admin。原两个mounted selector共享90s候选、每attempt≤60s含30s清理，caller/native未接受前不建gate。原Release两harness8964在合法27c36四scope准备新Cookie分支，必要strict20s普通段不借旧绿/旧额度。CORE651c实际take与X01v29交回runners见[fresh唯一领取](../../docs/evidence/web-platform/msg03-mounted-browser-admission-20261007/core-owner-switch.json)，不是另新task。

U08/U12/REQ37同一要求的[固定ae850原子take源码核对](../../docs/evidence/web-platform/svc-held1347-core-ready-20261007/dashboard-atomic-take-source-review.json)由root只读核五源：单PG advisory事务与同task/当前待接WT/父子literal互斥、stale不自动释放，UI能区分mismatch和未登记claim，registry fingerprint拒旧混合。这是固定源码审，不证明语义工作绝无重复、不替代原D05三source映射或当前fresh领取；沿已有release-history后继，无新编号/测试。

原X01-06 / WPF-001-05 / I01接收[真实App接缝只读增量](../../docs/evidence/web-platform/svc-held1347-core-ready-20261007/plugin-app-seam-peer.md)及[固定输入](../../docs/evidence/web-platform/svc-held1347-core-ready-20261007/plugin-app-seam-pins.json)：五模块已main仍不等实际Settings传入centerRuntime。最小候选沿App/session/react与原三integration tests，live namespace/principal/generation/active变化撤销旧controller；Settings关闭/折叠保留一个unresolved原key/body，中心停用不映成本地卸载、清草稿或取消材料。三产品仍归MSG03 v2/19，先完成并合法交权；测试须fresh冲突核。仅设计/验收输入，不新task、公共接口或运行，runtime原TODO05引用视图不改名冒完成。

REQ19/原MATURE01下一可见网页的[具体候选修正](../../docs/evidence/web-platform/msg03-recovery-material-release-impact-20261007/current.json)：7272共享附件恢复allitems投影，现text/receipt旅程不能排除fail/cancel串稿；先核旧候选可达性，若影响则最小共享membership修复进入candidate后重新固定。复用原附件draftItems投影，不在App/session复制过滤、不删除held A、不等待所有MSG/Plugin，也不以快速发布跳过已知数据污染。MSG原owner已正常amend20；独立研究/源修/必要消费者检查分别保结论，个人服务不重演。

REQ19附件影响核验已有[具体最小发布路径](../../docs/evidence/web-platform/s01-first-actual-return-20261007/release-minimal-fix-decision.json)：旧7272自然发送无MSG人工材料await同型证据，不写旧actualFAIL/安全保证；采用完整共享draft membership保护小修与精确consumer后，原发布链重固定7272基线的新Web source/descriptor，backend7272 lateLogout独立保留。只等这份必要delta，不等全MSG/Plugin；当时d576部分恢复后unmount P2未过；后续b924已由root b92e4c源/局部批准，旧Web移植与产物兼容仍另验。

Original后到明确授权的[04da/6c最小后端路线](../../docs/evidence/web-platform/release-backend-route-20261007/current.json)覆盖早先只读研究的“不可从6c另拼组合”限制：由其独立SVC06B正式审定并供artifact，必须保lateLogout已审合同，不再硬绑7272共源；新Web只纳已审共享draft小修。04da当前三server产品/test与一evidence helper分列，未因路线接受而冒源审/actual通过。原Release27c校准供给与固定pair兼容，无新框架或个人维护重演。


同一REQ19/MSG03后继现由[当前固定包](../../docs/evidence/web-platform/release-backend-route-20261007/current.json)收敛：b924两产品保护小修只通过其源码/消费者局部，W01准备准确旧Web移植，Original04da最小backend正式审定/descriptor尚待。MSG新独立120s mounted阶段复用原两旅程，每次45–60含30cleanup；旧90s/20s均closed不借余量。COREmain/release与D05切源已实际确认；剩余PROCESS/CLIENT登记由Original原D05处理，不新增任务或writer。

既有插件/性能后继接收[固定主线7源只读研究](../../docs/evidence/web-platform/msg03-main-release-source-handoff-20261007/plugin-ui-performance/report.md)：Host已按slot缓存，导航不改registry；React内联subscribe的重订阅与低频全registry通知只是待测候选，没有已测瓶颈，不启动生产优化。隐藏Activity仍可能有低优先级props render，不能写零CPU。本条仅归WPF-001-05与既有性能验收，不新task/take/PASS，不写released PERF源；新网页交付优先。

### D01 当前信息的人读验收补充

GO本次补充沿DASHSUM01、TIMING02与本计划WPF-001-37：摘要由唯一status作者描述用户可获得什么、还差什么，SHA/claim/命令保技术字段，不由renderer猜写。TIMING02继续既定简洁本地时间、显式时区、UTC与来源下钻；开工/完成/含等待历时未知明确展示，不改真实时刻、不猜历史。阻塞归组仅沿有效显式关系读源；不扩大旧active/delivery去重验收，不新task或立即take，候选与验收见[既有D01后继输入](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-human-followup.json)。

固定主线只读定位补足本条分组边界：原blockerIds资格保持；复用既有resolver且须 `links.kind === "subtask" && parent.state === "known"`、目标存在且有效，不能只看可能用于未核实导航的targetId。已验证big/none独立成组，其他关系明确待核实；父无自身blocker仅作导航标题，不创造父阻塞。覆盖父子均阻塞、仅子阻塞、目标存在但关系未知、父陈旧/循环、不同owner同文仍逐项保留；具体fixed source见[后继输入](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-human-followup.json)。

### 原 WPF-001-37 与 TIMING02 的首屏优先级验收补充

GO 2026-10-07 20:09 对实际4320与固定c29的只读观察：human.mjs 的 blockerIds 仍沿 registry 原顺序，未应用 priorityOrder；首屏前三使用 task 自身 priority，FLOW-001 仍为3；Arc 的实际领取尚未链接到正常任务来源；完整UTC、毫秒耗时与关系声明使摘要过长。来源为 GO 的 find-skills、web-design-guidelines1.0.0 与 Vercel command.md 方法，本管理段只登记观察，不称新增实现或复测。

沿原37既有阅读层改动：打开先能看到关键交付和服务可用性，阻塞按owner明确priority稳定排序，再按已验证的大task关系阅读归组。原task/owner/阻塞原文/详情全部保留，未知关系单列，parent没有自身阻塞不能伪造状态；不以关键词猜severity、不文本去重、不建第二手填状态源。开始/完成用紧凑本地时间和显式时区，精确UTC、耗时来源与UNKNOWN留详情，所有事项可展开。

先由原D05唯一writer在合法安全点完成已有Arc来源登记，Original owner自行核FLOW priority事实；本组不改其status/registry。UI实施等待现有owner空槽，使用独立worktree、fresh精确claim和受影响局部验证，复用现37 parent.state===known的关系规则及TIMING02既有计划，不另建同义task，不阻个人恢复。

上述首屏排序验收复用[固定源码与六类定向输入](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-first-screen-priority-research.json)：打乱registry仍按owner priority稳定、关键词不影响、tie/unknown确定、父子事实独立、精确UTC可下钻、Arc领取到来源登记转换。只纳原37/TIMING02，不新增task或当前产品写权。

2026-10-07现空闲W01顺序恢复既有TIMING02，并在相同阅读层承接原WPF001-37；独立dashboard-task-timing-readability树/分支，候选exact9为status/human/app/styles、status-timestamps/human-summary/task-timing三个既有测试及唯一新TIMING02计划/证据目录。与原七范围相比仅加human和对应summary test，原因是owner priority的既有helper入口需直接验证。原scope仍须fresh全局冲突和原子take，不继承旧已releasedclaim；当前25min16MiB普通源段/必要pure累计60s，浏览器未授。用户可用性摘要由原owner供给，Original FLOW priority与D05 Arc来源仍原writer负责，UI不推断或改写源事实。

- GO明确时间记录纪律沿现 TIMING02 / WPF-001-37：每个作者在唯一status记录真实开始、交审与等待起止，完整验收后才填完成；旧首次开工无原件则保UNKNOWN。段结束不等任务完成，精确UTC与来源留详情；不为补metadata打断产品或重跑已绿检查。

### 既有插件诊断与看板加载版本后继（2026-10-07）

WPF-001-05 / REQ22–23 的插件诊断小片采用[最小设计](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-diagnostics-minimal-design.json)、[独立peer](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-store-peer-addendum.json)及[真实fixture补件](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-diagnostics-fixture-addendum.json)。command/render诊断换snapshot却缺专用通知是静态缺口，须先实际挂载复现；activation失败已有publish，不能概括所有错误。复用唯一host的诊断snapshot/订阅，不另造状态authority；真实生产diagnostic小显示组件供Settings与fixture复用，以同host局部state触发renderer throw，不能靠改变祖先App或fakecast session证明专用订阅。Pure与实际mounted验证分层，性能只保待测重render/commit假设，不把稳定key/effect误称remount；实施须独立树/fresh精确claim，不扩大现Arc20。

WPF-001-37 / TIMING02 后继补[旧已加载页面版本差异研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-client-update-research.json)：旧UI可读取最新211数据仍保旧呈现，后续应使页面代码版本/有新版本的显式更新动作可理解。保用户展开详情、输入与选择，不自动reload，不新增手填进度或第二状态源；待合法scope单独实现/定向验证，不倒改TIMING02本轮98pure+6browser/双图与211部署通过。实际[211页面观察](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-211-ui-observation.json)仅作为已发生展示证据。

WPF-001-37 / TIMING02 已完成的紧凑时间/关联事项阅读片已main并在211部署；版本提示仍是同一TODO的后继。[固定界面版本设计](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-interface-revision-design.json)以每服务实例捕获的同一8资产字节派生revision，分开数据新鲜与已加载界面版本，不每poll扫描Git、不自动reload。旧无notifier客户端须一次普通reload，不能宣称能追溯提醒；126100B是固定源码量而非性能测量。未经新合法scope与验证不实施。

既有 RELEASE / MATURE01 / REQ19 的[779接续材料核对](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/web-779-post-recovery-intake.json)确认artifact、四report/16checks与C4实际审已齐。个人首次恢复partialFAIL不触发重建779或重验C4；后续只由原SVC06B依成功恢复实际backend/policy/version形成fresh发布输入，显式激活并核served779身份。尚无成功恢复receipt，不能猜expectedVersion，也不能把fixture或个人报告导入当网页已发布。

### WPF-001-09 / MATURE04-05 下一可用Web实施优先级

按GO本轮明确排序，个人入口恢复与Arc当前验收先收口；下一合法Web scope/worker优先原context length透明UI，高于继续插件管理旁支，不另建plan。既有FlowClient.contextHistory/server持久读由root核合同，Web输入准备与完整体验分开：选定与实际model、来源时点、hardlimit与压缩策略窗口、used/remaining可比性、材料或模型切换失效、历史估算与当前窗口均需明确；session累计usage不冒当前窗口，unknown/unsupported如实，惰性详情且0额外模型token API。实际合同0模型浏览器验收另排，未完整采集不关闭父task。WPF-MATURE-04不在当前管理exact6写域，本处仅更新原总TODO09与队列，待原合法owner维护其status。

P01诊断正确性设计留原TODO05/REQ22–23，不在本次context前新take。W01限时只读证实精确taskId WPF-P01（非协议P01），现唯一web-plugin-host/plans/wpf-p01-plugin-host三件套、旧28b70记录；主线plugin-system仅入口。旧6ce3/basec890、15模块/12browser/PH-R1..R4和maina26a历史保留；原精确start/finish UNKNOWN，不能用旧take/main观察时间补造。未来若迁web-plugin-diagnostics，应同taskId替换D05权威WT/同planDir，先合法scope交权与claim，不保两个status或复制Arc整blob。当前不迁、不写旧树。

MATURE04-05 Web历史消费于22:35:02.638以25d7e029v1原子领取三个新范围，fixedb129/独立web-context-history、263源1826585B。原子take沿已有子项名，不新建同义task；父status仍context-transparency唯一，Web阶段own evidence由本TODO09索引。实现先做历史reader/controller/真实Dialog，App/session/Thread与capability等尚未交权不写，全部当前窗口能力继续OPEN。

### MATURE04-05 模块交付与薄接线路由（2026-10-07）

原WPF-001-09引用[父MATURE04唯一计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/plans/wpf-mature-04-context-transparency/plan.md)和[Web模块限定审查](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/context-history-module-review.json)。新历史模块c5f896已16pure+strict通过并限定批准；ui.layout只打开UI，App/session私有reader仍须在真实身份/当前view/task与请求返回时授权，完整CT01–09不因本片关闭。接线前仅Arc真实持有的App/session两叶STOP→partial-amend；Thread另核真实writer。两个固定基线b129与Arc e611后续由Original窄合并保双方改动，交权不等源码已集成或组合浏览器通过。领取已真实可见：[现有UI观察](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-context-take-observation.json)，不新增同ID第二status。


### FLOW-001 REQ-01/22 / O12-05：Web 持续目标会话（待领取）

- [ ] **原任务后继待领取，不新建重复大task。** 用户在同一连续对话提交目标，阅读真实解释与计划调整，原地处理决策，查看验证产物；无需逐任务跳转。沿 FLOW-001 的权威索引/status/dashboard 和两层 task/subtasks 组织，WPF-M02 十任务总览不是本项替代。排在个人入口恢复、Arc/context和成熟聊天收口之后，优先于插件新旁支；本条只登记，无新WT/claim/运行许可。
- [ ] 复用现 @flow/interaction/goal createGoalEntry/createGoalSession、goal-session-controller、解释历史、计划/决策/产物和 graph-plan/native-execute 接缝，以及 FlowClient/recovery/assistant-ui。Web不造调度或权限权威，不把日志或固定fixture话术当模型回答；自然语言回复、材料共享合同缺口交原中心owner。GO固定main71288a457只读观察作为输入，具体代码设计与原件后续单份引用。
- [ ] 正文优先，tool/thinking按需可达；历史/节点/并发/字节/DOM全部有界。验收真实NL plan→execute→decision→artifact→独立接受，并覆盖恢复、迟到、冲突、双主题、键盘与窄屏。零模型公开旅程可分片交付，真实native未验则保持OPEN。仅整task blocker或Done向GO汇报，不为普通记录索取新确认。


同项[固定研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/continuous-goal-web-research.json)记录 main71288 与已装 assistant-ui0.15.23/core0.3.22 的真实接缝。原两层结构为 FLOW-001 REQ-01/22 / O12-05 父任务及以下待领取交付片，不创建新同义task或writer：

- [ ] Web共享controller消费片：真实goal入口、单会话正文/计划/决策/产物按需展示、稳定render snapshot缓存，复用既有2reads/4queued/50page/200cache边界；GoalExplanation仅解释记录，不当assistant回复。
- [ ] 原中心owner依赖片：progression durable commands、goal级真实对话合同、材料冻结分别固定来源/权限与失败语义，Web不本地补调度或权限。
- [ ] 实际旅程与独立接受片：先零模型公开旅程及恢复/迟到/冲突/主题键盘窄屏，再真实native授权验收；前者不能关闭后者。所有片目前待领取，先完成当前恢复、Arc/context和成熟聊天；不新WT/claim/窗口。


- [ ] **MATURE04-05 × Arc 组合接收边界：** [固定四Git输入与断言](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/arc-context-composition-research.json)只读记录，原两分支独立approval保持；Arc ebcd的 `currentGroups = layoutGroups(layout)` 包含隐藏workspace，context ed5自身基底的 `historyAuthorized` 对 `currentGroups.some(activeId)` 的语义不能整段移植。未来受控组合须用Arc `visibleGroups` / 当前active panes核授权，并实际覆盖held-history read期间切workspace→撤销/清空→迟到不发布→显式重开才恢复。当前Context准备段只两test，不改冻结产品或Arc；12binding PASS不代组合挂载验收。


同一dashboard后继补[领取详情刷新语义](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-context-claim-sync-explanation.json)：当前“更新此详情”在已有available观察时只更新已加载snapshot，不发新ledger读取；Context v3已合法提交，但旧23:08:38页面观察仍v2，保持PENDING_SYNC。后继应清楚区分更新阅读详情与重新核对领取，保用户已展开内容与时间来源；本次未证服务器失效，不再重复GET或另建产品任务。

### 既有 OPS16 轻量前置与模型显示后继（2026-10-07）

- [ ] 在既有 OPS16 方法内复用真实公共 decoder 检查 fixture 实际目录 DTO，固定供给从实际入口递归核 literal/静态资源并声明动态边界，尽量在 PG/Chrome 前暴露准备错误；不写第二 schema 自证、不扫全库、不造框架、不重开已冻结通过工作。Arc 原 DTO 的 displayName 空格已由真实 codec 证明拒绝、修后通过；Context 原614供给漏固定startup leaf，372文件有限入口图正修准备。上述是当前实施证据，不据此冒完整 runtime/所有动态边界通过。
- [ ] 沿[MATURE02唯一父计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)自然更新后继：友好 displayName 与实际执行 modelID 应分责。当前只修夹具符合既有合同，不临时放宽共享 schema；后继合同能力/兼容迁移由原 owner 在合法范围内处理。此处为交接引用，不复制父 TODO/status。

### OPS16 本轮连续段实际执行（2026-10-08）

00:12:46.922 实际一次派出 Context25min/320MiB、最多3次90s浏览器累计270s，以及Arc35min/384MiB同范围连续段（运行窗口顺序交接，源检查可并行）。每段最多4个相关局部child20s/累计60s，含清理；旧6352/20654ms等各段均CLOSED，旧余量不转。每个source/result固定记录，已定位普通fixture/CSS/窄产品错误可直接修复与相关复测，末尾一次独审；权限/归属/cleanup/验收含义变化才审变化面。真实START/terminal/RETURN与交接历时保留在原current/owner原件，不把准备或等待冒运行。

OPS16 后继沿原Q01/GDEP支持层：现PG测试import历史evidence fixture，准备绑专名PG_OPEN/旧HEAD/window/root/≤10s启动，普通Vitest筛选不能替代准入。下个合法改动让稳定PG支持层接明确run context，资源准入留caller，复用markedDB生命周期；Q01 listen/boss与GDEP SQL保各自职责，不造泛化框架、不新task、不重开已绿2/8例。X01 runtime后继8MiB仅为预算可行研究（no-checkout及本WT精确non-cone供给，含自身index双副本/objects/TMP），须原runtime/config真实交权及VAR main后fresh重算；不改共享gitconfig或安装，当前未授源段。

原WPF-001-09 / MATURE04-05 已完成本次独立历史面板8组及390双主题限定验收；当前容量/producer完整观测/Arc组合与pending revoke仍开放。长model ID在窄屏重复占约8行属非阻塞信息紧凑度后继，沿[Mika唯一父计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/plans/wpf-mature-04-context-transparency/plan.md)记录，不另建task或复制CT矩阵。
OPS16另有只读helper风险：conversation.fixture async经conversation-stream-integration wrapper可能漏return Promise，外层workspace-layout catch因而不能接拒绝；未证为本轮失败根因，原helper不在Arc exact18时不越权修改，待正常原owner范围处理，不重复全套验收。

本次Context连续段[一次限定独审](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/context-continuous-acceptance-review.json)确认末轮8/8+双主题390图，前两轮失败及旧6352ms保留；固定[Host机制研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/context-fetch-host-research.json)仅作为fixture修复依据。受控Arc组合沿[实际visible-view接缝证据](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/context-arc-visible-view-composition.json)：Arc currentGroups含隐藏workspace，reader授权应消费visibleGroups并保Thread visible/session lifecycle；既有binding.visible是防线，不冒现泄露。heldhistory/detail、同viewtask替换、在途撤权仍原CT后继，不阻本独立小片接收。
RELEASE01-11已由main2dbc受控接收，原owner69d0203 metadata收口、claimb4d7v2仅保2个records目录，两harness叶交回；RELEASE01-10与整体仍OPEN，网页779/v4实际发布引用Original独立回执，不重建或重验4App。

原 TUI01F-04 接续只读研究见[未决 final 事件](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/tui-r2-uncertain-final-peer-research.json)。B exact attempt 的 seq2 assistant-final 证明 barrier 已释放并进入投递链；HTTP拒绝、ACK丢失或重试未结尚未知，原owner限定诊断，不延长8秒断言、不把部分链路通过改成整体PASS。该记录仅既有跨lead接收桥，未派新执行者或清理者。

D05发布健康必须同时验证summary来源数与`/api/assignments`载荷`state=available`，HTTP200不等于领取可用。213发布遗漏显式协调数据库绑定造成全局UNKNOWN，已[原owner修复回执](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-center-source-coordination-repair.json)于00:56:14.690RETURN，213来源/available272claims，root原IAB确认全局unknown消失；[只读机制证据](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-claim-readiness-regression.json)说明后继复用该轻量payload见证，保原summary-only失误，不重置claim或新建DB。

### D01 / WPF-001-37：当前工作段历时后继（2026-10-08）

- [ ] 在唯一 owner 的 status 增加明确的本工作段起止与来源，dashboard 独立显示“本工作段历时（含等待）”。采用[兼容设计](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-current-segment-timing-design.json)：完整 task 起点 UNKNOWN 与工作段已知时间互不覆盖，段结束不等 task Done，不累计净工时。只对后续真正新段采用，不批量补历史、不从 commit/mtime/claim/自由正文推断，不新增第三层 task、后台计时器或第二手填源。
- [ ] parser/model/UI 分开 task timing 与 workSegment 的问题；陈旧 snapshot 同时撤销两种 elapsed 的当前断言。原 TIMING02 全部完成记录保持通过，本项是原 D01 后继；实现仍由合法独立 owner/scope 承接。

本轮原要求统一归入既有计划：[MATURE06-04 可行动登录](../wpf-mature-06-chat/plan.md)、[三真实插件挂载面](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-action-surface-peer-mapping.json)、[MATURE03 附件命中后继](../wpf-mature-03-attachments/plan.md)、[MATURE05 窄 tab 视觉 P2](../wpf-mature-05-workspace/plan.md#arc-visual-narrow-tab-01)。仅引用 Mika 的 MATURE04 唯一父计划，不生成第二份状态源。

### D01 / OPS16 固定输入与等待复盘补充

- [ ] 原TIMING02的纯metadata提交曾触发整HEAD绑定准备重新固定；GO本次回读报告整段87分48秒、准备审到START约19分27秒，但没有证据把全部等待归因于重绑或资源。下一原owner合法安全点区分实现/actual输入与普通status提交，仅输入字节、身份或权限约束变化时重新准备必要部分。当前监督器若仍绑定整HEAD照原合同执行，不改冻结包、不重开已完成TIMING02、不造平台/第三任务或新测试。原连续有界修复规则继续适用。
- [ ] D01聚合/claim映射沿原任务补“明确子TODO→父唯一status”下钻：MATURE06-04对应本MATURE06，MATURE04-05对应Mika的context-transparency父计划。当前页面显示“已领取，进度来源待登记”是展示映射后继，不能要求两子片各建第二status；只有原明确关系可解析，未知关系仍未知，不按ID或标题推断。原子领取有效性与进度来源分别保真，当前产品交付优先。

原WPF-001-05/plugin覆盖后继追加[Thread footer固定研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/thread-plugin-coverage-research.json)：TaskThread未接MessageFooter；Conversation host的通用footer贡献被user/assistant-draft门控，普通assistant-final缺入口。下一合法owner分开通用贡献渲染与内置stream/activity的role资格，保task/message身份和能力复核，不能简单移除gate造成内置重复，也不建第二registry。无runtime贡献验收；Arc overflow菜单裁剪仅静态风险，当前Arc/login交付优先。

D05已[一次实际215发布](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-verifier-sources-live.json)于01:13:24.689归还，213→215一次、214未独立部署；summary215与assignments.available/publicaccess同验，root现有IAB确认用户可见。登录[source/local限定批准](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/connection-actionable-source-review.json)不覆盖后继mounted/真实认证或main。

上述footer后继还须统一可信task/message解析：现MessageFooter只有messageTask(messageId)，MessageActions才有scope.taskId fallback，故只为TaskThread传入组件仍可能无task早退。沿既有已验证解析逻辑复用，未知message/context不强转；通用贡献与内置role资格继续分开。

[有界首失败证据方法](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/ui-failure-evidence-research.json)复用message-settings原错优先模式：custom Arc/Connection库调用不会自动继承plugin-host Test Runner的retain-on-failure。优先原错、已报告组/phase、小图与必要几何，诊断错误单独保留，不占cleanup；原冻结失败不重写。登录首mounted[初始化失败保真审](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/connection-mounted-failure-review.json)确认CJS入口未优化、10515ms CLOSED/0图；新段仅修fixture固定依赖优化，不改产品或冒已测真实认证。

- 原 WPF-001-05/plugin-host 后继 `PLUGIN-DIAGNOSTIC-NOTIFY-01`：固定源码发现 diagnostics 的100项有界数组变化未通知 PluginSettings 所订阅的接口，已激活插件孤立错误可能直到其他发布才显示；这是静态P2推断，未实测浏览器，不撤销原错误隔离结果。由原合法host owner在下一段复用现有store补稳定诊断订阅与dispose，避免为错误重建全部slots、避免通知异常递归；用已激活插件的通知/稳定snapshot/解绑不变量和既有mounted设置入口验证。无第二registry，不加当前Arc/login前置。[固定证据](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-diagnostic-notification-research.json)。


登录当前组件验收已由[最终限定独审](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/connection-mounted-final-acceptance-review.json)接受：cc4封存、末轮六组与390双主题通过，旧初始化失败和新段前两失败不改；真实认证/fullApp/main/deploy保持原MATURE06后继。Arc由[几何最终独审](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/arc-geometry-final-acceptance-review.json)限定接受四组功能、Close完整可见和8rem口径，滚动条压字仍原MATURE05视觉P2；[留白研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/arc-scrollbar-clearance-research.json)只指导下一ownedCSS窄修，不隐藏bar或等待fade掩盖现场。

既有子TODO→父唯一status映射采用[固定只读研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/dashboard-child-claim-source-research.json)：显式关系保原claimId/taskId/executionWT/branch/scope，跨WT进度链接不转移写权；relation参与registryFingerprint，避免不同映射版本误join。未知、歧义、stale仍保占用，多claims不压成单owner；未运行产品验证，不新增status源。

- 2026-10-08 02:33 UTC自然事实批：Arc滚动条小片8ca9/3904限定通过且全STOP；登录cc4仍待受控main，VISUAL01 d227保留首次六组通过/浮层夹具FAIL并进入原任务窄修。O16实际renew已在原期限内START并FULLRETURN，后续children另选一次150s，不能因准备完成自动连续执行。S01原quiet未OPEN取消保留；新单臂诊断只允许其他队轻量源码/metadata/正常Git，PG、端口、安装、build、新工程child仍排他，结果不冒AB容量或SLO结论。

- 原MATURE02 TODO08/11与MSG03设置入口：已把[固定Web创建接缝研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/web-settings-creation-seam-research.json)交Mika唯一父计划。Web当前legacy目录排除版本化设置，而TUI/new已有入口；后继复用prepare→原creationKey→CREATE-only→可信GET capability，不新receipt系统、不消费原draft、不因失ACK换key。需显式版本化ProfileSelection与Recovery codec分支，先协调App/I02、现Picker与recovery/binding.tsx权属，不能只松旧codec或让TUI代建。SVC09A产物与零模型激活沿Original独立原任务。
