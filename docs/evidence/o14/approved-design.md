# O14 bounded successor proposal (read-only; no claim)

Parent FLOW-001 / O01-05 / M02. Proposed worktree `Flow-worktrees/goal-persistent-progression`, branch `codex/goal-persistent-progression`; base must be fixed by Execution Lead after O13 integration. No provider call, budget or personal-service change is authorized by this proposal.

## Small public Interface

Owner authorizes one finite continuation manifest for an existing goal: current project graph revision; selected node IDs + node versions + exact existing actual input versions + previous execution IDs; immutable readonly Claude profile reference per selected node; maximum task admissions no greater than selected node count; explicit intermediate policy `verified-artifact-within-this-authorization`; expiry and reason. At most 20 selected nodes, first validation uses two. An external dependency must already have its exact accepted binding; an internal dependency must be another selected predecessor. Undefined actual inputs, changed knowledge, wrong purpose or revoked pins reject before grant creation. Graph titles never supply input.

`POST /api/goals/:id/progressions` uses existing stable key/body transaction replay. `GET /api/goals/:id/progressions/:progressionId` returns bounded light status, per-node actual task/execution/artifact refs and a causal stop reason, no bodies. `POST .../:progressionId/revoke` stops new admissions only, never claims running work stopped. Existing task decision/cancel/uncertainty reconciliation remain the sole authority. The intake/GoalSession client is not a background driver.

Persistent immutable manifest + unique per-node execution links are the minimum new storage. A goal may have only one unreleased active progression; no implicit restart, rebase or retry under a new key. Each node is admitted at most once under one authorization. Graph/input/previous-execution mismatch, out-of-scope dependencies, expired/revoked grant or unavailable profile stops admission with exact cause. Uncertain/failed/cancelled predecessors never supply dependencies; waiting tasks expose the existing decision reference. Revocation/expiry does not erase lineage of already admitted work.

## Reuse and the necessary semantic seam

`executeGoalNode` continues to construct prompts, exact dependency content, task/queue acceptance and execution/explanation writes in one transaction. The new advance module supplies a trusted, narrowly typed dependency-qualification result under a project lock; public commands cannot provide this result. `requireExecutionProfile(...ordinary)` plus configured-readonly check remains authoritative. Existing runtime/claim/lease/outbox are unchanged.

Today `currentDeliveries().dependencies()` only uses `accepted_binding`. Automatically writing accept-delivery would wrongly turn mechanical verification into owner semantic acceptance. Add a narrow persistent provenance for executions admitted by the continuation: within the exact manifest, a succeeded+passed predecessor with an exact latest artifact may be used as an operational input, while `accepted_binding` remains null until an independent owner chooses acceptance. Extend the existing shared validity recursion to validate these recorded dependencies for those executions only. Legacy manual/native admissions still require existing accepted dependencies. Both full and light goal readers must consume that same provenance so new children are not falsely labeled obsolete. No parallel second validity algorithm or copied artifact body authority.

Completion is `authorized-executions-finished / awaiting-owner-acceptance`, never overall goal acceptance. Allowing the operational input is the explicit authorization policy, not a claim that the upstream output was semantically correct. The owner can inspect exact references in the progression read before accepting or rejecting the final delivery.

There is no goal auto-scanner today: scheduler.ts only wakes queued tasks. Integrate `scanGoalProgressions(pool,boss,limit=20)` into the existing bounded center maintenance/queue-scan lifecycle owned by F01. It resumes after startup and is awaited on shutdown, without creating a second scheduler/timer/agent loop. Candidate rotation is persisted; each advancement locks project, then grant, then task paths consistently with current owner admissions. requirePublishedProfile currently reads the immutable profile plus runner revocation without a runner lock; do not invent a reverse-order runner lock. The unchanged claim-time runner/profile fence remains authoritative if revocation races with admission. One new task at most per selected progression per scan; scan errors do not recreate commands. PgBoss flow-wake remains the only task dispatch mechanism.

## Proposed product literal scope (14)

1. packages/contracts/src/goal-progression.ts
2. apps/server/src/goal-progression/index.ts
3. apps/server/src/goal-progression/store.ts
4. apps/server/src/goal-progression/advance.ts
5. apps/server/src/goal-progression/provenance.ts
6. apps/server/src/goal-progression/progression.test.ts
7. apps/server/src/goal-progression/fixture.ts
8. apps/server/src/goals/commands.ts
9. apps/server/src/goals/state.ts
10. apps/server/src/goal-delivery/metadata.ts
11. apps/server/src/goals/goals.test.ts
12. apps/server/src/goal-delivery/delivery.test.ts
13. apps/server/src/goal-delivery/state.ts
14. packages/storage/migrations/030-goal-progression.sql (candidate only; Lead must reserve after fresh ledger)

Own `plans/o14-goal-progression` + `docs/evidence/o14` would make 16 claims. Shared client/export/server index remain F01; no claim on scheduler.ts, runtime, runner or O13 interaction files. Public GoalIntent v1 can retain current behavior; exposing this new authorizing action in a real UI is a separately claimed direct consumer.

## Bounded validation

Two nodes with pre-existing exact actual inputs; actual HTTP/random PG, same real Claude adapter and injected query transports. Client disconnect after authorization; center admits A then B after actual verified artifact binding; owner acceptance remains absent. Restart before/after committed node admission and lost ACK must retain the exact progression/body and at most two tasks. Concurrent sweeps cannot duplicate tasks. Freeze changes in graph/input/profile/budget, genuine decision, failure and unknown each block with cause. Restart must not clear uncertain cause; no implicit re-run. Existing legacy accepted-dependency and delivery readers receive targeted direct checks, not a full O07/O09/O13 rerun. No synthetic graph is counted as model planning; actual planner+children budget remains independent.

This is a source-read proposal, not product implementation or claim. Exact lock-order and new schema constraints must be reviewed against the chosen fixed baseline before take. Lead confirmed029 is reserved for Mika X01. Candidate030 is not yet reserved here.

## Fixed-source lock/provenance audit

Source read at O13 base2f16 + ddf9 source; no mutable latest-main assumptions. Before implementation the approved O14 base must include the Lead's S01P06 input, and these unchanged/changed seams must be compared explicitly.

- Owner admissions: command replay transaction -> loadState(...,true) -> project FOR UPDATE -> exact previous task lock when present -> acceptTask -> immutable execution link/explanation. requirePublishedProfile is a read, not a runner lock. Existing runner-tool operations take runner then project then task, so the successor must not add a project-then-runner lock. No new runners.ts scope.
- New scan: select/rotate candidate grant IDs in a separate bounded transaction (at most20, SKIP LOCKED), commit that rotation, then lock each project's row before its mutable progression header and current tasks. Never hold the rotation grant lock while waiting on project. Creation/revoke use project -> header as well. It uses the existing maintenance hook and shutdown wait, not a private interval. Fresh profile/revocation checks precede each admission; existing claim-time checks close the post-admission race.
- The new immutable execution link identifies progressionId + goalId + nodeId + executionId. No caller-provided `qualified:true`. `provenance.ts` loads fixed links/manifests by bounded exact execution IDs for the already selected goal; both goals/state executionRows and goal-delivery/metadata read this projection. It must not load another goal or arbitrary history/body. Extra ancestor execution IDs are bounded by the selected manifest (max20); when a required recorded source is absent, validity is false, not guessed.
- Shared validity continues to distinguish current(node) (owner accepted output), dependencies(node) (legacy accepted prerequisites), and isCurrent(execution). Only isCurrent for a linked authorized execution may resolve its stored dependency bindings against the explicitly authorized within-progression predecessor executions. The execution constructor's new internal mode uses that same resolver; ordinary executeGoalNode calls never receive it. Every binding must match goal/node/execution/task/artifact/version/detail and latest verified artifact of its fixed producer, plus current input/knowledge/graph dependencies. Existing manual readers stay unchanged in meaning: `accepted` remains null and `deliveryCurrent` false until an owner acceptance.
- A failed/unknown producer or input/knowledge/dependency change invalidates operational reuse; do not infer settlement from observation or retry under a new grant. Grant expiry/revocation stops new admissions but does not erase the provenance of work already admitted. A newer unrelated project revision stops further automatic admissions under the frozen manifest; it does not retroactively delete old outputs. The explicit progression read explains this halt separately from historical artifact existence.
- The progression read may show `executions-finished/awaiting-acceptance`; goal accepted state remains independent. Any extension needed to represent eligibility must use the shared resolver, not add a second truth table in the scanner.

## Candidate030 storage constraints (not reserved here)

Two new fixed tables suffice: `goal_progressions` (immutable authority manifest/digest and goal/project identity, mutable checkedAt/revokedAt/finishedAt only) and immutable `goal_progression_executions` (unique progression+node and unique execution link). Manifest is finite v1 and <=64KiB, at most20 unique nodes with exact existing input references/profile pins and DAG relationships. JSON cannot grant arbitrary harness/purpose/policy strings. A trigger prevents changes to authority bytes, identity, original limits or creation timestamp; deleting/truncating grants or execution links is forbidden like existing goal history. Revocation is monotonic. One unfinished/unrevoked grant per goal prevents an accidental second driver; new grants cannot bypass existing previousExecutionId/unsettled gates even after revocation. The immutable link insert verifies its existing goal_execution belongs to that same goal/node and the manifest before storing it. No old rows are rewritten or versioned JSON changed.

Admission and link insertion share the same transaction, so crash/unknown ACK leaves either both committed or neither. Re-scan inspects the unique link, never resubmits the node. Failed admission rolls back both task and binding. Counting links gives the hard admission budget; profile-declared SDK budgets remain requested limits, not proof of actual billed cost. Unknown usage remains unknown. Restart reconstructs progression from these facts and task truth; it cannot clear failure/unknown or auto-accept delivery.

Direct-reader scope refinement: include goal-delivery/state.ts as a 14th product path. A linked authorized child may have inputCurrent=true while its predecessors are not owner-accepted; its public reason must not falsely imply that its already recorded operational input is unavailable. Preserve dependenciesReady as legacy manual eligibility and accepted/deliveryCurrent as owner acceptance; use the one validated execution provenance when choosing the reason. No new public status enum or acceptance flag is required.
