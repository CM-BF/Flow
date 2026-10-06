# Fixed Codex 0.154.0 semantic consumer

The semantic modules consume already-decoded JSON. They contain no process, JSONL framing, request IDs, timer, retry, network, auth or provider implementation. The separate isolation experiment has its own historical run evidence.

- `discoverModels(peer, limits?)`: caller must await R06 `ready`; peer only needs `request(method, params)`. Complete bounded model catalog or throw, never a partial catalog. No initialize/initialized call here.
- `normalizeModelPage(page)` / `validateRequestedControls(model, selection)`: catalog strings remain catalog choices, not account entitlement. Effort and service tier are separate. Missing fields remain missing; explicit null remains null. Persistent serviceTier null/omission semantics remain unknown.
- `createOrdinaryFinalProjection({threadId,turnId})`: caller binds native IDs from its own accepted thread/turn receipts and routes matching decoded `item/completed` / `turn/completed` notifications from R06 `receive()`. The module does not dispatch arbitrary server notifications or requests. It produces a candidate only after a unique ordinary final item and successful terminal; host authority, permissions and task completion remain R05 responsibilities.

The final projection assumes one continuous observation window: no replay/reconnect/resume acceptance is claimed. It rejects an item after a terminal, changed duplicate evidence and invalid identity; validation failure invalidates the instance. Phase null is unknown; multiple finals, async delivery and interactive questions cannot produce ordinary success. A full terminal view is cross-checked; a summary/notLoaded view is never treated as a complete list. Returned `completed` means the native evidence pair, not Flow task completion.

Bounds are local Flow policy, not inferred native limits: model pages <=16, <=100 models/page and <=1000 total (defaults 4/50/200); decoded page <=1MiB. IDs <=128 UTF8 bytes for final projection; message text <=1MiB; completed evidence <=64 items / 2MiB and one terminal notification <=2MiB. R06's default encoded frame cap is independently 1MiB: JSON escaping/envelope can overflow before content reaches its limit. Do not truncate or infer network transport acceptance from these decoded checks.

Run only the named local tests using Node24:

```sh
/opt/homebrew/opt/node@24/bin/node --test --test-reporter=tap experiments/codex-app-server-conformance/catalog.test.mjs experiments/codex-app-server-conformance/final.test.mjs
```

Fixtures are synthetic. They do not initialize the installed app-server, verify an account or execute a model. The selected immutable schema copies and manifest provenance are in `docs/evidence/wpf-mature-02/`.

## Single production projection owner

`final.mjs` is a relative re-export of `../../apps/runner/src/native-harness/codex/projection.mjs`, brought into this same worktree from reviewed main `4391bbf9f1785212d098ef6aa1c01a0320a003d3`. The production module owns the algorithm; there is no local copy or fallback and no cross-worktree runtime import. The existing final tests still import the public experiment entry, so they directly exercise the production algorithm. Catalogue/discovery modules and both test files are unchanged.

Production projection implementation `6313c885c5c5524faedba9b8c49e4d3e164028d5` preserves the original algorithm bytes. Its AssertionError can contain native IDs/text in actual/expected; production hosts must emit fixed safe reason/code instead of raw errors to logs/detail/UI.

The original `conformance-manifest.json` is historical evidence for fixed `0d0524c3439363d1fe60aad63f62817ba51fa2a5`; it is not a manifest of the new thin entry. Current consumer evidence is separately bound under `docs/evidence/wpf-mature-02/production-import/`.
