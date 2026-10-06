# Interaction controller

This module owns local selection, draft, observation epochs and one unresolved durable command intent. Flow remains the authority for conversations, tasks, permissions and assistant replies.

`createInteractionController({ client, connectionId, intents, makeKey?, pollMs? })` accepts a narrow typed FlowClient port and a persistent `load/save/clear` port. `initialize` reads local state without dispatch; `execute` and `input` share one command descriptor/handler table; `snapshot/subscribe` serves both the Ink and headless consumers. `disconnect` aborts local observation. Async `dispose` also waits for in-flight intent cleanup and never cancels a center task.

Mutation bytes and key are persisted before dispatch. Unknown outcomes retain their identity; only explicit `recover` retries. Epoch changes are checked before dispatch, after acknowledgements and after history reads. The module keeps no conversation database, provider loop, local command queue or assistant-ui history runtime.

Limits: 16,000 UTF-16 code units and 64 KiB per draft; 6 conversation/profile rows (all visible); latest 20 turns with 4 KiB user and 8 KiB assistant text each. Truncation is explicit. Polling is one timer, stopped on disconnect/disposal. Protocol text remains raw; `terminalText` is a display-only transform.
