# WPF-MATURE-02 Interface请求与交接

Owner chatui01_owner；co-lead mika；大task [WPF-MATURE-02](../../../plans/wpf-mature-02-harness-capabilities/plan.md)。当前仅实验consumer，不另造R05宿主。

## Lead待输入

- [04 producer已独审APPROVED、待main接收入口](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/producer-integration-ready.md)：权威四源/receipt由04维护。

- [Root literal单项候选准备](rootliteral/README.md)：仅根节点读取/存在性（可能含根枚举，非递归），19项零目标检查通过。固定组合待独审，未来go-c-rootliteral-once由Mika单次门禁，当前不运行。

- [R06五源已main接收/逐blob核验](r06-main-accepted.json)；已停写并完成[claim v5部分交回](r06-source-handback-receipt.json)。main362af3只接收已审生产seam；薄consumer仍待单独确认，诊断窗口不重开。

- [Sandbox syscall 67唯一窗口结果](sandbox67/run-report.md)：1编译/2目标，控制成功，新profile regular仍SIGABRT/no report；measurement未完成，cleanup/accounting完成。Mika于12:10:08 UTC接收b2a77cf3 faithful FAIL；窗口已消费，不重试或推断因果。
- [P04已main接收的权威比对回执](/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/i02/runner-read-fence-source-comparison.json)。覆盖先前移交历史；P04最终owner064183b984f0dd7bc6818ef84e68dbc9e4fc5de7，release实际以[外部COMMITTED回执](/tmp/flow-p04-final-release-receipt-20261006.json)为准，详情只查权威输入。

- [Native工程file-only / ≥Sol身份 / 全writer停止边界](native-engineering-boundaries.md)：固定main52eb与0.154/R06输入；缺证阻native promote，不阻零模型fixture/checker/snapshot。
- [04 main接收权威回执](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/main-acceptance.json)。仅路由，状态由04维护。

- [固定0.154 bootstrap只读事实与两条待选边界](bootstrap-policy-readonly.md)：等待GO策略/证据边界选择；源码差异不证明必要性或SIGABRT因果，不实现或运行新候选。
- [B01已审首片集成输入](/Users/citrine/Projects/AgentHarness/Flow-worktrees/task-read-projections/docs/evidence/b01/task-projections/integration-ready.md)。请Lead按权威输入独立接收，不等待第三reader；原authority请求保留。

- [Codex诊断v3结果：regular-file对照仍SIGABRT](fd-canary-v3/run-report.md)：获批唯一窗口已消费，1compile/2目标，父regular身份已核但子报告缺失；measurement未完成，清理/机器证据/计量完成；architecture_read于11:45:46 UTC限定faithful FAIL APPROVED（d8038d3a），无隔离或因果结论。无剩余运行授权。
- [B01轻投影权威来源/registry变更请求](/Users/citrine/Projects/AgentHarness/Flow-worktrees/task-read-projections/docs/evidence/b01/task-projections/authority-request.md)。请Lead按权威请求切换登记；root核main2f4a仍旧来源，authority尚待Lead登记。[第三reader已审集成输入](/Users/citrine/Projects/AgentHarness/Flow-worktrees/task-read-projections/docs/evidence/b01/task-projections/head/integration-ready.md)正式metadata已到；不复制TODO。

- [Codex诊断v2最终结果：控制socket已测，profile SIGABRT](fd-canary-v2/run-report.md)：获批唯一窗口已消费，1编译/2目标，第三NOT_RUN；测量未完成、清理/输出计量完成，architecture_read于11:30:14 UTC限定faithful incomplete/FAIL APPROVED，无剩余运行许可。
- [04归一化集成输入](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/normalize-integration-ready.md)。请Lead按此权威输入接收，进度仅在04维护。

- [附件生产挂载/清理delta APPROVED回执](attachment-production-review.md)：Mika11:26:54 UTC接收f04修复，原69eb mount及P2关闭；scope与历史见唯一收据。

- [C诊断v2最小日志/解析候选](fd-canary-v2/README.md)：固定851fd8c7已独审APPROVED，26/26局部受影响检查通过/9未选；本次获批运行结果见页首。旧6d窗口保持FAIL/0target并已封存。

- [附件薄client APPROVED回执](attachment-client-review.md)：实现ab1bcb与metadata bea11 raw分别绑定，Lead可读取该唯一review收据。
- [04历史领域集成输入](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/history-integration-ready.json) / [04独审回执](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/history-independent-review.json) / [当前handoff](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/handoff-current.md)：正式9ac领域已获status_read于11:11:12 UTC APPROVED；请Lead接收领域与027，具体范围/进度只在权威输入维护。

- [唯一C fd窗口最终结果：预算已消费，0目标、计量unknown](fd-canary/run-report.md)。固定编译正常退出且清理完成，后续三项全NOT_RUN；当前停止实际诊断，需后继独立预算/方案才能继续。此链接路由本大task阻塞证据；既有R06独立集成收据不受影响。

- [S01P04 runners.ts 精确移交及登记请求](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-read-fence/docs/evidence/s01p04/interface.md)。仅路由其权威共享路径请求，不复制进度。

- [F01 native catalog client固定APPROVED回执](native-catalog-client-review.md)：实现5ffe与metadata1fc raw绑定分开，Lead可独立接收；不是本owner冒称已main。

- [04权威center-store请求](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/center-store-request.md)：迁移分配与共享挂载以该权威请求为准；04 owner已获027，由其继续DDL/PG工作。这里只路由接口，进度仍见04权威status。
- 本目录生产target `c9c6e891003af2fc52ca77b0c4527d6d85e20e22` 已独审APPROVED，client接线待共享owner。[集成输入](integration-readiness.md)。已停止写入唯一共享store.ts并完成[部分交回COMMITTED回执](catalog-store-partial-handback.json)（v4，10:39:02.809 UTC）；[停写与固定source](catalog-store-stopped.json)。ENG01B/Lead可take该单一路径，其他四个目录路径仍由本owner保留，P3测试delta a761941f已于10:39:53 UTC独审APPROVED。

目录已通过main固定 `21e0a56c4b2b65a04a1e8d510a9d132e77c3894b` 接收：本owner只读逐blob核4源=c9、测试=a761，见[main接收核验](native-catalog/main-accepted.json)；复用33+1证据，未重测，不代表个人服务已部署，也未包含R06 stderr/诊断。

**历史03最小C诊断候选（本次v2结果见页首）：** [一页合同](fd-canary/contract.md) / [source manifest](fd-canary/manifest.json)。固定source `722032083d2cdfc6790103d18749c333c1b8f9e1`，C/schema/profile及组合已审；[当前host组合合同](fd-canary/execution-plan-v2.md)与[精确入口](fd-canary/README.md)已在唯一窗口消费，1编译/0目标，清理完成而计量unknown；[最终结果](fd-canary/run-report.md)是当前事实，冻结README中的NOT_RUN为运行前时点。旧失败原因仍unknown，三目标只观察自身fd metadata，不做Node/JSONRPC/provider或网络探针。

## 首片可独立实现

固定codex-cli0.154.0 stable schema，注入小的request/receive Interface并只处理已解码帧；R06 runner_owner独占JSONL/stdio/ID关联/背压/timeout/child关闭，caller等待R06 ready成功（它独占initialize→initialized），consumer只负责model/list分页边界与目录归一、ordinary final/failed/interrupted语义。没有spawn/auth/provider/账户文件读取。

## 共享合同需求（待R05 owner固定）

- NativeHarness descriptor保持R05唯一来源；需要Codex publicProfile/配置声明的正式入口，现有harness枚举、model/thinking/fast/access字段不可由consumer私自扩展。
- 目录/配置/实际证据分别：provider catalogue不是account entitlement，supported/unsupported/unknown应显式表达；账号查询机制及secret ownership单独定义。
- ReasoningEffort是固定schema中的string，由supportedReasoningEfforts目录约束。serviceTiers保留{id,name,description}/defaultServiceTier，不将deprecated additionalSpeedTiers当首选，不将effort低档当fast。
- TurnStart.serviceTier（thread持续override）与serviceTierForTurn（本turn-only，default表示标准速度、省略/null继承）语义分开。ProviderCapabilitiesRead的namespaceTools/imageGeneration/webSearch不是速度或账户证明。
- 已请求配置、实际init/turn结果与unsupported/unknown需持久关联task/attempt/native session；ordinary final不自动等于host安全结束，R05已有run/terminal Interface由其owner固定。
- 生产错误/取消/恢复、中心目录HTTP DTO及Web选择需明确owner和精确路径take。本scope不写packages/contracts、apps/runner/main/config或中心schema。

Web owner d01按本大task对接model/thinking/fast/access与账号/实际状态展示；请从本status/interface读取，不新增第二大task或手填事实源。

## Claude固定0.3.290 consumer缺口（Mika只读输入）

现有manifest只接受materialFiles/activeSteering/goalTools/goalGraphTools/model/allowRead/requireReadApproval/maxTurns/maxBudgetUsd/timeoutMs；adapter固定thinking.disabled+dontAsk，profile controls固定effort unsupported，不能由Web选择框宣称已贯通。

固定SDK声明ModelInfo已有resolvedModel、supportsEffort/supportedEffortLevels、supportsAdaptiveThinking、supportsFastMode；Options有thinking/effort；Settings有fastMode/fastModePerSessionOptIn；init fast_mode_state为off/cooldown/on并带disabled_reason（含sdk_opt_in_required），effort可缺/null且受org/model降级。因此directory/requested/actual分层，未知实际fast不得写已生效。Query.supportedModels存在不等于可零副作用调用；初始化/账户读取安全路径另证，不新开query。

共享owner需固定实际模型能力目录、请求选项、init/effective回执与unsupported的合同；Web d01仅消费已落地字段，不修改本owner实验来伪造生产支持。

共享审查输入：[TUI01A delta APPROVED回执](tui01a-review.md)（原2 P2已修，保留历史与非阻断P3）；[R05C纯投影APPROVED回执](production-projection-review.md)（仅projection.mjs/.d.mts；已审main提供共享entry）。两者均非第二进度源，当前不跨WT导入或合入未审C1。

**R05C复用交接：** [final投影提升回执](final-projection-handoff.md)。固定0d0524c算法只读提升至其已领取生产目录；生产模块已由已审main 4391bbf9f1785212d098ef6aa1c01a0320a003d3 进入本树；实验薄入口target 38516be71bf267ab546347a39da2adbe71f79e20已删除算法副本，27/27直接消费者通过，Mika于2026-10-06 09:47:22 UTC独审APPROVED。见[当前消费证据](production-import/README.md)，禁止长期双实现。

共享client输入：[native profile client独立review回执](native-profile-client-review.md)，固定095bdb8仅批准薄client接口，不复制F01进度，也不证明实际access:none。

共享挂载输入：[Mika R05-B server mount只读review回执](r05b-mount-review.md)，仅固定import/await两行，不是领域/provider批准或main进度。

## R05-B固定consumer答复（0.154.0，2026-10-06 09:11:04 UTC）

对照共享候选 `8a148c5f4288d3f3075bf4bde78504b5214c87f3:docs/evidence/r05/b-codex-interface.md`。以下区分原生字段与Flow拟定映射；生产adapter由ExecutionLead/runner worker维护，本owner只负责schema事实与实验conformance，绝不领取apps/runner/src/codex。

| Flow所需事实 | 固定schema字段/必要关联 | 保守映射与未证明边界 |
| --- | --- | --- |
| nativeSessionId | ThreadStartResponse.thread.id；后续ItemCompletedNotification.threadId与TurnCompletedNotification.threadId | 三者必须等于当前任务所创建的原生thread；Flow conversation ID不能代替。原始ID超Flow上限直接unsupported，禁止截断。 |
| nativeTurnId | TurnStartResponse.turn.id；item/completed.params.turnId；turn/completed.params.turn.id | 先绑定本次turn，再接收同thread+turn事件；不同ID拒绝，start响应不是终态。 |
| nativeItemId / phase | item/completed.params.item：type=agentMessage，id，text，phase | 只接受明确phase=final_answer且delivery=null的普通消息；commentary/reasoning/tool/async不拼入。phase=null保留unknown，多个不同final item为unsupported/ambiguous。 |
| item已完成 | ItemCompletedNotification（含completedAtMs） | item已完成只证明消息项，不能单独发布成功final；时间戳不是durable cursor。 |
| turn成功 | turn/completed.params.turn.status=completed且error=null | failed/interrupted、error通知、EOF/超时均不伪装成功；turn/interrupt空ACK不等于interrupted。必须与同一已完成final item一起满足。 |
| content | item.completed的text，保留UTF8原文 | Flow现有≤1MiB UTF8；超过明确unsupported，不拼接思考/telemetry凑正文。terminal内若给full items须核同item正文一致；无full items时保留已观察completed item的独立来源。 |
| sourceMessageId | Flow拟定sha256(JSON.stringify([nativeTurnId,nativeItemId])) | 这是Flow稳定编码，不冒称原生同名字段；证据需保留有界原始turn/item id便于复算。不能只按thread去重。 |
| messageId | Flow拟定sha256(JSON.stringify([source,nativeSessionId,sourceMessageId])) | 新source=`codex.app-server.agent-message`与adapterVersion=`codex-app-server-0.154.0-v1`供中心静态认可；旧Claude算法不变。最终采用由R05 owner固定。 |

### 最小requested与observed/actual形状候选

以下是Flow合同候选，**不是当前schema/运行已贯通**；R05 owner负责严格union与旧hash兼容。

```ts
requested: {
  model: string; // explicit configured model; no latest substitution
  reasoningEffort?: string | null; // catalogue-bound if non-null; preserve omission
  serviceTier?: string | null; // persistent override; omission vs null preserved, semantics unknown
  serviceTierForTurn?: string | null; // new-turn-only; omission/null inherits, "default" standard speed
  access: "none"; // Flow policy intent, not inferred from sandbox alone
}
observedThreadConfiguration: {
  model: string; modelProvider: string;
  reasoningEffort: string | null; serviceTier: string | null;
  approvalPolicy: AskForApproval; sandbox: SandboxPolicy;
} | null // only actual ThreadStart/ResumeResponse can populate
actualExecution: {
  model: string | null; reasoningEffort: string | null;
  serviceTier: string | null; tools: string[] | null;
  evidence: "unknown";
}
```

ThreadStart/ResumeResponse回报配置，不是该turn实际用了哪个resolved model/effort/tier或工具的证明。不能将它复制为actualExecution；本片统一actual null/unknown。固定普通final事件也不携带actual model/fast，serviceTier保持unknown until observed。native请求approvalPolicy与sandbox为明确字段，但二者不能证明无工具执行或无账号/Keychain/网络访问；Flow access none须由生产adapter/host实际执行控制并记录拒绝面。

Codex没有这里可直接套用的Claude SDK maxBudgetUsd/maxTurns效果声明；host wall time/输出上限独立命名，不伪装provider预算。B1首resume/queue/steer/stream/activity/goal ports均false/unsupported；B2 exact reader negotiation及SQL-before-limit filter由共享owner实施。

### 真实握手运行方案状态

status_read独立只读核实wrapper会继承process.env，固定schema/临时CODEX_HOME不能证明免个人Keychain/系统配置/网络/遥测。当前**未启动真实app-server**。批准候选须提供可验证进程级文件/Keychain/外连拒绝、白名单环境、空cwd/state、bounded输出与时限/清理；只允许initialize→initialized→model/list。缺这些控制则保持NOT_RUN，实验fixture继续独立推进，不把无凭据参数或关analytics当零副作用证明。

生产transport唯一owner：R06 runner_owner，独立codex-native-transport树；接口待其 docs/evidence/r06/interface.md 固定后组合。当前in-memory conformance不复制transport状态机，不持有进程/计时器/网络。此前标题09:05为作者错误估计；本次更新记录真实系统UTC，旧commit保留。


## 下一条配置与历史冻结（完整验收增补）

WPF-MATURE-02-09：同harness空闲会话对实际支持的model/effort/fast提供“下一条生效”的设置修改；不能将整会话永久Locked。运行中修改只有实际能力支持时开放。跨Claude/Codex不宣称旧native session可互通，须明确续聊兼容或新会话路径。

R05共享owner需区分可变 `nextTurnSettingsRevision` 与不可变 `profileSnapshot`；这些名字是合同需求候选，不是已落地字段。提交采用expected revision/CAS，持久记录请求选择、ACK状态与实际执行回执。未知ACK不可盲重试/回填成功；刷新/恢复后从持久事实恢复。历史turn、正在运行turn和已持久入队项各自持有入队/创建时冻结的snapshot identity，后续设置修改不能覆盖它们。目录能力降级/换model后的unsupported/unknown显式呈现。

每次新选择使WPF-MATURE-04 context measurement失效；与04 architecture_read直接对接settings identity和失效关联。Web d01消费正式合同，当前实验不删除锁、不改公共contracts/UI、不改变现存profile hash。

## 固定R06组合端口（c6c98a29bc7205b0cd876fd8a01bec17097a3d5b）

已读codex-native-transport树 `docs/evidence/r06/interface.md`。组合caller唯一等待 `transport.ready`（initialize成功且initialized写入），目录module只调用 `request('model/list',params)`；普通final投影消费caller从 `receive()` 获得的已解码notification。module不二次握手、不负责server request/respond、close或timeout。EOF/未知ACK/进程隔离由R06/组合caller报告，本module不能把它转成成功final。

R06默认encoded JSON frame上限1MiB（含envelope/转义、不含newline）；Flow正文1MiB UTF8上限是另一层限制。正文在上限内不保证wire frame可传，JSON转义还会放大字节。组合时必须核实际encoded frame字节并将超界显式unknown/unsupported，禁止截断；本地decoded page上限也不替代transport wire限制。固定R06接口未在本片运行组合，测试使用in-memory已解码数据，不能声称R06已通过本片测试。

本次实际更新时间：2026-10-06 09:07:59 UTC。


### 与04的settings identity对齐（architecture_read只读输入）

候选共享identity包含harness、requested/resolvedModel、immutable profile configDigest、executionInputDigest、materialRevisionDigest、historyEpoch。draft subject用draftId + next-turn settingsRevision；queued subject用queueItemId + 自身冻结settingsRevision；attempt subject用taskId/attemptId/ownerVersion/nativeSessionId及自身冻结profile。每次有效的新选择都变更settingsRevision（即使model同名、但effort/fast改变），令draft context观测失效，不重写queue/attempt identity。R05 owner负责正式字段和CAS/持久snapshot语义；02/04实验只消费，不能擅改共享profile hash。

### 本片工程证据

27个本地确定性语义检查通过，范围与限制见[README](../../../experiments/codex-app-server-conformance/README.md)、[raw](conformance.tap)和[manifest](conformance-manifest.json)。只消费已解码帧，尚未运行R06组合。真实进程候选路径见[隔离方案](isolated-run-plan.md)，目前仅核sandbox-exec存在，canary隔离证据未完成，真实运行NOT_RUN。


## 阻断性接线边界：access none尚无执行证据

Mika转交status_read对固定Codex0.154.0 schema及官方current文档的只读结论（本次非运行证据）：`ThreadStartParams`、`TurnStartParams`、`SandboxPolicy`、`WebSearchMode`、`ServerRequest`没有证明一个“关闭全部工具”的总开关。readOnly / networkAccess:false不等于access:none，approvalPolicy=never表示不询问，并非禁止工具。config开放字典仅表示可传数据，不能证明任意键生效；ThreadStartResponse没有actual tools证据。

因此requested.access:none仅表示Flow意图，effective必须unknown。生产adapter在可执行的无工具策略未核实前，应拒绝宣称已兑现none；中心可存profile意图/合成final seam，但不能据此发布可运行无工具能力。拒绝已收到的approval/dynamic tool请求只覆盖那些请求，不覆盖自动允许的动作。当前文档的features.shell_tool=false及web_search=disabled也只是部分控制候选，不证明固定0.154所有工具/MCP/app已禁用。

来源：[固定E02归档](schema-source.json)及status_read只读输入；官方[config reference](https://learn.chatgpt.com/docs/config-file/config-reference)、[approvals/security](https://learn.chatgpt.com/docs/agent-approvals-security)是current资料，不能替代固定版本执行证据。隔离目录probe约束文件/网络/进程的启动边界，与以后允许provider网络后的无工具推理分开。

## 隔离后继静态准备时点（后续运行结果见文末）

[静态设计](../../../experiments/codex-app-server-conformance/isolation/README.md)已绑定独审R06 target a239b14d5328c78cca02a8757e26f2b65502f926及其main e785a29f5dee324127603f73e9efda8a66242009；该静态段仅profile/canary脚本、命令与失败清理的可审文件，未执行sandbox/R06组合/真实Codex。先前纯语义approval不覆盖本后继。

账号后继补充（Mika/status_read只读输入）：GetAccountParams.refreshToken=true可主动刷新token，account/read不能一概称零网络只读；Account目录信息不证明模型entitlement。login结果/通知并非总有可关联loginId，AccountUpdated也不是请求receipt；任何实际account/read/login/logout均未授权/执行，secret/token/email/raw认证URL不进入普通日志。ModelReroutedNotification的同thread/turn from/to可作为逐turn实际模型证据候选，不能用ThreadStart配置回填actual。


固定源码补证（status_read只读提供）：官方rust-v0.154.0 tag commit `6b9826e3aa83b1a5947db50f4332cb9c65f1b340` 的Cargo版本为0.154.0，ThreadStart schema与本地归档相同；但发布产物至本机binary `4f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc` 的校验链尚未证明。[spec_plan.rs](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/core/src/tools/spec_plan.rs#L1079)中ShellTool=false仅跳过核心exec_command/write_stdin，MCP resource/apply_patch/view_image仍为独立注册；[hosted_spec.rs](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/core/src/tools/hosted_spec.rs#L14)的Disabled不生成hosted search。这是0.154源码候选证据，不是本机binary全部无工具证明，不产生运行授权或access:none承诺。


## 当前一次隔离运行结果：FAILED / STOPPED

固定driver7c6e3d8已按Mika许可只调用一次runSyntheticCanary；[唯一运行证据](isolation/canary-run-report.md)为SIGABRT/无有效报告，七项结果不可用，R06确认退出，listener与两个自有临时根已清理。不得把静态APPROVED或本次失败当运行隔离证明；不重试、不加profile grant、不启动真实app-server。原profile/语义算法保持冻结。

02/04 identity的共享后继请求仅在[04 canonical center-store-request](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/center-store-request.md)维护；Mika提供固定HEAD `5ef354c4d4273ce7f47dafff148f65d7c4629355` clean。共享Lead可从那里读取迁移号/source授权/consumed cut及精确接线需求。这里仅提供依赖指针，不复制04 TODO/进度，也不把04阻塞改写为02整task blocker。

04依赖协调输入：已审targets879c989a594a8f4f266b9a78a885e311c52eca0d与3ab95d288a91214d03dec719dc6b44024206118a，权威HEAD148a8c91bd2a64048c79d9e5332a4d95e433c314（6源码未变），可由Lead先受控集成。一页store请求已撤回last_sequence=current错误等式；后继仅历史样本record/readLatest，迁移号需Lead正式分配（main当前到025，026只是候选），并由F01 owner挂index/client。04将原子amend store/窄event合同与runner.ts/events.ts精确路径；02不实施04、不代分配号码、不复制其状态。


## 有界启动诊断候选（尚未实施）

WPF-MATURE-02-03允许后继最多3次自有合成子进程、总60秒含清理；须先固定最窄R06诊断seam/scope与每次假设及停止规则，Mika内部审查后才实施。旧SIGABRT运行与许可封存。当前无scope扩展、无新运行、不扫描私人诊断历史、不复制supervisor；原文只允许可信宿主私有sink，产品error/detail/UI仍固定安全。生产transport stderr仅计数且可能在stdio drain前关闭，方案必须区分完整捕获、截断和观察失败，不能假定data callback必收全部stderr。

具体诊断候选：[最窄R06 private stderr seam/scope/测试矩阵与3次60秒预算](diagnostic-seam-proposal.md)。仅方案，未amend或执行；生产默认行为不变，保留真实Codex NOT_RUN。

后继能力目录边界（Lead输入）：main253035e包含native publish client095；R05C C1仅pinned普通task→typed final及真实PG注入peer，ports为空，不含production env/真实启动/conversation resume/stream/steer/goal。现SQL先过滤Claude与conversation创建Claude-only为有意旧兼容。后继需versioned native catalog与显式unsupported conversation capabilities，目录出现Codex不等于可在普通聊天选择。待C1固定后由Lead协调server/execution-profiles literal；F01 client/index继续其唯一writer，不丢字段以维持旧digest，不直接放宽旧reader。

## R06 private stderr 当前实施边界（2026-10-06 10:06:13 UTC）

唯一交付：[诊断seam/driver证据](diagnostics/README.md)，固定target `7297986fbc879bb5040879daf97c7d5bb8b657ac`。原writer claim0dd97484-f0ce-4738-8075-505bd5e2541a已原子amend为v2，新增精确 `apps/runner/src/codex/{types.ts,options.ts,index.ts,stderr-capture.ts,stderr-capture.test.ts}`；其他生产路径无写权。R06唯一process owner不变。privateStderr默认关闭，默认report/timing不变；仅trusted host可启用有界字节sink，async/thenable明确观察失败且安全消耗拒绝，原文不进product error/detail/UI。

Mika已独审APPROVED 0778847的五源seam；当前driver清理修复另待审。C1固定7127已随Lead批准mainf181进入同树，wire/adapter等strict编译通过，未执行其child/PG测试。F01/client/index、adapter/default env未改。预算尚未消费：最多3 child/60秒含私有分类与清理，固定driver只实现前2次，第3NOT_RUN；待Mika安排与S01串行窗口，不自行启动。

S01P02协调入口：[部分交回receipt](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-concurrency-entry/docs/evidence/s01p02/main-partial-handback-receipt.json)与[main接收receipt](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-concurrency-entry/docs/evidence/s01p02/main-accepted.json)。Lead输入：main.ts已在v2停写交回，mainf181已接收4源；这里仅原始回执指针，不复制其进度。

组合根登记修复：7297986把mkdtemp成功后的路径即时入账，后续realpath/lstat/chmod失败保留并标cleanup未知。新增6项零listener/零child故障检查。profile/preload/peer/grants/七项不变，当前用diagnostics/manifest-v5与driver-input-v5；原reviewer正复审，执行继续HOLD。

## 唯一诊断batch封存（当前运行事实）

[运行报告](diagnostics/run-report.md)/[run manifest](diagnostics/run-manifest.json)：source7297986经原reviewer10:13:38 APPROVED，Mika独占窗口后一次执行2child，final282.794417ms、cleanupComplete。控制40bytes精确；原profile canary SIGABRT且父stderr管道0bytes，原因unknown、七项未通过。CLI0仅诊断采集/清理完成，实际catalog仍blocked；不证明sandbox能写stderr或没有错误文字。第三NOT_RUN、预算已消费，不恢复clock/新batch。R06/已审C1交付可独立推进，后续仅有界只读源码研究。

## 已审生产与实验片段的独立集成入口（2026-10-06 10:20:00 UTC）

[唯一集成收据](integration-readiness.md)列明R06五源0778847及薄consumer38516be可独立受控集成；其source在当前树仍与各自已审target逐字一致。Mika10:17 UTC接收d35c596的诚实诊断结果，canary仍FAILED/unknown，CLI0仅capture+cleanup。无新child、第三NOT_RUN、旧clock不重置。该收据仅本owner交付输入，main最终事实由Lead维护。

## 02-04 ready 后继：versioned native configured catalog

[最小新合同/reader/精确路径与直接验收设计](native-catalog-seam.md)，输入固定main f181，建议同/api/execution-profiles以精确native-v1独立协商、新page+新client method；旧Claude-only reader与配置digest不变。Codex仅runner-configured/not-probed，conversation明确unsupported，不能当普通聊天选择。现register函数已挂载，无需抢F01 server index或新migration；合同/领域reader/F01 client路径由Lead分别分配。只读设计，不amend源码，不启动child；R05D真实启动与actual catalog证据仍未证明。

R05D接入依赖：已只读核[main41315b四源接收](r05d-dependency.json)等于已审178ef49e。D0只接受显式小配置文件并要求trusted factory注入，无默认production factory/实际app-server启动；未来factory只消费本task后续固定独审的launch recipe与允许边界。目录17来源与f181逐字相同，仍configured/not-probed。**main41315b尚无R06 optional privateStderr五源**，0778847与薄consumer38516be继续排Lead独立集成队列，不能由R05D已main推断它们已main。

目录第一片可独立交合同codec+领域reader/routes/局部tests；client index目前TUI01B writer，F01持其他共享index，只留正式method交接，不复制HTTP。architecture_read只读五条约束已纳入设计，尚无源码amend。

03后继只读候选：[pre-JS fd/平台初始化/JS三层判别接口](pre-js-fd-hypothesis.md)。固定源码说明pipe可能AF_UNIX、早期fstat/fcntl可在JS前失败，但现场fd/errno未知，不据此扩大任何grant；自有native helper候选需另审source/recipe/运行窗口，当前0额外child/无新预算。

共享集成短请求（正文仍只在04维护）：请Lead安全点先接收其已审六源，并为后继store分配迁移号及共享events/runner union接线；权威入口为[04 center-store-request](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/center-store-request.md)与[04 integration-readiness](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/docs/evidence/wpf-mature-04/integration-readiness.md)。本处只路由接收请求，不复制04进度或代分配迁移号。

## 原生配置目录首实现交审

[固定source/raw/checks](native-catalog/README.md)落实设计：精确native-v1、strict新page、known-pair SQL过滤与哨兵digest、Codex/goal conversation unsupported；旧reader/codec与公共挂载不变。writer v3已原子追加五文件；受控main41315b merge944780d无冲突。33 distinct局部行为检查（7合同+9目录分次证据+17旧消费者）及strict0，真实Codex/provider/新诊断child0。client/index无修改，由当前TUI01B/Lead后续接新method。该新实现待独立review，不继承此前诊断/语义approval。

共享接收指针：[S01P03 integration-ready](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-graceful-stop/docs/evidence/s01p03/integration-ready.md)及[权威status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-graceful-stop/plans/s01-graceful-stop/status.md)。这里只指向owner交付，时间/进度由该处维护。

目录固定实现target `c9c6e891003af2fc52ca77b0c4527d6d85e20e22`，status_read / gpt-6-astra于2026-10-06 10:35:37 UTC独审APPROVED，0 P1/P2，Mika接收；manifest只绑定此source。33 distinct分次证据与strict0未重跑。原R06五源/薄consumer仍独立已审待Lead集成；目录配置事实不证明provider可用，client未接线。非阻断test-only清理delta见native-catalog/ack-cleanup，store.ts已按收窄协调v4单路径交回，其他四目录路径保留。


P3 test-only delta `a761941fce5b2b6dd12d8c974c6d2c7e51894628` 已由status_read/gpt-6-astra于2026-10-06 10:39:53 UTC独审APPROVED，原问题关闭；只有1项定向检查与strict0，原c9生产33证据不变。共享store.ts已通过页首v4 receipt交回，其他四目录路径/R06/本task证据保留；不恢复store写入。S01P03当前main接收/释放只查[权威status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-graceful-stop/plans/s01-graceful-stop/status.md)及其receipt，不在02复制进度。

C静态source72203208已由architecture_read/gpt-6-astra于2026-10-06 10:48:20 UTC独审APPROVED，仅C/profile/schema，无P1/P2；不包括执行设计/driver或运行。后继编译将按已读官方/本地clang文档评估单次-save-temps=obj保留所有own产物，固定v2设计与薄host组合另审，当前0compile/0target。
