# QuickControls portable types → direct candidate

**PREPARED / NOT_RUN / review NOT_STARTED.** This is a dedicated source candidate, not an activated workflow or a runtime grant. Product target remains `fe6ece131c489c79cf531a184e4cf51209f9c4a0`. No product source or local c1/b1 packet changes. It uses standard Node child processes, TypeScript and Vitest; the future CI owner supplies containment and resource/cleanup supervision. It does not introduce a second sandbox or general CI framework.

## Interface and future order

An independently reviewed, immutable checkout must contain this candidate and the exact 117 source/config/lock bytes in `source-pins.json`. The four product hashes stay fe6 even if the checkout SHA includes later metadata/candidate files. The caller supplies that actual SHA, a unique run ID, two new absolute directories outside the checkout, and an explicitly admitted work time (positive integer milliseconds, maximum120000). This ceiling is a rejection bound, **not** an approved remote budget. No remote install/check has run. Node24.20.0 and installed package versions are checked; lock and packageManager pnpm9.15.4 are pinned. A future installer must independently use the reviewed lock/manager and isolated checkout; this script neither installs nor changes a dependency.

Only after separate execution authorization, the future caller can use:

```text
node docs/evidence/wpf-message-settings-quick-controls/portable-check/run.mjs <actual-40hex-checkout-SHA> <run-id> <new-absolute-output> <new-absolute-scratch> <admitted-work-ms>
```

The exact children are current Node running installed `typescript/lib/tsc.js --noEmit -p <this>/tsconfig.json`, then installed `vitest/vitest.mjs run --config <this>/vitest.config.mjs --configLoader native --no-cache --reporter=json --outputFile <scratch>/vitest-results.json`. No root-wide check, PG, browser, provider or model entry. Types are strict + noUncheckedIndexedAccess + noEmit/incremental=false; relative @flow paths resolve this checkout's source. Vitest selects only `apps/web/test/message-settings.test.ts`, one worker, real Picker TSX/helper imports and real installed React/Radix JS; `css:false` is **Node direct only**, not browser CSS validation. JS paths are resolved from the installed web workspace via standard package resolution, never a copied macOS donor alias. The packages/optional Linux binaries and relative configuration resolution remain runtime-unverified.

The output directory records each child exit/signal/spawn-timeout error, bounded logs, complete bounded Vitest JSON, input manifest, and `result.json`. Both children must actually exit0; exactly one file and26 exact names must all pass, with no skip/todo/failure. `expected-tests.json` is the fixed c1 name expansion, not a result. Zero tests, import-before-collection failure, count drift, missing/truncated/overlarge JSON or an unknown child result fails. Failure does not trigger retry or relaxed selection.

## Independent acceptance, cleanup and limits

`CHECKS_PASSED_PENDING_CLEANUP` is only a candidate result. The program **does not claim descendants are gone or remove scratch**. `spawnSync` timeout/SIGKILL targets its direct child; it is not recursive containment. The outer CI owner must bound the whole job/group, observe both command exits and complete stdout, ensure all owned descendants are absent, then clean only its scratch and produce an independent receipt. This explicitly avoids treating a child exit or ephemeral runner disposal as proof of cleanup. Abrupt death can leave incomplete output; missing result/receipt is failed or unknown.

Each command's captured output is bounded; a maxBuffer/timeout error fails even if some logs exist. Retained logs are capped at512KiB per child and structured files at256KiB each; acceptance caps their sum plus result/receipt at2MiB. Vitest writes its report to scratch first, so these are bounded *reads/retention*, not a physical write quota. The caller must independently enforce admitted temp/log/overall-time limits and no credential/provider access; no polling, OS isolation or through-exit guarantee is invented here. Parent work deadline includes preflight/children/source recheck, while actual external elapsed and authorized total (including cleanup) must come from the outer observation. No old local30s/60s grant or macOS boundary acceptance is transferred to a remote runner.

The independent receipt must be pinned by SHA256 from the trusted external observation, not fabricated by the test worker. Required fields:

```text
sourceCommit, runId, actualOuterExitCode=0, runResultSha256,
terminal=<the exact complete stdout JSON>, terminalCount=1,
elapsedMs, authorizedTotalMs, observedAt,
cleanup={state:"complete",ownedProcessesAbsent:true,scratchAbsent:true,errors:[]}
```

`authorizedTotalMs` comes from the actual external admission; an author-selected large value is not authorization. The terminal record's hash must match the retained result, and the external exit must be observed after the process closes. The consumer then performs the offline consistency check:

```text
node docs/evidence/wpf-message-settings-quick-controls/portable-check/accept.mjs <output> <trusted-receipt-file> <trusted-receipt-SHA256> <expected-checkout-SHA> <expected-run-id>
```

This accepts only matching source/run/result/raw hashes, both successful steps, one final terminal line, complete external cleanup and admitted elapsed time. It checks consistency of the caller's receipt, not its authenticity. A nonzero/missing outer exit, absent receipt, mismatched source, timeout or unknown cleanup cannot pass. The future independent reviewer still checks the actual CI run/provenance. Browser remains NOT_RUN; these checks cannot alone create b1's trusted prerequisite approval.

## Static preparation and ownership

Only own evidence files plus plan/status/review were written. No workflow/global config/lock/package/installer was changed. The three `.mjs` texts passed finite `node --check`. A separately permitted builtin-only evaluation of the actual exact-alias expression passed for14 real specifiers, wrong prefixes/suffixes/subpaths/punctuation and synthetic regex metacharacters. It did not import the configuration or execute the candidate/product. Exact commands/output/source hashes are in `static-checks.json`. Types/direct/browser all remain NOT_RUN. Prepared file hashes are in `prepared-manifest.json`; fixed implementation and final metadata/candidate commit are separately recorded by the owner. Local c1/b1 files stay frozen and unmodified; their eventual metadata binding requires their own admission.
