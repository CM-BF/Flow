# FLOW-001 / O01-M02 candidate: complete input proposal and one owner confirmation

Read-only design, 2026-10-06. Based on O14 b8081a8fba7468337f668670a67206005bc0a73f and existing O05/O01/K03 ports; no new take, migration reservation, product write, tests, provider or personal-service action. O15 is a candidate ID to fresh-check with Lead. O14 remains frozen pending main receipt.

## Smallest user journey

Use the existing persisted graph proposal as the only planning artifact. Extend its input with an optional explicitly versioned `inputProposal: { protocol: "flow.goal-input-proposal.v1", nodes: [{ key, input: GoalInput }] }`. Every proposed addition must have exactly one matching input key; no missing, foreign or duplicate keys. Limit remains O05's16 additions/128 edges/64KiB for the WHOLE proposal. `GoalInput` is reused: actual goal, constraints, acceptance, mechanical verification rule, and <=4 exact knowledge citations (project/source/version/digest/byte locator). Titles remain display labels. Missing inputProposal preserves the original graph-only format/digest/behavior. Old proposals cannot be execution-confirmed.

The existing goalGraphCommand `propose` and two-tool SDK port already consume goalGraphProposalInputSchema, but the schema extension MUST NOT enlarge an old grant. Add one owner-only optional scope field `inputProposalProtocol: "flow.goal-input-proposal.v1"` to GoalGraphScope/admission. It has NO default, so absent legacy scope/canonical/hash stay absent and unchanged. The store persists only this explicit owner-admitted field and returns it through the existing host grant. No model command argument can set or widen grant scope. The center checks this finite capability inside current withRunnerAuthority, BEFORE commandInTransaction/replay, whenever command.proposal.inputProposal is present; a legacy/revoked/wrong-attempt grant rejects it with no proposal/audit mutation, even under a previously seen idempotency key. SDK exposes the same two tools; its host-bound scope can also reject the new payload locally, while the center remains authoritative against a direct HTTP caller. A new expressly granted planning run can propose complete inputs with maxApplications=0; it cannot call the owner confirmation route. No new tool, loop, actor kind or command kind. Its existing source contains run/runner/task/attempt identity, assigned by center authority rather than JSON supplied by the model. Read-only graph/source access stays exactly as granted; the planner can only cite material refs already provided to it, with center validation at confirmation. No new arbitrary knowledge read capability.

Existing proposal list stays text-free; existing explicit detail carries the bounded inputProposal. Owner previews the saved digest, full inputs, exact material refs and existing profile constraints. One new owner-only POST /api/goal-graph-proposals/:id/confirm-inputs with stable Idempotency-Key names proposalDigest, expectedProjectRevision, exact per-key executionProfile refs and external accepted dependency bindings, maxAdmissions, absolute expiresAt, fixed O14 intermediatePolicy and reason. Profiles, budget and execution authority are OWNER confirmation fields, never planner-provided authority. The body is finite and bounded; the response is a small immutable confirmation receipt plus the created O14 progression reference/snapshot, not all input bodies.

## Atomic composition, one authority per concern

New goal-plan-confirmation module owns only the immutable association between one saved proposal, an owner confirmation body and one O14 progression. It has no scheduler, runner state, validity engine, knowledge resolver or mutable proposal FSM.

Within existing commandInTransaction: lock project, then graph proposal, then confirmation row/unique proposal key. Validate immutable proposal identity/digest, then let commandInTransaction recover an existing same-key/body response before LIVE revision checks. Current revision, input/profile/expiry checks belong only inside the new-command mutation branch, so our own committed apply cannot prevent ACK recovery. The replay branch returns the original receipt rather than reapplying mutations or inventing a new key. Inside that branch, a prior confirmation of this proposal returns its identical immutable receipt for the identical body before live CAS; a different profile/budget/body conflicts, even with a new request key.

1. Reuse O05 applyProposalInTransaction(client,...) for an unapplied graph. If it already has an application, reuse ONLY that exact recorded nodeIds/fromRevision/toRevision and require current project revision still equals toRevision. Never silently rebase or repair a graph. Owner's expectedProjectRevision is checked against the currently reviewed base/apply revision; private O05 call uses the original saved base/digest.
2. Resolve each proposed key through the saved application mapping, require expected input version0 for first materialization, and call O01 applyGoalCommand with define-input for each full GoalInput. Reload authoritative state between nodes as needed. K03 freezeGoalContext validates exact material identity and resolves/fixes its content in this same transaction; no copied freezing algorithm. Existing inputs/active authorization/obsolete knowledge fail the whole confirmation, leaving graph/inputs/grant unchanged.
3. Reload final graph/input facts and derive O14 nodeVersion/inputVersion/projectRevision from those persisted facts. Use owner-confirmed profile refs/external dependencies and explicit budget/expiry, then call extracted authorizeProgressionInTransaction(client,goalId,manifest). This is a behavior-preserving extraction from O14 store.ts; existing authorizeProgression pool+key method still owns its original command wrapper and response. No nested transaction or internal HTTP calls.
4. Save an immutable unique proposal->confirmation digest->progression receipt in a small new table, all in the same transaction. A duplicate or failed link rolls back graph application, definitions, context freezing and progression. No tasks are admitted by confirmation itself: existing O14 scan owns all admissions after commit.

Only the original O14 progression gate governs waiting/unknown/failure/revoke/expiry. Owner semantic acceptance stays separate. Once an A->B run produces outputs, editing B's actual input with the EXISTING define-input API makes old B inputCurrent/deliveryCurrent false, while exact input/history/artifact remain readable via existing public detail. The old grant must never adopt the new input or launch it automatically. A replacement grant/input needs a NEW explicit owner decision, preserving unsettled predecessor checks. A new batch revision feature is not needed in this first slice.

## Candidate exact product literals (16) plus own records (2)

1. packages/contracts/src/goal-graph-proposals.ts
2. packages/contracts/src/goal-plan-confirmation.ts
3. packages/contracts/src/goal-graph-runs.ts
4. apps/server/src/goal-plan-confirmation/index.ts
5. apps/server/src/goal-plan-confirmation/store.ts
6. apps/server/src/goal-plan-confirmation/confirmation.test.ts
7. apps/server/src/goal-plan-confirmation/fixture.ts
8. apps/server/src/goal-progression/store.ts
9. apps/server/src/goal-progression/progression.test.ts
10. apps/server/src/goal-graph-proposals/proposals.test.ts
11. apps/server/src/goal-graph-runs/store.ts
12. apps/server/src/goal-graph-runs/runner.ts
13. apps/server/src/goal-graph-runs/runs.test.ts
14. apps/runner/src/goal-graph-tools/mcp.ts
15. apps/runner/src/goal-graph-tools/mcp.test.ts
16. packages/storage/migrations/031-goal-plan-confirmations.sql (CANDIDATE ONLY; fresh number reservation required)
17. plans/o15-goal-input-confirmation
18. docs/evidence/o15

Proposed WT Flow-worktrees/goal-input-confirmation, branch codex/goal-input-confirmation, base to be the exact accepted O14 main; never take before O14 releases overlapping store/test. F01 separately owns contract exports, thin owner client and createServer migrate/register. Intended ports: migrateGoalPlanConfirmations(pool) and registerGoalPlanConfirmationRoutes(app,pool,boss); boss is passed only because the reused applyGoalCommand signature takes it, and confirmation only invokes define-input, never task execution. No changes proposed to O01 commands/state, K03, shared runner-project-fence authority, runtime, lease, outbox, existing pump or scan timer. graph-run store/runner narrow scope covers the new explicit capability persistence/check only; old admission bodies remain byte-canonical. The existing goal-graph-tools/bind.ts reads and parses this stored scope and remains a protected direct caller unless an actual need for a narrow amendment is found. If an actual narrow compiler seam appears, request exact amend before touching it.

## Bounded zero-model acceptance

One exclusive marked random PG DB, dynamic HTTP ports and existing resource gate >=1GiB+96MiB before start, estimated DB increment<=96MiB; no install/build/matrix repetition. Public flow uses the existing real SDK tool wrapper with injected query to create a TWO-node complete proposal (evidence explicitly calls it injected, not successful model planning). One owner confirmation freezes full inputs/materials and creates exactly one grant; production O14 lifecycle admits A then B after the client disconnects. Prompt capture demonstrates distinct actual inputs and fixed material content, never just node titles. Mechanical outputs remain unaccepted until an independent owner act.

Targeted variants: old grant/new payload rejection before replay, old no-field JSON/hash unchanged, forged model-supplied capability, explicit new grant allowed with the same current authority and two SDK tools; missing/duplicate inputs or forged/cross-project/obsolete material; stale graph/application; revoked/wrong-purpose profile; active grant; finite byte/node/expiry/budget limits; transaction failure at final confirmation-link insert; lost ACK and restart with same key/body (no duplicate inputs/grants/tasks); alternate-key changed confirmation body rejected; pending/unknown/failure does not restart work. After success, an EXISTING explicit OWNER define-input command changes B to input v2 (not a model autonomously revising the plan), assert prior B history and artifact digest/body remain readable but not current, and no third task appears without new owner authority. Original graph-only proposal tests and one affected O14 authorization consumer remain unchanged; only select direct cases. No new provider budget, actual model outcome, OS cancellation or semantic acceptance claim.

Tradeoff: this intentionally composes the existing graph proposal and atomic mutation ports rather than adding another planning artifact hierarchy or expanding every existing command. It covers new proposed nodes first; bulk edits to already-defined nodes stay a later explicit requirement.
