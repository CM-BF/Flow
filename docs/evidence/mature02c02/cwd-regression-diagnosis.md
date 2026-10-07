# C02 R1 second-turn failure: bounded source diagnosis

Fixed failure evidence: `d5e94525d8d9bc0119059f9c4c541b2b669a46be`. Its six selected cases remain five passed / one failed. Original raw, result manifest and KEEP directory are unchanged; later source and status updates are not claimed to equal those historical bindings.

## Deterministic fixture defect

At the fixed target, `continuity-fixture.ts:34` requires the `thread/resume` request `cwd` to equal `codeHome`. These have separate responsibilities. `runtime.ts:160,175` assigns the attempt directory to `HarnessContext.workingDirectory`; `session-storage.ts:58` adds stable `codeHome` without replacing that directory. `turn.ts:18` and `wire.ts:25–27` correctly retain the attempt directory in the resume request. The fixture therefore rejects this correct public-runner request. The earlier unit fixture uses `workingDirectory=root=codeHome` (`continuity.test.ts:33–36`), hiding the mismatch.

After the resume request is dispatched, `exchange.ts:52–55,72–74` maps the fixture AssertionError to unknown settlement. The runtime preserves uncertain work instead of emitting a false completion. This deterministic defect is consistent with R1 reaching its second task wait and never seeing success. R1 did not save call traces or the last task snapshot, so it cannot establish the exact historical task status, scheduling or every contributing cause.

repository_map independently confirmed this source chain and found no additional concrete center tasks/scheduler/claim/session blocker. The same reviewer accepted R1 failure fidelity (0 P1/P2); this is not continuous-session acceptance. No new execution or inspection of the retained TMP occurred.

## Narrow correction and pending checks

Only test/fixture source changes: resume compares `cwd` to the actual factory `options.workingDirectory`; thread/start and turn/start validate the same seam. Persistent reads still use the independently checked `options.codeHome`. A single new regression uses one storage root and two distinct owned attempt directories, retaining the original session/close/final assertions. It must fail against the old fixture and pass after the fix; neither run has occurred.

The public fixture retains just the final already-issued task GET's id/status/attempt id/watermark and poll count, overwriting one metadata object. No prompt/native payload, new request, longer wait, retry, altered fence, production change or relaxed assertion. The 40×50ms polling budget is unchanged.

Local validation preparation is `cwd-regression-check-request.json`: only the new injected case, zero PG/native/provider, separately gated. A future PG window should target the previously failing continuity case rather than rerun the unaffected five; it needs a fresh fixed input manifest/namespace and reviewed one-case result gate. The original six-case source manifest and supervisor stay frozen, not silently reused with new inputs.

Clean-code/codebase-design: keep storage authority and per-attempt cwd separate at the existing private factory Interface; no new transport/FSM/permission system. Current result is SOURCE_FIX_PREPARED / CHECKS_NOT_RUN.
