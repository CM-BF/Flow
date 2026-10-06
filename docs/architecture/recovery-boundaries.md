# M1 recovery boundaries

The center owns durable task state. A client connection is only an observer. These are separate guarantees:

| Event | Current behavior | What remains unproved or unsupported |
| --- | --- | --- |
| Web/CLI observation ends | No cancellation is sent; another client can inspect the same task | Product browser journey remains pending W01 integration |
| Center restarts before a runner claims accepted work | PostgreSQL submission and wake-up survive; queued work becomes eligible again | Hard database loss/restore and host power loss are not tested |
| Center disappears during an active attempt | Runner stops new actions and interrupts the adapter conservatively; missing lease becomes uncertain | No transparent continuation of an active adapter is promised |
| Runner stops or is revoked | Unfinished task becomes uncertain and is never silently reassigned | Already running tools can have effects; lease expiration does not undo them |
| A known native session is resumed | Routed to its original runner, excluding concurrent session use | Actual native behavior is verified in R02; no cross-machine recovery guarantee |

## When a task is uncertain

1. Use `pnpm cli show TASK_ID --json` and `events TASK_ID --after CURSOR` to record task/attempt/runner IDs and the last durable state. Expand relevant references with `detail REFERENCE_ID`.
2. On the actual runner host, confirm that the process has stopped and inspect that attempt's retained local artifacts and `uncertain-events.json` if present. Check the real external target for any effects before deciding whether work could safely be repeated. Do not infer the absence of effects from a missing final event.
3. Preserve the evidence. M1 currently has no operator reconciliation command to release the attempt/session reservation or force a replay. Do not edit database rows to manufacture a successful or resumable state. A future audited reconciliation Interface must distinguish confirming effects, confirming stop, releasing occupancy and explicitly authorized recovery.

The center keeps the occupied capacity/session reservation for uncertain work. This is a deliberate safety limit and can reduce available runner capacity. Cancelling an already uncertain task does not prove the process stopped and does not free that reservation. `cancel_requested`, actual `cancelled`, execution `succeeded` and verification `passed` are separate facts.

## Evidence scope

Current deterministic integration checks are in [I01](../evidence/i01/README.md). Two independent runner processes and CLI processes have been exercised against real local PostgreSQL. Fixture success is not a real model result; estimates are not provider billing, and missing usage stays unknown. Remote runners need HTTPS termination and separately provisioned credentials; remote deployment is not covered by local tests.
