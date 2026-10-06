# WPF-MATURE-02 Interface请求与交接

Owner chatui01_owner；co-lead mika；大task [WPF-MATURE-02](../../plans/wpf-mature-02-harness-capabilities/plan.md)。当前仅实验consumer，不另造R05宿主。

## 首片可独立实现

固定codex-cli0.154.0 stable schema，注入一个只传JSON行的transport；consumer负责有界请求/响应关联、initialize→initialized顺序、model/list分页与public目录归一、ordinary final/failed/interrupted事件判别。没有spawn/auth/provider/账户文件读取。

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

## R05-B固定consumer答复（0.154.0，2026-10-06 09:05 UTC）

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
  reasoningEffort: string | null; // catalogue-bound if non-null; never fast
  serviceTier: string | null; // thread persistent override; preserve null
  serviceTierForTurn: string | null; // new-turn-only; "default" standard speed
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
