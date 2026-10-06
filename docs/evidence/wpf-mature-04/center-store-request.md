# 历史上下文样本：一页实施与共享输入请求

**Execution Lead 必需输入：唯一 migration 编号及 DDL owner 尚未分配。真实 PG 检查必须采用该唯一迁移，禁止临时重复建表。** 2026-10-06 10:28 UTC，GO 已授权推进历史持久化和公开读回；04 claim v3 有效，新增八文件须原子 amend 后写。固定 main `8d8ab520a9d43c7b9dafb22911416ee799ebf665` clean，六个已审源码尚未 main；879/3ab 两片批准、检查及逐文件 hash 见 [integration-readiness.json](integration-readiness.json)。进度唯一源为 [status](../../../plans/wpf-mature-04-context-transparency/status.md)。不等待 Codex；本片 current/remaining 恒为 unknown，完整 CT-02/CT-06 仍未达成。

**小 Interface / 状态归属。** `record(tx, task, attempt, event)` 仅在既有 `reportEvents → ownedAttempt → applyEvent` 的事务、runner→task→attempt 锁及 fence 后调用；不另开事务、sequence 或 runner POST。`readLatestHistory(tx, task)` 由中心选择 task.current_attempt_id 并核 task/attempt 归属，按原始 event_sequence 降序返回最多一条有限历史样本；GET `/api/tasks/:id/context/history` 沿既有 owner 鉴权，不接受 reporter 的 expected/current identity。DTO 明示 history-only，current/remaining unknown；事件序号只作历史排序，不能用 sample.sequence===attempt.last_sequence 宣称 current（artifact/final/verification/completed 仍推进序号，完成后不再接受新 sample）。

**唯一 DDL 请求。** `context_observations` 需要 task/attempt 外键、`(attempt_id, observation_id)` 唯一、完整 canonical wire/hash、有限 sample JSON、原始 event_sequence、host observedAt、DB clock_timestamp() receivedAt、按 task/attempt/sequence 降序索引及 detail reference。相同 canonical 重报复用首次序号/时间/ref；异内容 409。Envelope replay 仍由 runner_events 管。新 migration 路径/编号及 owner 由 Lead 指定后追加领取；store/tests 可以先写，PG 验证保持待验，不能用 mock SQL 宣称数据库通过。

**窄 source 与身份。** 仅允许 `claude / claude-sdk-0.3.290-v2 / claude-sdk-context / 0.3.290 / summary / sdk-summary-estimate / estimate / claude-context-summary-0.3.290`。hardCapacity unknown、compression not-observed。wire 只有 source 常量、observationId/observedAt/nativeSessionId、host resolvedModel nullable、used/compactionWindow nullable 安全整数、最多四种唯一匿名 categories；不接收完整 identity、材料 refs、evidenceRef、正文、path 或 session 账单。请求体 ≤65536 bytes，SDK 原始类别 ≤32 的聚合属于 runner，而非中心。空 resolvedModel 必须 unknown 数值/空类别；未知或越界拒绝，不截断冒充 full。

中心复用 `sessionEvidence(tx,task)`（conversations/replies.ts），要求恰好一个合法 session detail，sourceTask/sourceAttempt/runner 与锁定行相符、activeTaskId=task.id、nativeSessionId=attempt.native_session_id 非空、adapterVersion 精确 v2。`requireExecutionProfile(tx,task.submission.executionProfile)` 核未撤销 reference/digest、runner、Claude/v2，requestedModel 来自配置；首片仅显式普通 purpose profile，legacy/goal-tools/graph-tools 不猜默认授权。`recordSession` 负责已有 native session 归属；host resolvedModel 只是固定 source 报告，不是中心独立 provider 验证。

**metadata refs。** ordinary task 没有 K02 时 input/material digest 与 historyEpoch 为 null，材料未知；历史可存，不能声称已消费 input。会话从 DB task.conversation_input_id 调 `contextReference`（conversation-context/store.ts）读按序精确 citation/byteLength/freeze metadata，复用 executionInputDigest；材料 revision 用版本化 ordered refs canonical，不改名使用含正文 contextDigest。授权沿 freezeContext→resolveCitationsInTransaction 的 project/version/digest/locator，reporter 不能追加。Goal 的 `goalExecutionReferences` 只有 digest/count/bytes，没有精确 refs，首片材料仍 unknown，不调用全文 goalContextDetail。`saveDetail` 在原事务生成真实 metadata detail/ref，中心注入 ContextObservation；读回联查 details.id/task_id/attempt_id 归属。canonical 比较不含中心生成 ref/receivedAt，既有 ACK 不要求 runner 事先持有 ref。

| 本轮精确文件 / 后继接线 | owner 与交付 |
| --- | --- |
| `packages/contracts/src/context-observation-event.ts` + `.test.ts` | architecture_read：固定来源的有限 wire，不改既有 runner union |
| `packages/contracts/src/context-observation-history.ts` + `.test.ts` | architecture_read：历史 DTO、显式 current/remaining unknown |
| `apps/server/src/context-transparency/store.ts` + `.test.ts` | architecture_read：同事务 record/readLatestHistory，唯一 DDL 待 Lead，真实 PG 待验 |
| `apps/server/src/context-transparency/routes.ts` + `.test.ts` | architecture_read：局部 owner GET 和公开 HTTP 行为，不改全局 mount |
| `packages/storage/migrations/<Lead编号>-context-observations.sql` | **编号及唯一 owner 待 Execution Lead；本轮未领取** |
| `packages/contracts/src/runner.ts`、`apps/server/src/events.ts` | ENG01A writer：union/applyEvent 调 record，沿既有 fence/事务 |
| `packages/contracts/src/index.ts`、`apps/server/src/index.ts` | F01 writer：导出/挂载局部 routes，中心既有 auth 不复制 |
| `packages/client/src/index.ts` | TUI01B writer；typed reader 接线由 Lead 协调 |
| runner summary 采样/emit 与纯值抽取 | 后继 runner owner；不在本片调用 SDK/provider |

**避免复制归一化。** 等真实 wire producer 领取后，runner 抽一个 `normalizeClaudeSummary(response, expectedResolvedModel)` 纯 Module，唯一负责 camelCase 数值检查、≤32 原始类别→四种匿名类别、溢出及模型匹配。已审 `mapClaudeContextSummary` 与 wire producer 共用该实现；须先追加精确 scope/验证消费者，不能用假 ref 调 mapper。中心仅验证窄 wire、不解析 SDK、不重新聚合，而是注入 DB identity/真实 detail ref。当前六源码冻结，不借历史批准重构。

**验收 / 后继限制。** 本片验证 schema 拒绝隐私与溢出、完整 canonical 幂等、真实 DB 事务/归属/首次时间、owner HTTP 权限/404/空历史及 bounded response；未挂载前不称生产端到端。current 后继需可信 consumed input/history/result/steering cut；accepted steering 立即失效，同一 result 收尾事件不应永久破坏 post-turn current。没有该证据时未知，不造通用 FSM。采集、压缩、配置切换、freshness 与真实 provider 仍分别待实施验证。结构沿 [AGENTS modular-design](../../../AGENTS.md#modular-design)，本地技能用于单一事务归属、真实引用和字节边界。
