# Center verifier wiring — source preparation

The existing center is the sole HTTP/auth/startup owner. `ServerOptions.pluginVerifierPolicy?: TrustedPluginVerifierPolicy` is an explicit private operator input, never a request parameter. Omission leaves the new verification admission/phase routes unmounted. An explicit verifier policy without a host policy is rejected before allocating the center pool.

`main.ts` reads `FLOW_PLUGIN_VERIFICATION_CONFIG` during its existing observed configuration phase through the fixed VAR reader. Invalid explicit configuration fails before factory/listen; omission omits the option. The factory runs migration 034 then 036 sequentially inside the existing plugin migration phase. No new startup phase or lifecycle owner is introduced.

The same policy object reaches verification admission/phase, runtime enable, runtime projection, and reportEvents. Existing global owner/runner authentication, browser Origin/CSRF, error mapping, idempotency headers, bounds and no-store remain the authorities. This changes assembly, not verifier algorithms, permissions or settlement.

## Fixed dependencies and staged composition

`fixed-inputs.json` lists the fixed base plus pending AV/VAR readonly dependency bytes under this evidence directory. No dependency source is a product owned by this feature. Pending VAR preimages match base 69a; pending AV preimages match as well. The three owned consumers and new test must be copied explicitly to their corresponding input paths only after a legitimate product change. The current fixed mirror still contains base consumers and is not a claim of runnable wiring.

AV R2 failed all five cases. Its migration 036 parenthesization repair is pending; this input retains the old fixed bytes until an owner supplies a new fixed target. VAR domain PG, actual producer/result chain, runtime v4 dispatch and release/deployment remain independent unmet prerequisites.

## Planned local evidence

Nine real-factory/inject or actual-main consumer cases, with only domain/PG work replaced: default off and partial policy rejection; ordered migration and failure cleanup; owner auth/replay key; runner role and tool separation; browser Origin/CSRF; existing input/response limits and no retry; identical policy in enable/read/events; main explicit read/forward; main omission/invalid configuration. Tests use no listener or PG. They do not prove actual SQL or domain algorithms, which already have separate fixed source/local reviews.

Source and test are NOT_RUN. Future focused types and explicit Vitest path require the separately granted ordinary budget and a source-current mirror. No isolated helper-only acceptance, no whole-repository checks, no actual PG window consumed.
