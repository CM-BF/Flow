# WPF-P01 validation and handoff

Owner implementation target: `e5341915ebbffd9a667f68f7d1ca9c45c14c7c52`; input base: `c8900a6fdbca20e683fda6fc808c135f0569c116`. Node24.20.0/pnpm9.15.4, Chrome154; 2026-10-06 02:54 UTC. This is the isolated trusted host module and UI fixture, not proof of M02 App integration or a real center.

## Checks actually run

- `pnpm --filter @flow/web typecheck`: PASS.
- `pnpm exec vitest run apps/web/test/plugin-host.test.ts`: 14 PASS. [Machine report](module-results.json). Covers registration without load, JSON/ID/API validation, command fan-in, per-invocation B context, activation rollback/retry, disable during load/activation, late cleanup, stale contexts, reverse cleanup despite errors, changing grants, async/bridge errors, immutable stores, task/reference scope, theme fallback, host connection disposal, sync/async subscriber isolation and own-property slot validation.
- `pnpm --dir apps/web exec playwright test --config test/plugin-host.config.ts`: 9 PASS. [Machine report](browser-results.json). Actual WorkspacePanels Files/Terminal/reference keyboard focus, local B row command, actual theme adapter and custom fallback including computed token restoration, draft preservation, real sample menu and panel, loader failure retry, local render ErrorBoundary recovery, dynamic authorization, focused tab removal, bridge error visibility, light/dark/390px reduced-motion layout. Injected render error is expected and handled locally; no claim that it produces no console diagnostics.
- Vite production build with `src/plugins/fixture/index.html` as explicit entry: PASS. [Asset report](build-results.json). Entry239364bytes/gzip73928; lazy workspace73044/gzip24098; theme804/gzip493. This fixture starts with its workspace visible, so it activates that module immediately; separate emitted chunks alone do not establish deferred main-App loading or an improved product performance budget.
- Production static fixture smoke: PASS, 7 asset requests200 and zero page errors; actual WorkspacePanels output/theme/Notes, frozen context and local PH-R3 alert. [Report](production-smoke.json). Temporary5191 preview was stopped after the check.
- `git diff --check`: PASS. Final implementation diff from input base only plugins directory and three dedicated test/config files. Root manifest, existing App/Thread/workspace/themes/client/contracts unchanged.
- Temporary install lock exported fully as [dependency-lock.patch](dependency-lock.patch), root lock restored and `git apply --check` passes against the input lock. No new direct package dependencies. Installed versions remain the inherited exact `apps/web/package.json` versions (React19.3.0, Vite8.3.2, assistant-ui0.15.23, ansi-to-react6.2.6 etc.); only original Lead integrates the shared lock.

## Preview and reproduction

Worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host`, branch `codex/web-plugin-host`. A dedicated preview is running at [plugin fixture](http://127.0.0.1:5190/src/plugins/fixture/index.html); `?fail-load` injects one loader failure. Port5190 was checked unused before startup. Existing5174/4317/4320 services were not stopped or restarted.

```sh
cd /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --dir apps/web exec vite --host 127.0.0.1 --port 5190 --strictPort
```

Fresh dependency installation needs the authorized local lock exception or Lead's eventual integrated lock. Keep root manifests unchanged; export and restore temporary root lock after installation. The browser config reuses this dedicated fixture server if it is already running.

Production fixture build (from `apps/web`, choose a new temporary output directory):

```js
import {build} from 'vite';
await build({build:{outDir:'/tmp/flow-plugin-fixture-output',rolldownOptions:{input:process.cwd()+'/src/plugins/fixture/index.html'}}});
```

## Screenshots

[Light desktop](host-light.png), [dark desktop](host-dark.png), [dark390px / reduced motion](host-narrow-dark.png). These are functional fixture screenshots, not proposed final product layout.

## Integration boundary and remaining work

M02 owns App/Thread/workspace integration. The five implementation commits, in order, are `2dad8cac7586c294a7c559b31161b201f791199e`, `46164d611e6ccf836ab1efa1f5091288976b80d5`, `3d8121006fea24b6b9f25457eb363a10110781ad`, `d81075c1220fc0305bf698d84823caa4877c2d89`, `e5341915ebbffd9a667f68f7d1ca9c45c14c7c52`. Do not copy code or implement a second host; coordinate any host changes with this owner. See [frozen interface](interface.md).

App must validate authoritative task/reference membership, retain the connection epoch, dispose old host on disconnect/change, reject an aborted/stale command at the bridge, and never expose client/token in plugin context. The fixture demonstrates a safe supplied bridge and artificial data only. M02's native workspace tabs should remain the App layout authority; PluginTabs is optional convenience, not a mandatory second tab host. Real composer insertion remains explicitly unsupported in M02 until its safe seam exists; fixture insertion does not claim product support.

Pending: whole-candidate independent review, M02 explicit cherry-pick/App acceptance and real-center integration. No third-party sandbox, package installation/lifecycle, CLI/backend X01 implementation, arbitrary filesystem/PTY, settings persistence, Firefox/Safari/screen-reader or low-end performance claim. No automatic approval inheritance from an implementation SHA to metadata HEAD.

PH-R3 owner repair at e534191 adds Notes local role=alert, failure recovery and frozen renderer context. Root independently reproduced failure and then verified repair with real CUA5190, including successful retry and cleared alert; whole review conclusion awaits the additional M02 React/interface read-only assessment. The 14 module test result remains applicable because all five reviewed module files are unchanged from3d81210; final9 browser/typecheck/build/smoke ran on repaired implementation.
