# Trusted verifier process extension

The same trusted Host now exposes `invokeVerifier(PluginToolInput): Promise<PluginToolResult>` alongside legacy `invoke` (tool). Both use the one resources/framing/authorization/cancel/settlement implementation. The worker dispatches to the already-main `invokeInstalledVerifier`; its installed manifest rejects opposite-kind material before authorization/import. There is no in-process fallback.

The private, atomically paired host/worker protocol is v2 with required `executionKind: tool | verifier`. Unknown/array/missing kind, extra second-kind fields and v1 frames fail closed. The public tool method and configuration stay unchanged. A deployment must carry both files; mixed protocol versions are rejected.

## Fixed combination and scope

`donor-inputs.json` binds main c15cdff host.ts and package-store.ts/package.json. `combination.json` binds five exact same-byte copies of this owner source/test in `view`, including unchanged resources. This finite mirror permits real worker relative imports and main verifier support without writing unclaimed host/execution/package source. The same-tree package link points only to that view. No aliases hide an old host; no node_modules install. T7 relocatable release remains NOT_RUN. Main already contains original 4dc tool process implementation; this extension is NOT_INTEGRATED. No runtime/public verifier producer/independent center verdict gate is claimed.

## Actual local evidence

Five OPS14 supervised children: first 10 selected = 9 pass/1 assertion failure (receipt directory legitimately also contains owner.json); fix only exact expected receipt entries and targeted 1 pass/9 unselected; types0; then strengthen the result-text fixture to the existing AV02 typed output fields and run that 1 pass/9 unselected; final types0. Ten distinct tests (3 existing protocol/resources +7 extension), not a single final 10/10. All old raw/source variants remain.

The verifier fixture returns exact typed JSON text and preserves input digest/provenance/module independence. It is a transport fixture, not proof of the algorithm or server verdict. Real child tests cover both wrong-kind directions with no import/invoke markers and zero authorization; cancellation after load grant returns OUTCOME_UNKNOWN; package error plus nonempty scratch preserves unknown/cause/receipt and blocks a second spawn; legacy tool behavior remains. Test teardown removes only that fresh same-identity finite fixture after asserting retained production state; no old KEEP is accessed.

All five top-level groups ended absent with merged EOF and complete raw. Ten observed worker instances ended with protocol/stdout/stderr EOF; the cancellation worker has SIGTERM, others exit0. Eight new material roots were boundedly inventoried and removed; two inherited resource fixtures clean by their original assertions. Five outer TMP were exact empty/same-inode rmdir and ENOENT. 6407ms is summed supervision; whole external segment wall/peak are not measured. 3708 raw bytes, first failure unchanged.

No PG, HTTP listener, provider, native model, package installation, tar process, release build or browser. The three-entry USTAR test material uses gzip in memory and the real prepare/read/import/invoke path.

## Skills / quality

Applied installed find-skills discovery: Node24/TypeScript bounded child lifecycle maps to local codebase-design and clean-code; brainstorming bounded design was approved by Mika before source work. Paths: /Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code}/SKILL.md. No installation. Review at final seal: one narrow Interface, explicit mode, existing lifecycle ownership unchanged, no second supervisor/state authority. Error priority/unknown remains in original 4dc logic; package-kind error now crosses the protocol faithfully. Cleanup tests exercise behavior rather than mirror private functions. Remaining limits: trusted direct children only, no untrusted sandbox/physical removal, no T7/center/runtime integration.
