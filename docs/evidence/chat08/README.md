# CHAT08 native active steering — 0 provider delivery

Review target: `d4e7445fca4fbc261cbf33101fca4d9407879315`. Product implementation: `f78a15c69f3f365a37c9f317249858d8e279503d`. The final target adds only a fixture setup compatibility change. Base: `42c1cc85cfbf9fa3ca3fdcbee57dc02394bff6d7`. Author/sole writer: runner_owner / gpt-6-astra. No independent approval is asserted by this evidence.

A single existing Claude query can now receive additional, durable instructions through an async input source. The runtime opt-in is `runRunner({ activeSteering: true, ... })`; the default is unchanged. The pending command is acknowledged through the normal durable event outbox before its UUID is inserted once into native input. A root assistant/partial/result echo records observed consumption; only a successful result's UUID coverage can make a final candidate eligible. Neither receipt means that the model obeyed the instruction.

Intermediate successful results publish usage and bounded result metadata, not artifacts or canonical finals. The latest successful result must explicitly report `queued_turn_count: 0`, cover every non-rejected command across successful results, and have no host input backlog or unresolved command. Missing pending information remains unknown. Both center and host bound the attempt to 65 distinct result observations; repeated identical result IDs do not consume the bound. Command admission is bounded to 64. These are separate host evidence limits, not an interpretation of SDK `maxTurns`.

The runtime freezes ordinary sequence allocation, flushes the existing durable prefix, and persists one conditional proposal. The center locks the existing runner/task/attempt authority and performs revision/sequence checks, final sealing, actual artifact/verifier/final application, stream settlement, and successful proposal receipt in one transaction. A command that wins the race returns a definitive `not-committed`; the same query can consume it. The three events use the saved local artifact and existing `verifyText`, and the center independently verifies their exact rule/digest. No second verifier or event loop was introduced. Migration 024, immutable steering audit and existing `flow.commands` are sufficient; reserved 025 is unused.

An unknown transport result is never turned into a rejection. The exact local proposal stays in `pending-final-proposal.json`; the host only queries that proposal's current-authorized receipt, with the exact lookup DTO. This implementation does not automatically resubmit a proposal or native input. An `absent` receipt cannot clear the uncertainty. Restart can confirm and archive the final proposal but cannot synthesize SDK shutdown or a runtime completion. Until a proposal is confirmed, the retained record blocks new claims from that runner; operator disposition/garbage collection of permanently unconfirmable records remains a later operational slice. A process crash after commit and before `completed` leaves ordinary attempt reconciliation necessary.

The one query's timeout and SDK budget options are not reset between results. `modelUsage` samples use a per-model predecessor sample ID; repeated result IDs do not emit a second accounting sample. Resume still starts with an unknown inherited baseline; a decreasing counter stays incomplete. The SDK's configured `maxTurns` is passed once; no real provider limit/price behavior was measured. No `priority` semantics or public `interrupt()` queue-clearing behavior is assumed. Steering adds input to the active query; it does not promise immediate preemption of the current model turn.

## Actual checks and counting

| Raw evidence | Actual outcome | Meaning |
| --- | --- | --- |
| `finalization-red.txt` | 1 failing behavior | New `steering-result` was not handled yet; real owned PG/HTTP red. |
| `first-green-attempt.txt` | 12/12 | First center/outbox slice. |
| `vertical-initial.txt` | 20/20 | Adds real runtime → injected SDK → HTTP → PG, cancellation, bounded results. |
| `adapter-first.txt` | 34/34 | Adapter and pure state cases; overlaps other runs. |
| `checks-full-first.txt` | 104/104 | Direct domain/runtime/adapter/stream consumers. |
| `checks-final.txt` | 105/105 in 9.80s | After root/child filtering and decision-pause/queued-poll checks. |
| `proposal-lookup-red.txt` | 1 failing, 12 unselected | Exact HTTP lookup discovered a structural superset DTO bug during final self-check. |
| `proposal-fix-final.txt` | 7/7, 37 unselected | New strict HTTP lost-ACK/restart case + 6 affected journal/runtime regressions. |
| `factory-fixture-final.txt` | 13/13 | Final test-only `activeSteering:true`/`hasRoute` setup delta; preserves all domain assertions. |
| `typecheck-initial.txt`, `typecheck-second.txt` | exit 2 | SDK UUID template typing, then a test-only cross-package SDK type import; corrected. |
| `typecheck-third.txt`, `typecheck-final.txt`, `typecheck-delivery.txt`, `typecheck-fixture.txt` | exit 0 | The last file is the final target's typecheck. |
| `cleanup.txt`, `cleanup-final.txt` | owned test DB count 0 | Read-only confirmation after random `flow_chat08_` DB lifecycles. |

There are **106 distinct passing behaviors**, not 105+7+13 independent behaviors. The new strict-lookup case adds one to the 105; the remaining checks are repeated direct consumers. Final group sizes: center 13 + existing steering 16 + runtime 27 + adapter 31 + outbox 4 + pure state 4 + existing stream 11 = 106. The selected 7-case run does not claim to have executed its 37 unselected cases.

The final fixture handles the present module-level registration and the future explicitly configured production factory without duplicate routes. The production shared factory is owned by F01; its actual mounted branch is a separate integration check, not claimed by this branch's fallback run. Shared client input `3d81141324041c2c67680edbb686996cefaf8b4b` was approved separately and cherry-picked here as `005e042`; its consumer methods have no hidden semantic retry.

## Reproduction

Use Node 24 and the repository's existing local test PostgreSQL fixture at port 55432. Tests create and drop their own random databases and bind dynamic HTTP ports. They never connect to the personal preview database, start a provider query, or read actual provider credentials.

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/active-steering apps/runner/src/active-steering apps/runner/src/outbox.test.ts apps/runner/src/claude.test.ts apps/runner/src/runner.test.ts apps/runner/src/assistant-stream/stream.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

The exact selected recovery check was:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/active-steering/finalization.test.ts apps/runner/src/outbox.test.ts apps/runner/src/runner.test.ts -t 'strict HTTP lookup|durable prefix, freezes|definitive conflict|lost response confirms|absence after timeout|continues heartbeats|retains an uncertain final'
```

## Limits and next acceptance

- Public conversation capability remains false. No production server mount, main startup configuration, Web affordance or personal service was changed by this slice. Main integration is a separate receipt.
- All SDK messages are injected at the real adapter seam. This is not a real provider, native subprocess, model compliance, first-token latency, fee, capacity or UI acceptance result.
- A confirmed final closes the host input source and calls SDK close/abort before the existing runtime emits completion. The tests observe that call ordering and cancellation of blocked input; they do not prove a real provider process has exited.
- Legacy attempts without steering control preserve the old final path. A new steering-aware attempt cannot bypass the conditional endpoint with an ordinary final event. New commands are refused once a canonical final exists.
- A waiting tool decision pauses mailbox delivery without resetting the query deadline. Delivered but unconfirmed commands become unknown on actual runtime completion/cancellation; unknown is never automatically sent again.
- Final content is constrained by the existing 1 MiB detail limit **and** the 2 MiB combined final-batch envelope. Existing stream truncation/settlement limits, native activity bounds, and local process-crash rather than power-loss durability limits remain.
- No automatic active-attempt/native-session resumption, unknown-record repair, extra provider loop, queue/steer UI enablement, hot configuration, new tools, permission expansion, or generic scheduler was added.
