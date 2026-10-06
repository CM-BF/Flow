# WPF-001 Web 平台持续执行与需求账本

| 字段 | 内容 |
| --- | --- |
| 计划编号 | WPF-001 |
| 状态 | `in-progress`；持续目标按轮交付，不声称“完美”或无限优化已完成 |
| 创建 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 唯一管理 owner / model | d01_owner（本轮执行管理者）/ gpt-6-astra ultra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management` / `codex/web-platform-management` |
| 固定基线 | `d444608ab6c796c731e44e51a892868bf39bec2a`；2026-10-06 02:07 UTC 核验 main clean 后创建，不追逐 main 后续 HEAD |
| 独占写入 | `plans/web-platform/**`、`docs/evidence/web-platform/**`；不写 W01、其他 owner、共享契约或 main |
| 父目标 | [FLOW-001](../flow-001-architecture/plan.md)、[完整验收矩阵](../flow-001-architecture/full-plan-matrix.md)；W01为历史起点；当前实现按下方每片唯一owner/status与D04 scope推进 |

## 用户原话与来源轮次

这里持久保存本轮已传达的全部需求。引号中的原话由用户消息或 Goal Owner 逐字转交；没有逐字文本的轮次明确用“准确摘要”，不伪造引用。新消息到达后追加稳定 REQ ID，记录它改变什么、对应 owner/计划/验收；不能只留在聊天或模型上下文。既有要求不因新一轮 UI 修改丢失。

| 来源 | 用户原话或准确摘要 | 落地约束 |
| --- | --- | --- |
| U00 原始外部派工 | W01 产品 Web 与 D01 工程 dashboard 已授权实施；独立 owner 并行，协调者不直接写实现；优先 Astra Ultra，所有写入至少 Sol；原 squad 最多3活跃、项目总上限10，遵守实际运行时限制 | 初始基线 `eacee76fa7f1b6cc46b06b57ae68458637be4a26`，原 owner 独占树和范围，独立验证/提交，不 merge main，原 Execution Lead 集成 |
| U01 官方 Thread 整改（原话，由 root 转交） | “我不喜欢这个style，assistant ui没有其他style了吗？”；“你用了assistant ui的skill了吗？用的话你怎么会不使用Thread组件呢？完全不合格” | W01 从官方 registry 取完整源码、固定来源/hash、保留主要结构和行为、最小适配公共 FlowClient |
| U02 布局与交互（原话，由 root 转交） | “侧栏chat高度要窄，和arc浏览器一样的风格。可以split，merge到一个tab上。功能栏竖着放最左边和codex类似。AI elements里的termina，file system全部接上，接到右边tab格式，和codex一样。 Maximize你的subagents，你应该还有一个subagent栏位吧，派工” | W01 主 shell/split/merge；workspace_panels_owner 官方只读右侧面板；截图为设计输入，不冒充已有能力 |
| U03 角色分工（原话） | “你负责不停做research优化，你的一个subagent来负责管理” | root 持续只读研究/独立审查；d01_owner 执行管理；两个实现 owner 独立 worktree。当前4活跃，实际cap4，满槽排队，不额外spawn |
| U04 持续执行与插件（原话） | “记好plan，status，review，dashboard。然后你要不停的加plan，不停的增加新的功能，不停的优化性能，没有上限，只要不是完美就优化。并且确保我们所有组件都一定是被设计成可插拔的，我们要完整的plugin系统。所以所有的地方都要能随时加一个按钮之类的。” | 每轮形成可验证产出，持续记录下一功能/性能/研究队列；全栈 plugin 系统与所有适当 UI 扩展位置纳入计划，不把局部 slots 当完整 plugin 系统 |
| U05 需求持久化（原话） | “我和你说的话全部记进plan里，不要只靠脑子记” | 本文逐条追溯；每个新增 plan 都有唯一 status/review，未审查保持 NOT_STARTED |
| U06 Dashboard 视觉反馈（准确摘要，由 root 转交） | 用户不满意4320样式并提供 dashboard 截图，要求紧凑中性视觉；当时主线确认4320为17来源；03:17已实核30来源且原17保留 | 主线 D03 独占视觉与语义实现；WPF-D01仅协作需求/来源登记，不另派实现，不停/重启/覆盖原Lead4320服务 |
| U07 速度与验证（原总体 Goal Owner 经 root 转达，准确摘要） | 用户强调推进速度与 local tests；按实际影响范围先测本模块与直接依赖，共享接口变更才测链路，metadata不重复全库测试 | 保留真实行为、视觉、a11y验收，不为提速假连接；主线D03承担dashboard全部后续，M02提供公共工作/决策能力，W01保留消费接缝 |
| U08 多lead领取协调（原话） | “和你在一起工作的还有其他agent leads，一定要管理好执行dashboard，你们才不会overlap工作。take 工作最好也在dashboard上标清楚” | 主线D04维护唯一PG领取账本，多Lead按真实actor原子领取/显式转交；进度仍各status唯一，不凭旧源或缺失源当空闲 |
| U09 产品预览与架构tab（原Goal Owner逐字转交，经root传达） | “把产品Web UI打开留着可随时看，且工程dashboard增架构tab” | 原Goal Owner最终选择已审M02的49922并已打开保留用户tab，明确HTTP fixture；原owner保留服务，55049仅I01开发验证，不另起重复服务。工程dashboard架构tab由主线已承接，我方不改其代码 |
| U10 插件管理入计划（原Goal Owner逐字转交，经root传达） | “plugin管理写进计划里” | 主线维护独立X01全产品插件管理canonical计划；我方链接追溯并继续P01/I01前置，不重复建立X01或扩大已领生产范围 |
| U11 真实持续对话优先（原Goal Owner反馈经root转交，准确摘要，未提供完整逐字原话） | 用户在49922输入hi后只看到固定英文center/runner/result和Field notes/Verification卡片，要求真实Codex式持续对话；需要模型、thinking/effort、access权限、context、files、语音、发送、消息气泡、queue、steering、tool calls及可展示thinking；正文优先而详情按需 | 真实聊天核心优先于PERF02与工作台装饰；I01既有收尾继续，49922原tab/fixture服务保持且明确演示性质；真实中心能力与契约由主线唯一owner提供，不能用缺少持久conversation/turn/context lineage的任务拼接伪装追问，steering必须active turn/attempt确认生效 |
| U12 领取与跨Lead协作重申（root逐字转交） | “take工作在dashboard标清、跨lead防overlap” | 复用U08/WPF-REQ-37与现有D04事务claim；确认owner/Lead、worktree/branch、精确写入范围、state/version实际可见，不造第二手填进度或口头抢占 |

U00 补充执行约束：dashboard 优先尽早交可查看版本；来源映射严格以完整 handoff 的 task→唯一 owner worktree 登记为准；临时样本覆盖状态变化、缺失、空 review、转义与路径限制，真实工作树只读核验，二者证据明确分开。U02 原文保留拼写，实施含义为官方 AI Elements Terminal/FileTree，不伪造PTY或任意文件系统。

视觉输入文件（已由用户提供；路径仅用于追溯，不复制到其他任务）：
- `/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/TemporaryItems/NSIRD_screencaptureui_NDMyZU/Screenshot 2026-10-05 at 7.01.44 PM.png`
- `/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/TemporaryItems/NSIRD_screencaptureui_Q7C3Y2/Screenshot 2026-10-05 at 7.02.26 PM.png`

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
| WPF-REQ-16 | U00 来源/更新时间/HEAD/dirty及缺失/解析失败/过期明确 | 主线D03 | 状态/分支切换与缺失样本，空review不通过；文本转义、路径/realpath限制 |
| WPF-REQ-17 | U03 root持续research、subagent管理 | root / d01_owner | root不写实现；管理者持久化研究→owner→验证；不以研究替代ready实施 |
| WPF-REQ-18 | U00/U03 >=Sol、优先AstraUltra；当前cap4/满槽排队/项目10上限 | 管理者 | root+管理者+W01+panels=4；不再spawn，后续owner复用空位；项目总槽与原Lead协调 |
| WPF-REQ-19 | U04/U05 全部用户话进plan、持续维护plan/status/review/dashboard | 管理者、各owner | 每条REQ有来源/owner/验收，新增plan必有三件套；原话与转述清楚区分 |
| WPF-REQ-20 | U04 持续新增计划和功能 | root研究、管理者排队 | 每轮交付后按实际缺口选择下一ready计划；不把单批次或“完美”宣称完成 |
| WPF-REQ-21 | U04 持续优化性能 | WPF-PERF01 | 固定fixture/机器/build测基线及增量；证据支持改进，保持功能不退化 |
| WPF-REQ-22 | U04 所有组件可插拔、完整plugin系统 | 原Lead X01 + WPF-P01 Web子项 | 全栈生命周期、版本/配置/权限/隔离/CLI等价；UI统一扩展接口，内置功能也使用 |
| WPF-REQ-23 | U04 适当位置随时加按钮等扩展 | WPF-P01 | stable slot IDs+commandId，sample插件不改核心即可加button/tab/menu；不是每个DOM节点套Slot |
| WPF-REQ-24 | U00 独立worktree/branch，先核验不重建/重置/覆盖 | 管理者、各owner | 记录base/head/dirty与允许范围；冲突交唯一owner，管理者不并发写W01 |
| WPF-REQ-25 | U00 find-skills本地优先、固定来源，无重复安装 | 各owner | 每stack读本地skill并记录路径/hash/应用；assistant-ui/AI Elements/clean-code固定源 |
| WPF-REQ-26 | U00 每段/约30min安全停点/交付clean-code | 各owner | 实际命名、职责、接口、错误、重复、复杂度、行为检查发现/修复记录 |
| WPF-REQ-27 | U00 启动/实质进展/阻塞/交付/review修复更新状态/TODO/证据 | 各owner | status真实时间/目标SHA/检查/限制，完成可被dashboard读取 |
| WPF-REQ-28 | U00 独立review绑定SHA，未审NOT_STARTED | root或独立reviewer；owner转录 | 新实现不继承旧approval；metadata diff和实现target区分，不虚报当前HEAD通过 |
| WPF-REQ-29 | U00 feature分别提交/验证、不merge main、原Lead集成 | 各owner/原Lead | 完整SHA/branch/dirty/启动URL/checks/双主题图/技能/限制/plan-status-review回传 |
| WPF-REQ-30 | U00 共享改动交清单，不动共享contracts与其他owner记录 | 管理者/原Lead | 依赖lock、索引、registry、未来后端能力在handoff逐项列明 |
| WPF-REQ-31 | U06 紧凑中性dashboard且不打断4320现有17源服务 | 主线D03；WPF-D01仅协作 | 主线唯一owner实现与切换；我方不另派dashboard实现，提交来源清单，保留原17源及安全边界 |
| WPF-REQ-32 | U02 扩展视图不伪造终端/文件系统能力 | panels、原Lead | 现契约只有Timeline text/reference和Detail；标“任务输出/任务产物”，BR-01-A～D具体能力请求交Runner/M02/X01，由Lead登记owner及SHA；不称文本为stdout |
| WPF-REQ-33 | U04 与既有全栈插件/协议计划对齐 | 管理者、原Lead X01 | WPF-P01仅X01 Web host子项；原P01=协议接入不重用，M02公共命令不另造 |
| WPF-REQ-34 | U07 按影响范围做 local tests 并加快可审查交付 | 所有owner | 模块+直接依赖优先；共享接口才链路；纯metadata仅文档核验，保留必要视觉/行为/a11y |
| WPF-REQ-35 | 主线M02已交付完整接口；Web整改稳定后接入统一工作总览 | WPF-M02 / workspace_panels_owner（已独立交付） | 连续feed/attention原地决策、锚点/409/100+分页/懒详情/连接隔离，真实Web验收独立 |
| WPF-REQ-36 | 主线D03要求各权威status提供明确人读字段与实现范围 | 每个唯一owner自行写；管理者协调 | 阶段/优先级1–9/当前产出/下一可用交付/明确阻塞与决定/完整实现target与literal范围；不写其他owner状态 |
| WPF-REQ-37 | U08/U12 多lead避免重叠、take工作在dashboard标清 | 主线D04唯一账本；各Lead真实actor领取；各owner唯一范围 | taskID/owner/lead/worktree/branch/精确范围、claim版本/状态/时间与交出接收方可见；PG事务拒绝同task及同/父子路径冲突，跨task部分转交先停写→amend→take，不靠口头抢占；[04:07领取视图与42源实证](../../docs/evidence/web-platform/assignment-visibility-verification.json) |
| WPF-REQ-38 | U09 产品Web打开并保留，可随时查看 | 原Goal Owner选已审M02 49922；原owner保留服务 | 已审M02 http://127.0.0.1:49922/用户tab已打开并保留，明确fixture及恢复方式；I01 55049仅开发验证，不能声称稳定main或真实中心服务已起 |
| WPF-REQ-39 | U09 工程dashboard新增架构tab | 主线dashboard唯一owner / 原Lead承接 | 架构tab作为dashboard入口可访问；具体实现/来源/验收由其唯一[D05计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture/plans/d05-architecture-view/plan.md)记录，D06旧ef42277固定8f图已审集成并部署，旧claim已释放；前轮5ec固定eb已审集成并部署、e5b2 v2释放；[当前D06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-context/plans/d06-architecture-refresh/plan.md)沿同一图由panels从115b新树取得981d四scope，刷新数据和语义检查；本轮ff5已审集成accepted86a，981 v2释放且唯一source已部署，图仍固定115b，与个人运行版本分开 |
| WPF-REQ-40 | U10 plugin管理写进计划里 | 主线X01唯一canonical owner；我方父计划关联 | 主线计划包含Web管理页和CLI公共center命令、持久版本/配置/权限/作用域、npm install/enable/disable/upgrade/rollback/remove、活跃执行版本绑定、可信/隔离边界；实际[X01计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-management-plan/plans/x01-plugin-management/plan.md)已建立，文档888308d是全栈计划来源；X02持久registry及X03只读Web管理已有限交付，npm执行/完整生命周期与第三方隔离仍未完成。P01/I01本地Settings不冒充完整插件管理 |
| WPF-REQ-41 | U11 真实持续对话优先与明确演示边界 | [WPF-CHAT01 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations/plans/wpf-chat01-conversations/plan.md) / workspace_panels_owner；主线center/runner | hi自然回应、同conversation追问、断线重连；49922不暗换/重启，固定fixture不冒充模型输出。Web已按[CHAT receipt](../../docs/evidence/web-platform/chat01-take-receipt.json)独立受领；[PERF02 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window/plans/wpf-perf02-activity-window/plan.md)依[独立receipt](../../docs/evidence/web-platform/perf02-take-receipt.json)并行，不占CHAT范围或替代对话优先 |
| WPF-REQ-42 | U11 模型/effort/access/context/files与发送 | 主线capability catalog契约；Web真实消费 | 控件只展示中心支持的模型/能力和授权范围；unsupported明确，权限不由前端自授；context/files使用授权资源与版本，不能凭显示路径假接文件；K02固定736三contracts已按Lead受控输入消费，新八scope薄reader固定763已独审APPROVED，最终2bce clean已记录main115b、claim5ab v2释放，保持project身份/旧能力缺省与只读metadata；不开放context UI |
| WPF-REQ-43 | U11 消息气泡与正文优先、tool/thinking懒详情 | Web renderer与中心投影owner | 用户/assistant正文为主；tool及provider可展示thinking初始仅id/title/状态，初始响应/SSE没有大payload；鉴权展开前0detail，首次1/重复缓存，provider无thinking则不伪造；现有generic reference没有typed状态；已main CHAT05另有typed native接口，ActivityI消费真实工具/思考并保持generic fallback，未给thinking不造；不要求跳任务页。真正partial须native event→持久→read/projection，不用快poll或动画冒充；真实聊天/折叠详情链之后，主组合收拢为单一外层执行折叠入口，默认model/access/queue主要状态可读，其他技术语义可达，unsupported/unknown明确、requested不冒actual |
| WPF-REQ-44 | U11 queue和steering | 主线持久commands/runner；Web有权触发与渲染 | 中心队列持久、有序、可取消与重连；按固定main14c61公共合同，pause受理或原key重放后必须fresh GET最新paused/currentTurn，再由用户明确单独取消当前active task，两份receipt/结果分别显示，不称stop-all。same queueRevision也更新动态taskStatus/blocked/paused，旧ACK不覆盖新GET。Web实施见[QUEUE01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-queue/plans/wpf-queue01-ui/plan.md)；当前页面unknown key重试与中心状态重载恢复分开，原key跨reload/换连接恢复仍后继。steer仍不支持，须独立受理/送达/生效证据，不以HTTP超时当取消 |
| WPF-REQ-45 | U11 语音录音/转写与失败恢复 | 主线能力接口；Web受控交互 | 录音与转写分开、明确开始/停止/失败，失败保留文本输入；本轮不偷接付费语音服务，未支持明确，凭据不放浏览器/插件 |

## 当前 owner 与接口冻结

本表只列本队当前可写权威来源，实际范围以[本次D04读取与释放回执](../../docs/evidence/web-platform/current-owner-observation-0723.json)和committed receipt为准；不重新授权已释放范围。跨Lead仍只有D04一套账本，claim数量不当作agent并发。

| 当前工作 | 唯一 owner / worktree / branch | 写入边界与下一停点 |
| --- | --- | --- |
| WPF-PERF03 | w01_owner / web-message-reuse / codex/web-message-reuse | claim2ec58c2c v1，五literal；固定已审30b，messages.ts对新main253b相同。仅不可变turn身份的消息对象复用/实际core转换计数；不占App/Thread/stream，首canonical8f2959d7已管理核parser0并一次SOURCE_READY |
| WPF-CHAT06S01 | workspace_panels_owner / web-conversation-stream / codex/web-conversation-stream | claimd94ae4bb v1，七新literal scopes；[唯一status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-stream/plans/wpf-chat06-stream/status.md)。完整已审base fa9，三纯模块/两专测/自己plan-evidence；不占App/Thread，不再叠加shared输入 |
| WPF-001管理 | d01_owner / web-platform-management / codex/web-platform-management | claim632a7149 v2，仅plans/web-platform与docs/evidence/web-platform；不代写其他owner事实或产品实现 |

历史W01/P01/PERF01/CHAT/I01/M02均由原owner在06:43–06:45完成mainmetadata和release；PROFILE17093 v2早于04:59已释放，后继App也已另片集成。rendererI/D06在accepted86a后已释放；C01/ACTIVITYC01在fa9后07:11:50释放；ActivityI已入253b，原122 v2于07:23:42释放。历史原表与WorkspacePanels接口原文保留在[时点归档](../../docs/evidence/web-platform/owner-queue-history-before-0718.txt)，其版本和临时依赖例外不作当前写权；完整原receipt及实现证据沿各canonical与父status历史入口查阅。

## 已确认决定与工程方案

- 继续沿官方Thread和现有公共client，真实持续聊天、工具/思考折叠与增量正文优先；每片独立tree、固定输入、精确take、独审后集成。未消费的能力不因SDK存在而显示已支持。
- 现有`@assistant-ui/react@0.15.23`/core0.3.22源码是行为依据，不因最新文档存在API就升级依赖或使用不存在的接口；保留composer草稿、原key回执、queue和旧中心语义。
- split/merge只组织tabGroup，不合并消息；双split各自可见，与全局focused分开。隐藏、离线、关闭、换中心分别验证，关闭观察不取消任务。
- FileTree/Terminal与现有详情只据真实公共接口展示，不从UI推导PTY或任意文件读取能力。完整X01生命周期/第三方隔离/CLI等价仍归主线唯一计划；P01可组合slot不冒称全栈交付。
- dashboard由Lead唯一部署/登记；我方只管理本队source和已授权窄采样。性能需实际消费者/规模证据，合成probe不能宣称生产容量或用户延迟收益。

## 当前执行队列

| 顺序 | 当前计划 / 交付 | 状态与开工条件 |
| --- | --- | --- |
| 已集成 / 原范围释放 | WPF-ACTIVITYI01真实工具/思考与footer | ba341已审并在253b祖先/17paths相同，最终9aa35096 clean、122 v2已释放；保留R1红→修与不同target证据，不重复验收 |
| 并行实施 | WPF-CHAT06S01增量正文独立模块 | d94七scope实施，Lead07:16:38.910Z已实采84源live/issues[]；不将模块完成当App接通 |
| 并行窄优化 | WPF-PERF03消息对象复用 | 五scope已take，仅同turn对象复用与转换调用计数，不声称浏览器延迟收益；stream接线只读消费现conversationMessages接口 |
| 后继准备 | stream实际App接线 | 仅scope/interface proposal；ActivityI已main并release；仍需模块固定独审及准确组合base后新take。不并行抢App/Thread，不新建agent |
| 已集成 / 原范围释放 | C01/ACTIVITYC01与rendererI/D06 | 源码祖先/hash及原子release已核；不再等待集成，也不在旧树追写 |
| 已验真实持续聊天 | 既有CHAT/QUEUE与GO两query | GO/Lead固定真实两query2/2已验收封存；running入队、继续、浏览器退出与精确第二回复通过。本队只消费固定证据，不重跑模型；steer、语音、完整context等未完成项保持原REQ |
| 跨团队协调 | D04写权、Lead来源/部署、Mika领域工作 | 当前三active本队claim按真实范围防交叉。GO说明Mika仍2槽、当前无静默窗口；不自发暂停或扩大并发。只发送新可行动里程碑，不重复纯metadata通知 |

## TODO

- [x] **WPF-001-01** 持久化全部已传达用户要求与原话/摘要、来源轮次、稳定ID。
- [x] **WPF-001-02** 明确owner/独占范围/接口/依赖，建立无编号冲突的后续plan/status/review。
- [x] **WPF-001-03** 接收官方Thread与panels独立提交，完成W01集成、回归与独立review闭环。
- [x] **WPF-001-04** 向主线D03交付管理来源登记清单并只读验证；02:38:47.600Z新版22源中3个WPF源完整无issues（仅登记验证，不表示实现完成）。
- [ ] **WPF-001-05** 已审P01/I01前置继续与X01/X02衔接完整插件管理，保留中心生命周期/权限/隔离/CLI与后续Web消费验收。
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
- [x] **WPF-001-17** [WPF-RENDERER01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-data-renderers/plans/wpf-renderer01-data-renderers/plan.md)：按固定fb906独立模块与八scope正式受领，交付确定性可信data-renderer注册和每provider隔离、按需详情的单一内建例子；App接线、完整X01生命周期另片，独审/主线另计。
- [x] **WPF-001-18** [WPF-K02C01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-compatibility/plans/wpf-k02-compatibility/plan.md)：原QUEUE已停写释放后，从已审3d4985新树取得八scope；仅消费Lead三contracts受控输入，完成project身份与旧cap/metadata薄兼容，不开放引用选择/发送，固定验证后独审。
- [x] **WPF-001-19** [WPF-ACTIVITY01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-activity/plans/wpf-activity01/plan.md)：按固定3d4985新独立树与八scope受领，复用真实TaskSummary与bound lazy events/detail交付执行活动独立模块；初始零请求、显式分页/刷新、身份与隐藏/连接寿命隔离，App接线另片，不把现reference伪作typed tool/thinking。
- [x] **WPF-001-20** [WPF-RENDERERI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-data-renderer-integration/plans/wpf-renderer-i01-integration/plan.md)：消费已审renderer747并在115b独立树领取九scope接实际聊天；显式native-hidden可见性与display lease、真实按需详情、provider清理与原composer行为验证，完整X01/typedCHAT05另片。

- [x] **WPF-001-21** WPF-CHAT06C01：四scope独立a26树消费86fc单文件输入，仅兼容liveAssistantText缺省/boolean，身份与原回执/queue保持；不opt-in或启用增量正文，固定验证后独审/集成。
- [x] **WPF-001-22** WPF-ACTIVITYI01：同一U11/REQ43活动接线在固定86a独立树领取17scope，消费已main CHAT05真实typed工具/思考与generic fallback，P01统一message footer button/menu/panel、按需有界详情与生命周期；保留C01/61b/shared只读，完整CHAT06正文另片。

- [x] **WPF-001-23** WPF-ACTIVITYC01：独立86a树四scope兼容C02过滤页raw-scan游标，固定已过HTTP断言映射的contract fixture经真实61b reader验证，严格身份/排序/上界/reset/hasMore不放宽；独审后交Lead解锁发布，不混完整stream消费者。
- [ ] **WPF-001-24** WPF-CHAT06S01：七新scope独立模块消费完整已审fa9的公开stream协议，严格patch校验、增量projection与纯message适配；隐藏/连接/attempt隔离，final仅按明确settlement，实际Thread接线在ActivityI交权后另领。
- [ ] **WPF-001-25** WPF-PERF03：五scope独立30b树按不可变turn身份复用消息对象；同revision动态正文/来源/截断、历史排序与跨中心不误复用，真实installed core计数，不许宣称UI时延改善。

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

D04由原Execution Lead唯一承接并复用dashboard，我方不写D03/D04或共享registry。过渡期新take和transfer先读dashboard、对应权威status与live Git确认占用，再由原Lead单点登记；缺失/陈旧/冲突不当空闲。记录领取/更新时间用当前实观登记，不能倒填开始。分配账本只存lead/owner/task/scope/claim/handoff，不存第二套TODO/check/review，后者仍owner status唯一。

M02当前精确范围必须排除P01独占plugins与plugin-host测试；P01不写App、TaskThread或既有workspace。稳定host提交后通过明确handoff/cherry-pick交M02挂载，需要改host则回原唯一owner或登记转交。不同worktree不意味着允许同一功能逻辑重复实施。dashboard本身是只读视图；主线D04新增PostgreSQL工程协调独立schema/DB与CLI take/list/release/handoff，实现事务task/父子路径冲突核验、version与双方handoff、receipt后开写且不自动过期抢占。既有M02/P01合法实施继续并迁移登记；展示冲突时保留依赖集成关系，不以不同worktree掩盖重复实现。

- 2026-10-06 02:41 UTC：两owner精确literal范围已收齐并回报原Goal Owner/Lead，登记时间不倒填；迁移输入见integration-checklist，D04 receipt与展示尚待交付。

- 2026-10-06 02:50 UTC：M02 d47固定候选进入独立review，P01模块PH-R1/R2修到3d812获scoped approval；新增WPF-I01独立主App挂载三件套，root同意新树与精确claim，既有两owner不扩写未登记路径。

- 2026-10-06 03:13 UTC：持久化经原Goal Owner逐字转交U09，追加REQ38产品预览保留与REQ39架构tab；前者最终选择既有M02 49922并保留用户tab/服务，I0155049仅开发fixture，后者主线唯一owner承接，我队不重复实现。

- 2026-10-06 03:19 UTC：U10逐字转交“plugin管理写进计划里”已新增REQ40；主线[X01 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-management-plan/plans/x01-plugin-management/plan.md)已只读核验888308d文档，我队只关联已获授权Web前置，不重复实现完整生命周期。

- 2026-10-06 03:23 UTC：只读核主线X01 canonical888308d clean和D05 canonical dirty实施中，REQ39/40补真实路径；不代其给approval或重复产品实现。

当前独立轮：[WPF-PERF02有界Activity](performance-optimization/plan.md)，依据PERF三规模实际数据，已完成停写、逐文件amend/take与canonical转交；固定a87f64f/报告d891已APPROVED、最终172d交主线集成。原准备暂停和后续授权恢复时序保留，不改CHAT App。

- 2026-10-06 03:25 UTC：U11准确摘要及REQ41～45已完整持久化；真实持续对话优先。PERF02只有准备93889c3，无新tree/amend/take/生产写入；原probe停写意向保留但claim仍v1。I01继续现有交付收尾，49922原fixture不暗换。

- 2026-10-06 03:32 UTC：原Goal Owner明确U11已固定/合同未ready时允许八scope PERF02并行；实际03:30两次CAS amend后新take d36v1，旧M02 v3/PERF01 v2。I01独立APPROVED92a，b584 clean且实现停写，候选CHAT前端待合同/正式交接。新增Mika队2活跃，主线4+本队最多4总10；其B01后台snapshot/events/feed字节/长历史性能和下一X02插件中心工作不由本队重复。

- 2026-10-06 03:35 UTC：CHAT首合同4c240已固定、后台未全部ready；真实对话作为默认首页/可编辑composer，Work overview仅rail。I01 v2移App/官方Thread/两个消息身份桥接文件→CHAT新08259c1d v1/16literal范围已正式受领，canonical初始化中。首capqueue/steer/liveAssistantText/per-turn controls=false，后继REQ41～45不因此关闭；正文只adapter-final来源、requested/effective分开。

- 2026-10-06 03:44 UTC：刷新当前claim/队列/已交付事实；X02固定4054中心registry只读兼容研究进入REQ40依赖。root转中心2d3bb61独审通过及主线main ac4e34d，真实模型最终验收归主Lead，Web不重复调用或提前宣布通过。

- 2026-10-06 03:47 UTC：主线registry39源已实际核CHAT/PERF02唯一live来源/claim/worker一致、unregistered空；19activewriterclaims literal零重叠。PERF02唯一缺分支字段由owner修，来源注册不代表review通过。

- 2026-10-06 03:50 UTC：PERF02 a87独立APPROVED、最终172d clean且实现diff0；03:49实际dashboard检查/review/proof/字段全闭环，主线集成待执行。原worker转固定版本ACK语义只读调查，CHAT仍唯一实现owner，不扩scope。

- 2026-10-06 04:02 UTC：主Lead确认8f1481d实际push clean；rootorigin/main ancestor核与管理04:01:56 dashboard main current/scopeEqual实证吻合。完成有限基线+窗口两轮TODO06，持续优化愿望不宣称结束。

- 2026-10-06 04:08 UTC：U12逐字重申映射既有REQ37；独立CUA实际领取详情和42源/当前21writerclaims literal0overlap留时点证据，新增X03待登记如实显示。D05架构刷新8f只排队、待正式移交；CHAT优先收固定7cb复审闭环。

- 2026-10-06 04:20 UTC：CHAT7cb最终331已限定APPROVED并dashboard验证，root一次交主线；PERF02集成后04:12正式release v2，无finding不长期占scope。REQ39后继D06按D05v2移出→新f619v1受领固定8f四scope，唯一canonical见[计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-refresh/plans/d06-architecture-refresh/plan.md)。主线4320继续其owner部署，不新造分配事实源。

U11当前queue工程验收以固定main `14c61b4062f8040ba6c7239860929366e5bd3fc1` 公共合同与[QUEUE01 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-queue/plans/wpf-queue01-ui/plan.md)为准：pause受理或历史ACK重放后fresh GET最新paused/currentTurn，只有用户明确的单独动作才取消所观察的active task；暂停和取消保留不同receipt/结果，不能按旧ACK自动取消。same queueRevision仍接受新的taskStatus/blocked/paused；immutable ACK不回退较新GET。中心持久等待队列和本地未知命令receipt是不同生命周期，本片同页面重连原key保留；原key跨reload/换连接恢复后继pending。steering仍另项开放，SDK能力不等已接实现。

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

05:59 U11/REQ43后继界面整合观察（GO现场截图，经root转述；非当前验收失败）：[synthetic窄屏截图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/docs/evidence/f01/queue-live-preflight/second-reply-dark-narrow.png)中两处Execution details、执行配置/legacy文字、Continue this conversation及技术说明挤压聊天高度。后继设计合为单一折叠执行入口，默认保留需用户选择的model/access/queue状态；unsupported/未知回执仍明确，fixture标识简短保留。该观察归原需求，不新建重复任务、不改当前两候选scope。

CHAT05 typed活动初interface已固定ae4cc5c630b88616fe75c72eff9fc276a9f84f6c；这是REQ43后继依赖，task轻metadata与lazy detail、phase/工具status分开，partial未含。PG/adapter/client/index未全部冻结前不作ready公共输入；当前K02/renderer交付不扩大到typed活动渲染。

06:04 原REQ43下独立活动模块获root/GO正式P1授权，准确base3d4985不依赖CHAT05/renderer/K02新shared；新treepreflight后freshledger八scope空闲，committed take51f962ee v1再followup实施。唯一canonical由workspace_panels_owner在web-conversation-activity维护，父文只追溯原需求和handoff，不复制新module进度。

06:07 GO经root给真实queue验收结果：窗口06:02结束、2/2 query封存；GO核原结果、两实际图和固定manifest，running入队、显式Continue、browser退出仍running及精确第二回复通过。该部分归REQ44真实旅程验收，不替代跨reload未知原key/steer后继；本队未执行模型。main冻结解除，接线仅等待Lead组合后准确base。

06:09 U11/REQ43新增真实截图证据（root人工目视，管理仅核manifest字段/文件hash）：[真实两轮窄屏图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/docs/evidence/f01/queue-live/second-reply-dark-narrow.png)与05:59的synthetic preflight分开；manifest观测06:04:30.199828Z，web3d4985/centerRunnerfb906/caller0695bae，budget CLOSED 2/2。图中真实中文两轮可见，底部0 waiting loaded、两处Execution details、配置/legacy/禁用控件及长footer叠加，root估计约占底部三分之一。功能验收仍通过，不升为失败或输入延迟结论。后继沿既定顺序先真实聊天/折叠详情，再单一外层execution disclosure收拢；保留model/access/queue主要项和unsupported/未知回执，技术限定置可达详情；同390×844/键盘验收，unknown不当actual。见[归属与固定证据](../../docs/evidence/web-platform/queue-live-ux-observation.json)，不新建重复任务/模型调用。

CHAT05后继正文边界：超64KiB仅prefix+full原文digest，完整超限正文不提供恢复；截断JSON明确文本fallback，parse失败不当provider失败，不扩blob。当前generic活动detail上限1MiB独立；以未来冻结接口分别验收，不能互相覆盖。

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

06:54 再次遵循用户U12“take工作在dashboard标清、跨lead防overlap”：每个新片先向现D04原子账本登记唯一owner/Lead、分支/工作树与精确literal范围，再交唯一canonical给Lead注册；已领取但来源未部署如实展示，不能把receipt当完整进度卡，不另写平行账本。ActivityI17scope fresh06:53:53.277Z无交叉（特别不含C01的conversations/projection.ts），122210f6 v1已committed。后继source部署收到后由manager唯一采样；其它Lead协调沿既有GO桥接及四类实质变化，不重复派工。

06:59 GO关键路径调整仍归U11/REQ43：panels优先兼容旧61b活动reader的C02 filtered-page raw-scan cursor，先于新stream消费者模块。Lead已固定公开语义允许无returned entries仍扫描推进、hasMore基于watermark；保留task身份/entry递增且<=nextCursor/nextCursor<=watermark/reset/after护栏。唯一管理已桥请求C02 owner固定实现与真实HTTP样本/准确base，来源未齐不猜协议/不先写；旧51f released、当前ActivityI17scope不含旧reader。新片只production projection+直接test+自有plan/evidence，精确命名待提案。

07:01 上条等待输入已解除：Lead固定C02 77f0/d9a/309be语义并接受contract fixture（非raw capture），root精确base86a；WPF-ACTIVITYC01四scope新树preflight/freshledger无冲突，5896b272 v1 committed后panels实施，source首交后登记。完整stream七scope下一ready输入已由Lead给ba908a2d84a05b336d74fbaccd7a36d3d254c501 + 5ff assistant-stream.ts精确文件 + 已审88a四filecommit；本片固定交付后再新tree/take，不让同owner同时两片写入。任何共享冲突交Lead，不整merge。


07:10 当前执行更新：C01/ACTIVITYC01已审且管理独核main fa9实现相同；ActivityI e930候选独审中。完整stream模块从旧ba908空树按明确授权ff-only推进fa9，七scope正式take d94ae4bb v1，先前5ff单DTO/88四文件输入方案保留为历史、当前无需再apply。其plan/status/review是独立唯一源，本父项只追溯U11/REQ43。用户U08/U12多Lead协作及take dashboard要求继续通过fresh literal冲突检查、committed receipt、首canonical一次SOURCE_READY落实，不另造第二进度账。真实模型与个人服务仍不由本队调用或重启。


07:21 U11/REQ43后继范围明确：stream实际App接线复用P01唯一host的独立trusted flow.assistant-stream生命周期，禁用零stream读取/旧响应失效且保留草稿退canonical，重新启用按有界缓存恢复。十三literal仅proposal，等已审模块+ActivityI main/release后精确take，conversations/messages.ts不占。GO新fixture验收后要求将稳定配置与协议长说明收进执行详情/帮助，需选择/失败才常显；input-ready/unknown不掩盖、身份/bytes二级。排在stream接线之后另领范围，沿现REQ不新建重复需求。


07:23 main接收闭环：ActivityI已审ba341/c9在253b主线17paths相同；owner只mainmetadata至9aa35096并全停写，manager fresh CAS release122 v2。原树只读，51454保持。w01转PERF03已初始化30b独立树，messages.ts对253b零差，五scope fresh take2ec58v1；后继stream App只读调用conversationMessages，不与该优化抢文件。原RS08计数研究现转有界验证，不新增性能目标或模型实验。
