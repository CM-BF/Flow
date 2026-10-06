# RELEASE03 minimal immutable-backend rebinding proposal

Read-only against implementation 432b09ae1b552a68cc4720b369e42ed80bc942c9; final old-backend negative-evidence commit 676f677d58230c8d9982cbcddfd72136ab671cfe. No new product import, test, resource query, PG, Chrome, source mutation or runtime took place for this proposal.

The original four writer scopes are sufficient for harness changes and new evidence. They do **not** authorize modifying apps/server or Git-provisioning the new backend. Lead/sole Git owner must provide the exact immutable commit/tree containing backend362 plus only the approved context-transparency/store.ts correction and the provenance receipt. No moving-main merge, reset, file copy, or relaxed source guard by this writer.

## Exact changes after authorized input

- fixture.ts:13 BACKEND and browser.ts:15 BACKEND must both become the same supplied full commit. Keep separate browser constant because its supervisor deliberately imports no business module before admission. Gate.backend must match it (browser.ts:45). Do not parameterize arbitrary source roots or accept an environment-selected backend.
- fixture.ts:37–45 sourceIdentity must retain full protected-path comparison (apps/server, packages/client, packages/contracts, tools/personal-preview, lock) against the new immutable commit, record its actual tree and current execution HEAD, and record the changed store hash. Add the supplied old362→new tuple provenance to evidence; assert that only the approved store path differs in protected production input. This is an input acceptance check, not permission for the harness to patch it.
- All current BACKEND-derived database-owner/history/outcome/report backendHead values update automatically. Artifact descriptor/sourceHead506/releaseId/d629 remain byte-identical. SourceHead must never be relabelled to the backend or9eec.
- Keep checkHistory assertions unchanged (fixture.ts:190–228): both native observations accepted; materials unknown/metadata-unavailable, materialRevisionDigest null, executionInputDigest preserved; actual text/detail remains separately verified. Do not weaken expected history shape to make old362 pass.
- Preserve all ten original run files, hashes and failed outcome. New run gets a new directory/gate and new manifest. Existing cumulative accounting reads every complete budget (browser.ts:54–61): previousRuntimeMs must remain3,874, leaving176,126ms. If provisioned execution tree changes, transfer the original committed evidence intact or explicitly bind the same accounting source before any run; never start a fresh empty counter.

## A/B execution boundary needing an explicit choice

Current modes are history/all only (browser.ts:383–420): history runs both A cases and exits without Chrome; all runs both A cases before B, never Chrome after A failure. For the next authorized A-only gate, constants/provenance alone suffice. If A is sealed then B separately authorized, the current all entry would rerun A. Do not call it B-only or silently repeat. Manager/root must either authorize that extra bounded A within an all gate or approve a small four-scope app mode that verifies a sealed successful A attestation for the exact backend tree/artifact/source and reuses no live resources. B remains unimplemented/unexecuted as an independent mode today.

## Dependencies and gates

Current17 links are read-only and tied to the present worktree; a new execution tree needs exact read-only dependency provisioning/identity checks by its authorized owner. Never borrow moving @flow/dist, widen link authority, or treat source receipt as execution admission. Existing fixed client/contracts/tool bytes must stay unchanged except where the supplied tuple explicitly and narrowly proves otherwise. A fresh claim/source/deps/resource gate is required. History60s includes20s cleanup; overall180s and8MiB persist. Full App/Chrome requires its separate resource admission. Successful preparation or successful A alone cannot produce a SVC compatibility report or authorize a personal update.
