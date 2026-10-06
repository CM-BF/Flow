# WPF-MATURE-02 Interface请求与交接

Owner chatui01_owner；co-lead mika；大task [WPF-MATURE-02](../../../plans/wpf-mature-02-harness-capabilities/plan.md)。当前仅实验consumer，不另造R05宿主。

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

## 隔离后继当前状态

[静态设计](../../../experiments/codex-app-server-conformance/isolation/README.md)已绑定独审R06 target a239b14d5328c78cca02a8757e26f2b65502f926及其main e785a29f5dee324127603f73e9efda8a66242009；本轮仅profile/canary脚本、命令与失败清理的可审文件，不执行sandbox/R06组合/真实Codex。先前纯语义approval不覆盖本后继。

账号后继补充（Mika/status_read只读输入）：GetAccountParams.refreshToken=true可主动刷新token，account/read不能一概称零网络只读；Account目录信息不证明模型entitlement。login结果/通知并非总有可关联loginId，AccountUpdated也不是请求receipt；任何实际account/read/login/logout均未授权/执行，secret/token/email/raw认证URL不进入普通日志。ModelReroutedNotification的同thread/turn from/to可作为逐turn实际模型证据候选，不能用ThreadStart配置回填actual。


固定源码补证（status_read只读提供）：官方rust-v0.154.0 tag commit `6b9826e3aa83b1a5947db50f4332cb9c65f1b340` 的Cargo版本为0.154.0，ThreadStart schema与本地归档相同；但发布产物至本机binary `4f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc` 的校验链尚未证明。[spec_plan.rs](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/core/src/tools/spec_plan.rs#L1079)中ShellTool=false仅跳过核心exec_command/write_stdin，MCP resource/apply_patch/view_image仍为独立注册；[hosted_spec.rs](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/core/src/tools/hosted_spec.rs#L14)的Disabled不生成hosted search。这是0.154源码候选证据，不是本机binary全部无工具证明，不产生运行授权或access:none承诺。
