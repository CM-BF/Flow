# Legacy TUI profile direct-consumer compatibility

Fixed test-only source `ec30bb6246ac95e5843c7166dee7118b684fd089`; one file `apps/tui/src/journey.test.ts`,5 added/1 removed. The fixed integration input `4015c667f1e2b833755b2fda6ed205fb951ec576` broadens publishExecutionProfile.profile to legacy or message-settings profiles. The existing fixture publishes a configuration without turnSettings and requires the legacy branch. It now checks that branch explicitly and compares all six original control fields before retaining the returned profile with narrowed controls. No cast/any, no removed assertions, no change to publication body/key/lifecycle.

The original I02 root type failure is preserved unmodified in integration-red.txt, including three unrelated Web diagnostics; this slice does not claim to fix Web. Author ran one **focused noEmit, exit0 in2.564s**, using TypeScript5.9.3's standard compiler host to overlay only this test's candidate bytes on the read-only fixed I02 checkout.207 project inputs matched4015;505 dependency inputs and the overlay make713 compiler inputs, all individually recorded. The unchanged test before the overlay matched4015 byte-for-byte. I02 remained clean. This is not a root typecheck or runtime proof, and zero tests/PG/PTY/provider ran.

Freshfree1GiB+8MiB held; compiler cache2,551,568B was removed only after the owned group disappeared and dev/ino matched. Raw types stdout is empty; actual exit0/process record is separate. Exact claim v2 amendment preceded the edit. Parent handles integration/independent review.

- [Original integration red](integration-red.txt)
- [Actual process/exit receipt](types-process.json)
- [Single-file compiler/config](check-types.mjs)
- [All observed compiler inputs](compiler-inputs.json)
- [Fixed project source bindings](input-bindings.json)
- [Fixed manifest](fixed-manifest.json)

Methods: reuse local find-skills/clean-code/codebase-design; narrow test expectations at the existing public Interface, no production abstraction or behavior change. Source remains in the original a89 tree; new integration inputs were read only, never merged into its runtime.
