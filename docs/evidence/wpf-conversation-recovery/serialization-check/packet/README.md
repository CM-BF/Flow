# Recovery page-evaluate serialization check — prepared, not run

This is a dedicated, single-use local probe for the `9835e7488dd9b0b44b3afbc285336defdd739e98` harness repair. Current source tree HEAD is `79fe564f009d5b78be0878b669a77068089c77ba`, branch `codex/web-conversation-recovery`, clean at preparation. Binding includes all 19 cumulative source hashes. No product, dependency, or owner status file changed during this preparation.

`binding.json.state = PREPARED_NOT_REVIEWED_NOT_RUN`. There is no gate or runtime output. Parent refuses execution until independently reviewed binding and a separately issued, unexpired, matching single-use gate are supplied. Quick c1 owns the local check slot; preparation confers no admission.

## Exact input and real tool configuration

`extraction.json` records fixed old `a3449380d75839358f4a6df6f53c747872676efa` browser lines 487–497 and fixed new `9835e7488dd9b0b44b3afbc285336defdd739e98` lines 487–498. The two `.ts` files contain those exact callbacks; only an outer global assignment is supplied to capture the resulting function. The project browser module is never imported or executed.

The worker imports the pinned installed TSX 4.23.15 `dist/index-DE3OBZuV.mjs` export `t`, not a copied esbuild configuration. This uses TSX's actual ESM defaults (`target: node${process.versions.node}`, `keepNames: true`, `minifyWhitespace: true`, source maps), plus `{ tsconfigRaw: binding.tsconfigRaw }`. That third-argument shape follows installed `register-nyXW-TH3.mjs` `It(p,a,{tsconfigRaw:L(a,t)})`; the fixed root `tsconfig.json` has no extends, and root/Web package types are ESM. Loader files are source evidence only, not imported. Actual tool dependencies include the TSX helper and dynamically imported lexer, esbuild 0.28.2 JS and Darwin ARM64 binary. Node24 and each concrete source/realpath/hash are bound. The binary override points only at that same pinned installed esbuild binary.

Transformed code is evaluated in a producer VM; the resulting function is serialized with `Function.prototype.toString`. That string runs in an independent VM where `__name` is absent. No helper is installed in the page VM.

Required outcomes:

- Old callback must reproduce a `ReferenceError` mentioning `__name`, before changing the transaction prototype or installing restore.
- New callback must install successfully. Ten assertions preserve receiver, argument references/options/count, exact return values, original thrown error, deferred abort, only target DB + readwrite abort, no global helper, prototype restoration, restore-hook removal, and unmodified readwrite behavior after restoration (related checks share the ten named assertion keys).
- Both emitted source and serialized functions, old error/stack, new assertion results and Node version are retained. Expected count is two scenarios, ten new assertions, not a Node test-suite count.

This checks actual installed transformation plus a modeled IDB interface. It does not establish native IndexedDB scheduling, mounted App/Thread behavior, real Playwright serialization, HTTP, auth-loss acceptance, or browser PASS. The callback is transformed alone in the stated wrapper, not by importing the full module.

## Proposed one-time execution after review and manager admission

```sh
python3 /private/tmp/recovery-page-evaluate-once-ew6p5zj7/run.py --gate <manager-issued-gate.json>
```

The operator must capture complete parent stdout/stderr and actual command exit separately using the existing shell-redirection method, for example new `/private/tmp/recovery9835-parent.stdout.jsonl`, `.stderr.log`, `.exit.json` files; never overwrite earlier captures. No invocation has been made. Do not create an `allowRun` file from this README.

Gate fields: `allowRun: true`, `singleUse: true`, `mode: recovery-page-evaluate-serialization`, `taskId: WPF-RECOVERY01`, future `expiresAt`, matching `bindingSha256`, `runnerSha256`, `sandboxSha256`, and exact `head`, `implementation`, `claim`, `limits`, `overlaps: []`. Manager still owns fresh claim/window/resource admission. Candidate remains unreviewed until explicitly bound; no old gate can be reused.

10,000 ms total = 7,000 ms work + 3,000 ms cleanup reserve. Own temporary tree ≤8 MiB; generated raw + terminal captures ≤256 KiB. Fifty-millisecond accounting polls and final post-reap/pre-delete accounting are fail-closed on non-ENOENT errors. These are observed byte/time budgets, not hard disk quotas or a claim that blocking OS calls cannot delay the parent. No free-space sample is taken by this candidate; admission remains external. This local check has zero prior runtime and is separate from browser/direct/type budgets.

One sandboxed Node child starts a new owned process group; esbuild's child stays in that group. The worker calls esbuild stop in finally. Parent reaps only its owned group, checks absence (only ESRCH means absent), then samples before deleting its own scratch. Unknown/live group retains scratch and fails. Sandbox denies network and all file writes except packet scratch/raw and `/dev/null`; no project/dependency writes, PG, HTTP, Chrome, or product import. Sensitive environment, loader and arbitrary binary overrides are not inherited. TSX/Node compile caches are disabled and temporary/cache variables use own scratch.

Parent records child exit, cleanup errors, group/scratch absence and limits. Handled TERM/INT through terminal reporting cannot return PASS: before cleanup they request normal cleanup; after cleanup a single bounded late reporter emits FAIL, writes `late-stop.json` if possible and exits 1. Handlers are kept until process exit. Final accounting reserves 16 KiB for terminal captures, counted in both tmp and raw limits. No automatic retries. Fatal external KILL and inaccessible/uninterruptible OS operations are outside the handled-soft-stop claim.

Acceptance requires all of: actual outer exit 0; exactly one terminal stdout line with state PASS and no later FAIL/late-stop; empty parent stderr; worker exit 0; two expected scenario results and ten true new assertions; cleanup group/scratch absence; current hashes and actual captured byte sizes within limits. `worker-result.json` or an earlier disk result alone cannot establish PASS. The external exit record remains authoritative if terminal output fails. Report accounting/limit failures also fail even if the worker succeeded.

Original browser failure records remain immutable. Browser late cumulative `38364.050667 ms`, remaining `51635.949333 ms` (next integer cap 51635, including 15000 cleanup), are unchanged; there is no browser grant.

## Method and review boundary

Local find-skills and clean-code were reused, no installation: real dependency seam, separate old/new assertions, single owned worker, explicit error/cleanup boundary, no global helper or generic scheduler. Parent is a reduced dedicated adaptation of the reviewed Recovery50 supervisor; `supervisor-adaptation.diff` and the original parent hash are retained. `terminal-accounting.diff` preserves preparation self-review changes. Only Python file preparation, hash reads and static `ast.parse` of the parent were done; worker JavaScript has not been imported, syntax-probed or run.

Root's already-read primary references explain the boundary: [Playwright evaluation](https://playwright.dev/docs/evaluating) separates test and page environments; [esbuild keep names](https://esbuild.github.io/api/#keep-names) explains name preservation. Neither substitutes for the pending installed-version old-negative/new-positive observation.
