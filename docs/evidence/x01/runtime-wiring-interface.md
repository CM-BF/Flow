# X01 explicit production wiring slice

Fixed source: `2ea5adfedfe0187a49cde13c769823be753a1496`. The prior runtime/domain Interface remains `runtime-public-interface.md` (9b639f79, independently approved 08:43:58 UTC).

| Owner | Interface and invariant |
| --- | --- |
| FlowClient | One readonly `pluginRunner` domain binds the existing private request. Bearer or current browser CSRF, FlowApiError, abort/deadline and bounded ACK remain owned by this client. No second fetch transport or fallback decoder. |
| runRunner | Optional trusted `pluginExecution.store` selects the real FlowClient domain by default. The already reviewed explicit transport seam remains injectable. V3 request/journal, phase ACK uncertainty, attempt/outbox and restart behavior are unchanged. |
| createServer | Optional operator `pluginRuntimeHostPolicy` mounts the existing routes. Absent policy leaves admission/publication/phase routes unmounted. Runner credentials alone do not authorize a tuple; the existing synchronous exact trusted policy remains inside publication. |
| retryReconciled | Under the existing task/attempt lock, a frozen binding rejects generic retry with HTTP 409 `plugin_recovery_requires_binding`. It does not create a replacement fixture task, audit row or wake. Ordinary tasks continue into the prior resolution fence. |

Generic retry creates a new task and changes its prompt; copying an old binding would violate task/input and phase ownership. This slice only prevents silent downgrade. Complete recovery is OPEN: existing invocation results/outbox may be reconciled without re-execution; unknown ACK or confirmed invocation without results must not generate another key. Explicit remaining-work recovery must preserve exact material/config/target/store, recheck current grants and audit any version/input change. No new recovery API or second state machine is introduced here.

## Source baselines and direct consumers

Client index starts from LAZY approved `2949569bcac7d3b0257a0026f488f42eb6276222` after STOP/amend handback; X01 adds one import and one readonly domain. Runtime starts from approved9b639f79. Server index/reconciliation use fixed main `b7687ff3b33d538e2b41e05ec849f670d9b9d8bb`; P02 body and Codex remain. Contract support uses main with the previously approved optional pluginSource addition, and exact LAZY assistant-stream DTO from294. The source-only 98-file mirror is verification input, never a product overlay.

No new schema or migration: retry reads existing034 `plugin_tool_bindings`; createServer already migrates034. The full server factory closure was not compiled or executed in this local segment. Focused compiler covers the three selected test entries and their98-file closure. The small mount diff is a static review target; its actual authenticated HTTP/PG behavior remains a following acceptance step.

Six distinct local cases: three actual FlowClient domain authentication/abort/size consumers, one store-only runtime dispatch, two generic retry fences. Final user-facing error wording ran only the two recovery cases again. Prior11/19/9/3/5PG checks were not repeated. Fetch/SQL/package-host injection does not demonstrate real HTTP, npm execution or complete recovery. Startup/CLI trusted configuration remains open.

Architecture baseline owner after controlled main intake: Execution Lead; branch changes remain pending review and are not published as the current main architecture. Apply only the narrow delta to shared entries, retaining LAZY/P02/Codex.
