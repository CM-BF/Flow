# 中心 store：一页实施与共享输入请求

仅候选，未领取新scope、未实施；进度唯一源为[status](../../../plans/wpf-mature-04-context-transparency/status.md)。只读基线main `4391bbf9f1785212d098ef6aa1c01a0320a003d3` clean（2026-10-06 09:40:24 UTC）；6个已审文件均尚不存在，双target均非main祖先，见[核验](context-cut-audit.json)。已审879纯投影及3ab95d2纯Adapter可独立集成，不等待本后继。

**最小 store Interface。** `record(tx, task, attempt, event)`复用`reportEvents → ownedAttempt → applyEvent`的同一PoolClient事务、runner→task→attempt锁及fence；不自行开连接/事务、调用provider或另造上报端点/sequence。事件仍使用既有id/sequence envelope，新增窄`context-observation` payload。`readLatest(tx, task, attempt)`按原始event_sequence降序读1条历史sample，明确时间/来源；首store建议只交付持久化历史样本，不把它自动投影成current。current/remaining仍unknown，CT-02/CT-06未达完整可用；完整目标不因此降低。

**幂等与存储。** `(attempt_id, observation_id)`唯一；比较完整`canonical({source,adapterVersion,observation,coveredSteeringRevision})`及hash（不只比较tokens）。相同内容重报保留首次event_sequence/receivedAt，异内容409；envelope id/sequence重放仍由runner_events处理。新migration须由Execution Lead分配编号：task/attempt FK、完整有限metadata JSON、canonical/hash、原始event_sequence、host observedAt、DB `clock_timestamp()` receivedAt、覆盖revision及降序读取索引；payload≤65536bytes，拒绝溢出/全文/path。无复述正文、usage账单或第二份进度状态。

**信任与current cut。** 中心从已锁task/attempt/session/profile核taskId、attemptId、ownerVersion、harness、非空nativeSessionId、requestedModel/configDigest；K02 input digest仅对已有conversation/goal冻结输入核验。materialRevisionDigest必须版本化地从按序精确citation refs派生，不改名复用含正文contextDigest。host只报告resolvedModel、historyEpoch、估算和已消费steering revision；静态allowlist限定harness/source/adapterVersion/measurement method，非授权来源拒绝，reporter不得同传expected/current自证。evidence/summary refs核task/attempt归属，citation核项目/版本/digest/locator授权；缺可信绑定只存历史sample+unknown。撤回`sample.sequence===attempt.last_sequence`作为current条件：sequence只用于排序/幂等。accepted推进steering revision立即失效；新attempt/session/profile/input/epoch仍失效。首store不提供生产current，host时间不能刷新接收时间或绕过age。

| 精确接线请求 | 责任与最小改动 |
| --- | --- |
| 新`packages/contracts/src/context-observation-event.ts`及`.test.ts` | 建议04 owner：窄source/payload/covered revision合同，复用已有ContextObservation；不扩draft/queued SDK来源 |
| 新`apps/server/src/context-transparency/store.ts`及`.test.ts` | 建议04 owner：record/readLatest历史样本、完整幂等/来源/refs；current cut另验，不导入SDK |
| 新`packages/storage/migrations/<Lead分配>-context-observations.sql`及新`apps/server/src/context-transparency/migration.test.ts` | Execution Lead先给唯一编号和迁移挂载owner；04仅在明确amend后写 |
| `packages/contracts/src/runner.ts`、`packages/contracts/src/index.ts` | mika协调共享owner纳入事件union/导出；09:30账本R05B runner.ts旧claim已released，不自动视为获写权 |
| `apps/server/src/events.ts` | mika分配唯一owner，在applyEvent调用record；沿用原reportEvents顺序/锁/重放；不复制fence |
| `apps/server/src/index.ts`、`packages/client/src/index.ts` | F01现writer（astra_ultra_execution_lead，v22）负责受控挂载；中心owner鉴权只读GET候选`/api/tasks/:id/context`及一个typed client方法，后续再领routes/tests，不另开runner POST |
| `apps/server/src/active-steering/commands.ts` | readLatest直接比现有revision即可失效，预计无需修改acceptSteering；若额外写cut必须另协调，禁止偷加hook |
| runner实际采样/emit | R05/runner owner后继：只在已消费Query与冻结attempt可靠绑定后明确summary采样，沿HarnessContext.emit/outbox；生命周期/频率另验，当前不实现框架 |

**Lead最小输入：** allowlist与采样时点；sample覆盖的root resultId、消费UUID/revision、queue-empty/静止证据；首个支持路径及30秒freshness/结束后展示语义。current拟复用既有receipt/result/seal（host.ts:46/51/59；finalization.ts:48–65），不造FSM/counter。同一已覆盖result的artifact/verification/assistant-final/completed是收尾持久化，不因运输序号改变而失效；新SDK输出/工具消费、steering accepted或未知事件保守失效，缺证据unknown。另定K02 metadata seam、迁移号、共享writer/amend。后继验证须覆盖专用DB事务/重放/时间、权限/refs、cut失效、重启/迁移；当前只读与文档检查，未执行这些测试。

**源码判定：** 普通Claude先usage→artifact/verification→assistant-final（claude.ts:130–136、219–228），runtime.ts:214/223在adapter返回后发completed；受控final同样提交3条连续收尾事件（finalization.ts:58–69）。events.ts:94–96每条推进last_sequence、63–72完成task，92拒绝completed后的新sample。因此对已完成attempt，旧等式必不成立；这只是读码结论，未运行验证。
