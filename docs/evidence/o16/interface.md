# O16 Interface v1 — implementation contract

The experiment is a public consumer, not a new center or runner authority. Fixed product base is 8bd02cc3b9ec7afe5fec461e4d8ee05798e5d974. Only zero-query preparation is authorized now.

**Permit/observation Module.** Two finite permission phases: `plan` (one SDK entry), then `children` (at most two entries) after the actual proposal and explicit owner confirmation. A future trusted local permit binds source digest/worktree, expiry, phase, model, exact limits and (children only) goal/proposal/confirmation digests and profile references. Its JSON validates declared operator intent; it is not cryptographic proof of GO approval. No real permit is created by tests. Before native SDK entry, immutable wx+fsync reservation binds a finite slot and real task/attempt identity; any uncertain or consumed slot is not retried under another output/key. SDK usage and managed declarations are observations, not OS/USD enforcement.

**Journey Module.** `prepare/rehearse/plan/confirm/inspect/verdict/cleanup` are one experiment entry. `createGoalEntry`/`createGoalSession` own the existing persistent local intents; `FlowClient.confirmGoalPlan` is the existing owner confirmation seam. Original center persists grants, input versions, pins, progression and artifact bindings. Original runtime/Claude adapter own claim/lease/outbox/SDK iteration. The experiment owns only bounded private resources, fixed input/evidence and orchestration of explicit calls. It never dispatches the second child or changes a grant based on model payload.

Plan grants exactly one proposal, zero applications, <=2 nodes/1 edge and explicit inputProposalProtocol. Native successful evidence must contain current runner/run/attempt sourced proposal and complete actual inputs, not an owner-authored fixture. Rehearsal uses injection and says so. Actual owner reads the proposal before confirmation. No confirmation means no child. Observers can disconnect without cancellation; replay uses identical body/key. Lost outcome/failed stop keeps resources and prior reservation, never silently recreates work.

**Evidence Module.** Collect body-free planning/state refs first; read only selected versioned inputs/artifacts and bounded history via public clients/O12. Independent actor receives exact material/proposal/dependency/final text and mechanical facts. An owner acceptance command is separate from verification. A rejection leaves accepted=null and is preserved in the experiment report; the current product has no dedicated rejection-reason command. O12 confirmation integration and richer UI remain out of scope.

Resource reservation file/parent directory are durable before CREATE. Database random name+marker and runtime directory dev/ino bind ownership. Checkpoint precedes normal DROP/rm; all own processes/app/pool must close, connection observation is bounded to3s/LIMIT33 with <=32 and deadline check even on zero. Unknown cleanup never uses FORCE. Plan/owner-review/children are staged: no active SDK/worker during owner review; retained private DB/directory requires a finite separately arranged resource window. Raw/byte/deadline gates are measured, no unbounded output, cache or polling. No new dependency installs, personal service access or provider startup in preparation.

Candidate only: planner sonnet4turn/$0.20/90s; each child sonnet3turn/$0.10/60s. <=3 SDK entries total, not underlying HTTP-call or hard billing caps. Fresh actual phase-specific permit and GO authorization are required later. The second phase binds the real proposal; the experiment never considers the first permit an approval of unknown future content.

Assignment binding: the planner matches the immutable admitted task/run and configured profile; each child is matched against bounded owner public progression + goal-delivery projections and its actual executionIdentity. The private parent host alone performs these reads and returns a slot over a finite local IPC request; SDK input receives no owner credential. The original context.assertOwnership fence runs before/after that observation and before SDK entry. Child slot order is the owner-confirmed dependency order, never claim order. Public dependenciesReady reflects semantic acceptance and is not reused as O14 mechanical admission authority.

## 2026-10-06 18:48:40 UTC 实际候选入口

候选 source 提供 `plan(run, mode, permitPath)`、`confirm(run, actualBody)`、`children(run, separatePermitPath)`、`decide(run, independentDecision)`；`rehearse(run)`只组合显式合成查询/确认/接受。实际 CLI 与资源说明见 [实验 README](../../../experiments/continuous-goal-acceptance/README.md)。planner/children共用原SDK adapter与runRunner，原runtime拥有claim/lease/journal/outbox；child身份由parent公开progression/delivery只读查询绑定本次不可变assignment，owner token不发往worker。

决定的实际current/history/接受结果先耐久保存，再允许normal DROP/rm；纯故障注入2例已证checkpoint失败仍关闭center并保留资源。所有暂停阶段关闭owned进程组与center，保留随机marker DB和dev/ino目录供有限人工审阅；未知不自动重新创建run或消费新槽。三个query槽只是候选，真实预算仍未授权。

19不同纯/有限MCP检查、driver模块装配通过；不是类型全集、PG旅程或真实模型结论。首合同测试误把既有configured-readonly写为readonly导致1红，已定向1绿；源码身份首次将workspace依赖误当installedVersion导致装配1红，已绑定固定BASE package version后0，均保原输出。

## 2026-10-06 18:58:35 UTC operator 边界补充

实际PG候选改为 `operator.mjs --rehearse`，不再把node:test timeout当总墙钟。独立监督固定120s工作/30s清理、已登记driver及两phase进程组；stdout/stderr和本轮stage evidence合计2MiB。runtime与raw/余量采用同一测量函数，DROP/rm之前再复核，STOP或unknown禁止删除。3个自有Node stand-in例涵盖非零退出、忽略TERM后的有限KILL/组消失、raw超界保留；两轮重复只计3不同，没有PG/provider。当前operator只支持零query候选；真实分阶段operator和实际新许可仍后继待审，当前native函数不等于获准可跑。

## 2026-10-06 19:07:03 UTC 独立 parent 总时限

operator 在 test 启动前建立独立 Node watchdog；其150s计时不依赖父事件循环、persist或fsync。末1s前停止父PID及已登记的最多三个组，再尝试unknown/STOP checkpoint；写入未完成也按固定deadline退出。原始durable unknown reservation是未确认最终写入时的保留依据。complete ACK不能提前解除时限，须实际parent断连退出且登记组已消失。没有DB/tmp删除接口；signal仅记录sent/absent/unknown，不伪称完整停止。三个新纯owned-process用例覆盖pending persist、完成ACK后同步阻塞、正常退出；此前22不同未重跑，累计25不同。PG/真实模型仍NOT_RUN。

## O16-06 分阶段后继（2026-10-07）

当前实现见[native-stages/README](native-stages/README.md)：阶段exclusive reservation、15分钟pause绑定/单次consume、checkpoint先于收尾、首错与cleanup分开、仅实验persistSession:false。原统一监督器和产品base f5a保持。真实native登录来源/其它SDK写入未定，所有真实native入口先拒绝，不产生许可；真实PG/模型与长期恢复未验。此前零模型main结论及原FAIL/KEEP不追溯改变。
