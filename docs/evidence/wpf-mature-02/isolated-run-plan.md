# Real app-server probe — NOT_RUN

The approved semantic target remains `0d0524c3439363d1fe60aad63f62817ba51fa2a5`. The separate next slice now has a concrete [default-deny profile and bounded synthetic canary design](../../../experiments/codex-app-server-conformance/isolation/README.md), plus static-only [inspection](isolation/bootstrap-inspection.json) and [R06 binding](isolation/r06-binding.json).

The static round was followed by exactly one explicitly authorized synthetic composition. Its [runtime report](isolation/canary-run-report.md) records SIGABRT before any valid canary report, confirmed child/listener close and owned-root cleanup. No retry or profile change. The installed Codex process and all account/auth/provider operations remain NOT_RUN.

The candidate uses two exclusive empty temporary roots; one writable state subtree, one denied harmless marker root; explicit environment; fixed executables and library reads; no system profile import, network, Mach lookup or process fork grant. It tests only owned marker read/write, symlink/hardlink boundaries and a private loopback listener. It never probes actual personal files, Keychain or an outside-network address.

Approved R06 target `a239b14d5328c78cca02a8757e26f2b65502f926`, main integration `e785a29f5dee324127603f73e9efda8a66242009`, remains the sole child/framing/handshake/deadline/close implementation. The canary preloader precedes R06's exact synthetic peer. It is not another app-server transport.

Gate 1: Mika reviews exact profile, command, dependency hashes, canary and failure cleanup. Gate 2: only explicitly authorized synthetic canary execution can establish its narrow runtime results. Gate 3: a separately reviewed fixed native Codex initialize/initialized/model-list probe may follow; no thread/turn/auth/provider. Any missing startup allowance, denial failure, unknown result or unconfirmed close is a failing observation, never an automatic retry or policy widening.

Current blocker: the one synthetic child aborted before a valid report; Seatbelt compilation/enforcement and ambient-capability assumptions are not demonstrated. The design records macOS gaps rather than claiming no escape path. Bootstrap system cache reads do not establish personal-data isolation. A successful canary or catalog still cannot establish account entitlement, actual inference settings, complete tool disablement, or behavior after enabling provider network.
