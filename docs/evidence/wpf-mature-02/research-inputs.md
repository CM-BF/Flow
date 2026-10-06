# 既有性能后继研究输入

2026-10-06 16:09:16 UTC；GO经Mika提供，沿S01/REQ15与CHAT08原计划归档。本页仅固定源码观察与后继验证问题，不是新task、第二进度源、实现决定或运行许可；Claude CORE优先级不变。

## Active steering空邮箱轮询成本

只读固定main `e807730328a8f220721efcc3e346c03945991965`，本次未运行fixture/测试/PG/provider：

| 固定源码位置 | 已观察机制 |
| --- | --- |
| `apps/runner/src/active-steering/host.ts:29` | poll等待串行readMailbox完成后再setTimeout 100ms；不是固定100ms定时并发请求。 |
| `apps/runner/src/runtime.ts:210` | 每次mailbox先await control.assertOwnership，再发steeringMailbox HTTP。 |
| `apps/runner/src/attempt-control.ts:34`、`:72` | assertOwnership调用heartbeat；仅合并正在进行的heartbeat，没有按剩余租约跳过新调用的缓存。 |
| `apps/server/src/runners.ts:101`、`:109` | heartbeat经ownedAttempt验证后，活租约路径UPDATE last_heartbeat_at/lease_expires_at。 |
| `apps/server/src/active-steering/finalization.ts:23` → `storage.ts:23` | steeringMailbox→liveAttempt→ownedAttempt，再读取mailbox。准确路径是active-steering/finalization.ts，不是steering/finalization.ts。 |
| `apps/runner/src/claude.ts:57`、`:118` | 只有存在steering context才创建host，取得Claude native session后start；runtime还要求activeSteering opt-in及Claude adapter。不能推广到全部attempt。 |

在全部相关attempt均启用该能力、低延迟无阻塞、无共享inflight/其他串行工作的假设下，这条循环每attempt稳态接近10轮/秒，每轮一次heartbeat加一次mailbox HTTP；128个相关attempt约`128 × 10 × 2 = 2560`请求/秒，**只是这条轮询路径的代码推算近似上界，未实测，不是容量/SLO/整体HTTP硬上界**。实际网络/锁延迟、serial队列、inflight合并会改变频率；独立定时heartbeat、finalize额外读及命令事件未纳入这个算式，不从它计算生产吞吐或收益。

## 后继可判别问题（由原owner安排）

先用0模型、已有注入fixture计数和可控clock分开记录：空邮箱的轮询/heartbeat/更新次数；稀疏指令从接受到一次投递的等待；响应丢失后的unknown与停止；撤权/取消后新动作拒绝；指令与final竞争时的revision/sequence/seal及持久ACK。对照应固定相同attempt、clock步数与触发时机，计数和时序事实各自报告，不用128背景对象冒充真实128执行。

观察后再选择减少冗余读写的最小接缝。新动作前的当前权限fence、unknown/cancel、同一query一次投递和final事务保护必须保持；不能直接删assertOwnership/中心校验，不能只机械延长等待来声称优化。无需为研究另造缓存/调度FSM；无证据时保留问题，不预报百分比。

本输入不授权新的压测、PG、真实provider或付费调用；实际检查/产品修改需原owner按现有领取与运行门禁安排。本轮0运行。

## 路由与事实来源

- S01/REQ15原性能后继交 status_read / mika，权威[plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe/plans/s01-runner-capacity/plan.md) / [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe/plans/s01-runner-capacity/status.md)。本轮只读HEAD `65a9c7b4b577d49ff302581d590b31f3425cd900` clean；fresh账本S01现508f9c85 v1 ACTIVE仅其既有实验/证据/plan范围，本页不替它扩产品scope或开启A/B。
- CHAT08原领域 owner runner_owner / ExecutionLead，权威[plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/native-active-steering/plans/chat08-native-active-steering/plan.md) / [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/native-active-steering/plans/chat08-native-active-steering/status.md)。本轮只读HEAD `eb1caeb529697c7521cb710e5441bb207d2840a0` clean；原领域和metadata claims均released。请Lead沿原计划协调后继owner/精确scope，不能将旧owner身份当仍有写权。

本parent只保存输入与canonical路由，未修改两任务status/源码。find-skills/clean-code沿既有本地固定来源，关注单一状态owner、实际调用成本与错误取消语义，不以静态推算替代行为证据。X01资源候选仍按resource-candidates内16:06历史快照解释，后续计划更新须Lead操作前fresh核，不覆盖旧观察。


## S01/REQ15：旧池等待样本与空SSE读放大（16:38研究输入）

GO经Mika追加，本owner只读核固定`65a9c7b4b577d49ff302581d590b31f3425cd900`的[128报告](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe/docs/evidence/s01/mixed-128-run/report.md)及[analysis](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe/docs/evidence/s01/mixed-128-run/analysis.json)：旧1c496835固定fixture窗口pool acquisition n4691、p95 203.427084ms、max632.255666ms；transaction p95 22.496375ms。含插桩与连接建立，phase按parent收记录时刻划分；不是当前SLO，不能以两个分位数相减推锁耗时。旧share elapsed仍UNKNOWN，不追改原raw。

本轮只读main`74bc72f0d32daebc8f89a75528f3d72002b3a29e`：`apps/server/src/index.ts:69` center pool max8，`scheduler.ts:5` scheduler max3。`streams.ts`每SSE250ms tick（busy时跳过）调用`queries.ts:16`的eventPage，在一致事务内读取task+timeline；空页/正文不变仍有读取。tick前和send前各鉴权；cookie分支`browser-session/store.ts:34,40`还有identity/session PG读取。因此128 agents不等于128 SSE，也不能将此与runner heartbeat混成一种负载。

后继沿S01/REQ15原owner/计划，用已有fixture与observe-pg等待/idle/acquisition seam分开计idle observer数量、同task重复observer数、cookie鉴权成本、eventPage实际次数及runner heartbeat；先削减可证重复工作，再按证据讨论pool。必须保留send前撤销复核、cursor/RR一致性、慢读backpressure关闭、订阅/查询结束清理。此次不选新缓存/调度框架，不开压测/PG/模型预算，实际计量等CORE及串行窗口。

[官方node-postgres pool-sizing](https://node-postgres.com/guides/pool-sizing)本轮只读正文：多实例需合计连接并留管理/扩容余量；连接紧张先检查查询速度与数据库负载。此建议不证明Flow应调大或调小pool，也不替代上述固定场景测量。
