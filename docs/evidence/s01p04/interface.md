# S01P04 固定集成输入 — APPROVED

2026-10-06 11:30:12 UTC，owner status_read / gpt-6-astra，co-lead mika。权威 WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-read-fence`，branch `codex/runner-read-fence`，唯一 [status](../../../plans/s01p04-runner-read-fence/status.md)。所属大task [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)。

- 生产固定提交：`e1847ce1c66646eb40b7eb4111a31468d4681e1f`；只新增文件内私有 FOR SHARE 授权读取点，公开 lockRunner 继续排他。
- 消费者修复固定提交：`94b3cfae4be4c7c99b6dc2a224c7e37f63c91d88`；修正 steering final/command 的实际 task 锁等待断言，生产不变。
- 独审：chatui01_owner / gpt-6-astra，2026-10-06 11:29:47 UTC，APPROVED；原 e184 唯一 P2 关闭，无剩余 P1/P2。Mika已接收。详见 [review](../../../plans/s01p04-runner-read-fence/review.md)。
- 检查：9项真实专库 PG + 1项 ENG claim过滤 + 1项 steering消费者，共11不同通过；不是单次11/11。ENG12未选、steering15未选；各片局部strict0，初始失败完整保留。三个专库均关闭连接/普通DROP后确认absent；没有新的capacity/SDK Query/provider窗口。
- 固定证据：[生产48项manifest](implementation-manifest.json)，[修复34项manifest](consumer-manifest.json)；source/raw冻结。仅本Interface页首按Lead要求追加集成metadata，所以它在生产manifest的旧Git绑定仍可重现，当前WT支持文档有已声明metadata变化，不重写旧manifest/hash或原始证据。
- fresh现场：收尾前HEAD `225f4f4bc5c86073f3b5b06ac3418f546a26a5bd` clean，writer `cb7db4a9-cb89-4589-b2f3-d30b75549ab9` v3 ACTIVE、五个精确scope；保留占用直到明确handoff/release。main `53ce2ec2c95b489aa7a2a2eaa49849821af00c16` clean，两个实现target均未集成；不因无关main前移重新base。
- dashboard：Lead已报告实际137-source采样包含S01P04正式卡；这是Lead采样事实，不代表当前服务随后已刷新。本owner不写registry或第二状态JSON。

接收边界：Lead从本canonical分支接收上述生产+消费者修复组合，保留maintenance drain允许既有attempt、revoke拒绝后续授权、runner→task→attempt顺序及外层强锁。没有吞吐/SLO/>100执行容量结论；未领取共享runtime。

以下为原设计及路径移交历史快照；其中v1/ENG占用与尚未修改的文字是当时记录，当前权属及实现以页首为准。

---

# S01P04 runner 授权读取锁 Interface

所属大task：[FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)。co-lead mika，owner status_read / gpt-6-astra；S01-06仅作前序追溯，不建立第三层。权威worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-read-fence`，branch `codex/runner-read-fence`，初始base `c450c2da7e6185b88db9f46e0299ee504ee6f3e8`。本页是已同Mika确认的最小设计，生产实现尚未领取/修改。

## 一个文件内的私有读取fence

`runners.ts`新增私有 `lockRunnerForAttempt(client: PoolClient, runnerId: string): Promise<void>`：在调用方现有事务中以固定SQL `SELECT id,revoked FROM flow.runners WHERE id=$1 FOR SHARE` 锁定runner，检查存在且未revoked，否则保持现有401 `runner_revoked`。`ownedAttempt`仅改第一个授权读取点，其后的runner归属403、task→attempt独占锁、current_attempt_id/ownerVersion 409及调用方lease/completed校验保持。锁生命周期仍由调用方COMMIT/ROLLBACK结束，不建立新事务/锁服务/状态机，不向caller开放任意lock mode。

公开 `lockRunner()`继续FOR UPDATE。它服务claim/容量、profile及已有外层强锁；revoke、maintenance、运维reconciliation的独占语义不变。FOR SHARE可在同runner不同attempt间共享，并与更新runner授权状态的写锁冲突；不使用FOR KEY SHARE，因为后者允许非键UPDATE。依据[PostgreSQL16行锁矩阵](https://www.postgresql.org/docs/16/explicit-locking.html#LOCKING-ROWS)，不据此预言吞吐或锁等待百分比。

maintenance不是revoke：drain只停止新claim/admission；已有合法attempt须继续heartbeat/report才能排空。共享凭据fence不能以maintenance_state!=accepting拒绝ownedAttempt；hold仍要求active=0（含未知占用），revoke提交后才拒绝后续所有runner凭据。等待writer后取到的当前runner行必须重新检查revoked。

## 保留的锁顺序与约束

| 入口 | 原顺序及必须保持的行为 |
| --- | --- |
| 普通ownedAttempt/heartbeat/report/steering | runner共享授权→task UPDATE→attempt UPDATE；同attempt仍串行；租约/owner fence不变 |
| protocol-dispatch recover | store.ts97先公开lockRunner独占→103 ownedAttempt；保留外层强锁，内层SHARE不构成升级 |
| goal-run-authority | runner-project-fence.ts19 runner独占→23 project UPDATE→24 ownedAttempt(task/attempt)→25 authority；不改project顺序或授权撤销 |
| steering receipt重入 | 重取同runner/task/attempt，不更新runner，不升级 |
| claim /016 guard_attempt_maintenance | claim先runner独占；BEFORE INSERT attempt触发器也FOR UPDATE runner；共享路径禁止引入INSERT attempt或后续更强runner锁 |
| reconciliation | reconciliation.ts59运维恢复允许revoked并持有独占锁，不改 |

父lead与architecture_read已完成调用影响只读审查。新功能若要在共享路径写runner或insert attempt，必须另审锁顺序，不能依赖自动升级。

## 受控PG16行为验证

单个新文件 `apps/server/src/runner-read-fence.test.ts` 使用真正私有随机库、动态loopback（如需HTTP）、独有Pool/连接与有界生命周期。只复用现有生产Module Interface，不复制协议fixture框架、不启动runner/SDK/provider，不运行混合容量窗口。不得复制旧protocol-dispatch固定flow_p02/DROP SCHEMA或maintenance固定flow_svc02做法。创建前核唯一名不存在、CREATE发送前记creationRequested；即使丢ACK仍核精确自有库存在性，应用/事务连接结束后普通DROP并核不存在，未知显式保留名字，无FORCE/终止他人连接。

确定性顺序由BEGIN/已取得生产锁返回值/明确的PG backend阻塞证据控制；超时是失败上界，不以sleep概率或耗时差证明并行。每例finally解除gate、ROLLBACK未结束事务、await已发操作并release自有连接，整fixture结束close/Pool.end/DROP。计划覆盖：

1. A事务持有attempt1后，B同runner不同attempt2的ownedAttempt/heartbeat/report可在A释放前完成；记录双方身份与有效lease。原独占实现应有真实red。
2. 同attempt的第二事务在第一事务未释放前确实等待；释放后事件seq/ACK保持连续，不能把并发改成重复或乱序接受。
3. revoke请求等待既有共享fence完成；提交后新的ownedAttempt/heartbeat/report返回现有401。missing runner/错误runner/旧ownerVersion/过期lease仍按原错误或stop语义处理。
4. drain等待在途事务后完成；后续claim空，但既有合法attempt heartbeat/report继续。未完成时hold拒绝，完成后hold成功，不把draining当凭据失效。
5. 同runner容量为1的并发claim仍恰好一个assignment，016触发器及unknown占用不绕过。
6. 两个外层强锁代表：真实protocol recover，以及真实goal authority的runner→project→task→attempt路径；确认不会引入共享到独占升级或放松其已有排他边界。

直接消费者按本矩阵及共享runners影响选择：新专库测试优先；必要复用既有测试必须先核其资源隔离，不能执行固定共享库破坏性fixture。严格类型检查沿根Node24/ES2023/strict/noUnchecked基线，记录实际选择/通过数与未运行项；不跑全库。PG结果是功能交错证明，不是新吞吐/容量窗口。

## 精确生产路径移交请求

当前writer claim `cb7db4a9-cb89-4589-b2f3-d30b75549ab9` v1仅含三个scope：`plans/s01p04-runner-read-fence`、`docs/evidence/s01p04`、`apps/server/src/runner-read-fence.test.ts`。**没有runners.ts写权。**

2026-10-06 10:55:14 UTC fresh ledger：`apps/server/src/runners.ts`由 ENG01B / native_center_owner / lead astra_ultra_execution_lead 的claim `172ae2c2-8910-4bc8-bca3-53d797da175b` v2持有，权威WT engineering-execution-profile。请求等其ready稳定片完成后：原owner明确停写该路径→当前version原子amend移除→Mika协调固定已审源/main→本owner以最新S01P04 version原子amend加入该精确文件→成功COMMITTED后核继承来源和dirty再改。冲突/未知时保留旧范围，不先release抢占，不要求打断ENG交付，也不把本页当授予写权。

后继只在本独立树改上述最小授权读取点，保留ENG已审生产内容；shared registry/总进度由Lead路由到[唯一status](../../../plans/s01p04-runner-read-fence/status.md)，本owner不写共享registry。
