# O16 continuous goal acceptance consumer

Original FLOW-001 / O01 / M02. The production implementation is unchanged at fixed base
`8bd02cc3b9ec7afe5fec461e4d8ee05798e5d974`. This experiment consumes O13 intake,
O07 native graph tools, O15 owner input confirmation, O14 production progression,
O09 readonly Claude children, K03 fixed material, and O12 public observation/acceptance.

Current state: implementation, **no O16 native query and no PG run yet**. Native permits
are not granted. The historical O08/O10 permits are sealed and cannot be reused.

## Finite stages

All commands run in this worktree with the fixed Node24 executable and `--import tsx`.
The driver only accepts a bounded run label; evidence lives in `docs/evidence/o16/runs`.
No command defaults to native execution. Each PG stage also requires a Lead resource window. Current operator is zero-query-only; the native stage functions are preparation interfaces and need a separately reviewed real-phase operator window before use. Direct driver cleanup fails closed without the operator reservation.

```
FLOW_O16_PG_WINDOW=approved-one-shot node --import tsx experiments/continuous-goal-acceptance/operator.mjs --rehearse
node --import tsx experiments/continuous-goal-acceptance/driver.mjs plan RUN PLAN_PERMIT.json
node --import tsx experiments/continuous-goal-acceptance/driver.mjs confirm RUN OWNER_CONFIRMATION.json
node --import tsx experiments/continuous-goal-acceptance/driver.mjs children RUN CHILDREN_PERMIT.json
node --import tsx experiments/continuous-goal-acceptance/driver.mjs decide RUN INDEPENDENT_DECISION.json
```

`operator --rehearse` first writes a synced exclusive source/resource reservation, then supervises one test process independently: 120s work, 30s bounded group cleanup. It sums stdout, stderr, and this run's stage evidence; both DROP and directory removal recheck the shared 2MiB raw / 8MiB runtime / 1GiB free policy. A budget or process uncertainty leaves a STOP record and preserves resources. Both phase PGIDs remain in the durable resource file. The internal `rehearse` uses an explicitly synthetic proposal/query stream and synthetic acceptance.
It exercises the same public center and original runner, and is never model planning evidence.
Its phases stop their owned process groups and close the center between stages.

Before starting the test, the operator launches a separate watchdog process. From that launch,
it has a fixed 150s deadline, with the last 1s reserved for an unknown checkpoint. The watchdog
can stop the operator itself and the explicitly registered driver/phase groups even if the
operator is stuck in report persistence, synchronous fsync, or its final resource measurement.
It signals before attempting final I/O and exits at the deadline even if that I/O stays pending.
The initial durable unknown reservation remains the fallback when a final checkpoint cannot be
confirmed. A completion ACK does not disarm it: normal parent exit releases it. It never removes
DBs or runtime directories. Unregistered or escaped processes remain outside the observation
claim; a signal is not proof of full stopping, and the watchdog reports unknown-retain.

`plan` first durably reserves the fresh phase permit; then a real query may propose at most
two actual inputs with one dependency. It has no graph-apply or child-execution permission.
The resulting proposal and a clearly unapproved confirmation draft are saved. Worker and
center stop before waiting for the owner. A private marked DB and dev/ino-bound directory
remain for the bounded review window; do not move them or create a replacement run.

`confirm` is an explicit operator action using the existing strict public confirmation DTO.
It verifies exact proposal, profiles, material citation, two inputs, and finite admission.
The stable key/body is persisted before HTTP. Retrying this stage must use that same body;
current center authority is checked before idempotent recovery. Scanning is off here and no
worker starts. The actual confirmation identity is the input to a *separate* children permit.

`children` reserves that permit, restarts the existing automatic production scan, and starts
one owned runner. The original runtime owns claim/lease/journal/outbox. The parent holds owner
credentials and supplies only bounded public progression/delivery observations over local IPC;
the SDK worker only has its runner token and immutable real assignment identity. An entry slot
is durably consumed before calling query. Unknown outcomes never permit a fresh retry.

`decide` receives `{actor, decision:"accept"|"reject", reason, artifacts:[exact bindings]}`
from an independent operator. The actor field is an operator handoff, not proof of identity or
semantic correctness. The driver cannot infer acceptance from verification, SDK success, or
its own text checks. Native mode never auto-accepts. Rejection is recorded in experiment evidence;
there is no existing product command that persists a rejection reason. Successful explicit
acceptance uses O12's normal durable command path in dependency order.

## Bounds and limitations

- Candidate native ceilings: planner 1 SDK query / 4 turns / $0.20 request / 90s; children 2
  SDK queries / 3 turns and $0.10 each / 60s each. SDK entry count and reported estimated cost
  are not a billing cap or count of provider HTTP calls. Auxiliary model usage remains visible.
- `dontAsk`, requested tool lists, managed plugin names, and SDK init observations are not an
  OS sandbox or proof that advertised capabilities were unavailable. Host decisions and actual
  paired Read results / center-audited graph effects are recorded separately.
- Worker groups are independently checked after TERM/KILL; the direct child exit alone is
  insufficient. A process escaping its group is outside this experiment's observation claim.
- Native errors after entry preserve `unknown` in the original runtime; query close is not a
  settlement receipt. A killed phase cannot automatically start another writer or query.
- Readiness requires fixed source bindings and installed dependency versions. No SDK startup,
  authentication, package install, or model query is part of source-only preflight.
- Random DB allocation is preceded by a synced exclusive reservation. Cleanup requires marker,
  directory identity, stopped workers, bounded zero-connections observation, and checkpoint before
  normal DROP/remove. Any unknown retains resources; no FORCE cleanup is implemented.
- The fixed resource entry gate is 1GiB + 128MiB. Actual native scratch/WAL estimates still need
  review before any real-phase permission. No personal ports/services are touched.
- O12 cannot issue confirm-inputs or a rejection command. This consumer calls the existing public
  confirmation method directly. Unknown intake/planner/acceptance evidence is retained, not
  repaired by inventing requests; extra recovery UX remains outside this experiment.

## 分阶段暂停准备

O16-06 接口及实际分轮验证见[单一阶段说明](../../docs/evidence/o16/native-stages/README.md)。operator沿原watchdog提供有限phase入口；pause绑定实际提案/配置/源码/资源关闭，期限后只拒绝继续，不自动清理。当前native登录/其它SDK写入输入未固定，入口明确拒绝，不能以命令存在当模型许可。原已消费run不复用，旧raw/失败保留。
