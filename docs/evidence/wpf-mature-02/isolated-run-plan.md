# Real app-server probe — NOT_RUN

The first implementation slice is entirely in-memory. No installed Codex process was started. This document records a bounded next experiment; it is not authorization to start real app-server/provider/auth.

The existing `/usr/bin/sandbox-exec` executable was found and its usage text read. That establishes tool presence only, not successful sandbox enforcement. A temporary CODEX_HOME, environment allowlist or disabled telemetry setting alone cannot prove exclusion of personal Keychain/config/network access. R06 explicitly is not a sandbox.

Proposed ownership and sequence:

1. R06 remains sole process/transport owner. Consume its fixed `createCodexTransport` Interface, including ready and bounded close; do not implement another child supervisor. A sandbox wrapper would be the explicit executable; the fixed native binary would be its command, bypassing the npm wrapper that inherits environment. Executable compatibility with R06's allowlist must be reviewed first.
2. Prepare a default-deny Seatbelt profile scoped to one dedicated temporary cwd/state and the exact fixed native executable plus required system runtime reads. No broad HOME, user Library, Keychain or network grants. Child environment is an explicit allowlist with HOME/CODEX_HOME/TMPDIR pointing only to dedicated empty directories. No credential variables or personal config copies.
3. Before Codex, run only an owned synthetic canary under the same profile: prove allowed temporary write, denied read of a different owned temporary directory, denied connection to an owned loopback listener and denied external connection attempt. Also prove transport deadline/close reports confirmation. The canary must emit bounded boolean outcomes only. It cannot use real secrets or user services. A failed denial or unconfirmed close blocks the real probe.
4. The exact profile, executable hash, environment-key list (no secret values), command arguments, canary raw results and fixed R06 target go to Mika for path review. Today the profile/canary proof is missing, so real initialization is blocked while the semantic fixture proceeds.
5. Only after that review: one fixed 0.154.0 native app-server, initialize with experimentalApi=false/requestAttestation=false, initialized from R06 ready, then bounded model/list. No thread/start, turn/start, auth/login, resume, tools or paid provider request. Any server request/unknown result/error fails the probe; close owned child, record confirmed/unconfirmed, no automatic retry.

A successful catalog would still not establish account entitlement, inference configuration, zero early config reads beyond the enforced profile, or actual model execution. A sandbox restriction that prevents startup is a valid negative result; do not widen to personal paths simply to make the probe pass.
