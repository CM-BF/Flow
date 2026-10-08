# WPF-MATURE-04 上下文窗口与使用透明度

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | WPF-MATURE-04 / in-progress |
| 创建日期 / 最近更新 | 2026-10-06 / 2026-10-08 |
| 任务层级 / 大task ID | 大task / [WPF-MATURE-04](plan.md)；本目录为本大task唯一正文，不复制 Web 管理计划 |
| co-lead / 单一 owner / model | mika / architecture_read / gpt-6-astra（由派发 lead 确认继承模型，满足 Sol 门槛） |
| 权威 worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency / codex/context-transparency |
| 固定启动基线 | b1c2e39837c2208e6fc2c59a80e16797f26448b5 |
| 当前阶段 | M2 |
| 当前写入范围 | parent owner仅plans/wpf-mature-04-context-transparency与docs/evidence/wpf-mature-04（claim v11）；Web产品由W01独立WT合法领取，历史源码均已交回 |

## 用户结果与已确认边界

用户应能理解当前所选或实际执行模型的上下文容量、当前窗口已用/剩余、材料占用，以及压缩/摘要何时发生、产生何种结果、原文如何追溯。数值必须区分 provider 证据、estimate 与 unknown；换模型、增减材料或执行输入变化后应更新，超限必须明确。session 累计 token/成本绝不能冒充当前窗口使用量。前端插件消费中心规范数据，只按需打开引用，不为计量重新上传或重复传送全文。

GO/用户已授权该方向及规划实施。首片规划已固定，mika随后协调批准4文件纯投影实现与局部验证；当前不包含生产SDK采集、持久化或页面挂载。Web由d01管理并沿本计划验收，不另写重复目标；不修改S01、CHATUI或其他任务的状态。只有后续明确获准的2测试路径/严格noEmit在此实现片执行；没有真实模型、安装、私人服务或凭据操作，协调连接只通过已配置环境加载。

## 当前事实与差距

当前W01历史面板已完成独立页面的8组浏览器验收及390双主题限定独审，main接收、Arc组合、真实观测生成与完整CT仍未完成；详见唯一[status](status.md)。下列源码研究与首片实施描述保留其历史范围，不将当时未挂载结论用作当前Web状态。

- main 的 execution profile 公开请求模型、配置 digest 与 opaque materialScopeDigest；resolvedModel=null、providerCapabilities=unknown。它不是实际模型、原生容量或工具实际读取材料的证明。
- K02 已冻结精确 citation/version/digest/locator，公开 sources.byteLength，私有 execution input 与公开用户原文分离；当前 8192 UTF-8 bytes 等限额是 Flow 输入预算，不是模型 token 窗口。runner 还会附加本机材料路径/系统提示，executionInputDigest 不涵盖完整 SDK 上下文。
- Claude modelUsage 被编码为 cumulative session usage，中心按 baseline 求任务消费；它能支持费用/消费账本，不能证明窗口已用、压缩后余量或当前材料驻留。
- native activity 目前消费 assistant/user/tool_progress，未发现当前生产合同接受 compaction/context-window 观测。CTX01 的摘要、原文恢复只有合成实验；不能当产品已启用压缩。
- R05 现有独立分支提供本地 NativeHarnessDescriptor 配置 seam，未提供中心上下文观测；其 descriptor 不送中心、不改变 profile digest。不得借本任务改其私有配置或把可选 port 声明当 provider 事实。
- 固定 Claude SDK 0.3.290 的公开 Query.getContextUsage 可返回结构化分类；summary 使用上次response usage与本地估算，full（默认）会调用逐类token-count API。本片只读类型，绝不调用该方法或打开query；后续不能默认full或后台触发计数API。SDK total_tokens明确是estimate，raw_max_tokens可能是较小的自动压缩策略窗口，不能充当模型hard limit。Codex冻结schema只有total/last/modelContextWindow和thread/turn关联；其last/total是否表示当前窗口尚未核实，不自动使用。

固定源码路径、R05 branch/head/dirty 和只读依据见[基线证据](../../docs/evidence/wpf-mature-04/source-baseline.md)。上述是静态研究结论，不是运行验收。

## 方案与取舍

按 brainstorming 的 Architectural 路径比较三种方案：

1. **采用中心规范快照与持久来源引用。** 由受信 runner/上下文 owner 提交有限观测；中心核 ownership、去重、关联实际输入并生成公开快照，Web 仅展示。这让 provider/estimate/unknown、过期及恢复语义集中，推荐。
2. 浏览器根据 usage、聊天记录或字节数推算：覆盖不到系统提示、工具/schema、隐藏历史和原生压缩，也易重复发正文；不采用。
3. 直接暴露 SDK 原始事件/插件内部状态：让消费者承担来源、版本和权限差异，易扩散全文；不采用。

推荐设计只新增解释事实的 Interface，不接管压缩算法。唯一 compression owner 属于宿主/上下文策略；WPF-MATURE-04 记录和展示其已发生操作。首片可独立实施中心纯投影和公共 schema，先正确暴露 unknown 与已有材料 metadata，不宣称已测量完整窗口。观测持久化、SDK Adapter 和 Web 接线分阶段交付；完整验收仍要求真实来源适配的确定性合同证据与产品页面行为，不能以初始 unknown 界面结项。

## 公共 Interface 候选

详见[接口候选与第一实现片](../../docs/evidence/wpf-mature-04/interface-candidate.md)。这是待 co-lead 协调的候选，不是已发布 wire 合同。

- 一个版本化 ContextSnapshot，绑定 requested/resolved model、profile、task/attempt/ownerVersion/session 与输入版本。分开模型硬容量和压缩策略窗口，used及每个窗口remaining各自携带provider/estimate/unknown、来源/方法/证据和适用输入；SDK来源与数值准确度是两个维度，不能把SDK估算或一个provider容量字段的可信度传播给usage。
- materials 复用精确引用与 byteLength，区分 selected/authorized/included/observed-read，token 占用不可从未读取文件的大小断言；分项不无条件相加。
- 压缩/摘要是有序、去重的事实记录，记录来源、前后计量、摘要结果引用与覆盖原文引用。未收到事件只是 not-observed，不表示没有发生；不读取或展示私有推理。
- 当前执行快照、已持久队列与下一条草稿预估分开。用户新验收允许同harness空闲会话的受支持model/effort/fast设置“下一条生效”，由WPF-MATURE-02/R05提供真实capability及设置门禁；每次改变next-turn settingsRevision即失效对应草稿测量。历史、当前running和已持久队列保持各自冻结配置，不能被新选择改写。跨harness必须显式新会话/兼容边界，不凭相同nativeSessionId继承；本片只表达identity/失效，不实现设置命令。
- 中心列表只传有限 metadata/引用；正文沿既有 owner 鉴权详情入口按需获取。零新增全文上传；没有来源证据时保留 unknown。

## 稳定 TODO 与阶段交付

- [x] **WPF-MATURE-04-01** 固定权威计划、原子 claim、源码/依赖差距和全部用户验收；首片文档自查、commit/push，独立 review 保持 NOT_STARTED。
- [x] **WPF-MATURE-04-02** 确定上下文测量公有合同和精确 writable scope；独立实现 schema/纯投影，覆盖 unknown、不可比、材料版本、模型变化及超限；879c989a594a8f4f266b9a78a885e311c52eca0d，30/30与局部strict noEmit，Mika于09:14:39 UTC独立APPROVED。
- [ ] **WPF-MATURE-04-03** 实现受 ownership 保护的中心观测持久化与 owner 读取；提供去重/重放/过期/重启/权限证据，保留已有 usage 与全文隔离。
- [ ] **WPF-MATURE-04-04** 接入受支持 harness 的实际容量/当前窗口/压缩来源与估算方法；unsupported 明确 unknown，唯一压缩 owner 与结果/原文 refs 可追溯。沿此现有04记录非阻塞窄屏信息层级改进：长modelID使用紧凑摘要与可展开完整身份，保持可访问全值、时间和unknown/estimate说明。
- [ ] **WPF-MATURE-04-05** d01 管理、w01_owner在web-context-history独立WT实施的 Web 插件消费中心 Interface，覆盖草稿/执行/换模型/材料变化、过期、超限、双主题/窄屏及按需详情；不重复传全文。
- [ ] **WPF-MATURE-04-06** 完整矩阵、独立 review、必要直接消费者验证、main 集成与 canonical dashboard 事实同步；不以本首片或 fixture 结果替代完整交付。

本次 -01 首片可单独交付；后续 TODO 未达验收不勾选。状态及阻塞唯一来源为[status](status.md)，[review](review.md) 只记录绑定具体提交的独立结论。

## 完整验收矩阵

| ID | 用户验收 | 可检查完成条件 |
| --- | --- | --- |
| CT-01 | 当前模型容量 | requested/resolved 区分；模型hard limit与compaction policy window分开；实际模型、能力来源及版本关联；无可靠容量时明确unknown，不静默套默认 |
| CT-02 | 已用/剩余 | 明确当前窗口与观测时间；provider/estimate/unknown 独立标识；同一输入/可比口径才推导余量；累计 session usage 注入也不能转成窗口值 |
| CT-03 | 材料占用 | 精确 citation/version/digest/locator、字节计量与 token 口径；selected 不冒充已读/驻留；重叠与 compiled 输入不双加 |
| CT-04 | 压缩发生与结果 | 有序幂等记录压缩来源、发生事实、前后口径、结果 ref、覆盖原文 refs；缺失观测为 unknown/not-observed，重启后保留 |
| CT-05 | 引用追溯 | 授权用户可按需打开固定来源/摘要；越权、摘要不存在、原文不可用和版本失效明确；默认列表无正文 |
| CT-06 | 模型/材料变化 | 同harness支持的next-turn model/effort/fast变更推进settingsRevision；材料增减推进输入revision；旧观测不能覆盖，历史/running/已持久队列保持冻结；跨harness显式新会话/兼容边界，不以session猜兼容 |
| CT-07 | 超限与未知 | hard-limit与compaction-window超限及provider/estimate可区分；deferred分类排除窗口求和，按kind而非英文label分类；未知不能显示0或安全；不会静默裁剪或新增自动压缩 |
| CT-08 | 前端插件消费 | 中心到客户端 schema 可兼容；Web 零全文重传、详情展开才读取；离线/重连、双主题/窄屏/键盘可用 |
| CT-09 | 事实与权限 | current attempt/session/input 关联、稳定事件去重、冲突拒绝、stale fenced、owner/runner角色隔离、main 与 branch证据分开 |

## 依赖、风险与解除条件

- 共享合同/runner event/中心挂载/client 和 migration 由 mika 协调；新范围须当前 claim 原子 amend 成功才写。首片未领取这些路径，不是要求用户再批准普通工程步骤。
- R05 owner assignment_review 的配置提取仍 active/待 review；本任务通过现有接口读取其输出，修改 R05 port 或共享 native-harness.ts 需明确接口协调，不能抢写。
- WPF-MATURE-02 owner chatui01_owner 的权威路径由mika提供为 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities`，合同候选在同树`docs/evidence/wpf-mature-02/interface.md`；该worker负责能力事实，本任务消费固定版本，不复制能力目录或承诺Codex现已执行。Web/Lead沿本目录读取依赖，常规接口确认不转发GO。
- provider 的实际模型/当前窗口/压缩字段、token 口径和可恢复性需在实现时按固定 SDK 官方类型/文档核对；首片不假定某个模型容量、不调用 provider。缺字段允许诚实 unknown，但具体支持范围必须有适配证据才验收。
- K02 引用 budget 与模型容量含义不同；本机材料授权、实际读取与当前驻留也不同。摘要不能当原文已删除，cost 节省不能由字节比推断。
- 正文/索引/registry 是单 owner 分工；本 owner 只写自身 canonical，计划索引及 dashboard 登记由 mika/d01 协调；未实际聚合前如实标等待展示。

## 首片检查与后续验证方法

首片仅检查 Markdown 本地链接、计划/状态 TODO 一一对应、NOT_STARTED、literal scope、diff 空白与误承诺；不跑产品测试。后续按具体改动做 Node24/pnpm9.15.4/Vitest4.0.18 显式路径的有意义行为测试；持久化阶段才运行独立数据库/动态端口的受影响 HTTP、ownership、重启与迁移检查。provider层以注入的官方形状帧/纯Mapper先验证；summary是否可在零模型初始化后读取仍unknown，不为查字段启动query。full token-count或真实模型须对应已有预算/窗口授权，不能默认调用、后台触发或把合成帧称真实模型结果。

## 实质变更

2026-10-06：按授权建立 WPF-MATURE-04 唯一计划；区分当前窗口、累计 usage、Flow 字节预算及 R05 配置描述，登记中心规范投影候选与完整验收。

2026-10-06 09:04 UTC：首片bbfb7037ee3ca3e37bf14a078f8a05582b209f48已push。mika批准候选的4个新文件和局部行为验证；fresh ledger无冲突，claim v2已COMMITTED。遵循主仓3d31版本[统一模块化规则](/Users/citrine/Projects/AgentHarness/Flow/AGENTS.md#modular-design)；本任务仅补小Interface、状态归属、metadata字节界限与直接消费者证据，不复制通用规则。纯投影无状态、无IO；中心仍唯一持久事实owner，未来runner/SDK负责观测来源。

2026-10-06 09:09 UTC：纯投影/schema的2文件30个行为检查及继承root严格配置的局部noEmit通过。追加下一条设置revision与queued/attempt冻结语义；修正derived准确度不可升级估算、SDK autocompact reading不可冒充model hard limit。未挂载生产，完整任务不完成。

2026-10-06 09:17 UTC：mika批准追加`apps/runner/src/context-observations/claude-summary.ts`及`.test.ts`，claim v3原子amend已COMMITTED。只适配固定SDK0.3.290的camelCase summary响应，不调用Query、full、token-count或模型。host提供冻结identity与有界证据；model不符拒绝；unknown保持；rawMaxTokens仅策略窗口。分类只读kind/tokens，最多32输入行并拒绝非法/溢出，不解析名字、路径或正文；经已审公共投影验证。本小片不覆盖采集/持久化/压缩事实，-04仍开放。

2026-10-06 09:26 UTC：e81f200第二片被独立预审判1P2：Query summary无法证明pending draft/queued输入覆盖。最小修复只允许带nativeSessionId的attempt，host仍负责已消费input/history cut，draft/queued估算是后继独立来源；本片26+23=49/49与strict noEmit0。第一片879 approval不受影响，原46历史不算修后结果；新target复审待完成。

2026-10-06 09:30:13 UTC：3ab95d288a91214d03dec719dc6b44024206118a获status_read/gpt-6-astra独立APPROVED（root 09:28 UTC接收），原P2解决。首两片可分别集成；后继中心store仅在证据中固定精确接线请求，需当前ledger与共享owner定scope后实施，不扩claim。

2026-10-07 当前-05路由：c5f896历史Web模块已完成16pure/strict0及D01限定独审；下一薄接线由同W01独立树继续，尚无App/browser/main/部署证据。进度仍唯一取[status](status.md)，固定来源在[路由证据](../../docs/evidence/wpf-mature-04/web-history-route-current.json)。本条不更改任何CT验收条件或勾选开放TODO。
