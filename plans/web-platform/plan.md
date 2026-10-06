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
| 父目标 | [FLOW-001](../flow-001-architecture/plan.md)、[完整验收矩阵](../flow-001-architecture/full-plan-matrix.md)；Web 实现仍在 [W01](../w01-web/plan.md) 的权威 owner worktree |

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
| U06 Dashboard 视觉反馈（准确摘要，由 root 转交） | 用户不满意4320样式并提供 dashboard 截图，要求紧凑中性视觉；最新主线确认4320为17来源 | 主线 D03 独占视觉与语义实现；WPF-D01仅协作需求/来源登记，不另派实现，不停/重启/覆盖原Lead4320服务 |
| U07 速度与验证（原总体 Goal Owner 经 root 转达，准确摘要） | 用户强调推进速度与 local tests；按实际影响范围先测本模块与直接依赖，共享接口变更才测链路，metadata不重复全库测试 | 保留真实行为、视觉、a11y验收，不为提速假连接；主线D03承担dashboard全部后续，M02提供公共工作/决策能力，W01保留消费接缝 |
| U08 多lead领取协调（原话） | “和你在一起工作的还有其他agent leads，一定要管理好执行dashboard，你们才不会overlap工作。take 工作最好也在dashboard上标清楚” | 主线D04/Execution Lead唯一登记领取和转交，dashboard展示唯一owner/负责lead/范围/领取状态；进度仍各status唯一，不凭旧源或缺失源当空闲 |

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
| WPF-REQ-35 | 主线M02已交付完整接口；Web整改稳定后接入统一工作总览 | WPF-M02 / 独立owner待派 | 连续feed/attention原地决策、锚点/409/100+分页/懒详情/连接隔离，真实Web验收独立 |
| WPF-REQ-36 | 主线D03要求各权威status提供明确人读字段与实现范围 | 每个唯一owner自行写；管理者协调 | 阶段/优先级1–9/当前产出/下一可用交付/明确阻塞与决定/完整实现target与literal范围；不写其他owner状态 |
| WPF-REQ-37 | U08 多lead避免重叠、take工作在dashboard标清 | 原Lead/D04领取登记；各唯一owner声明范围；管理者协调 | taskID/owner/lead/worktree/branch/精确范围、reservation→claimed→active→review→integration/transfer、领取/更新时间与交出接收方可见；同task/source或范围冲突提示，原Lead单点登记防竞态 |

## 当前 owner 与接口冻结

| 工作 | 唯一实现owner / worktree / branch | 边界与状态入口 |
| --- | --- | --- |
| W01官方Thread+主shell+split/merge | w01_owner / `Flow-worktrees/m1-web` / `codex/m1-web`；本轮起点 `b04df95821a55384c55c833e94405daaf35af8ad` | `apps/web/**`（排除正在委派的workspace子组件合入前并发写）、`plans/w01-web/**`、`docs/evidence/w01/**`；唯一手填status在该树 |
| 右侧workspace子交付 | workspace_panels_owner / `Flow-worktrees/web-workspace-panels` / `codex/web-workspace-panels`；同base `b04df958...` | 仅 `apps/web/src/components/workspace/**`、`docs/evidence/w01/workspace-panels/**`；不建第二W01 status。提交后由W01显式cherry-pick并复验 |
| WPF-M02统一工作入口 | workspace_panels_owner / `Flow-worktrees/web-unified-workspace` / `codex/web-unified-workspace`；初始化merge c0c41f9881713f3b371ba62c8f4e68ca5d71e8db | App接缝、TaskThread/projection、workspace-feed及对应测试、plans/wpf-m02-web-workspace、docs/evidence/wpf-m02（精确literal文件清单由owner提交Lead）；排除plugins及plugin-host测试，host仅稳定提交→明确handoff后集成，不自行重复实施 |
| WPF-P01可信Web host | w01_owner / `Flow-worktrees/web-plugin-host` / `codex/web-plugin-host`；初始化0673653ac6b2da8259bc8ca40d9ae723da2ce875 | `apps/web/src/plugins/**`、plugin-host测试、`plans/wpf-p01-plugin-host/**`、`docs/evidence/wpf-p01/**`；不写主App、现有workspace组件或共享契约 |
| 本管理计划 | d01_owner / `Flow-worktrees/web-platform-management` / `codex/web-platform-management` | 仅本文范围，管理与需求事实；不复制别人的进度事实 |
| 只读研究/独立review | root | 原始研究#1～5转化为实现/验证条目，证据见[研究台账](../../docs/evidence/web-platform/research.md) |

冻结 `WorkspacePanels` 接口（在panels owner的 `types.ts` 权威定义）：

```ts
type WorkspaceTabId = 'files' | 'terminal' | `detail:${string}`;
type WorkspacePanelsProps = {
  task: TaskSnapshot | null;
  details: Record<string, { data?: Detail; loading?: boolean; error?: string }>;
  onLoadDetail: (id: string) => void | Promise<void>;
  connection?: 'connecting' | 'live' | 'reconnecting' | 'disconnected';
  activeTab?: WorkspaceTabId;
  onActiveTabChange?: (tab: WorkspaceTabId) => void;
  onClose?: () => void;
  className?: string;
};
```

组件不直接持有FlowClient、不新增权威运行状态。W01主shell选择active pane/task并传回调；同task单projection/observer。依赖统一由W01的manifest和既定临时lock例外管理；`ansi-to-react@6.2.6`已由panels核对React19/types，取代早期3.0.0提案。panels验证可以在自己的ignored node_modules只读链接已装依赖，不安装、不写目标、不提交链接；证据必须记录。其他接口变化先同步双方，再修改。

## 已确认决定与工程方案

- 已授权本轮实现，不重复设计批准。W01先闭环官方Thread与用户布局，不把未审shell塞入完整插件框架；保留稳定扩展位置，随后WPF-P01实现统一host。
- 官方Thread以实际registry及已安装 `@assistant-ui/react@0.15.23` 兼容性为准。最新GitHub main可能含未发布API；不能把“最新源码”直接当可用。对已受理任务隐藏不受契约支持的followup/edit/reload；新任务实际用官方Composer提交；取消维持中心命令与确认，关闭观察不取消任务。
- split/merge只组织tabGroup，不合并消息。root建议的Arc“合并为分屏项目/拆回独立tab”作为语义研究，本轮实际动作以用户“split、merge回一个tab组”为准。
- FileTree/Terminal保留官方源及必要可访问性/主题修订；新功能还没有PTY或任意文件读取API。不能从UI能力推断后端能力。
- [WPF-P01](plugin-system/plan.md)正式编号避免与现有P01协议计划冲突。root早期“P01插件”只是临时代称。X01仍为全栈插件总范围/总owner；Web host是其实现子项。
- [WPF-D01](dashboard-followup/plan.md)仅为协作需求与来源登记；原Lead D03独占dashboard紧凑中性视觉和高层语义全部实现，我方不另派owner、不启动第二实现，不控制其4320服务（02:38已实观22来源）。
- [WPF-PERF01](performance-cycle/plan.md)采用生产基线/规模与请求/交互证据，禁止用单个bundle阈值或synthetic规模宣称真实模型容量。

## 当前执行队列

顺序可因实际阻塞/ready状态调整；修改要写原因，不把排队当已运行。

| 队列 | 计划/交付 | 状态与开工条件 |
| --- | --- | --- |
| 已审交付 | W01 Thread/shell/splitmerge及panels | root整体APPROVED cb4a392，owner正式review metadata收尾；组件46a1dbd通过 |
| 当前管理 | WPF-001需求账本/研究/接口/来源登记清单 | 执行管理者维护；root只读核对完整性 |
| 跨团队协作 | WPF-D01需求+管理来源登记 | 主线D03实施；我方提交清单并只读确认注册，不占我方实现槽 |
| 独立审查 | [WPF-M02统一工作总览](unified-workspace/plan.md) | 固定实现d47c602，完整输入含main8c57；root整体复验，owner只做metadata |
| 独立审查 | WPF-P01插件host | typed接口冻结；模块3d812 scoped APPROVED，整包d81075 React/builtins另审；不覆盖主App |
| 下一独立集成 | [WPF-I01插件主App挂载](plugin-integration/plan.md) | 两输入审定+D04交接后复用M02 owner，新tree/branch；不继续扩大M02已审范围 |
| 性能轮 | WPF-PERF01 | 当前W01 owner先记录新build基线；测量/优化owner空出后排队，每次一个有证据瓶颈 |

## TODO

- [x] **WPF-001-01** 持久化全部已传达用户要求与原话/摘要、来源轮次、稳定ID。
- [x] **WPF-001-02** 明确owner/独占范围/接口/依赖，建立无编号冲突的后续plan/status/review。
- [ ] **WPF-001-03** 接收官方Thread与panels独立提交，完成W01集成、回归与独立review闭环。
- [x] **WPF-001-04** 向主线D03交付管理来源登记清单并只读验证；02:38:47.600Z新版22源中3个WPF源完整无issues（仅登记验证，不表示实现完成）。
- [ ] **WPF-001-05** 空槽后派发WPF-P01，与X01/M02对齐完整插件系统而非只做UI插槽。
- [ ] **WPF-001-06** 建立WPF-PERF01生产基线及下一有证据优化轮，继续按用户新要求更新追溯。
- [ ] **WPF-001-07** 将完整M02工作入口交给独立Web消费owner，单独验证、review与集成。
- [x] **WPF-001-08** 收取两owner精确literal范围并交主线单点登记，验证D04领取/转交/冲突展示，避免多lead重复派工。

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
