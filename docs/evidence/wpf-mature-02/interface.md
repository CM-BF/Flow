# WPF-MATURE-02 Interface请求与交接

Owner chatui01_owner；co-lead mika；大task [WPF-MATURE-02](../../../plans/wpf-mature-02-harness-capabilities/plan.md)。当前仅实验consumer，不另造R05宿主。

## Lead当前可行动请求

- **原生目录观察已执行并归还运行时段，目录仍未取得。** [本次固定结果](native-catalog-observation/run-report.md)：ready=true/1次model-list；收到已知但不允许继续的 `remoteControl/status/changed`，按原规则停止。1目标已受控关闭、完整stdio和本次两root清理确认，私有原件KEEP；[双审忠实失败收据](native-catalog-observation/result-review.json)。既有授权消费后不重试/扩表；此前[准入错误及更正](native-catalog-observation/preflight-correction.json)不回写。

- **SVC07事务短断连恢复：请求Lead sole provision（FLOW-001/REQ-19）。** owner db_transaction_owner/Astra，lead mika；WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/server-transaction-disconnect`，branch `codex/server-transaction-disconnect`，base `22a0806bc2465e11096949618113833f31766b19`。status_read 19:40:37.483 UTC报告main/origin clean，四literal无active/handoff父子冲突，新task/WT/branch/registry均不存在；SVC06是固定后台产物，非本责任。精确四scope：`apps/server/src/database.ts`、`apps/server/src/database-transaction.test.ts`、`plans/svc07-transaction-recovery`、`docs/evidence/svc07`。仅修公开transaction借用client错误与释放生命周期：connect callback内装listener，等待run收束，原异常不被ROLLBACK/release覆盖；COMMIT未知不重执或假称回滚，坏连接销毁式release一次。先小fake公开接口验收，0真实PG/个人环境；真实PG另排Lead窗口。服从当前center同版本恢复，provision及fresh原子take后才写，不另建重复大task。

- **S01P07受控provision请求（父FLOW-001/S01-06）。** owner status_read/Astra，lead mika；固定main22a0806bc2465e11096949618113833f31766b19；WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-claim-recovery`，branch `codex/runner-claim-recovery`。Mika转述19:29:48 fresh：main/原S01 clean，新WT/branch/task不存在，15literal无active/handoff冲突；仅Lead soleprovision，owner须fresh原子take后才写。精确范围：`apps/server/src/runners.ts`、`apps/server/src/runner-claim-receipts.ts`、`apps/server/src/runner-claim-receipts.test.ts`、`apps/runner/src/admission-journal.ts`、`apps/runner/src/admission-journal.test.ts`、`apps/runner/src/runtime.ts`、`apps/runner/src/runtime-claim-recovery.test.ts`、`packages/contracts/src/runner-claim.ts`、`packages/contracts/src/runner-claim.test.ts`、`plans/s01p07-runner-claim-recovery`、`docs/evidence/s01p07`、`packages/contracts/src/index.ts`、`packages/client/src/index.ts`、`packages/client/src/runner-claim.test.ts`、`apps/server/src/index.ts`。稳定claim key空闲复用/500ms不变；首次非空allocation在原锁/事务存receipt，accept原子落assignment+nextkey后才执行；实时lease/cancel/owner fence与v1unknown保守阻塞不变，复用SQL不加scheduler。当前0take/写入/检查，原S01仍唯一owner状态。

- **REQ-15会话页批量读取：请求Lead sole provision准备树。** 原global REQ15后继，拟owner architecture_read/Astra，`/Users/citrine/Projects/AgentHarness/Flow-worktrees/conversation-turn-page-batch` / `codex/conversation-turn-page-batch`；固定main `22a0806bc2465e11096949618113833f31766b19`，19:09:42只读核5入口相对ec5无diff、B02/B03 v2已释放、拟范围无active writer。精确10literal：`apps/server/src/conversations/queries.ts`、`apps/server/src/conversations/state.ts`、`apps/server/src/conversations/replies.ts`、`apps/server/src/conversations/turn-read.ts`、`apps/server/src/conversations/turn-page-batch.test.ts`、`apps/server/src/assistant/store.ts`、`apps/server/src/assistant/index.ts`、`apps/server/src/assistant/final-preview-batch.test.ts`、`docs/evidence/req15-turn-page-batch`、`plans/req15-conversation-turn-page-batch`。S01 actual安全点后准备；take前0写。首片同PoolClient批量final+turnViews≤50接turnPage，保RR/冻结settings-context/invalid-legacy/PG全UTF8hash；不领tasks/contracts/client/migration/contextwrite。仅路由provision，不改旧B02/B03或建立第二status。

- [本片接口与边界](native-catalog-observation/interface.md)保持链接只计自身、不follow、control父身份和原两项通知允许表；7组源码检查不重跑。旧system-config失败根与私有原件继续KEEP，不回填旧FAIL。当前actual已结束，REQ15/SVC07真实PG验收仍须另排。

- **系统配置窗口已消费：初始化成功，但目录与完整计量未完成。** [固定失败结果](native-system-config/run-report.md)：1native ready=true/1次model-list，未知通知触发受控关闭；完整stdio、两个own根因清单不完整KEEP，私有诊断KEEP。无目录/模型资格，完整预算UNKNOWN，不重试；[结果已双审限定接收](native-system-config/result-review.json)，保留整体失败/未知。

- **S01空领取测量已双审收口。** [唯一result-ready](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe/docs/evidence/s01/idle-claim-cost/result-ready.md)，固定e61ba2c3；原owner维护唯一status，dashboard一次timeout仍PENDING_SYNC。本次实际已结束且0PG/Chrome，与R01串行窗口无冲突；不重复供给、测量或轮询。

- **原生目录单项许可窗口已消费，仍在握手前退出。** [本次固定失败结果](native-catalog-pagesize-compat/run-report.md)：1native exit1、ready=false/model-list 0；process/root/stdio收束，156B私有诊断KEEP，明确os error1，具体操作/原因unknown。[结果忠实性已双审接收](native-catalog-pagesize-compat/result-review.json)，功能仍失败；无重试或模型资格。


- **numeric pagesize单许可出现正差异，窗口已消费。** [固定结果](native-pagesize-compat/run-report.md)：A三API −1/EPERM；B只增加hw.pagesize_compat后三API全16384/errno0，1compile+2helper正常关闭、自有根清理。仅本C组合改善，不自动native重试或声称根因/修复；[忠实性已接收](native-pagesize-compat/result-review.json)。
- **CHAT06P03已main接收并交回写权（Mika核验）。** [唯一owner状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/assistant-stream-runner-hash/plans/chat06-runner-prefix-hash/status.md)：owner567d62042f273f6a8b23ff6da334e698bed94ff7 clean/pushed；main0b8cd6f4六源与refs一致，真实noEmit0已关闭类型P2，v2于18:22:14.915 RELEASED；[实际外部release](/tmp/flow-chat06p03-main-release-receipt.json)。无需重复集成或重测。

- **Claude逐消息设置CORE/C01/F01已main接收。** main8d84唯一[组合接收回执](/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/i02/message-settings-integration.json)；CORE [owner main acceptance](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/vertical-main-acceptance.json)固定3e768151，claim v4已释放，不让原owner回写。Web/TUI完整用户验收与真实provider仍开放。
- **共享consumer沿现有交接接线。** [具体函数、冻结请求、ACK/observed及跨端验收](claude-message-settings-consumer-handoff.md)是本父唯一接口；公共client/CLI由MATURE02C01交付并已进入上述main组合，[controlled输入](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-client/docs/evidence/mature02c01/controlled-inputs.json)按历史时点解释。Web RECOVERY/TUI01F源须协调合法owner，本父不领取或复制HTTP/FSM；[C01补充P2已关闭收据](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-client/docs/evidence/mature02c01/supplement-approved.json)保留。
- **历史诊断已消费。** [页大小原键无改善结果](native-pagesize/run-report.md)/[忠实性收据](native-pagesize/result-review.json)；[首次native握手前失败结果](native-catalog-probe/run-report.md)/[忠实性收据](native-catalog-probe/result-review.json)。344B私有原件KEEP；不据历史结果恢复授权或声称根因。
- **资源只供sole Lead判断。** [B01/P03必要KEEP与本组有限消费者说明](resource-candidates.md#next4c补充)保留；未登记外部consumer仍unknown，本组0稀疏/回收。原O14窗口、CORE闭包供给和旧PG过程已保留Git564421ba及child证据，不再列作当前待接线：CORE [首次setup失败](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/pg-setup-failure-manifest.json)、[16:58资源NOT_RUN](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/pg-retry-resource-not-run.json)与后续批准分开。

- [资源候选与KEEP边界](resource-candidates.md)仅供sole Lead核历史后决定，本owner0回收/稀疏。
- [X01后继enable/binding准备](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-management-plan/docs/evidence/x01/enable-binding-preparation.md)由原owner维护；唯一SQL号、writer与当前main输入须Lead协调，旧core占用观察按历史解释，不抢写。
- [GO性能研究输入](research-inputs.md)路由S01/REQ15、CHAT08原计划；静态推算不当容量事实，0新增PG/provider预算。

- **本父仅三项管理scope。** 四profile路径已[停止写入](claude-core-profile-stopped-writing.json)并[原子交回](claude-core-profile-handback-receipt.json)，claim v6保留docs/实验/plan；后续core接收和main事实以上述唯一回执为准。本父不恢复产品写权。
- 跨端具体冻结/recovery/profile资格与验收均沿上方[consumer交接](claude-message-settings-consumer-handoff.md)，不另建合同。历史[首leaf接收](/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/i02/claude-message-settings-intake.json)与[父级职责](claude-message-settings-handoff.md)保留。
- 其他共享薄client独审入口：[goal progression](goal-progression-client-review.md)、[plugin installation](plugin-installation-client-review.md)，只在各自transport范围成立。

OpenSSL ca6a候选独立于native探针：[四fake局部检查](node-owned-openssl/validation-manifest.json)、[SOURCE_REVIEW](node-owned-openssl/source-review.json)、[c46f准备批准](node-owned-openssl/preparation-review.json)均保留，实际仍NOT_OPEN，不是Claude或native的前置。未来必须重新核13输出和准入；不因资源恢复执行。各诊断accounting仅对应固定提交快照，旧raw/清单不追改；新共享metadata按当前实际字节计费。

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

原manifest仅model与固定thinking.disabled的限制属于早期基线；CORE/C01/F01已main接入逐消息合同。当前入口和跨端缺口以上方组合回执及consumer交接为准，不能从SDK声明推断账号或实际推理效果。

固定SDK声明ModelInfo已有resolvedModel、supportsEffort/supportedEffortLevels、supportsAdaptiveThinking、supportsFastMode；Options有thinking/effort；Settings有fastMode/fastModePerSessionOptIn；init fast_mode_state为off/cooldown/on并带disabled_reason（含sdk_opt_in_required），effort可缺/null且受org/model降级。因此directory/requested/actual分层，未知实际fast不得写已生效。Query.supportedModels存在不等于可零副作用调用；初始化/账户读取安全路径另证，不新开query。

共享owner需固定实际模型能力目录、请求选项、init/effective回执与unsupported的合同；Web d01仅消费已落地字段，不修改本owner实验来伪造生产支持。

共享历史独审入口：[TUI01A delta](tui01a-review.md)、[R05C纯投影](production-projection-review.md)。各自固定范围，不另建进度源。

**R05C复用：** [final投影提升回执](final-projection-handoff.md)与[生产模块消费证据](production-import/README.md)保留；已审生产模块取代实验算法副本，历史27/27不重跑，禁止长期双实现。

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

### 运行边界

真实native已观测到握手完成，但目录仍未取得；旧结果与当前未开放后继见页首。复用唯一R06进程owner，不二次initialize、不重发unknown，不把目录当entitlement。

## 下一条配置与历史冻结（完整验收增补）

WPF-MATURE-02-09：同harness空闲会话对实际支持的model/effort/fast提供“下一条生效”的设置修改；不能将整会话永久Locked。运行中修改只有实际能力支持时开放。跨Claude/Codex不宣称旧native session可互通，须明确续聊兼容或新会话路径。

当前Claude方案由页首child请求维护：draft只在客户端，不建中心next-settings/settingsRevision；profile reference/configDigest标识可信配置，完整messageSettings沿既有body幂等digest与CAS冻结。历史、运行中及入队snapshot互不改写；未知ACK保留原intent，能力降级/续接语义未知明确拒绝。早期nextTurnSettingsRevision候选已被此方案替代。

每次新选择使WPF-MATURE-04 context measurement失效；与04 architecture_read直接对接settings identity和失效关联。Web d01消费正式合同，当前实验不删除锁、不改公共contracts/UI、不改变现存profile hash。

## 固定R06组合端口（c6c98a29bc7205b0cd876fd8a01bec17097a3d5b）

已读codex-native-transport树 `docs/evidence/r06/interface.md`。组合caller唯一等待 `transport.ready`（initialize成功且initialized写入），目录module只调用 `request('model/list',params)`；普通final投影消费caller从 `receive()` 获得的已解码notification。module不二次握手、不负责server request/respond、close或timeout。EOF/未知ACK/进程隔离由R06/组合caller报告，本module不能把它转成成功final。

R06默认encoded JSON frame上限1MiB（含envelope/转义、不含newline）；Flow正文1MiB UTF8上限是另一层限制。正文在上限内不保证wire frame可传，JSON转义还会放大字节。组合时必须核实际encoded frame字节并将超界显式unknown/unsupported，禁止截断；本地decoded page上限也不替代transport wire限制。固定R06接口未在本片运行组合，测试使用in-memory已解码数据，不能声称R06已通过本片测试。


### 与04的settings identity对齐（architecture_read只读输入）

早期02/04 settingsRevision候选已由当前Claude请求方案替代：复用profile reference/configDigest与持久task/queue完整messageSettings，不另建中心可变revision。草稿选择变化须使相关context观测失效；历史requestedModel取已冻结task设置，旧无snapshot沿旧profile。具体接线/身份合同以页首child next-slice-handoff为唯一当前来源，context直接消费者需在最终纵向验收交付。

## 阻断性接线边界：access none尚无执行证据

Mika转交status_read对固定Codex0.154.0 schema及官方current文档的只读结论（本次非运行证据）：`ThreadStartParams`、`TurnStartParams`、`SandboxPolicy`、`WebSearchMode`、`ServerRequest`没有证明一个“关闭全部工具”的总开关。readOnly / networkAccess:false不等于access:none，approvalPolicy=never表示不询问，并非禁止工具。config开放字典仅表示可传数据，不能证明任意键生效；ThreadStartResponse没有actual tools证据。

因此requested.access:none仅表示Flow意图，effective必须unknown。生产adapter在可执行的无工具策略未核实前，应拒绝宣称已兑现none；中心可存profile意图/合成final seam，但不能据此发布可运行无工具能力。拒绝已收到的approval/dynamic tool请求只覆盖那些请求，不覆盖自动允许的动作。当前文档的features.shell_tool=false及web_search=disabled也只是部分控制候选，不证明固定0.154所有工具/MCP/app已禁用。

来源：[固定E02归档](schema-source.json)及status_read只读输入；官方[config reference](https://learn.chatgpt.com/docs/config-file/config-reference)、[approvals/security](https://learn.chatgpt.com/docs/agent-approvals-security)是current资料，不能替代固定版本执行证据。隔离目录probe约束文件/网络/进程的启动边界，与以后允许provider网络后的无工具推理分开。

## 已封存诊断与可独立交付

旧隔离/Node/C/native窗口结论见页首固定结果链接与[review索引](../../../plans/wpf-mature-02-harness-capabilities/review.md)，过程全文保留历史Git。本页不恢复旧授权、不改raw/manifest；R06五源已main接收并交回，[集成输入](integration-readiness.md)按固定时点解释。真实资格、访问强制与全writer撤销仍unknown。

## 原生配置目录与共享接线

生产目录4源/测试已由main21e0a56c接收，见[核验](native-catalog/main-accepted.json)；不代表个人服务部署。store已[原子交回](catalog-store-partial-handback.json)，其余profile路径也已交回，本claim v6仅管理三scope；共享client不由本worker写。

[目录合同设计](native-catalog-seam.md)及[集成输入](integration-readiness.md)保留exact-single native-v1、owner gate、knownpair SQL先于LIMIT、严格sentinel/digest与Codex/goal conversation unsupported约束。目录仅configured/not-probed；原legacy Claude reader与JSON/hash保真。client review收据见页首。完整02的运行/下一条设置/跨端验收仍开放。
