# Trusted data renderer module interface

Fixed input: `fb906cb42391971a8b315dbd813f7633927d7265`. This module is a display adapter; actual ConversationThread/App wiring is a separate claim. P01 remains the sole lifecycle owner; no install/enable/grant state is introduced.

## Exports

- `src/data-renderers/registry.ts`: `DataDeclaration`, `DataRenderer`, `createDataRendererRegistry(declarations, host)`, `FLOW_REPLY_NAME`, `FLOW_REPLY_OWNER`. Host is the existing P01 `list/subscribe` seam. The catalogue is atomic, sorted, frozen and rejects duplicate names independent of order. Names must start with their owner id; `flow.*` / `flow-*` are reserved, with only `flow-reply-detail` v1 owned by `flow.reply-detail` allowed. A single name has one declared version. Declaring does not load or attach.
- Registry exposes `catalog`, `getSnapshot/subscribe`, `getDiagnostics`, `resolve`, `attach`, `dispose`. Existing trusted P01 loader calls `registry.attach(ownerId, name, Render, context)`. It joins `context.own` and `signal`, checks the declaration, and only resolves ready when that P01 owner is active. A disabled/failed/rolled-back generation cannot revive. `dispose` removes subscriptions and attached abort listeners. It does not dispose the external P01 host.
- `src/data-renderers/react.tsx`: `AssistantDataRenderers({registry,fallback?})`, `defaultDataFallback`, `summarizeData`. Mount once inside each isolated official `AssistantRuntimeProvider`, replacing legacy `makeAssistantDataUI` registration. Its stable provider-local wrapper registers declared names plus the unknown-data fallback; cleanup removes only that exact function. Do not mix another registration for the same name/fallback into that provider: this is an exclusive integration seam, not a strategy of relying on upstream first-registration priority. Multiple panes share the immutable catalogue/lifecycle, never the wrapper or aui client.
- `src/data-renderers/flow-reply-detail.tsx`: `flowReplyDeclaration`, `FlowReplyDetail`, `flowReplyFallback`, `ReplyBindingsProvider`, `createReplyPort`, `ReplyIdentity/ReplySnapshot/ReplyPort/ReplyBindings`.

## Reply port and authority

`ReplyBindings={connectionId,viewId,bind(messageId,turnId):ReplyPort|null}` is supplied by the App for the current message. It must verify actual conversation/turn/task/message membership and existing read permission before returning a port. Neither registry declarations nor plugin active state grant read permission. Plugins get no FlowClient/token/arbitrary ID lookup. Builtin legacy detail reads retain the existing authorized path; general third-party grants remain P01/App/X01 work.

`ReplyIdentity` carries connectionId, viewId, conversationId, messageId, turnId, taskId and detailKey (the existing projection's complete source/attempt/version/digest/reference key). `createReplyPort({identity,signal,current,source,load})` freezes this identity. `current` rechecks actual identity and permission for every snapshot/read; signal ends the connection. `source` is a stable narrow immutable `ReplySnapshot` observable, not a token stream. `load` invokes the existing `projection.loadReply(boundTurnId)`; the projection remains responsible for dedupe, identity/digest checks and caching. No HTTP response is copied into renderer-local state. Old promise completion is rejected when the port lifetime ends; it cannot write into a new view.

Reply data accepts legacy `{turnId}` only for `flow-reply-detail`, normalized to v1, and explicit `{turnId,version:1}`. IDs follow public 1–128 length. Unknown versions/malformed payloads get no bind/read capability. Builtin parsing returns a detached frozen object. Other build-time trusted declarations are responsible for pure validation and detached immutable parse output; the registry catches schema errors but does not recursively clone arbitrary plugin values or sandbox them.

`ReplyBindingsProvider` owns only per-identity disclosure state so React Activity cleanup/re-registration does not lose expanded UI. It owns no reply content cache or authorization. Supply a stable bindings object per connection/view; remount/key the entire integration by connection/host lifetime. Close removes local disclosure; hide/restoration preserves it and the projection's cache. Source notifications can rerender, but do not fetch.

## Fallback / bounded output

Unknown name/version/schema renders an escaped diagnostic summary without a read port. Summary budget: depth 3, 8 members per object/array, 48 visited nodes, 512 characters per string, 4096 output characters plus a fixed truncation marker. Cycles and accessors do not execute arbitrary getters. Original text parts stay in the official Thread. For validated Flow reply parts only, inactive/failed/throwing enhanced renderers use the standard builtin detail display and the same host-authorized binding. React render errors are locally contained; P01 deactivate/reactivate yields a new renderer generation for recovery. Async read errors remain local and retry is explicit.

## Later App integration (not implemented here)

Separate claim will replace the legacy ReplyDetail registration in `conversations/ConversationThread.tsx`, construct ports from its existing projection, and bind registry lifetime to `plugin-integration/session.ts` / provider in `plugin-integration/react.tsx`. Current messages format does not need changing. Preserve current authorization and connection epoch, remove the old named registration, and do not share aui roots across split panes. Queue owner currently owns ConversationThread; no transfer or overlap is implied.

Actual fixture uses the existing FlowClient, ConversationProjection (including digest/detail cache), official Thread, real P01 host, two isolated providers, StrictMode and Activity. It simulates public HTTP, not a real center/model. X01 npm lifecycle, persisted grants/CLI equivalence/third-party isolation and K01/K02 DTOs are outside this module.
