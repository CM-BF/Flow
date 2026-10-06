# One-shot synthetic canary — FAILED / STOPPED

Authorized static target `e535fc04364c3be4a08ab0c6bc8bebe25afed977`; Mika/gpt-6-astra 2026-10-06 09:28:12 UTC allowed exactly one synthetic invocation. Prepared driver target `7c6e3d835655e1c2c274b71ce0d65225e87172df` was committed and pushed before execution. Existing tsx4.23.15 imported fixed R06 successfully without calling its factory; no copied supervisor.

Actual UTC: **2026-10-06T09:32:21.310Z → 09:32:21.558Z**. runSyntheticCanary called once, factory called once. The once-reservation was created exclusively and fsynced before that function call; actual command/environment/config/copied hashes were fsynced before R06 spawned the owned wrapper.

Result: no valid child canary report. R06 observed `DISCONNECTED`, owned child `confirmed-exited`, signal `SIGABRT`, exitCode null. This is a bootstrap/pre-report failure or unavailable report; exact cause is unknown. **None of the seven canary checks has a passing result.** The transport intentionally did not expose raw child stderr, and no personal crash logs were read. Driver exit1 is the reported failure, not a test pass.

Cleanup: own listener closed=true; retainedRoots=[]; a read-only follow-up confirmed both recorded temporary roots absent. No port/PID scan, other-service stop or repeated invocation occurred. The approved profile and all eight bound files remain byte-for-byte unchanged. No permission was widened. No real Codex, model/list/thread/turn/auth/provider or outside-network probe was started.

[Run manifest](canary-run-manifest.json) binds complete [actual inputs](canary-actual-input.json), [reservation](canary-once-reservation.json), [result](canary-result.json), and driver stdout/stderr. The original [static manifest](manifest.json) and static README remain immutable historical preparation artifacts; they are not the current runtime result. Original semantic six files/one raw/29 schema remain unchanged; 27 semantic and 31 R06 tests were not rerun.

The once permit is consumed. Work stops at this evidence: no automatic retry, no additional profile grant and no real app-server authorization. Any follow-up needs a separately reviewed concrete change/path; the failing run does not establish which bootstrap permission would be necessary or safe.
