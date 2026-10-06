# O13 Interface — continuous goal journey

Fixed base: 2f16e30a7e4dbeb7d4bc28e03284835764ef19a0. Interface-only first slice; implementation and checks pending.

## Center light read (F01 client input)

`GET /api/goals/:id/graph-runs?after=<opaque>&limit=<1..20>` returns `GoalGraphRunPage` from `packages/contracts/src/goal-graph-runs.ts`.

F01 method: `goalGraphRuns(goalId: string, options: { after?: string; limit?: number } = {}, signal?: AbortSignal): Promise<GoalGraphRunPage>`. Standard owner authorization; existing registerGoalGraphRunRoutes mounts it, so no new factory registration. The opaque cursor is goal-bound, newest-created-first with id tie-breaker. Each page verifies the goal and returns only runs belonging to it and their exact task summaries in one consistent read. It contains no prompt, graph proposal body, artifact body, grant authority, or credentials. It is a live read, not a frozen timeline or proof of completion. Unknown goal is 404; malformed/cross-goal cursor is 400; no automatic retry or state mutation. Default 10, maximum 20.

## Client Module and lifecycle

Natural-language entry captures the exact `GoalCreation` (selected project, originalGoal, constraints, acceptance) and stable command key in a host-owned durable atomic store before `createGoal`. A bounded, connection/entry-specific record retains the accepted goalId; after lost ACK recovery sends only the original key/body. Changed input cannot replace unresolved work. A returned goal is checked against all original input fields before binding. This bootstrap has no planner or task scheduler. After binding, the existing GoalSession owns observation and one pending action.

GoalSession retains legacy GoalIntent version 1 and existing goal/project/decision/cancel actions. New explicit `graph-plan` and `native-execute` actions dispatch through the same persistence, receipt validation and unknown/recover path. Graph planning requires the finite Claude graph-purpose profile and bounded scope already enforced by O07. Native text execution requires the configured-readonly profile already enforced by O09. Profile presence does not grant model budget. No automatic dispatch follows a read, reconnection, graph application, mechanical pass, or uncertain result.

Planning metadata is a lazy bounded read via `goalGraphRuns`; existing task/detail and proposal reads serve explicit expansion. A model-generated graph title is not an actual child input. The owner selects a node and explicitly freezes its goal, constraints and acceptance with existing define-input, then chooses native-execute. Current task/input/previous execution dependencies remain center-checked. A separate owner actor can accept a fixed delivery or leave it unaccepted; mechanical verification and semantic acceptance remain different facts. Existing O11 explanations/decisions and O12 fixed artifact digest checking are reused.

The host owns atomic local storage and namespace exclusivity. Disconnect aborts observation and in-flight HTTP while preserving uncertain intent; it never cancels a durable task. Old v1 consumers and public contracts keep their behavior. Read concurrency and queues continue through O12 ObservationReads; no second authorization/agent loop or center database entry point is introduced.

## Verification boundary

0query public HTTP + random PostgreSQL + real Claude adapter query injection. Synthetic MCP calls create the graph through O07, then an explicit owner input and O09 child traverse runtime/outbox, fixed artifact and O11/O12 delivery. At most one goal, three nodes and one child in the success journey. This proves composition and identity/error behavior, not actual model planning. A new real planner+child budget and actual UI acceptance remain separate; O08/O10 permits are sealed and unchanged.

Skill methods: installed find-skills discovery selects local codebase-design/clean-code/brainstorming for TypeScript domain, HTTP/PG and durable controller work. Existing relevant local skills suffice; no install or dependency update. Approved bounded design preserves the deep existing GoalSession, with a narrow intake bootstrap and goal-owned light read. Quality review checks naming/responsibility, ownership, error/unknown handling, bounded resources and behavior at the public Interface.
