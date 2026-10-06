# 首轮执行与 Agent 分工计划

| 字段 | 内容 |
| --- | --- |
| 计划编号 | FLOW-003 |
| 状态 | `completed` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-05 |
| 父计划 | [FLOW-001：产品与技术架构](../flow-001-architecture/plan.md) |
| 关联验证 | [FLOW-002：Provider 与 Harness](../flow-002-provider-harness/plan.md) |
| 当前阶段 | F00/C01/R01/L01/R02/W01/D01已接收；真实Web闭环/93测试/独立review通过，main已集成并推送14fea3d |
| 规划基线 | `main` / `5df746a`，只有计划和实验归档，没有应用骨架 |

## 1. 已确认方向与首个交付目标

用户已选择首版优先 **个人自托管：一个中心连接本机或远端 runners**。多人组织、角色管理与托管 SaaS 不进入首个交付；工作空间归属、中心访问认证和 runner 身份仍保留，不能让任意远端执行器直接领任务。

首个里程碑 M1：用户在 Web 发起任务，中心持久受理后关闭浏览器，后台继续执行；CLI 可观察、回答决策或取消；重新打开 Web 可看到一致的结果、固定版本产物和验证证据。首轮既运行确定性测试执行器，也接入一个真实 harness；两类证据分开记录。

已有要求继续生效：PostgreSQL、正式 CLI、薄 Web、分层读取、可替换 harness、模块与插件边界、A2A 等协议支持，以及 Sol 以上模型修改门槛和独立 worktree 规则。

## 2. 人员与并行规模

用户已明确分开目标负责人与工程执行负责人。**Goal Owner 为主 agent `/root`；Execution Lead 为独立的 Astra Ultra agent `/root/astra_ultra_execution_lead`（`gpt-6-astra`，`ultra`）**。本文的工程派工、文件维护、技术审查和合并均由 Execution Lead 负责。

| 负责人 | 主要职责 | 独占修改范围（拟建） |
| --- | --- | --- |
| Goal Owner：主 agent | 与用户沟通、总体目标与优先级、掌控关键路径/资源/技能驱动结构质量、主动定位解阻、核对目标达成并汇报 | 无项目写入范围；不写代码或计划文件，不运行工程测试，不执行合并 |
| Execution Lead：Astra Ultra | 最小架构、F00 公共契约与工程骨架、薄 client/CLI、技术派工、工程检查、审查与集成合并 | 根配置与 CI、`packages/contracts/`、`packages/client/`、`apps/cli/`、跨模块工程验收、计划及索引 |
| Agent A：中心 feature owner | API、PostgreSQL、命令事务、调度接入、事件/验证记录、验收状态与展示投影 | `apps/server/`、`packages/storage/`、`packages/scheduler/` |
| Agent B：runner feature owner | runner、harness 接入、已有身份引用、取消/权限/恢复、usage 映射与指定 verifier 的执行 | `apps/runner/`、`packages/harness-*/`、`packages/provider-*/`、`packages/verifiers/` |
| Agent C：Web feature owner | Web 页面、交互与组件、按需展开、缓存和重连展示 | `apps/web/`、`packages/ui/` |

用户已将开发并发期望上限提升为 **10 个 agents：Goal Owner + Execution Lead + 最多 8 个 workers**，所有ready且独立的工作尽量并行。实际并行度为 `min(10, 运行时可用槽, ready独立任务数)`；只读审查也占槽。2026-10-06 00:55 UTC实测第5个文档worker启动仍返回 `collab spawn failed: agent thread limit reached`，当前运行时实际cap为4（两个执行workers）。这是真实容量限制，不是人为要求三条feature串行；容量开放后立即并行W01/CLI/文档等独立任务。产品100+ agents目标与开发槽分别管理。

所有修改由 Sol / Astra 或已确认达到门槛的模型执行；身份或能力不明的模型不分配写任务。Execution Lead 按用户指定使用 Astra Ultra，其他写入人员至少 Sol，不为压低开发成本降到 Terra / Luna。只读审查可以单独委派，但不获得写权限。

这些是稳定职责，不要求每轮创建新的 agent。Execution Lead 在任务单记录各 feature 的实际 owner；一个子任务结束并释放执行位后，再安排下一条线。恢复或更换 owner 时交接分支、基线和证据，同时运行的不同 features 始终使用不同 worktrees。

中心的数据库、命令受理和调度先归一个 owner，因为它们共享事务与状态语义；不在首轮拆成数据库组、API 组、队列组相互等待。Execution Lead 的 CLI 保持薄，与公共 client 共用中心契约；UI、中心业务和 runner 实现分别由对应 feature owner 负责。

## 3. Worktree 与共享文件规则

下面是计划中的分支和目录，不代表已经创建。建议工作目录放在仓库外的 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/`。

| 任务 | 分支 | Worktree 目录名 | 负责人 |
| --- | --- | --- | --- |
| F00：骨架与契约 | `codex/m1-foundation` | `m1-foundation` | Execution Lead |
| C01：中心闭环 | `codex/m1-control-plane` | `m1-control-plane` | Agent A |
| R01：runner 闭环 | `codex/m1-runner` | `m1-runner` | Agent B |
| W01：Web 工作记录 | `codex/m1-web` | `m1-web` | Agent C |
| L01：正式 CLI | `codex/m1-cli` | `m1-cli` | Execution Lead，F00 后执行 |
| I01：集成验收 | `codex/m1-integration` | `m1-integration` | Execution Lead |

Execution Lead 在自己的 foundation、CLI、integration worktrees 之间按任务切换；不会进入其他开发者的工作目录代写修改。主 checkout 保持作为稳定入口；已集成且检查通过的提交才进入 main。Goal Owner 不获得 feature 写入范围，也不执行这些工程操作。

共享文件实行单一写入负责人：

- 根 workspace 配置、公共 schema、公共 client、契约 fixtures 和 `pnpm-lock.yaml` 由 Execution Lead 负责。
- 数据库 migrations、schema 和投影由 Agent A 负责，其他 agents 通过 API 或契约提出需要。
- 各 agent 可以修改自己包的 manifest；新增依赖先提交名称、用途和版本要求，由 Execution Lead 更新公共基线和锁文件，再同步安装。不能各自提交互相冲突的根锁文件。
- 全局计划和索引由 Execution Lead 更新，目标与优先级依据 Goal Owner 传达的用户决定；任务实施说明与验证证据放在该任务所属目录，避免所有人同时编辑同一份进度文档。
- Worktrees 隔离源码，不隔离端口、数据库或模型会话。每个任务使用不同开发端口、测试数据库和临时执行目录；集成环境由 Execution Lead 独占，禁止不同分支对同一测试库并发执行迁移。

用户已授权 Execution Lead 从 F00 持续推进至 M1，实现、验证、提交、feature 分支推送与按既定流程集成都在本轮范围。先保留并提交已有计划与规则，再建立 F00 的独立 worktree；main 仅在检查通过后更新，不强推。真实 harness 调用按 R02 任务预算执行。

后续实施时，创建 worktree 前检查分支、目录和未提交改动，不覆盖同名目录。提交授权已取得；先将当前计划变更保存为独立提交，不把主 checkout 的未提交修改带入某个 feature。C01 / R01 / W01 各自在获得执行位时从同一个已经提交的 F00 基线创建 worktree，任务单记录绝对路径、分支和确切 SHA。接口发生变化后，由 Execution Lead 发布新契约提交，相关负责人同步并重跑受影响检查。

## 4. F00：先交付可并行开发的基线

F00 的目标是让中心、runner 和 Web 三条线在获得执行位后，可以独立启动和验证自己的部分。由 Execution Lead 先固定最小公共契约、调度选择和 runner 失联语义，再派发功能实现。

主要交付：

1. 最小 pnpm workspace、TypeScript、格式与检查入口、固定的 Node LTS 和依赖版本；应用目录只建立本轮需要的部分。
2. 公共命令、查询、事件与 runner/harness 契约，以及可被 Web/CLI 消费的薄 client。
3. 无模型调用的确定性 fixtures：正常执行、等待决策、取消、失败、重复事件、断线补发、大型折叠详情和验证失败。
4. PostgreSQL 本地开发约定、各 worktree 的独立环境配置，以及各模块可单独运行的检查命令。
5. 一份短的调度选择记录，明确首版只实现一个可靠执行方案及其恢复边界。

需要在 F00 明确的语义：

| 契约 | 必须明确的内容 |
| --- | --- |
| 身份和 ID | workspace / task / attempt / native session / artifact 分开；中心客户端身份与 runner 身份分开 |
| 命令受理 | 幂等键作用域；相同键不同内容的冲突；持久化后才返回受理；取消是显式命令 |
| 生命周期 | 任务与尝试分开；请求取消与实际停止分开；执行完成与验证通过分开 |
| Runner | 注册、能力、容量、领取/分派、attempt 所有权版本、心跳、失联、事件去重；旧所有者的结果不能覆盖新状态 |
| 客户端读取 | 有界快照、事件水位、游标重放、缺口与过期处理；普通 SSE 不发送完整底层结果 |
| 展示层 | 正文与有序引用交错；非正文引用业务字段只有 `id/title`；详情另行按权限加载 |
| Harness | 开始、取消、权限等待、恢复句柄、能力、资源发现控制、原始事件引用 |
| Usage | 原始来源、step/turn/session 范围、累计基线、未知字段、辅助调用与去重 |
| 验证 | 固定版本产物、verifier 身份/版本、输入摘要、结果和证据；模型自述不直接推进验收状态 |
| 扩展位置 | harness、protocol、provider/auth、context、renderer、verifier 的最小注册边界；不建设完整插件市场 |

F00 一并确定 runner 连接策略。首版建议 runner 主动连接中心，以 HTTP 领取带所有权版本的任务、续租并批量上报事件；远端使用 HTTPS，客户端展示仍使用 SSE。由中心所有者通过 CLI 注册 runner、签发可撤销凭据，中心只保存凭据摘要与权限关联。这个方向是本计划建议，具体请求/响应和配对流程在 F00 固定，不能留给 C01/R01 分别决定。

中心不可用时建议采用保守边界：runner 停止领取任务和开始新工具动作，将已有执行产生的事件有界缓冲；无法续租或确认所有权时，不开启新的外部写操作。已经在途的操作不能假设撤销成功；重连后核对所有权与实际结果，再恢复、停止或交由中心处理。中心不因租约过期就盲目在另一 runner 重做不确定的写操作。具体 harness 能否阻止下一工具动作、缓冲上限和失联判定都要通过确定性测试确认。

F00已核对并固定Node24.20.0、PostgreSQL16.13和pg-boss12.37.0；M1选择pg-boss，替代最初Temporal倾向，取舍及四项短验证见[调度ADR](../../docs/architecture/m1-scheduler.md)。人工等待、取消、所有权失效和完整应用恢复仍须C01/R01/I01验证。只维护这一套M1调度，不自建泛化工作流引擎；普通技术取舍由Execution Lead负责，影响用户目标、预算或既定范围时由Goal Owner协调。

F00 完成条件：新 checkout 能按说明启动开发依赖，公共 schema/fixtures 可用，调度方案、runner 配对/通信/失联策略有明确记录，契约检查通过，三个 feature owner 分批确认自己的输入输出足够开工，Execution Lead 记录统一基线 SHA。审查使用实际可用执行位，三位owner可并行或分批完成，也不要求用户审批每个普通类型定义。

## 5. 首批任务与滚动派工

下面的批次已获实施授权；目前从 F00 准备开始，后续完成条件以证据为准。Goal Owner 持续处理用户沟通与目标协调；Execution Lead 保留一个执行位完成公共工程工作，并管理当前运行时可用子 agent 执行位。

| 批次 | Execution Lead 的工作 | 当前运行时可用子 agent 执行位 |
| --- | --- | --- |
| F00 基线 | 固定公共契约、骨架、调度与 runner 失联语义 | 按需安排中心/runner/Web owner 分批只读审查；不提前实现各 feature |
| 第一批 | 基于 F00 开始 L01，处理契约反馈 | C01 中心 + R01 runner，先建立确定性执行闭环 |
| 第二批 | 继续 L01，审查已交付提交并准备集成 | W01由用户外部task完成（交付b04df958已接收）；内部空闲位安排其他ready工作；另一位继续尚未完成的 C01/R01，或在依赖与预算具备后启动 R02 |
| I01 集成 | 合并、运行跨模块检查、整理工程证据 | 按需安排对应 owner 修复或只读复核；总数仍不超过两个 |

若运行时容量允许，C01、R01、W01应同时启动；当前第5个agent实测被拒绝，因此临时滚动。实际启动顺序可根据依赖调整，Execution Lead 在任务单记录；feature 的目录与 owner 边界不随排队顺序改变。

| 任务 / 负责人 | 要交付什么 | 依赖 | 验收与边界 |
| --- | --- | --- | --- |
| C01 / Agent A | 中心 API、初始 migrations、命令持久受理、runner 注册/分派、事件与验证记录、验收状态、轻量快照/SSE、详情查询 | F00；调度方案已选 | 重复命令不重复建任务；正文查询不读取完整 payload；重启后已受理记录仍在；迟到事件不能改写新所有权 |
| R01 / Agent B | 独立常驻 runner、确定性测试 adapter、事件上报、取消、决策等待、最小能力/身份引用、固定产物与确定性 verifier | F00 | 观察连接关闭不结束执行；重报可去重；验证绑定实际产物版本；失联报告不伪装为完成；模拟 adapter 明确标记为测试用途 |
| W01 / Agent C | 连续工作记录、输入与决策、折叠证据、交付卡片、连接状态和有界列表 | F00；先用契约 fixtures | 只渲染和调用中心；展开才读详情；保留阅读位置；空态/执行/等待/失败/交付均有完整页面 |
| L01 / Execution Lead | `submit / watch / show / decision / cancel` 的薄 CLI、JSON 输出、稳定退出语义 | F00；接口可用后联调 C01 | 与 Web 共用 client；退出 watch 不取消；显式 cancel 的受理和实际停止可区分；不能在 CLI 内直接执行模型 |

R01 的测试 adapter 让 C01 / W01 / L01 能够先联调。Claude wrapper 的 HTTP 400、完整 Pi 对照和统一浏览器 OAuth 不阻塞这些任务。

验证闭环的责任明确分开：Execution Lead 定义 verifier 契约；Agent B 实现首个确定性 verifier，按指定产物版本执行并上报证据；Agent A 持久化产物/验证关联，只有证据符合当前验收要求才推进验收状态；Agent C 展示执行与验证各自的状态。验证失败保留产物和证据，不能被模型的一句“完成”覆盖。

R01 完成后，Execution Lead 在有执行位且依赖具备时派发 **R02：首个真实 adapter** 给 Agent B，使用新的 `codex/m1-native-harness` 分支与 `m1-native-harness` worktree。建议先接已有成功冒烟的原生 Claude，作为可撤换候选，不宣告它已经赢得最终选型。完成既有身份检查、只读未知 fixture、权限拒绝、取消、会话重建和 usage 映射；不把实验 shim 直接搬进正式实现。

开发 Flow 的模型门槛与产品支持哪些 harness 是两个问题。接入 Claude / Pi 不自动授予模型修改本项目的权限。真实模型验收先操作隔离的测试材料；任何修改 Flow 项目本身的模型都必须符合根 AGENTS.md。

Web 的美观要有具体产物：一套字体/间距/颜色/密度/动效变量；完整的浅色与深色主题，主题由可扩展 tokens/注册机制管理，新增主题不改业务组件；真实主要状态在两种主题下都有检查证据，以及键盘、窄屏、减少动画和长记录的检查证据。用户明确指定安装并应用 assistant-ui skill；assistant-ui 仅负责客户端展示，中心仍是业务事实来源。UI fixtures 是开发依据，不能作为后台可靠执行的证据。

## 6. 派工单与沟通方式

每个任务必须交付一张短任务单。Execution Lead 填写，依据 Goal Owner 维护的目标与优先级落实技术边界：

| 字段 | 必填内容 |
| --- | --- |
| 身份 | 任务 ID、目标、负责人、符合模型门槛的执行模型 |
| 工作位置 | 仓库、worktree 绝对路径、分支、基线 SHA |
| 输入 | 只链接相关计划章节、契约版本、fixtures 和必需源码 |
| 技能与质量 | 开工前的 find-skills 结果、实际读取/应用的技能和固定版本；工作段/约 30 分钟/交付/合并前 clean-code 记录 |
| 写入范围 | 可修改目录、共享文件 owner、不能自行改变的接口 |
| 交付 | 可运行行为、验收方法、应保存的结果与未验证事项 |
| 依赖与停止条件 | 上游提交、资源与调用预算；遇到身份/权限/预算或契约缺失时停止相关动作并报告 |
| 回报 | commit SHA、检查结果、证据路径、限制、需要 Execution Lead 处理的具体问题 |

沟通以任务记录、契约和证据引用为主。只在依赖完成、接口变化、发现阻塞或提交交付时汇报；没有新事实就不广播完整上下文。Agent 自行解决所属模块内的普通实现细节；跨模块接口、根依赖和业务语义由 Execution Lead 协调。

Feature owners 向 Execution Lead 回报工程进展、阻塞和证据；Execution Lead 汇总工程检查与交付状态给 Goal Owner。Goal Owner 核对用户目标是否达成，向用户持续汇报，并协调需要用户决定的范围、预算或优先级事项。用户不必逐个进入开发任务查看，已确定的部署方向和根规则不重复询问。

每项任务在使用新 stack 前执行根 AGENTS.md 的技能发现；优先本地技能，实际读取并应用后开工。clean-code 在每个工作段、feature 交付、合并前及长开发约 30 分钟的安全停点执行，记录时间、范围、发现/修复与剩余项。固定版本及首轮发现记录见 [技能与质量基线](../../docs/quality/skills.md)。

## 7. I01：集成与完成标准

合并顺序：F00 → C01/R01 的确定性闭环 → L01/W01 → R02 真实接入 → 集成验收。C01 与 R01 在完成前就利用 fixtures 对接，不等到各自“大功告成”才检查接口。

每个 feature 提交前完成自身相关检查，由另一位符合门槛的工程 agent 只读审查；Execution Lead 可以审查子 agent 的提交，其自身实现由可用执行位上的 reviewer 审查。审查遵守用户期望 10 槽和运行时实际容量，修改仍由该 feature owner 在自己的 worktree 执行。Execution Lead 在 integration worktree 合并并检查迁移、依赖与端到端行为，再将工程验收通过的提交集成到 main。禁止强推覆盖其他开发成果；出现冲突由相应 owner 与 Execution Lead 处理。

工程验收与目标验收分开：Execution Lead 负责测试命令、技术复核、集成和证据汇总，提供产物版本、检查范围、通过/失败及未验证项；Goal Owner 据此核对 M1 是否满足用户目标并对外汇报，不代替工程执行、不运行测试或 merge。未具备证据的条件不标记完成。

M1 的共同完成条件：

- [x] **M1-A01** Web / CLI / 中心 / runner 可分别启动，中心连接两个测试 runners，任务由一个有效 attempt 执行。
- [x] **M1-A02** 模拟受理响应丢失后以相同幂等键重试，只有一项任务；内容冲突能明确返回。
- [x] **M1-A03** Web 提交后关闭整个浏览器，后台继续；CLI 可以观察同一任务并回答一项决策；Web 重连恢复一致状态。
- [x] **M1-A04** 退出 CLI watch 不取消任务；显式 cancel、完成竞争和重复事件均有确定结果。
- [x] **M1-A05** 时间线和普通 SSE 不含折叠详情 payload；展开才按需读取；超长正文/详情都有界。
- [x] **M1-A06** 产物有固定版本和确定性验证，执行完成与验收通过分别记录。
- [x] **M1-A07** 中心重启后受理记录可恢复处理；runner 失联标记待核对，不盲目重跑可能已完成的外部写入。
- [x] **M1-A08** 真实 harness 使用随机未知 fixture，提示不泄露答案；恢复题禁用工具，设置无历史对照，分别报告通过和失败。
- [x] **M1-A09** usage 不因重报或恢复重复累计，缺失分类不记作零，估算与实际供应商统计分开。
- [x] **M1-A10** 各自记录功能、故障、UI 和性能测试范围；不把模拟通过写成真实模型、跨机恢复或 100+ 容量通过。

真实调用数量、超时和预算在 R02 派工单中固定；常规开发、重连和大 payload 测试使用确定性 adapter。已有登录不意味着可以无限循环调用模型。性能先测有界查询和缓存交互；FLOW-001 中的毫秒级预算在记录环境与样本量后验收。

## 8. 后续批次与未决项

M1 完成后沿用用户10槽期望上限并按运行时实际cap安排，后续角色按依赖和执行位排队，不同时启动全部方向：

| 后续任务 | 依赖 | 交付方向 |
| --- | --- | --- |
| P01：A2A / MCP | 内部生命周期与身份契约稳定 | A2A 双向任务/产物映射、MCP client；明确版本、能力、断线和取消；ACP 按选定 harness 需求接入 |
| E01：Harness 对照补全 | R02 与 FLOW-002 | Pi 原生/wrapper 的资源与恢复对比；Claude wrapper 身份来源/刷新差异和同版本测试；失败证据也是有效交付 |
| X01：插件与上下文 | 最小注册边界、usage 账本 | 一个可安装的工具/renderer/verifier 扩展示例；确认 billion-context 项目后验证压缩、恢复与引用 |
| K01：项目与知识库 | PostgreSQL 模型和来源/权限记录 | 来源导入、版本、检索和引用；检索质量单独验收 |
| S01：容量与故障 | 多任务、预算、观测和恢复具备 | 128 个持久会话，模型/工具并发分别调节；报告资源、延迟和成本，而非只报告 agent 个数 |

开工关口：F00 必须选定调度实现并固定上述 runner 配对/通信/失联策略；R02 明确真实 adapter 的支持范围。远端部署说明根据所选传输落实。部署优先级已由用户确定，不再作为阻塞项。

## 9. 变更记录

- 2026-10-05：确认个人自托管优先；建立中心、runner、Web 的 feature 边界、独立 worktrees、契约基线与 M1 端到端验收。实际开发任务尚未启动。
- 2026-10-05：按用户纠正分离 Goal Owner 与 Astra Ultra Execution Lead；工程写入、F00、client/CLI、技术派工、审查与集成归 Execution Lead。明确四槽总上限与当前可用执行子 agents，三条 feature 线滚动调度；本轮仅修订计划及索引，不实现、不实验、不提交或推送。

- 2026-10-05：用户授权正式从 F00 推进至 M1；解除上一轮仅规划限制。加入逐 stack 的 find-skills 和固定版本 clean-code 质量关卡，允许提交与隔离集成，应用能力仍按实际证据记录。

- 2026-10-05：F00建立Node24/pnpm/TypeScript工程、contracts/client、独立PostgreSQL开发环境；选择pg-boss，短验证与两位owner接口复核通过。用户新增浅色/深色主题及assistant-ui/AI Elements技能要求，纳入W01。

## 执行 TODO（稳定 ID）

- [x] **F00** 公共契约、骨架与调度短验证；证据见 ../../docs/evidence/f00/scheduler.json，提交542f70b/3995ec1。
- [x] **C01** 中心闭环；独立计划见 [C01](../c01-control-plane/plan.md)。
- [x] **R01** 确定性 runner；独立计划见 [R01](../r01-runner/plan.md)。
- [x] **L01** 正式 CLI；独立计划见 [L01](../l01-cli/plan.md)。
- [x] **W01** Web 与双主题；独立计划见 [W01](../w01-web/plan.md)。
- [x] **D01** 工程执行 dashboard；独立计划见 [D01](../d01-execution-dashboard/plan.md)。
- [x] **R02** 真实 harness 接入与有界验证。
- [x] **I01** 合并版本的端到端、故障与UI验收；[独立计划](../i01-integration/plan.md)。
- [x] **LAB01** 两个有界性能toy与方法复核；[plan](../lab01-performance/plan.md)。
- [x] **D02** Dashboard权威来源补齐；[plan](../d02-progress-sync/plan.md)。
- [x] **LAB02** 独立观察者诊断与报告；[plan](../lab02-observer-probes/plan.md)，不作为M1门槛。

- 2026-10-05：用户要求所有ready独立任务尽量并行，期望上限10；当前第5worker仍被运行时拒绝。每plan迁移独立status/review，当前feature owners维护各自状态，branch完成与main集成分别记录。

协作记录：[status.md](status.md) · [review.md](review.md)。状态按实际提交和证据更新，review模板不是通过结论。

## 外部task派工方法

1. Execution Lead先确认ready任务的输入、冻结完整base SHA、独立分支/worktree和独占写入范围，登记owner占用。
2. Goal Owner把可复制任务说明交给用户，由用户自行新开task；本轮不调用create_thread。预留时记录reserved-external/awaiting-dispatch，内部不重复派发；每次汇报前核对外部完成快照及owner实际status/head/dirty，不能因未主动回传持续推断未开工。
3. 外部owner先核验仓库、branch/base/head和dirty状态，读AGENTS及plan/status/review，完成技能发现并实际读用相关skill；只在自己worktree写入并维护自己的status。
4. 公共contracts/client/根lock/migrations等变更向Execution Lead提出具体需求；不自行修改他人owner范围。基线变化由Execution Lead发送具体SHA与影响说明，外部owner合并后跑受影响检查，不悄悄追逐main。
5. 交付回传branch/head SHA、工作树、检查/证据路径、未验证/阻塞、status和review目标。外部task不自行merge main；Execution Lead统一只读review、集成验证与合并。

当前已接收外部W01与D01（各自已独立review并提交），不再预留等待。其他可独立安排的是针对固定commit的只读review；E01 wrapper认证调查仅限隔离只读分析、不修改共享登录或生产实现；协议映射设计需先明确版本与输入契约，不把未ready的协议实现冒充可并行任务。

W01与D01由用户外部分队完成：W01 b04df958（批准实现866c20e），D01 6783562（批准实现9c236c5）。两个 feature 独立 worktree，不共享可写 UI 包、lock 或 contracts。具体输入、任务登记与交付格式见 [外部交接](../../docs/handoffs/external-web-dashboard.md)。当前内部 4 槽运行限制仍据实记录；不将预留写成已运行。

当前真实Web/PG/整浏览器退出/CLI决策/新浏览器一致产物与验证已通过；R02+I01真实原生预算5/5已使用。LAB01两个0模型/0云toy已方法review通过；D02补齐14条来源；LAB02独立观察者诊断不构成M1门槛。main已在I01最终独立review后更新到14fea3d，实验不替代产品性能或真实agent容量证据。

## M1范围与后续结构质量

M1是持久执行基础，当前Web为薄任务观察/决策页，不能当最终“一个地方线性交流、跨任务解释与决策”已实现。M2优先统一跨任务入口，任务页作为下钻；固定多任务验收记录切换次数、重复问题、人介入时间。

独立架构健康review（6434fba，无阻断M1项）与后续P2见[工程质量台账](../../docs/quality/architecture-health-2026-10-06.md)。harness/usage来源集中在接Pi前；runner当前有效并发1，在S01前再实现有界并发；observer读量先诊断，不凭推算优化。dashboard metadata/review与main观察SHA管理噪声留受控后续项，不为凑全绿反复刷新所有owner文件。

2026-10-06 02:05 UTC：用户明确完成整个计划，本plan的M1完成状态保留，后续批次由 [完整验收矩阵](../flow-001-architecture/full-plan-matrix.md)持续追踪。C02/P01/M02实际开工；每项完成后进入验收/集成和下一ready工作，不再以“至M1”为授权终点。
