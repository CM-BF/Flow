# Seatbelt canary proposal — NOT_EXECUTED

This directory is a static proposal. No profile was installed, no canary ran, no listener was opened and no app-server/auth/provider started during preparation. `node --check` is syntax checking only. The reviewed semantic consumer outside this directory is unchanged.

The only process owner is approved R06 `createCodexTransport` at `a239b14d5328c78cca02a8757e26f2b65502f926`, integrated at main `e785a29f5dee324127603f73e9efda8a66242009`. `compose-canary.mjs` injects that function. It has no CLI entry point and never imports/spawns a second transport. The synthetic peer is passed as bytes from that fixed Git target, hash checked, then copied to a temporary control directory. No production Codex program is selected by the canary options.

## Two exclusive temporary roots

`runSyntheticCanary` would create exactly two `mkdtemp` directories, both 0700, canonicalized under `/private/tmp`:

| Root | Contents and sandbox access |
| --- | --- |
| `flow-wpf02-allow-XXXXXX` | `control/` holds 0400 profile, config, preload and fixed peer files (directory 0700, deliberately owner-writable). Sandbox read only; the blocked creation would be permitted by directory mode without Seatbelt. `state/` holds empty home/codex/tmp directories and output, sandbox read/write. |
| `flow-wpf02-deny-XXXXXX` | One harmless `denied-marker.txt`; no sandbox read/write. The parent alone checks its original content. |

The allowed state contains one intentional symlink to the denied marker, testing canonical path enforcement. The child also attempts a hardlink to that owned marker; any success fails the scenario. No real private path, Keychain, credential, config or external address is a canary target.

## Explicit wrapper command (proposal; do not run independently)

R06 would supply only pipe stdio, the listed environment and its own deadlines/close. The equivalent child command is below; the two roots are fresh values from the same invocation, never user-supplied arbitrary paths:

```sh
/usr/bin/sandbox-exec \
  -D ALLOW_ROOT=/private/tmp/flow-wpf02-allow-XXXXXX \
  -D DENY_ROOT=/private/tmp/flow-wpf02-deny-XXXXXX \
  -f /private/tmp/flow-wpf02-allow-XXXXXX/control/default-deny.sb \
  /opt/homebrew/Cellar/node@24/24.20.0/bin/node \
  --jitless --no-addons \
  --import /private/tmp/flow-wpf02-allow-XXXXXX/control/canary-preload.mjs \
  /private/tmp/flow-wpf02-allow-XXXXXX/control/peer.mjs normal
```

The child environment is exactly PATH=/usr/bin:/bin, HOME=state/home, CODEX_HOME=state/codex, TMPDIR=state/tmp, LANG=C, LC_ALL=C, TZ=UTC. No inherited process.env, NODE_OPTIONS, DYLD_*, LD_*, tokens or proxies. R06 previously observed macOS may add `__CF_USER_TEXT_ENCODING`; no value is logged or taken as authorization.

The reviewed composition caller would obtain `peerBytes` with `git show a239b14d5328c78cca02a8757e26f2b65502f926:apps/runner/src/codex/fixtures/peer.mjs` and call:

```js
const result = await runSyntheticCanary(createCodexTransport, {
  r06Target: 'a239b14d5328c78cca02a8757e26f2b65502f926',
  peerBytes, // Exact Git bytes matching r06-binding.json; no mutable source substitution.
});
```

This round provides no auto-running test/CLI entry. The caller must consume the approved R06 module through the repository's existing TypeScript build/test toolchain. Direct Node import of its `.ts` entry is not offered: its internal `.js` specifiers require the existing build/transform. Profile execution and that composition remain separate reviewed next steps.

## Expected outcomes and bounds

The preloader must complete seven checks before R06's existing synthetic peer starts: allowed state read/write; denied external-root read; denied external-root write; denied control-directory write; denied symlink read; denied hardlink creation; denied TCP connect to the parent's own live `127.0.0.1` listener. Only EACCES/EPERM counts as denial. ENOENT, ECONNREFUSED, timeout or any other error fails; no listener means no network evidence. The listener sends no bytes and immediately destroys an unexpected connection; its total accepted connections must be zero. No DNS or outside-network target is used.

Network check 500ms; listener bind/close each 1000ms; R06 initialize 3000ms (includes preload), request 1000ms, TERM/KILL 500ms each. R06 frames 4096 bytes, read/write queues 8192 bytes / 8 frames, one pending request and one server request. Result file <=4096 bytes. No model/list/thread/turn/auth method is sent in this synthetic scenario; R06 owns only its usual initialize/initialized exchange. No retry or runtime policy widening.

Only R06 `close().child === 'confirmed-exited'` plus confirmed owned listener close permits deleting the two invocation-created roots. Inode/device identity is checked before cleanup. An unconfirmed close retains roots and returns failure. No PID scanning, port killing, shared temp wildcard deletion or other service operation. Cleanup never follows the deliberate escape link. Same-UID race resistance is limited and explicitly not a security claim.

## Policy provenance and unresolved macOS behavior

`default-deny.sb` imports no system profile. The local Apple `bsd.sb` grants blanket metadata/home-related paths, so it was read for syntax, not inherited. Default deny plus explicit network*, mach-lookup and process-fork denials leave all network transports and Keychain-related Mach lookups without grants. Only the fixed Node and fixed Codex executables may exec; canary arguments select Node only. This is not a blanket ban on replacing the current process with either allowed image.

The profile lists 62 exact runtime load names gathered with local `otool -L/-l`; 21 non-system executable/library files are SHA-256 bound in `bootstrap-inspection.json`. The one broader read/map grant is the system dyld shared-cache directory `/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld`, present on this host. Cached system framework images often do not exist as standalone files. This grants public OS runtime cache reads, not all `/System/Library`, `/usr/lib`, HOME or `/Library`. Its sufficiency/necessity for startup has not been observed. No generic sysctl read, Mach service, sandbox extension, dynamic-code-generation or `with no-sandbox` allowance is present. Any missing bootstrap dependency requires a new reviewed exact allowance; never import `system.sb` or broadly allow HOME just to pass.

The local sandbox-exec man page labels it deprecated; installed Apple profile headers say the policy language is private and may change. Static parentheses/keyword checks do not compile SBPL or prove enforcement. `codesign` inspection found Codex JIT/unsigned executable memory entitlements; these are not treated as evidence of Seatbelt bypass or of safety. Node is requested with --jitless/--no-addons, but actual startup remains untested.

Potential gaps remain: sandbox-exec itself starts before installing the child profile; a parent could have inherited file descriptors/Mach send rights/extensions; same-UID mutation of user-writable Homebrew binaries between hash check and exec is not prevented; dyld cache access is broader than individual load names; file-extension/inode behavior and Mach enforcement have not been dynamically verified. R06 supplies only three pipe stdio descriptors and no inherited credential environment, narrowing some paths without proving absence of all ambient capabilities. There is no known reproduced bypass here, and no claim that the profile has no macOS escape path. Successful owned canaries would establish only their tested boundaries, not universal isolation.

A later fixed Codex startup needs its own receipt under the reviewed profile and separate authorization. No turn/provider network is ever authorized by a successful directory/canary probe. Runtime initialization isolation does not prove `access:none` for future model inference, especially after any network policy change.
