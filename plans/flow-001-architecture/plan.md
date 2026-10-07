# Flow 产品与技术架构计划

| 字段 | 内容 |
| --- | --- |
| 计划编号 | FLOW-001 |
| 状态 | `in-progress` |
| 创建日期 | 2026-10-05 |
| 最近更新 | 2026-10-06 |
| 来源 | Flow 产品与技术选型讨论、设计原则、协议支持与开源项目借鉴要求 |
| 当前阶段 | M1已独立验收并集成main；完整计划继续执行，C02/P01/M02已启动 |

## 1. 目标与用户约束

Flow（心流）希望让一个人通过连续、易读的交互，管理大量后台 agents 的工作，在必要时作出决策，并获得可追溯、经过验证的交付物。

用户明确提出的要求：

- 降低人的 context switch 成本。用户不必反复进入不同任务才能了解进度或推动工作。
- 项目管理和 task board 首先服务于 agents 的执行与协调；人的主界面应提供线性的解释和决策入口。
- 常用 CLI 命令及其结果应能包装成可插拔、可复用的 UI。
- 使用美观的 Web UI，兼顾个人开发者和企业内部使用。
- 后端优先稳定、高效，复用现成 harness，避免重新实现完整 agent 执行循环。
- 支持工程项目管理与知识库管理，从一开始使用 PostgreSQL。
- 长期目标是让个人同时管理超过 100 个 agents，并显著控制 token 成本。
- 减少不必要的 agent 间交流，支持根据执行结果动态调整计划。
- 设计插件机制，以便接入已有 npm 包、工具及上下文管理能力。
- 前后端严格分离。中心提供存储访问、API 转发与业务逻辑，可以连接多个执行后端；Web 前端只负责渲染和触发操作，可以被替换。
- 后端必须提供正式 CLI。前端断开后，只要中心服务和执行后端仍可用，已接受的任务应继续执行。
- 所有功能以模块组织并预留插件接口，核心业务不依赖特定前端。
- 数据按读取用途分层：聊天展示层保留正文；thinking/tool call 等折叠项只保留 `id` 和 `title`，通过 ID 按需读取下层内容。
- 聊天切换和常规操作追求毫秒级响应，减少无用查询、传输和渲染；具体可测预算见第 8 节，尚无性能验证结果。
- 支持 A2A 等常见协议，与外部 agents、工具和客户端互操作，并将协议接入设计为可扩展模块。
- 借鉴 Hermes、T3 Code 和 Paseo，可按各自许可证复用合适代码，尤其是 provider 登录、会话与执行接入。
- 实际比较 AI SDK HarnessAgent 与 Claude Agent SDK、Pi 原生接入；首轮使用本机已有 Claude / Pi 登录状态，不提前锁定路线。
- 首版优先个人自托管：一个中心连接本机或远端 runners，再扩展企业多人场景。

核心边界：人的交互保持连续；后台的任务、上下文、执行会话和验证记录分别管理，并可并行运行。

## 2. 方案状态与范围

本文记录初步建议。记录计划本身不代表用户已经选定所有库，也不代表这些组合已经通过兼容性或性能验证。

用户已确认首版优先个人自托管，浏览器与 CLI 连接一个中心，执行器运行在本机或远端服务器。企业多人集中执行和托管 SaaS 作为后续扩展方向；首版仍需中心访问认证、runner 身份和工作空间边界。

当前规划覆盖：交互层、应用服务、agent 接入、可靠调度、项目数据、上下文、知识检索、插件、验证与成本观测。

首轮不以建设完整插件市场、任意规模分布式数据库或一次接入所有 harness 为完成条件。先建立一个可验证的执行闭环，再扩展覆盖范围。

## 3. 候选技术栈

具体库均为初选。PostgreSQL、Web UI、前后端分离、CLI、多执行后端、模块化、分层读取及 A2A 等协议互操作属于已确认方向。

| 层 | 初选 | 职责与取舍 |
| --- | --- | --- |
| 工程基础 | TypeScript + pnpm workspace | 共享类型与插件数据约定；早期按模块划分，不立即拆成大量服务 |
| Web 应用 | React + Vite | 面向高交互工作界面，前端可以独立部署到内网 |
| 设计系统 | Tailwind + shadcn/ui | 统一字体、间距、颜色和组件状态，保留定制空间 |
| 对话交互 | assistant-ui | 复用输入、消息、工具交互；通过外部状态接入 Flow |
| 补充 UI | 按需使用 AI Elements | 复用工具、确认、产物等组件，避免重复管理消息状态 |
| 中心 API 服务 | Node.js LTS + Fastify | 独立常驻，提供存储访问、业务逻辑、转发与调度入口；不把浏览器连接作为任务生命周期 |
| 公共客户端契约 | HTTP API + OpenAPI + SSE | Web、CLI 和后续客户端共享命令、查询和事件契约；具体协议版本实施时固定 |
| 协议接入 | 独立 protocol adapters | 已确认 A2A 支持方向；建议优先 A2A/MCP，按需求实现 ACP 和 AG-UI；优先复用维护中的 SDK |
| CLI | 独立 TypeScript 客户端 | 调用与 Web 相同的中心 API，支持非交互参数、结构化输出及退出码；具体命令库未定 |
| 执行后端 | 独立 runner 进程或服务 | 一个中心连接多个执行端，按能力与容量分派任务，内部再适配不同 harness |
| AI 应用接口 | AI SDK 为候选 | 按需用于模型调用、流式输出；HarnessAgent 是否作为统一入口由对比验证决定 |
| 执行 harness | Claude / Pi 原生接入与对应 HarnessAgent 适配层并列验证 | 保留各自会话、工具和扩展能力，首个生产接入尚未选定 |
| 可靠执行 | M1 采用 pg-boss + PostgreSQL 领域状态 | 同事务持久排队；等待、取消与所有权由中心记录，取舍见 F00 ADR |
| 轻量调度备选 | pg-boss | 使用现有 PostgreSQL 处理后台队列，额外基础设施较少 |
| 主数据库 | PostgreSQL + 候选 Drizzle | 保存任务、依赖、决策、证据和费用等关系数据 |
| 知识检索 | PostgreSQL 全文检索 + pgvector | 先统一关系数据与检索；中文分词及混合检索质量单独验证 |
| 大文件存储 | S3 兼容存储 | 保存大文件、日志归档和产物内容；数据库保存元数据与引用 |
| 实时传输 | SSE + 持久化事件游标 | 单向推送进度，支持断线后恢复业务事件 |
| 可观测性 | OpenTelemetry + token 账本 | 追踪执行过程，分解模型、协调、压缩和重试成本 |

选择 Vite 是基于当前应用以交互为主的判断。Vercel Chatbot 可参考登录、附件和聊天实现，但其应用结构不直接作为 Flow 的架构约束。

## 4. Harness 接入路线

| 路线 | 优点 | 代价 | 当前安排 |
| --- | --- | --- | --- |
| 原生 Claude Agent SDK worker | 直接复用 Claude 的工具、权限与会话能力 | 需要映射 Flow 事件，保留供应商特有行为 | 与对应适配层成对验证 |
| 原生 Pi SDK/RPC worker | 保留原生会话和插件宿主行为，可独立运行执行进程 | 需要映射事件，SDK 与 RPC 的进程边界不同 | SDK 成对验证，RPC 单独验证生命周期 |
| AI SDK HarnessAgent + Claude / Pi | 统一调用入口，底层仍复用现成 harness | 适配层、sandbox、版本及能力可能有差异 | 与同一底层 harness 的原生路线比较 |
| AI SDK 自建 agent loop | 直接控制模型与工具循环 | 需补齐现成 coding harness 的工作区、会话等能力 | 首版不优先 |

AI SDK 的模型调用接口、HarnessAgent 和原生 harness 分属不同层次。特别是 Claude Code adapter 内部仍使用 Claude Agent SDK；因此比较重点是接入成本、能力保留、执行环境和恢复行为，不能把两者当成完全不同的 agent 引擎。

具体版本、上游可复用模块、登录归属及首轮实测记录见 [FLOW-002：Provider 登录与 Harness 对比计划](../flow-002-provider-harness/plan.md)。源码检查、运行冒烟、故障测试与容量结论分别记录。

Flow 自己维护一层薄的执行接口，至少表达：创建会话、提交任务、接收事件、请求取消、等待决策、恢复会话和查询能力。具体 SDK 的对象与类型不直接成为数据库领域模型。

接入时保留 harness 自己的历史和恢复状态，同时独立保存 Flow 的项目记录与人的交互记录，避免反复把完整历史灌入原生会话。

当前官方文档中的已知限制：

- AI SDK harness packages 明确标为实验性，实施时需要固定版本并运行兼容性验证。
- Pi 适配器在宿主 Node.js 进程运行；其 sandbox 主要承担文件和命令执行，不自动隔离宿主扩展。
- Pi 适配器支持显式扩展工厂，但关闭文件自动发现的扩展、主题及 prompt templates。
- Pi 适配器当前不支持 HarnessAgent 的 structured output 参数；业务结果须通过其他明确接口提交并校验。
- 统一适配层不保证各 harness 的会话恢复、权限、插件及工具行为完全一致，需使用能力声明处理差异。

原生 Claude / Pi 与统一适配层均保留。可以按 harness 选择不同接入方式，Flow 的内部契约保持一致；不要求为了统一入口放弃必要能力。

## 5. 模块职责与数据流

| 模块 | 负责什么 | 主要输入与输出 |
| --- | --- | --- |
| Web / CLI 客户端 | 输入、渲染、查询与触发命令，维护本地展示缓存 | 用户目标与决策；可读记录或机器可读输出 |
| Flow 中心应用服务 | 统一 API、存储访问、业务逻辑、权限、预算、路由与业务事件 | 任务、依赖、决策、产物及事件 |
| 协议适配模块 | 协议发现、协商、鉴权接入及消息/任务映射 | 外部协议请求与事件；Flow 内部命令及关联记录 |
| 规划与协调模块 | 根据新信息拆分、调整、取消任务 | 当前事实、验收条件；版本化任务计划 |
| 可靠执行层 | 调度、等待、取消、失败恢复 | 可执行任务；执行状态和恢复记录 |
| 执行后端 / runners | 向中心声明能力与容量，持有执行会话，驱动现成 harness | 任务契约、上下文引用；执行事件、检查点和产物 |
| Provider / 身份模块 | provider 实例、登录流程、凭据引用、状态与刷新协调 | Web/CLI 共用的登录挑战；runner 可使用的身份引用 |
| 上下文与知识模块 | 检索、压缩、引用、版本及预算管理 | 来源资料和任务；适量且可追溯的上下文 |
| 验证模块 | 检查交付是否满足要求 | 固定版本产物与验收条件；验证记录 |
| 展示投影模块 | 将业务事件组织成面向人的解释 | 已保存的事实；进展、决策、验证和交付卡片 |

基本流程：用户给出目标 → 保存目标与约束 → 形成可调整的任务 → 执行并记录证据 → 验证产物 → 将重要进展或必要决策呈现给人 → 根据新信息继续推进。

前端消息数组不作为项目事实源；每个 agent 的 transcript 与面向人的工作记录分开保存。人的解释需引用实际事实，不能用生成的叙述覆盖缺失或失败的执行记录。

### 5.1 中心与执行端的边界

Web、CLI 和其他客户端连接同一个逻辑中心。中心对外提供业务事实与操作入口，对内连接一个或多个执行后端。每个执行后端可运行不同 harness；执行后端数量、agent 会话数量和 harness 类型是不同概念。

中心可由多个实例组成，其可靠性不应依赖某个 API 进程的内存。初期可以采用模块化单体中心、独立 CLI、独立 Web 和独立 runners；模块化不要求每个模块单独部署为微服务。

浏览器不持有任务调度、预算裁决、验收或恢复逻辑。CLI 与 Web 在权限和业务语义上对等，关闭 CLI 的观察命令也不会取消正在执行的任务。

建议 runner 主动与中心建立认证连接或领取任务，以适应本机和企业内网部署；具体传输协议、连接方向及离线策略仍待确定。执行端通过中心接口交换事实，不直接读写中心数据库。

### 5.2 命令受理与断线恢复

1. 客户端提交带幂等标识的命令；中心校验权限、参数及相关版本。
2. 中心持久化命令与待分发记录，提交成功后返回受理结果和命令/任务 ID。
3. 调度层分派任务，runner 执行并持续保存检查点、事件及产物。
4. 客户端通过快照和增量事件观察工作；断开连接只结束观察。
5. 取消必须是显式业务命令；取消受理与执行实际停止分开记录。

若客户端未收到受理响应，应使用相同幂等标识重试或查询结果，避免重复创建任务。不得把 HTTP 请求关闭、SSE 断开或前端组件卸载的取消信号直接传给后台任务。

快照需要携带对应事件水位，随后从该水位补齐事件。重放按序号去重、检测缺口；保留窗口外的游标通过重新获取快照恢复。SSE 的重连机制不替代服务端的持久化和补发实现。

runner 失联先标为状态待核对，不直接认定任务已停止。恢复或迁移时需要核对执行所有权与外部操作结果，避免两个执行端重复产生副作用。

中心短暂不可用时的 runner 自主权限尚未确定。候选策略是允许已有授权且输入齐备的步骤继续，并缓冲结果；需要新决策、新预算或跨 runner 调度时暂停。该策略不是已确认要求。

### 5.3 常见协议支持

用户已确认支持 A2A 等常见协议的目标。以下角色、优先级和具体实现范围为建议，实施时固定规范版本、传输方式及能力矩阵，不笼统宣称兼容所有版本和扩展。

| 协议 | 职责 | Flow 的建议角色与位置 | 优先级建议 |
| --- | --- | --- | --- |
| A2A（Agent2Agent） | 跨系统 agent 能力发现、消息、任务状态及产物交换 | 中心作为 client 调用外部 agents，也作为 server 暴露经授权的 Flow 能力 | 优先验证双向接入 |
| MCP（Model Context Protocol） | 工具、资源和提示模板互操作 | 中心管理连接及权限，中心或 runner 按实际运行位置持有 client；可进一步以 server 暴露 Flow 查询与工具能力 | 优先 client，再扩展 server |
| ACP（Agent Client Protocol） | 客户端与 coding agent 的会话、提示、更新、文件/终端及权限交互 | runner 作为持久的 ACP client 接入支持该协议的 coding agents；对外服务编辑器另行适配 | 根据首批 harness 的支持情况实现 |
| AG-UI（Agent User Interaction Protocol） | agent 与交互界面的事件和状态交换 | 中心对外提供可选的展示协议适配，接入支持该协议的客户端 | 预留接口，按客户端需要实现 |

这里的 ACP 明确指 Agent Client Protocol。协议客户端/服务端角色属于通信关系，不等于浏览器前端/业务后端。ACP 会话由持久 runner 持有，不能因为浏览器关闭而结束；MCP 本地进程工具可由对应 runner 承载。

协议适配器调用同一套 Flow 业务命令和授权逻辑。外部协议格式、内部任务模型、客户端展示投影分别维护：外部请求 → 协议适配 → Flow 命令与执行记录 → 业务事件 → 轻量展示。核心数据表不直接照搬某个协议的 schema。

A2A 接入范围建议包括：

- 读取或发布 Agent Card，识别端点、技能、协议版本、可选能力及认证要求。
- 支持直接消息结果及长期任务两种交互，建立外部 endpoint/task/context/message ID 与内部任务、执行尝试的映射。
- 处理进度、补充输入、产物、失败和取消；外部报告完成与 Flow 验收通过分别记录。
- 按对方能力选择流式订阅、查询或推送通知；不支持的能力明确报告，允许合适的降级方式。
- 对重复通知去重，核对断线后的实际状态。取消请求成功与远端实际停止不能混为一谈，重试按协议能力和操作性质处理。
- 对大产物使用协议允许的引用形式，并按权限读取；对方只返回内联内容时，在适配层保存到下层，浏览器仍只接收正文或 ID/title 引用。

MCP、ACP 等适配同样需要能力协商、错误与取消映射。协议产生的权限请求和补充信息请求进入中心的决策机制；客户端当前是否在线不应使这些请求消失。

协议转换默认通过程序完成，不额外调用模型解释每一条消息。内部 agents 继续按任务记录和引用协作，只有需要跨协议互操作时才经过相应适配。协议支持本身不保证减少 token，也不保证不同 harness 间会话可无损迁移。

轻量展示规则适用于协议入口：原始工具参数、结果和可展示 thinking 保存在下层，不直接透传至普通时间线。AG-UI 等适配必须遵守选定协议的必需字段与事件语义；若某项能力要求传递更多内容，应独立按需提供或明确不支持，不能删掉必需内容后宣称完整兼容。

每个适配器登记支持的协议版本、传输、client/server 角色、发现/任务/流式/取消/恢复/产物能力和实际验证范围。认证身份映射到 Flow 的工作空间、权限及预算，外部协议入口不绕过公共业务约束。

## 6. 交互与美学

- 主界面是一条连续的工作记录，重点呈现阶段进展、待决策事项、验证结果和交付物。
- 任务、日志、证据等详情支持原地展开，保留可选的检查视图。
- 常用操作以插件注册，包含参数表单、运行状态、结果展示及再次执行入口。
- 保持统一排版、适当信息密度、留白和动效节奏；后台更新尽量不打断阅读位置。
- 仅在确有必要时请求人的决策，并展示决策对象、关联任务和当前版本，避免对过期状态操作。
- 同一业务状态只维护一个来源，assistant-ui 和 AI Elements 不各自持有相互竞争的状态副本。
- Web 渲染与输入不参与后台任务的存活条件；换用 CLI 或其他前端后，仍能观察并操作同一个任务。
- 折叠详情在网络层也保持未加载，不将已下载的完整工具输出仅用样式隐藏。

## 7. 动态计划与可靠执行

任务计划允许运行时新增、拆分、取消和修改依赖，保留计划版本与变更原因。依赖、预算、超时、取消以及验收条件仍应明确。

若采用 Temporal：

- 由其负责执行的持久性，Flow 负责业务计划和决策语义。
- 模型判断、工具调用等外部操作放在有记录的执行步骤中，避免重放时重新作出不一致决定。
- 业务任务状态与执行平台状态明确分工；两者同步通过稳定操作标识、可靠投递和对账处理，不能假设跨系统更新天然原子化。

若采用 pg-boss：

- 复用 PostgreSQL 队列处理任务领取及重试。
- 明确额外需要实现的会话恢复、等待决策、取消传播和外部操作去重，避免低估维护成本。

两种路线都必须区分 harness resume 与任务 retry。模型会话恢复不意味着外部副作用自动恢复；操作可能已经成功，但返回结果因故障丢失。对外部写操作记录稳定标识、尝试与结果，支持查询实际结果后恢复，避免盲目重复执行。

## 8. 数据与并发设计

初始数据模型至少覆盖以下概念；具体表结构和索引在实施计划中确定：

| 概念 | 主要内容 |
| --- | --- |
| Workspace / Project | 工作空间、项目归属及隔离边界 |
| ConversationIndex / TimelineEntry | 有界会话索引、正文及按顺序排列的折叠引用 |
| ActivityDetail / Payload | thinking/tool call 的详情、参数、结果及底层内容定位 |
| Command / Runner | 持久化命令、幂等标识、执行端能力、容量与连接状态 |
| ProtocolEndpoint / ExternalBinding | 协议端点、协商能力、身份引用，以及外部任务/会话/消息与内部执行的关联 |
| Task / Dependency / Revision | 任务目标、依赖、验收条件和变更版本 |
| Run / Attempt / HarnessSession | 一次执行、重试尝试、harness 身份及恢复信息 |
| ProviderInstance / CredentialRef / AuthFlow | provider 账户实例、凭据所属位置和引用、可恢复的登录流程；不将凭据放入时间线 |
| Event / DeliveryRecord | 业务事件、可靠投递及处理记录 |
| Decision | 人的选择、关联任务、版本和生效状态 |
| Artifact / Evidence / Verification | 产物版本、来源引用、验证动作与结果 |
| KnowledgeSource / Chunk / ContextSnapshot | 原始来源、检索单位、上下文引用与版本 |
| Usage / Budget | token 用量、费用、预算和统计来源 |
| PluginInstallation | 插件版本、配置、声明能力及作用范围 |

并发原则：

- 持久会话数、可调度任务数、同时进行的模型请求数、工具进程数分别限额和观测。
- agent 数量与数据库连接数解耦；模型等待期间不长期占用数据库事务。
- 按任务追加业务事件，避免所有 workers 更新同一项目热点记录。
- 流式文本按批次保存；不为每个 token 创建业务事件。
- 大产物保存在对象存储中，数据库保留内容版本和引用。
- 同一执行会话需要明确所有者，旧 worker 的迟到结果不能覆盖更新的执行状态。
- 事件持久化与传输分开处理。浏览器重连按游标补齐业务事件，不把在线推送当作唯一记录。
- 工程 agents 使用独立工作区；最终验证针对合并后的产物版本。

100 个 agents 不直接等于高数据库吞吐需求。是否需要分区、独立检索服务或额外消息系统，应根据实际读写形态及压测决定。

### 8.1 分层存储与读取契约

分层首先落实为独立数据模型、表和 API 读取约定，首版不要求多个物理数据库。元数据和正文可保存在 PostgreSQL，大型底层内容通过对象存储承载。

| 层级 | 建议内容 | 加载时机 |
| --- | --- | --- |
| 导航索引 | 会话 ID、标题、更新时间及少量导航状态 | 加载或分页刷新会话列表 |
| 聊天展示 | 消息基础信息、正文、有序折叠引用；非正文引用的业务字段仅为 `id`、`title` | 进入聊天后读取当前窗口 |
| 活动详情 | 可展示的 thinking 内容、工具名称、参数、状态，以及底层结果引用 | 用户展开相关引用时 |
| 底层证据与内容 | 完整工具结果、执行日志、文件、产物与来源证据 | 用户进一步查看、下载或后台任务按权限读取时 |

thinking 指 harness 实际提供且允许展示的内容；未提供时不生成伪造的思考记录。

正文与折叠引用按有序块保存，保留“正文 → 工具调用 → 后续正文”的交错关系。引用只承载 ID/title，排序及消息版本放在所属消息或块容器中。引用 ID 应能解析到明确的内容版本，不能在相同 ID 下静默替换已经完成的证据。

展示查询直接读取轻量表或预先维护的展示投影，不先读取完整底层结果再删除字段。不得依赖 ORM 的深层关联自动加载；SQL 列选择和关联范围应明确。

为避免“一条消息”本身过大，聊天接口同时限制条数、块数和响应字节量。超长正文与大量折叠项支持连续分页，内容不被摘要静默替换；展开大结果也先加载有界片段。

### 8.2 读取 API 与实时事件

候选接口职责如下，路径名称尚未定案：

- 会话索引接口：游标分页返回导航元数据，不读取消息详情。
- 时间线接口：按稳定序号和游标返回有界正文及 ID/title 引用，并提供快照水位。
- 批量详情接口：只查询本次明确展开的 ID；一次请求可读取多个详情项，避免逐项网络请求及数据库 N+1 查询。
- 内容片段接口：按游标或范围读取大型工具结果与日志，支持进一步下载。
- 命令接口：受理创建、补充、决策及取消等动作，返回持久化后的操作标识。

实时推送遵守相同层级：普通时间线只推正文增量、引用变化和小型版本通知；不混入折叠详情或原始工具输出。只有已展开的内容才按需读取或订阅详情。高频更新合并并限制刷新频率。

客户端缓存最近会话，按内容版本复用数据并后台校验更新；长时间线按可见范围渲染。缓存仅为性能优化，清空缓存后仍能从中心完整恢复。缓存键、查询和订阅均包含工作空间及权限范围；详情 ID 不是授权凭证。

### 8.3 性能目标的测量方式

用户要求毫秒级体验。建议把验收拆成可测的交互响应、读取和命令受理预算；以下数值是初步预算，并非已承诺或已测能力。

| 操作 | 初步目标 | 测量边界 |
| --- | --- | --- |
| 切换已缓存聊天、展开已缓存内容 | p95 ≤ 50 ms | 用户动作至首批可读内容绘制 |
| 轻量时间线和有界详情查询 | p95 ≤ 100 ms | 中心收到请求至完成响应，不含公网往返 |
| 创建或取消等命令受理 | p95 ≤ 200 ms | 中心收到请求至持久化完成并响应，不表示执行结束 |
| 冷缓存聊天切换 | 根据部署网络另定 | 包括网络、解析、渲染；与缓存命中场景分别报告 |

模型生成、测试、索引构建及大型文件传输异步执行，分别测量完成用时。不能把快速返回受理结果报告为工作已经完成。性能测试同时记录 p99、响应大小、网络往返、数据规模、缓存命中与并发负载，避免用单次或平均延迟替代体验指标。

## 9. 上下文、协调成本与知识库

默认通过共享任务记录和结构化交接协调：任务目标、约束、事实引用、产物引用、验证结果和待解决问题。出现歧义或缺失信息时再增加 agent 对话。

上下文分为项目事实、用户决策、任务材料与临时执行历史。每次执行根据任务构造必要上下文，优先引用固定版本并传递增量，允许按需展开原文。

常规状态变化和预算检查由程序完成，避免 coordinator 模型参与每一个事件。压缩和摘要也计入成本；不能仅因上下文更短就推定总成本更低。

知识库必须保留来源、版本、权限范围以及引用位置；检索过滤与任务授权一致。首版验证全文检索与向量检索组合，对中文、代码标识符和精确术语分别测试。

成本统计至少包括：

- 模型输入、输出，以及供应商提供的缓存读写统计。
- 规划、agent 间交接、面向人的解释、检索和压缩所产生的模型开销。
- 重试、重复读取和验证开销。
- 每项验收通过交付的总 token、费用、用时及成功率。

若 harness 不能提供完整统计，标注覆盖范围及估算来源。当前没有实际数据支持任何 A2A 成本占比或 token 节省比例。

首轮实验已发现 adapter 返回的 usage 可能是会话累计值。账本必须记录原始来源及 step/turn/session 范围，累计水位绑定原生 session 和统计基线；不能把恢复后的累计值逐轮相加。缺失的 reasoning/cache 字段不当作零，辅助模型调用也纳入覆盖范围。具体证据见 FLOW-002。

## 10. 插件系统

| 插件入口 | 扩展内容 |
| --- | --- |
| Harness adapter | 执行、暂停、恢复、事件与能力查询 |
| Provider / auth adapter | provider 实例、登录挑战、凭据归属、状态校验、刷新与退出 |
| Protocol adapter | A2A、MCP、ACP 及可选展示协议的版本协商、消息映射与传输接入 |
| Context policy | 检索、压缩、历史恢复和上下文预算 |
| Tool / connector | npm 工具包、MCP 服务及外部系统 |
| UI / artifact renderer | 参数表单、工具结果和交付物展示 |
| Verifier | 测试、检查及领域验收 |

npm 用于分发，Flow 的版本化接口用于接入；MCP 用于工具互操作，不能替代完整的插件生命周期和调度机制。

插件声明版本、能力、作用范围和配置。可信服务端扩展与第三方隔离执行需要不同加载方式；浏览器渲染器与服务端代码分别管理。首版优先建立小而明确的接口，避免提前建设完整插件市场。

模块边界应贯穿中心业务、执行端、存储/检索适配和客户端。内建实现也通过模块接口使用能力；替换组件不应要求其他模块直接访问其内部表或 SDK 对象。配置、生命周期、取消、错误与事件语义应明确。

UI 插件负责渲染或触发公共命令，不能成为某项业务执行的唯一入口。对应操作必须能由 CLI 或其他客户端调用。执行端插件遵守中心下发的权限、预算和任务身份，不能绕过业务记录。未知 UI 插件类型至少能以 ID/title 展示并通过通用详情入口访问。

每个会话只有一个上下文压缩负责人。插件的压缩、工具与任务委派能力应能独立启停，避免和 Flow 调度重复。

用户提及的 “billion token context” 可能指 `billion-context` / `billion-context-pi`，具体项目尚未确认。已找到的插件属于压缩与历史恢复方案，其名称不意味着模型具备原生十亿 token 窗口。

候选接入检查：

- 验证显式扩展加载是否保留插件所需的宿主行为。
- 验证本地 session 文件、附属存储与跨 worker 恢复的关系。
- 验证压缩后的原文引用、子会话及分叉行为。
- 由 Flow 统一管理调度和版本，避免插件额外委派任务或自行升级改变行为。
- 作者报告的节省比例仅作参考，用 Flow 实际任务验证成本与正确性。

## 11. 可追溯交付与验收

交付记录至少关联用户要求、产物版本、验证动作、验证结果及未验证事项。区分实际执行结果、推断和待验证结论。

界面可读解释由上述记录生成，并提供展开证据的入口。agent 自述“已完成”不直接等于任务验收通过。

对代码任务，保留修改、测试及最终合并版本的对应关系。对知识任务，保留来源引用和结论的支持范围。验证按风险和任务性质选择，不把所有任务固定为同一套检查。

## 12. 技术验证

以下为完整验证矩阵。已开始的上游源码检查与首轮小任务实测记录在 FLOW-002；其余系统级验证尚未执行。小任务通过不能代替恢复、容量和插件兼容性验收。

| 场景 | 验证内容 | 需要记录的证据 |
| --- | --- | --- |
| Harness 接入比较 | 原生 Claude / Pi 分别与对应 AI SDK adapter 比较工具、事件、会话及取消行为 | 固定底层版本与模型，记录 sandbox 差异、能力缺口和接入成本 |
| Provider 登录与复用 | 本机已有身份、Web/CLI 登录挑战、多 runner 凭据归属和刷新 | Hermes / T3 Code / Paseo 固定源码版本、可复用模块、真实认证结果与未测项 |
| 长任务中断恢复 | 流式输出、工具调用、等待决策时终止 worker，再由其他 worker 恢复 | 是否丢失状态、重复执行、错用旧结果 |
| 上下文插件 | 压缩后暂停、恢复、分叉与引用还原 | 原文可恢复性、信息遗漏、额外压缩成本 |
| 超过 100 个会话 | 建议以 128 个会话做容量场景，分别调节模型与工具并发 | 成功率、延迟、内存、数据库写入和连接数 |
| 动态计划 | 执行中新增任务、修改依赖、取消旧任务 | 变更记录、取消传播、过期结果处理 |
| 外部操作故障 | 操作成功后丢失确认，再触发恢复 | 操作去重、结果回查及不确定状态处理 |
| 上下文成本 | 相同任务比较完整历史传递与引用/增量方案 | 验收成功率、输入输出、缓存、协调及重试成本 |
| UI 连续体验 | 多任务更新、断线重连、决策与查看证据 | 阅读位置、事件完整性、决策对象版本 |
| 无前端执行 | Web 发起任务后关闭页面，由 CLI 观察和接续操作 | 任务继续执行，客户端断线不触发取消，状态与交付物一致 |
| 多执行后端 | 同一中心连接多个 runners，模拟失联和恢复 | 能力路由、执行所有权、无重复副作用 |
| A2A 互操作 | Flow 调用外部 agent，外部 client 调用 Flow；包含直接响应、长任务、补充输入和产物 | Agent Card、版本/能力协商、关联 ID、认证和最终状态映射 |
| 协议故障恢复 | 重复通知、重连、取消竞争、不支持流式能力及大型内联结果 | 不重复执行、实际状态可核对、能力降级、上层不加载完整 payload |
| MCP / ACP 接入 | 工具/资源调用、会话交互、权限请求，以及 Web 断线后的执行 | client/server 角色明确、runner 持有会话、请求进入中心决策机制 |
| 分层读取 | 包含大型工具结果、超长正文及大量折叠项的聊天 | 首屏与普通事件不含详情 payload，响应有界，展开按需读取 |
| 缓存与事件衔接 | 快照与订阅之间发生更新，旧游标重连，多客户端切换 | 无事件丢失、重复结果可去重、版本与权限一致 |
| 交互延迟 | 分别测试缓存命中、冷缓存、查询与命令受理 | p95/p99、响应字节量、网络条件及模型完成时间分开报告 |
| 知识检索 | 中文、代码标识符、精确事实及权限过滤 | 召回质量、引用正确性、检索耗时 |

100+ 会话测试与 100+ 同时模型执行测试分别报告，不互相替代。具体资源预算、延迟目标和允许的成本上限需在部署方式与模型额度明确后确定。

## 13. 分阶段落地

阶段用于表达依赖与可检查产出，允许根据验证结果调整实现。

| 阶段 | 目标 | 主要产出 | 完成条件 |
| --- | --- | --- | --- |
| 0：选型验证 | 消除接入、恢复、协议和插件兼容性的主要不确定性 | 上游复用清单、成对对比结果、固定版本、协议能力矩阵、部署选择 | 关键场景有实际证据，明确采用路线及限制 |
| 1：最小工作闭环 | 一个目标可以执行、验证并交付 | 独立中心 API、CLI、轻量 Web、选定的首个 harness runner、分层读取、任务/证据数据及取消恢复 | Web 发起后断开仍继续，CLI 能接续观察和操作；交付物可追溯 |
| 2：多 agent 协作 | 并行任务可协调且成本可解释 | 动态依赖、上下文引用、预算、独立工作区、token 账本、A2A 双向互操作及 MCP client | 计划变化与故障可恢复，协议能力经过验证，费用能按任务追溯 |
| 3：知识与插件 | 验证扩展能力及来源追溯 | 知识检索、插件接口、上下文和 UI 扩展示例，按需要加入 ACP、MCP server 或 AG-UI | 插件和协议有明确宿主约定，升级与恢复行为可检查 |
| 4：容量与部署 | 验证超过 100 agents 的目标及实际部署边界 | 容量报告、资源配置、故障演练和部署文档 | 分别报告会话与执行并发能力，列明硬件、额度、成本及限制 |

实施时可把独立阶段拆成子计划。每份子计划链接本计划，列明具体产出和验收证据，避免一次展开所有模块的细节。

首轮具体分工、独立 worktrees、公共契约基线及集成验收见 [FLOW-003：首轮执行与 Agent 分工计划](../flow-003-m1-execution/plan.md)。Goal Owner（主 agent）负责用户沟通、目标取舍、优先级协调和目标验收；独立的 Astra Ultra Execution Lead 负责 F00、架构与公共契约、骨架、薄 client/CLI、技术派工、工程检查及审查集成。用户期望开发上限10槽（含这两个角色），实际并行度取用户上限、运行时cap和ready独立任务数的最小值；当前实测运行时仍只容纳4个agents，因此暂时滚动，容量允许即并行中心、runner、Web等ready任务。先完成 F00，再用确定性测试 adapter 建立闭环，真实 harness 接入与选型验证分别记录。用户已授权持续完成完整计划；M1已在main交付，C02核对恢复、P01协议、M02统一工作入口从e845eb0基线继续执行。完成后立即领取下一ready项，不能停在单里程碑。

## 14. 待定事项

| 问题 | 影响 | 解决方式 |
| --- | --- | --- |
| 中心短暂不可用时 runner 可自主执行到哪一步？ | 本地缓冲、授权边界及恢复对账 | 明确继续执行、暂停和恢复策略 |
| 毫秒级目标的基准网络、数据规模与设备是什么？ | 冷加载、端到端延迟及性能验收 | 确定基准环境，实测初步预算 |
| 首版是否强依赖 Pi 原生 npm 扩展？ | 原生 Pi 与统一 harness adapter 的选择 | 明确插件清单并运行兼容性验证 |
| 各 harness 使用原生 SDK/RPC 还是 HarnessAgent？ | 能力、版本、隔离、恢复和维护成本 | FLOW-002 按同一 harness 成对验证，允许混合接入 |
| Temporal 还是 pg-boss？ | 恢复语义、运维和自建工作量 | 根据部署方向及恢复验证决定 |
| 100+ agents 的首要并发口径是什么？ | 性能目标、资源成本和供应商额度 | 分别定义会话、模型请求、工具执行目标 |
| 首批真实任务和验收基准是什么？ | 成本、正确性与 UI 设计的评价标准 | 选择代表性的工程任务和知识任务 |
| “billion token context” 具体指哪个项目？ | 插件接口及维护策略 | 确认仓库与版本后验证 |
| 首批协议对端、版本及必须支持的能力是什么？ | A2A/MCP/ACP/AG-UI 的适配范围与排期 | 选择实际互操作对象，建立兼容矩阵并验证 |

## 15. 参考来源

以下链接来自 2026-10-05 核对的官方文档或项目仓库。隔离实测见 FLOW-002，M1系统证据见 I01；完整后续能力仍以验收矩阵为准，实施前再次确认版本和支持范围。

- [AI SDK Harnesses：职责与实验性状态](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)
- [AI SDK harness 适配器列表](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-adapters)
- [AI SDK Pi adapter：扩展、运行位置和限制](https://ai-sdk.dev/providers/ai-sdk-harnesses/pi)
- [AI SDK Claude Code adapter：原生 SDK 与 sandbox bridge](https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code)
- [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent)
- [T3 Code](https://github.com/pingdotgg/t3code)
- [Paseo](https://github.com/getpaseo/paseo)
- [Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)
- [Pi RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)
- [assistant-ui ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store)
- [AI Elements](https://elements.ai-sdk.dev/docs)
- [Vercel Chatbot](https://github.com/vercel/chatbot)
- [Fastify LTS](https://fastify.dev/docs/latest/Reference/LTS/)
- [Temporal Durable AI](https://docs.temporal.io/ai)
- [pg-boss](https://github.com/timgit/pg-boss)
- [Drizzle 事务](https://orm.drizzle.team/docs/transactions)
- [pgvector](https://github.com/pgvector/pgvector)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [billion-context-pi](https://github.com/ranxianglei/billion-context-pi)
- [billion-context-pi 宿主适配约定](https://github.com/ranxianglei/billion-context-pi/blob/master/docs/host-adapter.md)
- [OpenAPI：语言无关的 HTTP API 描述](https://spec.openapis.org/oas/latest.html)
- [HTML Standard：Server-sent events 与 Last-Event-ID](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [PostgreSQL TOAST：大型字段的存储机制](https://www.postgresql.org/docs/current/storage-toast.html)
- [A2A 官方规范](https://a2a-protocol.org/latest/specification/)
- [MCP 官方规范](https://modelcontextprotocol.io/specification/2026-07-28)
- [Agent Client Protocol 概览](https://agentclientprotocol.com/protocol/v1/overview)
- [AG-UI 概览](https://docs.ag-ui.com/introduction)

## 16. 变更记录

- 2026-10-05：根据首轮讨论建立计划，记录用户约束、候选 stack、模块职责、技术验证及阶段路线；所有未确定选型和未执行验证保持显式标注。
- 2026-10-05：记录用户确认的前后端分离、CLI、中心连接多执行后端、前端断线不中止任务、模块化和分层读取原则；补充候选 API 契约、恢复边界与性能预算。具体库选择和数值预算仍待验证。
- 2026-10-05：将 A2A 等常见协议支持纳入明确目标，补充独立协议适配模块、A2A/MCP/ACP/AG-UI 的角色和建议优先级，以及互操作验证；尚未实现或声明已兼容具体版本。
- 2026-10-05：加入 Hermes / T3 Code / Paseo 的源码借鉴与 provider 身份模块；取消默认优先 Pi + AI SDK 的倾向，建立 FLOW-002 对原生 Claude / Pi 与各自适配层进行实际比较。使用用户选择的本机已有登录状态，结果不外推为生产可靠性或 token 节省结论。
- 2026-10-05：用户确认个人自托管优先、一个中心连接本机或远端 runners；建立 FLOW-003 派工计划，落实独立 worktrees、单一接口/迁移负责人及首个端到端闭环。
- 2026-10-05：同步 FLOW-003 的职责修订：Goal Owner 负责沟通与目标验收，Astra Ultra Execution Lead 承担工程执行、技术审查和集成；四槽并发下最多两个执行子 agents，三个 feature owners 滚动派工，F00 尚未启动。

- 2026-10-05：M1选定pg-boss，保留Temporal为复杂工作流后续重评对象；短验证与边界见 `docs/architecture/m1-scheduler.md`。

## TODO（稳定 ID）

- [x] **FLOW-001-T01** 记录用户目标、架构约束、模块职责与系统验证矩阵（本文）。
- [x] **FLOW-001-T02** 完成首个M1工作闭环与证据；跟踪 [FLOW-003](../flow-003-m1-execution/plan.md)。
- [ ] **FLOW-001-T03** 实现并验证协议、插件和上下文后续阶段。
- [ ] **FLOW-001-T04** 在声明的环境与预算下完成性能、容量和部署验证。

协作记录：[status.md](status.md) · [review.md](review.md)。状态按实际提交和证据更新，review模板不是通过结论。

2026-10-06 01:14 UTC：新增 [架构改进研究](research-2026-10-05.md)，由 Goal Owner 提供官方资料结论，标记研究建议/未实测。未改冻结 M1/Web/dashboard 契约，也未新增完成标记。

2026-10-06 01:19 UTC：[前端开发与测试工具研究](frontend-tools-2026-10-05.md)记录官方候选、真实浏览器方法与四类验收，尚无Flow接入/收益结论；不改冻结W01/D01。

2026-10-06 02:05 UTC：用户明确继续完整计划。逐项追溯见 [完整验收矩阵](full-plan-matrix.md)，M1通过仅是基础；后续跨任务、动态计划、协议、KB、context成本、插件、harness与容量不能由M1/toy代替。

2026-10-06 08:49 UTC协作记录（随后由用户最终规则覆盖）：当前职责、两层任务和跨层消息预算以[OPS-001](../ops-001-status-review/plan.md)及根AGENTS为准；早期分工/额度和泛化重要接口消息例外均为历史。co-lead→GO仅每大task独立blockers+完整Done一次，日常接口/领取/集成由status→dashboard传递。

2026-10-06 09:45 UTC发布后继：FLOW-001-T04/REQ-19增加SVC04独立Web artifact发布与回退。沿用已审SVC03固定artifact/自有进程/锁，纯前端更新不能要求后台任务清零；旧tab的lazy assets需精确manifest白名单、有界保留且不自动reload。先0provider自有fixture验证后台持续、失败保旧和rollback，真实安装切换另走现有受控流程。现SVC03仍是固定单artifact服务，以上是授权后继，不冒称已实现；co-lead已安排原runner_owner在TUI审查修复安全停点准备独立scope。


<a id="continuous-goal-delivery"></a>
## 连续目标交付的下一纵向路径（2026-10-06）

沿原O01-05、M02、REQ-01/22执行，由Execution Lead负责跨端技术规划；不新增重复大task，不以已交付workspace列表代替完整目标。ENG01B与TUI01C当前领取片段先安全交付，随后优先此路径，具体实现仍独立worktree/精确claim。

| 责任 | 复用接口与下一个最小接缝 | 依赖与验收 |
| --- | --- | --- |
| 中心目标/计划 | G01/O01 goal、固定revision proposal/apply、受限grant和节点输入；有意义的目标/决策/产物变化保存可追溯解释 | 不扩大旧grant；保存源版本，不每条tool event调用模型；刷新只读 |
| 执行与验收 | 现runner claim/lease/outbox、queue、C02恢复、ENG受信检查与产物版本 | 执行、机械验证、业务接受分开；失败保留旧证据，重试不重复未知副作用 |
| 统一公开旅程 | 连接现goal→plan→node execution→verification→decision/delivery，补最窄持久关联或有界读模型 | 由现公开typed命令驱动；无客户端编排权威、无第二调度器；新scope先看已有真实缺口 |
| 客户端 | CLI/headless/TUI先验证共同协议；Web并行消费同一中心历史/命令 | 不要求逐task找结果，任一端退出不取消任务；只为受影响浏览器交互补验 |

完整验收：在一个连续入口提出目标和约束，理解并决定计划变化；看到并行进展与真实blocker；验证失败后能区分修复结果与旧证据；最终交付绑定内容版本、检查来源/范围与接受状态。固定文案、手动十个task或一个计划图成功均不足。零模型公开旅程只证明协议与恢复，真实native规划/解释/工程语义另用明确有界预算，不复用历史额度。


### 连续读取的稳定身份与实时进展（2026-10-06 11:15，研究输入）

GO只读固定4285182（至a7238相应文件无差）：goal-tools-mcp/read.ts先取全GoalSnapshot并hash；非input详情/下一页要求相同snapshotRef。goals/state.ts在snapshot中携带execution.task.updatedAt，而events.ts会随已提交活动更新它。因此无关兄弟任务的新活动可能使当前材料ref失效，迫使重新overview。此为源码推导，尚未复现，不能称token浪费或百agent失败。已有goal-graph-runs/runner.ts的固定baseRevision分页/currentRevision/stale可借鉴，但固定图读取不是动态执行读取已完成。

下一统一读口应将稳定输入、已保存解释、集合分页身份与实时执行进展分开；真实写命令/产物接受仍由中心核节点输入、依赖产物版本、grant/fence，不能将混合观察冒充一致快照。先两节点0模型公共旅程：读A/翻页期间B活动更新；相关输入/依赖变化仍显式识别且过期写拒绝。记录实际请求数、传输字节、重复可读材料，不把bytes当tokens，不造新快照平台或第二调度器。与上述同一连续目标路径一起设计，不另立大task、不打断当前片段。

2026-10-06 11:32:46 UTC 执行映射：原O01/M02下一统一读口已由[O11唯一子计划](../../../goal-delivery-read-model/plans/o11-goal-delivery-read-model/plan.md)领取，实现owner只读plan/state/immutable input/decision分层。独立WT与6literal（含两个type-only共用规则hook）不新造大task或调度器。写权限与相关版本拒绝仍原中心权威；实际验收和成本字节待子片证据，普通进度仅其status。

### 连续入口的历史解释与共享控制器（2026-10-06 11:55:24 UTC）

O11限定读口已main52eb；下一O12沿同一大目标提供已有goal的连续观察、显式命令/未知ACK恢复与断开不取消。复用immutable goal_explanations提供轻历史引用和按固定id显式正文，超过旧50条窗口仍可达；兄弟活动不能使旧解释引用失效，历史解释不代表当前状态仍有效。0模型公开旅程覆盖>50条、相关版本冲突、两个公开客户端和同key恢复。状态仍中心权威，客户端不自动调模型或调度child；owner读口不直接授予runner/MCP。公开typed入口由headless/TUI/Web并行消费，完整自然语言目标闭环不因本片通过而勾完。


### 有界独立分支与共享预算后继（2026-10-06 15:25 UTC）

归原REQ-18/22、O01-05/M02和COST001-05，不改已审O14 v1：固定70cc的goal-progression/store.ts:83–99会在同授权任一未完成执行时返回，因而独立ready节点也串行。当前首版只证明有限有序推进，不代表百agent编排。O15当前输入确认继续，不扩其writer。

后继按显式版本策略允许独立分支在中心容量/共享预算内并行；依赖未满足仍等待，全局撤销停止新受理，unknown不自动重试或释放预留。0模型验收A/B独立、C依赖A：A待人时许可策略允许B实际完成，C不提前；证据须真实重叠而非只queued多行。复用现scheduler、usage账本和中心事务；原子预留、跨runner竞争、lost ACK/重启不重复占用、unknown不凭超时退款归COST001-05，次数/并发硬界与估算USD分开。资源未达不启动负载。

来源：[官方SDK成本说明](https://code.claude.com/docs/en/agent-sdk/cost-tracking)，2026-10-06实际读取；当前文档说明query预算不计resume带回历史额，clear可重新起算，费用是客户端估算。仅作后继设计输入，不替代固定SDK0.3.290行为证据，也不改历史usage字段/旧grant。

### P01读取取消的局部后继（2026-10-06 15:25 UTC）

固定7810至本轮已审客户端增量，a2a-mapping的read包装组合signal只中断等待，flow.events/detail未收到该signal；client detail支持signal，events尚无可选signal。底层HTTP仍到自身默认15秒超时，并非无限泄漏。归原P01/REQ-08/10低优先后继：兼容地透传观察取消，实际挂起HTTP证明observer abort后events/detail关闭、没有后继页/详情读取，正常和默认超时保持；断开观察绝不cancel中心任务。0PG/provider/新依赖，仅直接模块。现reference仅id/title，不能无依据先判断artifact种类；不借本片建缓存/事件系统或重跑全库。


### 版本化依赖原文按需读取（2026-10-06 15:28 UTC，后继输入）

归REQ-08/15/22与原连续目标路径。GO只读固定fb9fe5e7：goals/commands.ts在每个child受理前读取依赖全文/hash并拼入prompt，任一依赖或最终JSON超过16,000 code units即拒绝；这是O01/K03已声明v1界限，不作新回归。多child共享大产物会重复输入，换provider窗口不自动解决。

后继采用明确版本的固定artifactId/version/digest引用及受限原文读取能力，普通child只获本attempt授权依赖，不获planner广泛工具权。原文不截断、不只留摘要、不暗读latest；复用goal input/context与R05扩展点，不让Web/TUI各造状态。0模型验收同一128KiB产物给多个独立child：初始受理/输入不搬全文、显式读取有界、越权/失效拒绝、旧版本仍可追溯，并完成真实下游路径。记录请求/字节/读取次数，不称token节省。旧v1/兼容reader保持，当前O14生产与O15确认优先，不扩大其writer。

### 会话页批量读取后继（2026-10-06 15:48 UTC）

归REQ-15/B02→B03，当前真实兼容发布与Claude消息设置优先。固定a89f的turnPage仍逐条await turnView，各turn分别取task/context/session/preview；已有有界contextReferences可复用，queue已采用批量读。B02/B03旧无context的50turn实测252 SELECT只作为历史基线，不能称为今日所有混合页的查询量；B03只减少全文向应用搬运，没有消除N+1。

下个共享读路径安全点由co-lead与Mika定精确范围，在同一有限页/只读快照内批量投影，保留逐行归属、current attempt、source、digest、版本及unknown门禁，不用同PG连接Promise.all伪并行或删除完整性核验。0模型小例复用历史口径并加入context/附件/新消息设置、无关及旧attempt拒绝；分别记录SQL数、DB解码/HTTP字节、延迟，不因批量化宣称速度或token收益。源码绑定见[研究输入](../../docs/quality/conversation-page-batch-successor-2026-10-06.json)。这只是可执行后继，无新writer/测试/负载，不扩大当前消息设置范围。

### P01增量协议读取成本（2026-10-06 16:01 UTC，GO只读输入）

固定a89f42ab的observe在updatedAt/watermark变化时从cursor0重新映射；seen仅避免重复发送，events/detail读取仍重做，historyLength=0也因默认artifacts要求扫描。现10k事件/200引用/2MiB界限保留，不称无界泄漏。归原P01/REQ15，与观察取消后继一起：使用真实官方SDK HTTP fixture固定1产物+多次状态/非产物变化，记录events/detail请求数及字节，并核首Task、后继status/artifact updates、重连、水位、权限与unknown可见结果一致；0PG/模型/新依赖，不以无界缓存掩盖成本。官方依据[A2A 1.0规范3.1.6/3.5.2](https://a2a-protocol.org/v1.0.0/specification/)。此为后继设计输入，当前TUI/Claude/兼容发布优先，无新writer或运行。

2026-10-07补充出站方向，仍归REQ-04/P01/P03：GO只读固定d022c800的`apps/runner/src/protocol-dispatch/index.ts`，observe每轮snapshot(historyLength:0)→importArtifacts→默认500ms等待；`materials.ts`的版本receipt去重在下载、拼接与digest之后。P03去history及上段反向bridge检查均不等于已经消除出站重复artifact传输；这是源码推断，未运行容量或token实验。

后继沿本地find-skills/codebase-design，由原协议owner在安全空槽用固定官方SDK、少量有界poll和真实HTTP toy核稳定128KiB产物加状态变化，记录请求数、wire字节、重复hash/import次数及取消/完成发现延迟，再决定有界backoff/jitter或能力声明后的订阅加快照核对。A2A 1.0首Task/后续增量不保证断流无损重放；保留lease/cancel/uncertain不重发、版本、重连和响应字节上限。不造第二scheduler或无界缓存，不宣称token节省/已证100agents瓶颈；NOT_RUN、未领取，不抢当前SVC06/O16。


2026-10-06 16:59 UTC REQ-19/SVC06（关联X01）只读研究输入：固定main9314中，server/index静态出口经package-fetch worker/artifact barrel加载pacote，安装routes/commands加载plugin-runtime/tar；只读artifact入口也依赖含resolver的barrel。因此未启用两个可选host的聊天/TUI入口仍需要这些依赖，TUI01F的真实准备清单体现此闭包。当前仅源码耦合事实，没有启动时间/RSS/物理安装节省实测。

后继在CORE/RELEASE收口后的空闲小窗口，沿现SVC06/X01计划核禁用/启用host的真实import边界，再决定最小组合入口按需加载及纯artifact reader/fetcher职责分离。先0PG/0provider、有界import-only，不删功能、不造通用插件框架；迁移完整性、默认禁用、授权和启用失败清理保持。大型release的既有资源门槛不因拆分候选降低，当前writer不被打断。

### CHAT05-06 完整工具原文：已交付底层与下一用户交付

2026-10-07安全点核对：CHAT05P01/P02的持久分块传输、授权分页reader和显式单attempt host已交付main f5a13cbe；下述2026-10-06第一片问题/验收作为历史动机保留，不能再把底层未实现当当前阻塞。唯一产品范围与实际结果见[CHAT05P02权威status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/native-activity-body-wiring/plans/chat05p02-native-activity-body-wiring/status.md)；本次不重跑原44局部例或PG03。

下一用户结果仍归CHAT05P01-06 / REQ15：来源允许的工具输入/结果可由用户展开并分页追回完整原文，默认首屏/SSE不取大正文，旧截断历史继续如实显示。三项实施交接共用已交付reader/descriptor，不另造正文模块或任务权威：

| 原任务下的交接 | 责任与依赖 | 验收边界 |
| --- | --- | --- |
| CHAT05P01-06：实际SDK/CLI显式开通 | Execution Lead安排assignment_review；当前SVC06B产物/发布安全收口后ready，先fresh核runner/CLI/公共出口写权，现未领取 | 复用P02 host确认与outbox恢复；原始bytes先持久、final等tail、unknown保留。实际SDK接缝与合成0模型直接消费者分开，真实provider另获预算。 |
| TUI001-03/08：终端完整正文消费 | Execution Lead安排原TUI owner；SVC09A当前片先收口，依赖同一FlowClient分页合同，现未新增writer | 展开前零正文请求；显式有界分页/完整拼接/取消，不复制Web私有投影；headless与实际PTY证据分别保留。 |
| WPF-MATURE-06-03：网页完整正文消费 | Web co-lead自主安排原合法owner；新网页/消息设置优先，Lead提供P02固定合同并协调必要共享出口 | 实际展开/下一页可达、默认惰性读取和有界缓存；旧截断/未完整不能冒充可恢复。浏览器验收独立，不作为全部后端串行门禁。 |

以上是一个既有后继的唯一实施交接，产品编写须原子领取后才开始；完整用户验收尚未完成。不是当前SVC06B产物或SVC09A scope的一部分。

2026-10-06 18:56 UTC 原第一片规划：

沿既有 CHAT05-06 / REQ-15，不新增大task。该历史基线的 mapper 截到65,536B后仅保存前缀与全文hash，不能追回余文；旧历史仍明确 truncated，不能补造可恢复性。此为已知未完成范围，不改原CHAT05批准。当前保留页面兼容与O16安全交付优先，之后由 Execution Lead 负责派工/公共接线，指定 assignment_review 在当前R01正式收口后的首个合适实施槽承担 producer→durable transfer→center immutable body 的窄纵向片；未取得新独立WT/精确claim前不写产品。若O16共用runner接缝尚未释放，先做独立body合同与reader范围，不能双writer。

第一片 Interface 明确来源可公开的tool输入/结果原始bytes、body身份/固定digest/完整性状态、字节与块数上限、授权页读取以及取消/错误/资源释放。复用现有outbox、attempt fence和detail授权，受理/重报/崩溃恢复不重复正文，旧attempt不能覆盖；最终完整受理前不得称已保存全文。超过真实保存上限明确拒绝或incomplete，非公开thinking/redacted材料仍不制造正文。首屏与SSE只轻引用，展开前零正文请求。Web/TUI用同一公共引用和分页合同，呈现各自独立，不新建对象存储平台或scheduler。

零模型合成超过64KiB的可公开正文，验证producer到中心完整bytes/digest、失ACK原key重报、崩溃恢复、旧attempt拒绝、授权HTTP/headless分页拼回原文、旧前缀历史不可恢复，以及超真实上限的明确状态。记录实际传输/持久bytes和有界内存/队列，按实际受影响接缝做直接消费者验证；不重跑无关全集，不把bytes称token收益。Mika已有会话页批量读取仍是另一职责，本片不占其读页实现范围。原CHAT05唯一plan保留具体子片归档，完整REQ15尚未完成。


### 队列与目标扫描的锁隔离后继（2026-10-06 19:10:54 UTC）

- [ ] **FLOW-001-T04-SCAN-01** 沿 REQ-15 / CHAT04 / O14，验证单实体锁等待不阻断无关队列和目标；后台扫描及关闭均有整轮总时限。Execution Lead负责排期，当前兼容发布/消息设置和O16先收口；未分配实施writer/未运行。

GO只读输入绑定main22a0806bc2465e11096949618113833f31766b19：index.ts同一pendingWorkScan串行queue→goals；queue候选轮转SKIP LOCKED提交后，第二阶段逐个promoteReady重新普通锁conversation/task；goal推进亦普通锁project/task。生产10s statement_timeout仅约束每条SQL，条数上限不等于整轮时限。既有抛错后轮转用例未证明候选选出后的锁等待隔离。这是源码推导风险，尚无实测延迟或事故。

最小独立验收复用中心事务/admission/生命周期：少量ready会话与目标，受控屏障使首候选在第二阶段等待行锁；无关项应在声明局部预算内推进，释放后原项恰好一次；pause/cancel/授权/FIFO保持，关闭有界，未知事务保守。不能以Promise.race遗弃仍写SQL，不能新增scheduler框架或用128任务负载代替此因果旅程。模块各自拥有领域规则，跨模块组合入口只管有限轮次与关闭。

一手语义参考（本轮已打开，网页current为PG18，生产固定版本行为仍须局部验证）：[SELECT锁定](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)、[客户端超时配置](https://www.postgresql.org/docs/current/runtime-config-client.html)。本段纯规划，不改已审O14 v1或宣称性能提升。


### 自托管长期服务监督（2026-10-06 23:47:36 UTC，REQ-19后继）

- [ ] **FLOW-001-T04-LIFECYCLE-01** 交付每服务唯一监督职责的自托管恢复片。Execution Lead负责界面与排序；候选实施owner为assignment_review，在当前完整工具原文局部片安全点后以独立WT/精确scope领取。当前仅设计输入与只读接口核对，无新产品writer、主机持久配置或运行验证。

当前b178/0da：compose只声明PG且无restart；personal-preview的runService仅spawn一次并等待退出。OPS14仅监督有界test/operator，SVC06仅固定发布产物，两者都不是长期服务监督。23:32的实际停机原因仍unknown，现主机全局监督尚未调查；不能把缺策略当根因或声称加一行即可解决。

职责采用最小成熟平台接缝：Docker容器与宿主非容器服务各自选择唯一supervisor，不同时由Docker策略与宿主管理器监管同一容器。首次设计先只读核可用平台及现监督身份，不修改主机策略。固定release/config身份、依赖readiness、用户stop/drain与意外crash区分；重启次数、退避、日志量及健康状态有界。Flow仍拥有lease、durable queue、授权与unknown副作用，不因进程重启重投未知工作或产生额外探测模型请求。

0模型自有环境验收：受控退出、依赖暂失后同一持久数据接续；明确stop不复活；同一服务无第二进程；旧租约/队列恢复与未知副作用保持；超限停止并给出诊断。实际本机持久配置及服务切换另提供固定、可回退的审查交付，不借本次恢复授权悄悄上线。与SVC06固定runtime/dependencies独立但互相引用，公开健康只反映已观测状态。

一手依据：[Docker restart策略](https://docs.docker.com/engine/containers/start-containers-automatically/)（2026-10-06实际打开）：只约束容器，on-failure不覆盖daemon重启，不能与主机管理器重复监督同一容器。此处记录候选方向与未验证范围，不宣布自动恢复完成。遵循根模块化规则，用find-skills/codebase-design/clean-code评估生命周期、依赖方向和两个实际消费者，避免新调度平台。

后继只读接口核对（native_center_owner，fixed b178，0运行）：当前start为detached+unref，internal-service要求预登记nonce/PID且归属依赖PGID=PID，不能直接塞进平台KeepAlive。候选先提取单role observe/reconcile-stopped接缝与受监督前台模式；明确supervisor、nonce身份和显式stop/maintenance的唯一控制者。只有exact-owned且确证stopped才可替换，unknown/EPERM/原组仍在/持久记录失败即止；不自动解除maintenance或清理unknown工作。整套start入口不用于单role恢复。macOS登录期LaunchAgent不承诺logout后仍运行，关Web与logout分别验收。

[Apple launchd说明](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)（2026-10-06实际打开）要求受监督进程不得自行daemonize。平台适配与SVC06固定release通过小接口组合，现有短命OPS14不变；本轮未安装或修改任何launchd/Docker策略。

固定只读接口核对见[生命周期后继证据](../../docs/quality/selfhost-lifecycle-2026-10-06.md)。


### REQ-18：插件宿主组合下的连接与控制响应（2026-10-07，待测）

- [ ] **FLOW-001-T04-POOL-01** 沿原 REQ-18 / S01 容量验收，确认100+实际执行扩展时，已启用的插件下载/安装不会令心跳、取消和交互控制失去预先声明的响应边界。Execution Lead负责范围与排期；实施owner未领取，当前仅补验收条件、NOT_RUN。聊天关键路径与现有恢复队列优先，不增加运行预算或降低资源门槛。

**已确认事实与限制。** 只读输入为 main `05cdc51e9668d8e3b5219440361ee6b8f1b3a549`：`apps/server/src/index.ts:72` 业务池max8、获取连接5s、SQL statement_timeout10s；`scheduler.ts:5` pg-boss独立池max3、获取连接5s。这是每中心实例的配置，不是每runner的连接配额。SSE每观察者250ms读取，事务释放连接；心跳、控制与扫描仍共享业务池。`plugin-package-fetches/worker.ts:83–128`在启用host后为session advisory lock持续持有一个业务连接，含空闲及下载阶段；`plugin-installations/commands.ts:100–132`在文件准备期间也持有会话连接。这些事实不证明已发生饥饿、连接泄漏或生产事故。

原[S01结果](../../docs/evidence/s01/mixed-128-run/report.md)是8个runRunner实例位于同一runner OS进程、128个实际fixture attempts、6秒窗口；业务池获取连接n4691、p95约203ms、最大632ms含连接建立，FOR SHARE分类仍UNKNOWN。它不证明128个原生模型、长时容量或本次插件组合；[LAB02](../../docs/evidence/lab02/README.md)则仅是观察者。既有固定source/raw/批准不变，S01原唯一[计划](../s01-runner-capacity/plan.md)与owner继续负责其既有容量工作，本条不复制一套实验。

| Module / Interface | 组合验收责任 |
| --- | --- |
| 中心组合入口与业务Pool | 固定实际启用host、中心实例数、每池上限/保留用途；读出totalCount/idleCount/waitingCount并分开记录checkout等待、连接建立及SQL/事务时间。 |
| 下载/安装宿主 | 保留session advisory fence、事务与外部I/O分界、停止与unknown恢复；记录占用开始/结束、空闲持有及资源释放，不以文件阶段的无SQL当无连接占用。 |
| runner/公开控制调用者 | 固定真实runner进程/实例/attempt数量及身份；观测心跳、取消受理与实际停止、交互读写的请求至回执时间、错误/超时及租约/fence结果。 |
| 原S01观测入口 | 复用已有有界计量与资源归属；观察不写业务状态、不构建第二账本/调度器，观测者数量与执行者数量分别计数。 |

**最小组合与顺序。** 先在自有0模型小例核直接消费者和持有/释放因果，再按独立固定容量预算决定100+ fixture与后续原生/长期阶段；本次没有开放任何阶段。固定禁用两host、仅下载、仅安装、两者同时启用四种配置。启用后分别覆盖空闲、受控在途网络/文件阶段及正常停止；下载只用自有loopback合成材料，禁止用公共registry波动冒充受控条件。非SQL停顿必须有界、可收束，不以Promise.race遗弃仍有副作用的工作。

**运行前必须冻结的判定。** 具体场景的执行/观察拓扑、持续时间、心跳间隔/lease、每类控制响应最大界限及统计口径、并发请求数、总时间/字节和清理预算均须在原S01候选中明确；未声明界限不能报告PASS。逐组合保存两池及所有中心实例的连接预算合计和管理余量、占用/排队峰值及有界样本、checkout等待分布、真实心跳/取消/交互延迟和错误。取消受理ACK不等于adapter停止；同时保留实际生效、未决与unknown。池等待、SQL时间、事务/非SQL持有时间不混算，低采样未见等待不证明无等待。

正常收束须核自有宿主停止、锁/会话与连接释放、已接受工作及持久恢复事实；连接丢失、取消和错误不得跨session替换原写者或重投unknown。不能只把持锁连接还池、在另一会话接管、增大池数或删掉插件功能便宣布解决。若测得问题，再以最小Module/Interface选择修复，保持所有权与恢复不变量；不先造通用quota或隔离框架。

与既有 **FLOW-001-T04-SCAN-01**（上文“队列与目标扫描的锁隔离后继”）交叉引用：该项仍负责单实体行锁、queue→goal同轮阻塞及整轮/关闭截止，本项负责可选host组合对共享连接及控制响应的影响；不得重立扫描任务或用大负载替代原因果小例。SQL语句超时不覆盖JS获取连接、外部文件/网络阶段，也不是事务或整轮总截止。

一手来源（2026-10-07只读核）：[pg.Pool](https://node-postgres.com/apis/pool)的满池FIFO及totalCount/idleCount/waitingCount；[pool sizing](https://node-postgres.com/guides/pool-sizing)的跨实例总量/管理余量；[pg-boss constructor](https://pgboss.io/api/constructor)的实例max共享（本地绑定12.37.0，网页非固定包行为证明）；[PG16客户端超时](https://www.postgresql.org/docs/16/runtime-config-client.html)的服务器命令时间范围。实际安装版本与固定源码在未来候选再次绑定，网页不替代运行证据。

架构影响：本条只记录现存连接生命周期及待测组合，未改产品Interface/运行图；未来实施若调整池/宿主职责，由该owner更新既有D06固定架构输入。方法采用本地find-skills发现、codebase-design的Module/Interface职责与clean-code的单一事实源/无重复；只做文档内容、链接与独立审查，不运行工程检查。

### REQ19 下一可用更新与 O16 旅程接续（2026-10-07）

原SVC04/SVC06目标由SVC09受信host策略与集中保留策略先解除实际部署依赖，assignment_review负责，已在[唯一SVC09计划](../../../personal-release-policy/plans/svc09-personal-release-policy/plan.md)的独立树/精确scope实施，P02已main并归还范围。当前个人af51缺browser-session/message-settings/028/032，不能把main接线或Quick组件当Web-only已可用。新策略候选统一count4、资产总192MiB、32兼容报告，保现三个版本及其lazy namespace；只在正式固定实现/直接消费者审查后采用，不临时绕过count3，不把安静期、pagehide或cache当退役证明。版本manifest、实际backend、公开origin/私有策略组合须真实兼容；新host先保原三项再第四CAS，完整退役另保open。计数是可审工程策略、不是用户不可变要求；真实新增存储与阶段总峰值另由固定候选计量。个人动作未开启。

当前CHAT05与ENG有界片收口后的下一ready验收是原O16公共完整零模型旅程，由原native_center_owner沿[O16唯一计划](../../../continuous-native-goal-acceptance/plans/o16-continuous-goal-acceptance/plan.md)，复用已审4ae准备/CAS修复与最早FAIL/KEEP；fresh核固定源、现资源与未知保留，不能重置旧run。目标→依赖执行→独立接受→统一交付须有真实公开旅程，不由模块通过替代。

原O01-05/O16后继另保一个恢复情景：后续目标/约束已更新时，恢复或native compaction后依据中心当前目标版本及输入收据继续，复用已接受产物、不重复已确认副作用，不以最初请求替代当前工作。现O16禁resume的获审scope不因此改写；零模型与真实native语义分别验收，未新授provider预算，不造第二上下文权威。

### 聊天续接：原 runner 撤销后的旧会话（2026-10-07，待复现）

- [ ] **FLOW-001-T03-RESUME-01** 沿原聊天/runner恢复验收，用已有公开HTTP与专库fixture核对“无profile pin的旧Claude会话已有成功turn → 明确撤销原runner → 新key续聊”及正常续聊对照。Execution Lead排期，拟由原中心owner在O16当前片安全收口后承担；尚未领取产品范围或运行，不打断固定后台发布。
- 固定main `63768046daa048e955670e74c0ce2491f8ba9873` 的 `conversations/admission.ts:40` 对follow-up跳过runner撤销检查；`execution-profiles/store.ts:130–132` 无pin直接返回，`tasks.ts:52` 仅核session存在，`runners.ts:64–100` 仍限定原runner。它们支持“可能受理后无法领取”的静态候选，未证明真实永久排队、生产故障或泄漏。
- 若复现成立，最小修复应明确告知会话当前无法继续及既有恢复选择；保留旧幂等回执、历史消息、原session/runner归属和锁序，不迁移session、不重置unknown任务。只验证新key拒绝、旧key原回执、正常续聊及直接queue消费者；技术方案与精确scope在fresh账本核对后确定，0模型，不重跑容量或聊天全集。

2026-10-07T08:57:27.268283+00:00 O16零模型公开旅程已独审并main b768接收，1 selected/1 passed/0provider，旧FAIL/KEEP保留。原O16-06下一native片段仍有实施缺口，不仅缺预算：现operator仅rehearse并要求完整independently-accepted与DROP，不能直接在plan后停下复核。排在SVC06实际发布/OPS-METER01收口之后，由原native_center_owner重新fresh领取原三范围，准备一次planner后关闭进程/连接、只保有期限独立复核材料，再依实际proposal确认两children的分阶段候选；复用OPS14/既有SDK循环，固定Claude登录来源、SDK/配置、总写入上限与结束条件。此处只排准备，未启动query/未复用O08/O10预算，真实模型预算仍交具体候选；ENG授写资格决定保持独立。

### 2026-10-07 11:55 轻读取后继补充

沿既有REQ-04/P01与TUI001-08，GO只读固定main7272151b补充：反向A2A bridge更新仍从cursor0重新映射并先读所有reference正文后筛artifact；包装取消未传入支持signal的detail，events仍无signal，底层默认15秒，不称无限泄漏。普通detail是新UUID持久记录、native完整材料在另一表，不能据此泛化为所有投影永不变化。复用上段公开Interface有界测请求/字节/取消，保留[GetTask完整产物](https://a2a-protocol.org/v1.0.0/specification/#313-get-task)与[订阅初始Task及有序更新](https://a2a-protocol.org/v1.0.0/specification/#316-subscribe-to-task)、授权和unknown；原P03去history不重复，未测前不预设缓存或新框架。

同一TUI001-08后继保留非聊天界面的观察生命周期：controller离开conversation已停止TurnObservation，但schedule仍只核connected/closed/selected，help/settings/profiles可能继续刷新原会话/turns/已开启queue。此为未测源码候选，合并原有headless有界投影验收：非聊天界面无无用读取、返回恢复观察，后台任务继续、未知发送不改变。由原TUI owner后续fresh范围与局部fixture测量，不扩大当前发布或消息设置writer。两项均NOT_RUN，无新task、测试、模型或运行预算。

### O16 认证环境的单因素候选（2026-10-07，仅研究）

[Hermes仓库问题29015](https://github.com/NousResearch/hermes-agent/issues/29015)报告macOS Claude2.1.145在私有HOME下出现false/none/firstParty，普通HOME有登录；这是旧版本用户复现，不能作为本机2.1.290根因。本次已实际打开来源，未运行。现O16“公开接口不区分下层存储结果”仍有效，但不意味着所有环境因素已穷尽。原owner在发布收口后可设计同一固定binary、其余配置与Keychain服务命名不变、仅HOME因素对照的零模型公开四字段观察；先明确正常身份读取和可能初始化写入边界，再在合法范围决定是否执行。不得Keychain/config symlink、读取或复制凭据、换账户、登录、第四次SDK query；不把参考workaround当本项目授权。原R1/R2/R3失败、累计3、未知费用和KEEP全部保留；此候选NOT_RUN、不新建auth任务。


### REQ-18 / R05：配置材料快照的长期保留（2026-10-07，待测）

承接既有runner资源生命周期验收。GO只读输入绑定main `7524a7fa6768ace7e284fc80d7cc25c1407ec2a9`：`apps/runner/src/claude.ts:55,216–235`在每次attempt（包括续聊）复制配置的materialFiles到新的materials目录；`runtime.ts:218`隔离attempt目录，所核结束路径未见退役，复制在adapter的try/finally之前。单次32×1MiB不等于跨attempt总量有界。这是源码候选，非已测磁盘原因、全部外部回收不存在或token浪费结论。

后继用户结果是长期材料保留/回收有明确owner与界限，重复及失败不持续堆积；沿原Claude adapter/runner生命周期选择最小接口，不新增大task或泛化缓存。排在当前个人发布、已ready聊天之后，尚未领取/NOT_RUN、不增加运行预算。先以零模型小例核相同材料两次续聊、复制中途失败、已确认结束与unknown保留的文件数/实际bytes，核旧native引用仍可用。已确认且符合保留策略才退役，不能在finally统一删除、不动用户或未知材料；单次、并发与历史累计口径分别记录。

## 2026-10-07 协议等待终止与材料保真（REQ-04 / P01 / P02）

排在当前个人发布和已ready聊天之后，沿原协议任务细分，不新建大task。GO与有界只读reviewer核固定main7524：A2A bridge在waiting仍轮询；锁定SDK1.3.0对INPUT_REQUIRED结束观察队列，AUTH_REQUIRED行为不同。后继以真实官方SDK的有限HTTP fixture验证INPUT_REQUIRED本次观察结束、原远端任务可继续及后台独立性；仅此状态，不泛化binding违规。[A2A 1.0 streaming及任务交互](https://a2a-protocol.org/v1.0.0/specification/#117-streaming)的章节措辞差异应在测试边界注明。

同固定源码的protocol-dispatch/materials.ts把多个text Part插换行并保存text/plain，合并文本digest不保各Part MIME。后继合同须明确多Part/非plain MIME的保真或显式拒绝，不能冒充原始交付材料；覆盖同内容不同MIME及多Part结果。两项均源码确认的验收缺口、NOT_RUN，当前无新增writer/运行/provider预算；P03的historyLength0及已排读取取消/重复传输后继不重复。

## 2026-10-07 工具目录延迟加载研究（REQ-08 / COST001后继）

GO已查一手文档：[Anthropic tool search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)、[tool caching](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching)、[Claude Code MCP tool search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search)。API defer_loading延后模型上下文加载，但仍提交全部工具定义，不能称请求字节已减少；原生MCP发现另有配置/回退，不能将API字段直接用于SDK。固定0.3.290/native2.1.290支持未验。未来大目录优先复用harness发现，保Flow授权/稳定工具身份，分别量目录和wire字节、输入/缓存、发现往返与成功；小目录不预设收益、不套官方比例。本条仅研究归档，无新探针/依赖/预算，当前7524显式工具名单与goalMount不改。

### REQ-18 / S01：执行受理的依赖批量读取（2026-10-07，限定片已交付）

- [x] **FLOW-001-T04-DEPENDENCY-READ-01** 限定依赖批读片已交付：GDEP01 owner b01_bounded_reads / Mika，固定bcbce5源码于mainfe26cc936接收。16pure及8真实PG独审证明199短依赖一次有界查询、原输入/首错/项目锁与回滚边界；[唯一接收及原件引用](../../../m2-integration/docs/evidence/i02/gdep01-approved-intake.json)。完整公开execute/native/progression与整体性能不在此完成范围。
- GO只读输入固定main `9a815eca7`：`apps/server/src/goals/commands.ts:96–107` 的dependencyContent逐项await产物；execute/native合同最多199依赖，applyGoalCommand→loadState(...,true)已持项目行锁。16k输入上限限制最终内容，不能限制许多短依赖的查询次数。此为源码推导，不是199个agent、已测延迟或生产饥饿结论；与会话页N+1属于不同直接消费者。
- 最小候选先核一次批量读取与旧输入逐字等价：保顺序、精确task/artifact/version/detail绑定、hash、整单预算、事务/授权与未知拒绝；不移开既有锁、不以同连接Promise.all假并行、不新增第二缓存。先局部查询次数/输入等价，再在合适隔离窗口做有限PG同项目竞争，0provider，不重复128容量全集。
- 与既有SCAN-01、POOL-01关联但不替代：本项负责执行受理依赖查询，前两项分别负责扫描锁隔离与插件宿主连接占用。官方行锁语义参考[PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)；采用前以实际固定版本核验。

### 失败后的可解释轻摘要（REQ-15 / SVC06B / runner，2026-10-07）

- [ ] **FLOW-001-T03-ERROR-01** 用户应从任务轻摘要看到已确认的失败类别、发生阶段和后续可选动作；无依据明确UNKNOWN。沿现adapter→runtime→中心状态/客户端接口演进，由Execution Lead细分、原runner/中心owner在当前网页发布和双槽宿主验收后领取。当前仅管理准备，产品范围尚未take，不抢现writer。
- 固定main53f50e的runtime.ts:314–327丢弃原异常并统一输出笼统文本；runner事件合同只有可选error字符串，现轻投影不暴露结构化类别。16:32个人只读观察确认旧任务failed但公开摘要原因UNKNOWN；历史原文缺失不能恢复/补造原因。NativeExecutionError的settlement只表达停止边界，不是认证、超时等原因分类。
- 小Interface保留来源与有限分类、阶段和UNKNOWN，轻摘要不带原始异常/正文/凭据，详情仍按需授权；取消及副作用未知保持既有语义，分类或可选动作不授权自动重试。旧客户端兼容、同attempt归属与迟到/旧attempt拒绝须验证；只做零模型定向失败注入、直接消费者及实际涉及的前进迁移，不另造观测平台或复制MATURE02已有泛化要求。
- 仅借鉴[OpenTelemetry错误语义](https://opentelemetry.io/docs/specs/semconv/general/recording-errors/)中类别与说明分开、结合操作语境、避免重复记录的原则，不引入OTel依赖。原运行诊断包和私有材料继续各自授权，当前0新query/个人读取。实施时沿唯一status记录真实工作段与等待。

### Web/TUI 队列回执一致性（REQ-15 / TUI001-06/08 / WPF-MATURE-06）

- [ ] **FLOW-001-T03-QUEUE-ACK-01** 两端对同一矛盾队列回执都保持原key/body与unknown；正常历史replay仍可刷新当前观察。Execution Lead与Web co-lead协调，产品owner和精确scope尚未领取，排在个人新版发布、默认宿主诊断之后，不新建大task。
- GO只读固定 `035a4dfce9cbf00691ecd432f560967abfef0044`：interaction的dispatchQueueIntent校验resume无promoted时currentTurn.taskId等于冻结expectedTaskId，并校验promoted task/turn/item绑定；Web queue/commands.ts:74–81仅核shape/revision/promoted.state，:164–167会保存accepted checkpoint，FlowClient未补同等语义。TUI controller已有无promotion却换task的UNKNOWN例；Web矛盾接受尚属源码推导、NOT_RUN，不能写成线上事故。
- 先由原端owner用直接消费者复现差异，再提取浏览器安全的小型纯回执规则供Web和TUI共用；不让TUI引用Web私有projection、不合并两端持久化/展示FSM，也不复制两套if。覆盖无promotion换task、promoted身份矛盾、合法replay与当前观察分离、原请求恢复。0provider，本模块及两个直接消费者足够；实现前核fresh claim/接口边界，当前不新增运行预算。
