> 2026-10-06 12:54:04 UTC 当前：生产范围已合法移交，writer4eb31983 v2；受控main3609合入至f0ebd514。以下旧开工/阻塞段为历史。最小Interface不变，开始必要专库功能验证，A/B NOT_OPEN。

# S01P05：task事件状态一次持久化候选

**当前只领取metadata，生产尚未开工。** Owner status_read/gpt-6-astra；co-lead Mika；权威WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/event-state-persistence` / `codex/event-state-persistence`；fixed base `aeb764e5d2c2ec043ae8673cde2724f5330db2ab`。唯一status [S01P05](../../../plans/s01p05-event-state/status.md)。接收派工不代表events.ts写权：本claim `4eb31983-3bd8-415e-9898-143e28c727ef` v1仅docs/evidence/s01p05、plans/s01p05-event-state。

## 最小Module / Interface

复用现有 `persistEventState(client: PoolClient, task: TaskRecord, attempt: AttemptRecord): Promise<void>`，签名、导出及两个调用者不变。它在caller已取得runner→task→attempt fence/锁且拥有事务时，保存event应用后聚合的attempt序号及task投影。先维持现有attempt last_sequence/last_event_at UPDATE，再将现有三个task UPDATE合成一条固定列UPDATE：status、cursor、pending_decision、updated_at=clock_timestamp()、verification_status、latest_artifact_id、latest_artifact_version、usage。task/attempt状态仍归caller，函数不commit、不新增锁、重试、缓存或通用SQL builder。

普通reportEvents仅accepted>0时调用；纯重放accepted0不更新timestamp/state，混合旧/新event只保存新事件累积后的最终值。finalizeSteering继续先校验当前credential/fence与保存receipt、控制修订/精确artifact，再同事务apply三个final事件并持久化、保存receipt。异常原样交transaction rollback；不把unknown变null，不重算usage/verification/cursor，不新增默认值。

## 影响与现有约束

| 固定输入 | 必须保持 |
| --- | --- |
| events.ts:77–115 reportEvents/persistEventState | event id/digest/sequence、live fence、terminal拒绝、accepted0/replay及四表以上副作用原子性 |
| active-steering/finalization.ts:38–75 | final proposal identity/seal/receipt原子性、相同重放、冲突拒绝、完成后查询 |
| usage.ts / evidence.ts / timeline.ts | 同TaskRecord聚合usage（包括null/unknown）、exact artifact/version与verification、原cursor顺序 |
| migrations/018:48 与 021:37 | task触发器仅UPDATE OF conversation_input_id或goal_input_id；合并固定SET不含这些列，frozen input不可变规则原样 |
| runners.ts ownedAttempt / database.ts transaction | runner SHARE、task/attempt UPDATE原有顺序不动；Pool max8不动；原错误/rollback行为不变 |

已固定10项readonly输入bytes/SHA见[readonly-inputs](readonly-inputs.json)。没有schema/index/migration/public contract/interface变化，不需要新模块。具体收益只先证明task UPDATE从3次到1次、减少2次数据库往返；真实延迟/锁/吞吐未测，不能宣称已提速。

## 范围移交请求与登记

12:36后fresh账本F01 `8470e7d2-662a-4dbe-9b0e-12ef82aac90e` v32 ACTIVE仍持 `apps/server/src/events.ts`；owner astra_ultra_execution_lead，canonical m2-shared-foundation（只读现场HEADdb318ed6 clean）。S01P05在fixedmain registry与本次账本无既有writer；新metadata claim已COMMITTED。

请求顺序：F01原owner明确停写events.ts → 按其fresh current version原子amend移除单路径 → 本owner fresh核账本后将现claim v1原子amend追加 `apps/server/src/events.ts` 与新 `apps/server/src/event-state.test.ts` → COMMITTED后才改生产/test。若期间版本变化或冲突，保留原metadata claim等待协调；不能release再take或借integration绕过。共享index/registry/usage/迁移不申请写权。

Lead登记请求：task S01P05、所属[FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)，co-lead mika，owner status_read/Astra，worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/event-state-persistence`，branch codex/event-state-persistence，planDir plans/s01p05-event-state，唯一status `/Users/citrine/Projects/AgentHarness/Flow-worktrees/event-state-persistence/plans/s01p05-event-state/status.md`。未登记/聚合前只记录等待，不假称服务刷新。原S01实验是前序追溯，不是第三层父task。

## 计划内最小验证

新专库测试只以public reportEvents/finalizeSteering与原transaction接口验证：合法混合事件最终状态和完整ACK相等；每个accepted批次恰一条task UPDATE；纯replay不写与冲突不消费；注入任务写失败/后续非法event整批rollback，无孤儿detail/usage/artifact/timeline/sequence；stale/uncertain拒绝；finalization精确artifact、seal、receipt重放/回滚。任务input binding直接检查018/021保护在正常状态写时保留，错误改绑仍拒绝。

真实PG功能检查需取得上述scope并固定最小fixture；随机专库、动态port（如需HTTP）、CREATE-request-before-send、有限query/close，确认own连接结束后exact DROP/absent，无FORCE、无未知重试、0 provider。旧共享库/不安全fixture不运行。直接消费者和局部strict依实际影响选取，不全库。当前0测试/PG/HTTP/child调用。

后继A/B各128、总256task/attempt、8×16、5min/512MiB仅GO预算方向预授权；还需fixed两版本/profile预算独审及Mika唯一window OPEN，与发布/Nodeactual串行。此生产片不自行启动任何capacity窗口。原S01 FOR SHARE classifier修复独立实验target，不改64911结果/raw。

## 验收和后继预算细化

[最小行为矩阵](validation-matrix.md)明确reportEvents/finalizeSteering完整rollback、pure replay timestamp、null/unknown及018/021列trigger；[A/B设计](ab-design.md)固定共同observer/profile、一个总clock与清理reserve候选。两页均为metadata，0source/test/PG/load调用。剩余唯一生产范围请求仍events.ts和新event-state.test.ts，取得COMMITTED追加后才实施。
