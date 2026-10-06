# 中心 store：一页实施与共享输入请求

仅候选，未领取新scope、未实施；进度唯一源为[status](../../../plans/wpf-mature-04-context-transparency/status.md)。只读基线main `3418fe682944145494463dca9e09f89c8b9c2295` clean（2026-10-06 09:30 UTC）。已审879纯投影及3ab95d2纯Adapter可独立集成，不等待本后继。

**最小 store Interface。** `record(tx, task, attempt, event)`复用`reportEvents → ownedAttempt → applyEvent`的同一PoolClient事务、runner→task→attempt锁及fence；不自行开连接/事务、调用provider或另造上报端点/sequence。事件仍使用既有id/sequence envelope，新增窄`context-observation` payload。`readLatest(tx, task, attempt)`按原始event_sequence降序读1条sample；只将中心确认的current identity/material metadata交已有projection，无样本或缺绑定返回unknown。

**幂等与存储。** `(attempt_id, observation_id)`唯一；比较完整`canonical({source,adapterVersion,observation,coveredSteeringRevision})`及hash（不只比较tokens）。相同内容重报保留首次event_sequence/receivedAt，异内容409；envelope id/sequence重放仍由runner_events处理。新migration须由Execution Lead分配编号：task/attempt FK、完整有限metadata JSON、canonical/hash、原始event_sequence、host observedAt、DB `clock_timestamp()` receivedAt、覆盖revision及降序读取索引；payload≤65536bytes，拒绝溢出/全文/path。无复述正文、usage账单或第二份进度状态。

**信任与current cut。** 中心从已锁task/attempt/session/profile核taskId、attemptId、ownerVersion、harness、非空nativeSessionId、requestedModel/configDigest；K02 input digest仅对已有conversation/goal冻结输入核验。materialRevisionDigest必须版本化地从按序精确citation refs派生，不改名复用含正文contextDigest。host只报告resolvedModel、historyEpoch、估算和已消费steering revision；静态allowlist限定harness/source/adapterVersion/measurement method，非授权来源拒绝，reporter不得同传expected/current自证。evidence/summary refs核task/attempt归属，citation核项目/版本/digest/locator授权；缺可信绑定只存历史sample+unknown。current至少要求sample原始sequence等于attempt.last_sequence、覆盖revision等于中心steering_attempts.revision且对应消费证据可核；accepted推进revision立即失效，不等SDK下一次回报。后续sequence/attempt/input变化保守失效；host时间不刷新DB接收时间或绕过age，生产freshness需该接线验收。

| 精确接线请求 | 责任与最小改动 |
| --- | --- |
| 新`packages/contracts/src/context-observation-event.ts`及`.test.ts` | 建议04 owner：窄source/payload/covered revision合同，复用已有ContextObservation；不扩draft/queued SDK来源 |
| 新`apps/server/src/context-transparency/store.ts`及`.test.ts` | 建议04 owner：上述record/readLatest、完整幂等/来源/refs/current cut；不导入SDK |
| 新`packages/storage/migrations/<Lead分配>-context-observations.sql`及新`apps/server/src/context-transparency/migration.test.ts` | Execution Lead先给唯一编号和迁移挂载owner；04仅在明确amend后写 |
| `packages/contracts/src/runner.ts`、`packages/contracts/src/index.ts` | mika协调共享owner纳入事件union/导出；09:30账本R05B runner.ts旧claim已released，不自动视为获写权 |
| `apps/server/src/events.ts` | mika分配唯一owner，在applyEvent调用record；沿用原reportEvents顺序/锁/重放；不复制fence |
| `apps/server/src/index.ts`、`packages/client/src/index.ts` | F01现writer（astra_ultra_execution_lead，v22）负责受控挂载；中心owner鉴权只读GET候选`/api/tasks/:id/context`及一个typed client方法，后续再领routes/tests，不另开runner POST |
| `apps/server/src/active-steering/commands.ts` | readLatest直接比现有revision即可失效，预计无需修改acceptSteering；若额外写cut必须另协调，禁止偷加hook |
| runner实际采样/emit | R05/runner owner后继：只在已消费Query与冻结attempt可靠绑定后明确summary采样，沿HarnessContext.emit/outbox；生命周期/频率另验，当前不实现框架 |

一次性需Lead固定：事件source/adapter allowlist与消费cut证据、metadata-only K02 refs读取seam、migration编号、上述共享writer和精确amend。验证范围随后绑定实际片段：专用DB事务/rollback、完整同异重报及时间不刷新、sequence/steering/attempt失效、跨runner/task/ref拒绝、重启读取/迁移幂等、事件消费者与owner只读路由；Node24/pnpm9.15.4/Vitest4.0.18显式路径，0provider/auth/个人服务。当前仅文档检查，不声称这些验证已运行。
