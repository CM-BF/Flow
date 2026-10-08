# 04 后继接线 owner 路由澄清

2026-10-06 11:10:26 UTC，fresh协调账本只读核对。当前进度仍以[唯一status](../../../plans/wpf-mature-04-context-transparency/status.md)为准，本页只纠正接线派工路由。

[center-store-request.md](center-store-request.md) 与 [integration-readiness.json](integration-readiness.json) 已绑定实现 `9ac549dddd12b6bb186bf34116c4c72fe9889cfc`；其中 ENG01A/TUI01B 的共享owner表属于历史快照，不表示当前写权。本次不改该固定输入、源码、raw或manifest；正式027与Interface无变化。

| 精确共享路径 | 此次账本观察 |
| --- | --- |
| `packages/contracts/src/runner.ts` | 无active claim；需Lead重新fresh核对并take/amend成功后才可写 |
| `apps/server/src/events.ts` | 无active claim；需Lead重新fresh核对并take/amend成功后才可写 |
| `packages/contracts/src/index.ts` | F01 / astra_ultra_execution_lead，claim `8470e7d2-662a-4dbe-9b0e-12ef82aac90e` v28 ACTIVE |
| `apps/server/src/index.ts` | 同上 F01 v28 ACTIVE |
| `packages/client/src/index.ts` | 同上 F01 v28 ACTIVE；旧TUI01B路由已过期 |

空scope不是授权；上述记录也不能覆盖后续账本变化。后继共享接线由Lead协调当前合法owner，按fresh take/amend收据执行。04 owner保留 `d3a9be2b-6321-49b5-992b-9e3f9f216f49` v5修复期，不领取这些共享路径，等待固定target独审。

## 当前共享接线更新与最小 union 输入（2026-10-06 11:31:11 UTC）

此段取代上方11:10的写权快照；原9ac绑定的center-store-request不改。fresh main `53ce2ec2c95b489aa7a2a2eaa49849821af00c16`、04 HEAD `b0e7032d41dd15c6953668548afe6d98bfb2114c` clean、04 claim v6 ACTIVE。账本显示 `packages/contracts/src/runner.ts` 与 `apps/runner/src/runtime.ts` 由 ENG01D / native_center_owner、claim `a1177b12-a802-4d70-b616-270d6d21e6fc` v1 ACTIVE；其授权范围是optional frozen executionIdentity/普通Codex生命周期。04不写这两条路径。contracts/index、server/index、client/index仍F01 Lead8470 v28；events.ts本次无active writer，空scope不构成授权。

Lead在ENG01D接口冻结后fresh核账本、受控追加/交接写权，复用现成helper即可：

- 从已审9ac `packages/contracts/src/context-observation-event.ts` 直接导入 **`contextObservationEventSchema`**，作为既有 `runnerEventSchema` 的 `type` union成员；保留helper整项校验与65536B上限，不重建 `.shape` 或复制合同。`RunnerEvent` 与 `RunnerEventData` 沿既有infer/WithoutEnvelope自然获得该分支，不另维护第二个事件类型。
- 最小envelope仍是 `id`、`sequence`、`type: 'context-observation'`、`observation`。observation精确字段为 `source`、`observationId`、`observedAt`、`nativeSessionId`、`resolvedModel`、`used`、`compactionWindow`、`categories`；source只采用同文件 **`CLAUDE_CONTEXT_SOURCE`** 固定值。`ContextObservationEvent`、`ContextObservationPayload`、`contextObservationPayloadSchema`已导出可复用。不新增task/attempt/ownerVersion/profile/expected/current/evidenceRef；身份沿现有batch ownership及中心锁定行核定。
- F01维护的contracts/index按需要直接导出上述文件及 `context-observation-history.ts` 的 `contextHistoryResponseSchema`/类型，避免新HTTP客户端或DTO副本。现有reportEvents/applyEvent在ownedAttempt事务/fence后调用已审 `record(client, task, attempt, event)`；不新建POST/sequence/事务，不把后继optional executionIdentity当本历史模块自证材料。
- 正式027及局部owner GET可以由F01先挂载并验证迁移、现有auth与typed reader；runner union/event handler需等合法共享scope。尚无producer时读回空历史也须如实，不以人工构造样本冒充SDK采集。后继producer使用已审c173 **`normalizeClaudeSummary`**，无fake ref；runtime/Claude采样仍未授权开工。

接线影响验证由合法owner在实际集成点完成：union与batch接收/隐私及字节拒绝、原事件兼容、现有fence/sequence/digest与同事务幂等回滚、全局owner auth和HTTP typed reader。04本次仅metadata，无工程重测。历史domain固定输入为 [history-integration-ready.json](history-integration-ready.json)，纯归一化为 [normalize-integration-ready.json](normalize-integration-ready.json)；二者均独立APPROVED，current/remaining/cut/Web仍开放。

## Web 历史消费者交接核对（2026-10-06 12:15:12 UTC）

此段更新前文“共享接线未完成”的历史事实，不修改9ac绑定请求或producer已冻结输入。main `362af3bac77541e5a60979326bcf4d4b8c947915` clean 已有历史 GET/DTO、薄client及原reportEvents接线；04 producer `eccb1ba6d9f3bf95cca4f50693dde8e32707ed40` 仅branch固定待独审/集成，不能假定当前服务已有样本或已部署。

**Web 权威来源。** main registry将大task WPF-MATURE-04映射到本owner计划，没有第二份04计划。Web管理权威为 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform/status.md`（12:10 UTC），实际HEAD `bb30ceb1066917dc012b5cb88768a23290172155`、管理范围dirty；其WPF-001-09仍把context列开放后继，当前实际工作为ATTACHI02/DPERF03。该树 `docs/evidence/web-platform/mature-task-handoff.md:211` 仅写“Mika / P2，Web消费UI”并链接本唯一plan。12:15:12 fresh账本的Web active任务为WPF-001/ATTACHI02/DPERF03/WORKSPACEPERF01；未见独立context-history UI claim。main Web源码也无 `contextHistory`/`context-history.v1` 消费。故现有权威输入**未确认04历史UI已开工**；这不是根据未回传推断，更不把知识引用选择/发送模块当作窗口用量UI完成。TODO05保持pending，后继由d01按fresh派工/领取协调，不干扰其现有任务。

**可直接消费的现成 Interface。** `FlowClient.contextHistory(taskId, signal)`（`packages/client/src/index.ts:56`）调用 owner GET `/api/tasks/:id/context/history`，按 `contextHistoryResponseSchema` 解码并核返回taskId。server全局owner-auth后挂载（`apps/server/src/index.ts:131–141,166`），runner凭据不得读；不要复制HTTP客户端、携带expected/current identity或把403当“无样本”。GET禁止额外query，`Cache-Control:no-store`。task由中心加载，`readLatestHistory`（store.ts:99–104）仅选择其 **current_attempt_id**，按**原始eventSequence降序**返回最多一条；它不是整个task跨attempt历史列表，也不是当前占用/实时模型状态。

**显示边界。** `latest:null` 表示当前attempt没有可用历史sample，不能显示已用0、充足或已完成采样；identity以响应绑定task/attempt/session/profile为准，不把旧attempt样本贴到新attempt。sample的observedAt与中心receivedAt分别显示/保留来源；used与compactionWindow是SDK估算，modelCapacity仍unknown，rawMaxTokens不得标成model硬上限。响应 `current` / `remaining` 均固定unknown/history-only；不要据elapsed、eventSequence、free类别、累计session账单或两个历史值相减制造current/remaining。compression `not-observed` 不是“未发生压缩”。过期/未采样/权限错误显示各自状态，不把网络失败沿用为新鲜结果。

**按需有限内容。** materials仅中心已授权精确citation+bytes或metadata-unavailable，tokens为null；选择了材料不证明已经驻留。默认面板不重传全文，用户展开时使用现有 `FlowClient.detail(sample.detailRef.id, signal)`（index.ts:457）/已有授权引用reader，保留版本/locator/ref，不自行补正文或猜token。producer增量仅令普通显式Claude成功root result后有机会出现历史sample；缺方法/reject/非法值可无样本，pending unknown可保留uncertain。steering/goal/graph、current cut、压缩跟踪及真实SDK可用性均不在本片。消费端无需等待新contract，但具体Web实现/双主题窄屏与真实服务验证仍由d01另领scope。

## 当前Web路由：2026-10-07（取代旧pending快照）

2026-10-07T22:50:51.105Z：WPF-MATURE-04-05已经开工，writer w01_owner，独立WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history`、branch `codex/web-context-history`，claim25d7e029-9334-479e-8872-61090c406e0a v1 exact3，22:35:02.638Z提交。固定源c5f896333458579b0e0fa65ba2b389e14084a81e、delivery bdf6be1fde74c8d02ce7eadbf651fa0da65d33a7；22:50:05.833Z实际观察ac2581637 clean，只是该瞬间事实。

现有controller/UI/plugin模块16pure+strict0（1797ms CLOSED）由D01/root于22:45:15.211Z限定批准，固定[root-module-review.json](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history/docs/evidence/wpf-mature04-web-history/root-module-review.json)，SHA9a4dd06c29f518972d74eabcb27afbcce965b36f4164fd3947a528144bafc24c。实际测试target4366466与最终c5f896标题增量区分保留。原两stale floor消费不改，只有事后样本高于正确线的观察。

下一接线仍属原-05：App.tsx提供授权FlowClient reader；plugin-integration/session.ts承接唯一view/session状态及取消；ConversationThread.tsx提供稳定入口。App/session22:47:29交回是管理回报；Thread与新exact scope须W01 fresh取得，父metadata不授产品写权。新的薄接线段已获管理安排，当前不得称mounted。继续真实HTTP schema/权限错误、按需详情请求、A→B→A失效、隐藏/关闭/禁用/重连取消及browser键盘/双主题/窄屏验证；不由历史estimate制造current/remaining或压缩证明。

[唯一父status](../../../plans/wpf-mature-04-context-transparency/status.md)维护-05进度；WPF-001-09只引用，W01树只保存自身证据。旧12:15未见UI开工为历史，现由本固定路由取代。完整CT01–09与-03/-04/-05/-06保持开放。

## 当前W01接收路由（2026-10-08T00:36:44.532Z）

唯一产品owner w01_owner，web-context-history/codex/web-context-history，25d7e029 v3 exact8已STOP。固定source c7f3933c1cd815a539192823628847ac5ca6123e / seal067f77d6d195038d7b07d28ae9d9cd3657daa8de；现场8819faa34a5cb08f164c4a4f98b1595218dc2cad clean仅为本次快照。独立页面8/8与390双主题2PNG获root限定批准，main待Original受控接收，不能wholeblob覆盖Arc App/session/Thread。Arc隐藏工作区与pending撤权组合未验；真实producer/current/remaining/fullCT仍OPEN。Mika父05为唯一手填进度，WPF09只引用；具体边界与固定原件见[当前路由](web-history-route-current.json)。旧段记录保留为历史。
