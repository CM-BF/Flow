# S01P08 — READY for controlled main intake

Recorded 2026-10-07T06:58:13.419Z. Independent approval: **SOURCE_AND_LOCAL_RESULT_REVIEW_APPROVED**, db_transaction_owner / gpt-6-astra, 2026-10-07T06:52:59Z; 0 P1/P2. [Formal receipt](review-receipt.json). This is branch delivery, **NOT_INTEGRATED**.

## Exact intake

Base `311e62158186177e344b49d24ed32e335268be1d`; approved source `e3d28f96b971256abd155904b4cbd333bbdc57ad`; reviewed packet `b3d8327e4945d2465ab704bdf25ec7ff41a86371`. Final metadata commit is the Git HEAD containing this READY. Authority is this worktree/branch; do not copy older status from another tree.

| Repo-relative source | Approved SHA256 | Intake |
| --- | --- | --- |
| apps/runner/src/native-harness/codex/adapter.ts | 3f22af96739e4485b320b8fb699f053dab35d2799e85672a8ff830d2bf3f6b67 | One check moves inside first-session branch; apply this narrow delta against current main, preserve unrelated accepted changes |
| apps/runner/src/native-stream-ownership.test.ts | 01d18d01b636fc72bb4bda7c2b4a202a080e79fb94c59aa9f222b308ffffb6de | New direct composition/guard test |

Adapter before/after Git blobs: `4872d541c30cab0982a59fe2517e204ccb20eaf6` → `097cf41141b96f55442e925d9740e90b5138090e`. No root/package configuration, control, server, shared index or other-owner stream test is part of the product delta. A conflict/new semantic edit returns to the owner; do not replace a newer adapter wholesale.

Evidence and own plan/status/review may be received from this final metadata commit. [optimization-review.json](optimization-review.json) remains immutable, SHA256 `95e973c3d5b6d4105669fdaf4f7b0f213a8c9d69f7d722db1be358d155d791a0`, 21 bindings/85537B to approved source. [README](README.md), local/config/raw and old manifests stay original fixed-Git evidence; its historical “pending review” reflects packet preparation, superseded by this receipt without rewriting those bindings.

## Direct consumers and evidence

The new 11-case test directly composes `createCodexAdapter` with `AttemptControl`, `FlowClient.heartbeat` mocked at its existing method, and an injected `CodexTransport`; it reaches existing turn/exchange/stream code. Its focused strict closure is recorded in [tsconfig.json](tsconfig.json) and [source-closure.json](source-closure.json). C02-owned `stream.test.ts` and ordinary/engineering public behavior are not modified. At integration, check current-main drift in these direct imports; only new drift warrants affected checks under Lead's normal local rules. Do not rerun historical S01 85/8/4 or the old A/B fixture for this metadata intake.

Final 11/11 + strict0; historical baseline7/7 and strict exit2→0 preserved. Same32768B text/5patches/9events under32 and512 fragments, mock heartbeat calls15→11. No real latency/SQL/HTTP/native/provider/capacity claim. Six child/raw records remain in [local.json](local.json); raw4481B, all final process/EOF/TMP cleanup confirmed with historical unknown observations retained. External whole-segment wall UNKNOWN.

## Ownership and registration

Claim `1e4868a6-a900-463a-9de3-0a4234179733` v2 ACTIVE, four literals; fresh same-owner receipt checked before this metadata update. Product writes stopped; keep claim through main acceptance/fix period. No active runtime or pending launch. Dashboard **PENDING_REGISTRATION / PENDING_SYNC**: Execution Lead must register `plans/s01p08-native-stream-ownership/status.md` from this WT/branch and read actual Git HEAD/dirty. No public Interface, connection, timer or lifecycle change requires a new architecture drawing; main acceptance remains to be recorded. Original S01 A/B READY is independent and unchanged.
