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
