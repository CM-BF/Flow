# Flow Web (W01)

A center-driven React application. The shared `@flow/client` performs every task command and read; the browser holds a disposable projection and detail cache. The complete official assistant-ui Thread element renders messages, actions, markdown and the new-task composer through ExternalStoreRuntime. Official AI Elements FileTree and Terminal components render a right-hand task workspace. Split/merge changes views only; it never merges center histories.

## Run the HTTP fixture preview

Use Node 24.20.0 and pnpm 9.15.4. From the worktree root:

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
pnpm install --no-frozen-lockfile
pnpm --filter @flow/web fixture
# In another terminal:
VITE_FLOW_FIXTURE=true pnpm --filter @flow/web dev
```

Open <http://127.0.0.1:5174/#task=demo-decision>. Web listens on loopback 5174 and its proxy defaults to fixture port 4317. Browser tests use isolated 5175/4318. The fixture is a contract-shaped, process-memory HTTP adapter: it simulates accepted tasks across browser reconnects, but cannot prove database persistence, process restart, real model behavior or actual artifact verification. The page visibly labels this mode.

The root lockfile change is supplied as `docs/evidence/w01/dependency-lock.patch`, not committed as a shared lock. The Execution Lead must regenerate/integrate the workspace lock with `apps/web/package.json` before a frozen install. Owners may temporarily regenerate only their own worktree lock under the handoff exception.

## Connect a real center

```sh
FLOW_CENTER_URL=http://127.0.0.1:YOUR_CENTER_PORT pnpm --filter @flow/web dev
```

Leave the Center URL input blank to use the same-origin development proxy, then provide the owner token in the connection form. The token remains in page memory and is not stored in localStorage or embedded in a URL. Reloading a real-center page requires reconnection. A direct Center URL requires the center to permit the Web origin via CORS. Production serves `dist` and proxies `/api` to the center over HTTPS. Never use `VITE_FLOW_FIXTURE=true` for a real-center build.

```sh
pnpm --filter @flow/web build
pnpm --filter @flow/web typecheck
pnpm --filter @flow/web test
pnpm --filter @flow/web test:browser
```

Browser validation uses the locally installed Google Chrome through Playwright. It creates screenshots and JSON evidence in `docs/evidence/w01/thread-revision`; no live center or model calls are made.

## Behavior and extension points

- `src/projection.ts` is the HTTP projection module. It retains the last delivered `nextCursor`, merges pages by event ID, reloads after stream reset, and treats empty SSE pages as status/decision/usage updates. Older history starts at cursor 0 while current observation keeps its own cursor.
- Closing, disconnecting or navigating away only aborts the observer. Cancellation is an explicit two-step user action and `cancel_requested` stays distinct from `cancelled`.
- Submission and commands reuse a stable idempotency key after an ambiguous response in the current page session. Changed submitted content gets a different key. Keys are intentionally not persisted with prompts across reloads.
- References expose only ID/title until expanded. Detail reads are deduplicated and scoped to the selected task generation. Detail content is displayed as escaped text. Chat text uses the official Markdown renderer without raw HTML execution.
- Execution, artifact acceptance, artifact version, and usage source/completeness remain separate facts. Null usage is unknown, never zero. A completed execution may retain failed verification evidence.
- `src/themes.ts` registers complete semantic token sets. Add a theme with a unique ID, label, light/dark scheme and optional semantic token overrides. Defaults use the official shadcn palette; the activity bar switches light/dark. Only the theme preference is stored. CSS contains responsive, visible-focus and reduced-motion rules.
- Task URLs use `#task=<encoded ID>`; skip-to-content moves focus without replacing the route.

## Limits

No real center/runner/harness integration or independent review is implied by fixture checks. The browser does not independently verify artifacts or reconcile uncertain runner ownership. Native session resume is represented by server evidence; no new session recovery workflow is invented in W01. Failed authentication is shown as the center error and users can change the connection. Long history is progressively loaded by request; it is not an unbounded eager fetch.

## Official Thread adaptations and workspace limits

The copied registry sources, exact SHA256 hashes, and necessary Flow adaptations are recorded in `docs/evidence/w01/thread-revision/provenance.md`. Existing accepted tasks hide the composer because the public center contract does not support appending messages, editing prompts, or regenerating answers. These capabilities have no fabricated callbacks. New tasks use the official Composer; its failed sends restore a draft and retry with the projection's retained idempotency key. Escape never requests cancellation.

Chat tabs keep one projection per task. Split moves the active tab into a second group; merge combines the tab groups without combining messages. Closing a tab only disconnects observation. Unsent text/backend/scenario and right-panel selections survive split/merge in this page session. They are not persisted across a browser reload. Terminal shows read-only task text; Files lists center-returned references, not arbitrary local files or a PTY. Reference content is fetched only when opened.

Stable `data-extension-slot` names mark future plugin integration locations. They are identifiers only; this delivery does not claim a plugin execution system.
