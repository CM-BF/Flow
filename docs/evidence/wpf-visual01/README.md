# WPF-VISUAL01 — actual App shell and material

Implementation [source binding](source-binding.json): `a8b2b22a29bc3fb6ebd5252754d1e1cdbc975231`, base `9d6bd45abdf5149bc44f1e9dc534454e7403f7d7`. Five product files + two dedicated fixture/browser files, nine literal scopes. [Canonical status](../../../plans/wpf-visual01-shell/status.md) is the only handwritten progress source. Parent is WPF-MATURE-01; this slice does not close the full mature visual task.

The actual Flow App now has neutral compact chrome, inset rounded opaque conversation/workspace panes, fine boundaries, subtle shadows, and quieter typography. Appearance offers Light, Dark, Light opaque and Dark opaque. The original two rail theme actions remain; colors still follow the plugin palette. Opaque selections disable glass and persist through reload; contributed Ocean theme and disable→dark fallback are verified through the real host.

## Inspect and reproduce

Retained production fixture: <http://127.0.0.1:53047> (session64287). Development fixture: <http://127.0.0.1:65126> (session28071). Only synthetic public-contract HTTP data; no provider, DB, personal files, real credentials or user service. If connection is shown, fixture token is the non-secret literal `flow-fixture-only`.

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/visual-shell.fixture.ts --visual-preview --production
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/visual-shell.browser.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/visual-shell.browser.ts --production
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/plugin-host.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web build
```

Build before production verification when source changes. Tests start/close their own dynamic fixtures; retained previews are independent. Latest browser reports retain the actual1e29967+dirty execution source and seven SHA256s, rather than claiming the later commit existed during execution.

## Evidence

- [Validation and failure history](validation.md), [quality and scope](quality.md), [checks](checks.json).
- [Development eight journeys](development-browser.json), [production eight journeys](production-browser.json).
- [Fixed CSS baseline method](baseline-method.json), [baseline actual App report](baseline-browser.json), [dimension comparison](layout-comparison.json).
- [Baseline desktop](baseline-long-light-1280.png) → [current desktop](production-long-light-1280.png); [baseline narrow](baseline-long-light-390.png) → [current narrow](production-long-light-390.png).
- [Empty state](production-empty-light-1280.png), [dark reading surface](production-dark-1280.png), [opaque](production-dark-opaque-1280.png), [tool/thinking](production-activity-dark-1280.png), [split draft](production-split-dark-1280.png), [narrow error](production-error-dark-390.png).
- [Reduced transparency](production-reduced-transparency.png), [forced colors](production-forced-colors.png), [unsupported-backdrop branch](production-unsupported-backdrop-branch.png).

## Limits

The unsupported-backdrop branch is deliberately simulated by replacing only the CSS `@supports` condition in the HTTP fixture; it is not a claim of testing an old browser engine. Reduced transparency and forced colors use Chromium media emulation. Source images are synthetic actual App screenshots, not the private Arc reference image. No latency, accessibility certification, real-provider or actual personal-page deployment claim.

Plugin theme tokens still accept the existing color whitelist. Radius/shadow/blur extension remains MATURE01 follow-up; this slice uses host-owned material tokens and a narrow CSS override of styled Thread defaults. It does not change App/Thread JSX, plugin validation, workspace layout model or SDK/dependencies. Four built-in choices are not a complete theme/plugin system. Separate workspace navigation/view ownership observations remain their existing backlog.
