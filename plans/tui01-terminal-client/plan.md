# TUI-001 可日用终端客户端

状态：accepted / in-progress。创建：2026-10-06。Goal Owner定义用户结果；co-lead Execution Lead自主分派sub-tasks。本目录是唯一大task权威，不把每个小片重新命名为大task。统一遵循[模块化、接口与性能规则](../../AGENTS.md#modular-design)。

## 用户结果与完整验收

用户可以在交互式终端日常使用Flow，借鉴Claude Code、Codex、Hermes的公开操作方式：slash补全/帮助、会话选择/续聊、真实model/thinking/fast/access选项、context/files、逐段正文、工具/可公开thinking按需详情、queue/steer/cancel/人工决定以及runner/plugin管理。可发现而未发布的能力明确unsupported/unknown，不能把菜单存在当能力实现；完整Done不能以首片或永久禁用代替。

所有动作消费共享typed commands / FlowClient / HTTP。中心保持持久任务/会话/授权/队列/最终结果权威；终端不直连DB/provider，不另建scheduler、权限或任务状态机。退出/断线仅停止观察，任务继续；显式cancel与真实停止结果分开。普通slash/help/status不调用模型。真实provider仅按另行固定预算验收，已有封存额度不复用。

## 跨客户端的共同中心验收

同一会话由两个公开客户端交替操作，能观察彼此已提交的变化；过期revision只产生确定冲突，不自动改revision重发，原草稿保留并恢复只读观察。重复请求、未知ACK与断线恢复复用同一中心幂等/CAS规则和原key/body。任一客户端退出只停止其观察，中心后台任务继续。核心协议旅程允许共享headless/终端驱动，Web只补实际受影响的浏览器交互，不另建测试平台或状态权威。

后台新能力可先交付公开contract及可重复headless/终端验收，Web与TUI并行消费；两端互不作为全部开发的串行门禁。此验收并入TUI001-08，TUI001-09先完成共同回执与冲突恢复基础，不以局部共享模块代替完整双端日用验收。

## 最小架构与取舍

| Module | Interface / ownership | 扩展与界限 |
| --- | --- | --- |
| 共享交互命令目录（候选packages/interaction） | typed参数schema、名称/help/completion、能力需求、结构化handler；注入FlowClient与signal | slash只是语法；TUI与headless driver调用同handler，不把字符串发作新后端协议。新增能力只注册描述与handler，复用中心校验 |
| 会话观察/发送controller | 中心快照、分页cursor、不可变request body/key、连接epoch；只拥有草稿/选择/观察与本地未决intent | 不复制Web私有controller或领域FSM；可证明相同的纯协议规则在合法scope渐进提取，Web直接消费者照旧验证。unknown不自动重发/换key |
| 终端renderer（候选apps/tui） | 订阅controller轻投影、编辑器、focus、resize、选择与展开；无后端业务决策 | Ink渲染层可替换；输入与显示有界，detail仅明确展开获取；终端控制字符先转义，不执行模型输出的ANSI/OSC链接指令 |
| FlowClient / 中心 | 既有owner认证、幂等/CAS、queue/steer/decision、真实final/artifact | 复用公开合同；TUI不调用provider，不绕profile/purpose/fence；新增合同同时提供headless验收与Web输入，不变成所有开发的串行门禁 |

比较方案：纯readline负担最小但多行、CJK、resize/editor容易自造复杂实现；直接套assistant-ui LocalRuntime会把本地历史和abort变成错误权威；选择Ink + 受控TextInput/必要primitives作为首实现候选，中心投影由明确controller拥有。必须先核固定包实际exports与依赖图；若需要assistant-ui runtime，只能外部store接缝，不使用默认local history、默认cancelRun或自动generateTitle。

固定选择：Ink8.0.0 + React/types19.3.0（沿现Web同版）+ react-ink0.0.46 + ink-testing-library4.0.0。TUI01A已在依赖提交1cec921核对实际core仍0.3.22，既有Web importer/packages/snapshots零变；新增包SRI/许可/engine及离线缺项、registry下载来源保留在其dependency-provenance.json。安装关闭生命周期脚本；兼容行为仍待实际终端验收，不以依赖解析成功代替。0.0.48保留比较，禁止依赖全局安装路径或latest脚手架。

## 首个端到端子片 TUI01A

先在独立feature树实现可运行小片：`/help`、`/conversations`、`/open <id>`、`/profiles`、`/new`、普通发送、`/recover`、`/disconnect`与`/quit`。有界会话/消息列表、当前task状态/最终正文，原文草稿保持；创建/发送先冻结body+key，丢ACK明确unknown并原key核对。退出不提交cancel，重开从中心恢复同会话；不以完整本地transcript作为持久事实。

第一片即包含一个共享headless消费入口、真实PG+fixture runner的发送→退出观察→恢复正文旅程和真实PTY输入/resize/清理；0provider。stream/工具详情和queue等保持后续TODO，但首controller需留公开reader端口，不依赖Web私有store。worker在R06有界交付/独审安全点后接此实现；本轮不新增agent绕threadlimit，计划与协议准备可先行。首次实现take前定精确scope：候选apps/tui、packages/interaction、新子计划/证据；apps/cli与root lock仍F01单写，必要窄移交后才改。

## 稳定TODO与sub-task顺序

- [x] **TUI001-01** 建立唯一大task、职责、研究/版本来源、初始范围和完整验收；此项完成不等于产品可用。
- [x] **TUI001-02** TUI01A：固定实际依赖与小Interface，交付slash/controller/headless/基础交互端到端片，独立review后及时main。
- [x] **TUI001-03** 流式正文与活动：task/attempt增量协议、settlement原规则、重放/乱序/重连，展开前零detail请求，输出/缓存/刷新有界。
- [ ] **TUI001-04** 真实执行选项：消费MATURE02/R05 Claude+Codex能力，model/thinking/fast/access requested/effective/unsupported分明，不把catalog当账号授权。
- [ ] **TUI001-05** context/files：复用固定citation与附件生命周期合同，发送/排队冻结身份，未就绪拒绝；不直接附本机路径给远端runner。
- [ ] **TUI001-06** queue/steer/cancel/decision：精确version/pin/attempt，durable ACK与实际生效区分，unknown恢复不自动复投。
- [ ] **TUI001-07** runner/plugin管理：复用中心已发布功能，列出/详情/明确owner操作，下载不等于启用；不造终端私有插件权限层。
- [x] **TUI001-09** 共享发送回执：TUI01A局部修复先交付，后继将创建/提交两种ACK的结构与冻结请求身份核验收敛到client小Interface，Web/TUI复用；unknown保留原key/body，旧回执不覆盖当前执行状态。唯一设计见[共享ACK后继](../../docs/evidence/tui01/shared-ack-design.md)。
- [ ] **TUI001-08** 日常终端与双公开客户端完整验收：同会话交替操作、过期CAS不自动重发、断线/退出后台继续；窄终端/CJK/emoji/粘贴/多行/resize/focus、丢ACK/重启、过载与资源回收，文档/独审/部署入口；真实provider只在具体新预算许可后运行。

## 验收矩阵

| 层 | 必须证明 | 不可替代的边界 |
| --- | --- | --- |
| 纯contract/controller | slash/help/completion同一描述来源、原文/稳定key/能力拒绝、跨连接迟到隔离 | 无HTTP/无模型，不称后端连通 |
| 实际HTTP/随机PG+fixture runner | owner auth、创建/发送/丢ACK原key、中心历史恢复、观测退出任务继续 | 专用库/自有进程，正常清理；fixture不是provider |
| PTY / renderer | 可见正文、输入编辑/CJK宽度/emoji/粘贴、多行与resize、焦点/关闭rawmode | 快照测试不是实际PTY，必须分开记录；stderr/token不泄露 |
| 有界性能 | 页/正文/detail字节限额、有限observer/queue/cache、backpressure与退出句柄 | 记录样本与字节/CPU/资源，不凭Ink/模块化声称更快 |
| provider（后继） | 固定模型/配置、真实输出与语义、native身份与费用来源 | 不复用旧预算；TUI通过不代表Web浏览器通过 |

默认Ctrl-C/退出只断开观察；显式`/cancel`才提交中心动作。显示内容清理终端escape但原始正文hash/授权detail不被改写。凭据只从明确私有配置/已有合法env读取，禁止slash历史、日志、URL或报告回显token。命令history不保存秘密；本地intent若持久化需0600、连接身份绑定、完整性与容量界限，失败保unknown，不扫描其他目录。

## 依赖与可并行性

MATURE02/04提供能力与上下文来源，MATURE03提供文件生命周期，MATURE06共享queue/steer合同；TUI基础片不等全部大task完成，也不抢Web App/Thread。R06/ R05B继续并行，不因TUI新目标停止已ready交付。个人61227/61228与现用户任务不受本计划操作。架构图后继标注TUI→共享交互→FlowClient→center，当前只是planned。

研究与来源：[research.md](../../docs/evidence/tui01/research.md)、[provenance](../../docs/evidence/tui01/research-provenance.json)、[包版本候选](../../docs/evidence/tui01/package-candidates.json)。

当前唯一子片：TUI01B已交付共享ACK与冲突恢复；Web WPF-ACK01接其真实第二消费者，TUI001-09已按两消费者独审/main关闭；完整双客户端旅程仍归08。TUI01C承担TUI001-03，以共享浏览器安全协议/中立正文段落复用既有Web规则，不复制终端状态机或迁移Web host。

11:32:04主线验收映射：TUI01C已main648e、焦点修复及类型组合通过；03仅流式/详情子片完成。后继06优先复用已发布queue/cancel/decision小typed handler与headless，不等待整个能力目录或Web视觉；实际实施仍由空闲worker独立take，当前无新增writer。

## 已发布控制接口的下一终端入口（2026-10-06T12:13:55.672556+00:00）

继续TUI001-06/08：后台typed contract/FlowClient/HTTP为唯一业务入口，slash/Ink/headless可替换；新能力先有可复用headless验收，Web独立消费。O12目标会话/固定历史已main，可按[小设计](../../docs/evidence/tui01/goal-session-next-design.md)接终端；不复制业务状态。完整日用和同会话双端验收保持原08，普通文本不会被自动解释为goal执行。下一执行owner候选assignment_review，待当前SVC05准备安全点由co-lead派工，不等待全部模型目录。
