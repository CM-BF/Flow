# Flow terminal — first conversation slice

Run with Node 24 and installed workspace dependencies. Set `FLOW_URL` to your center's origin and provide its owner token through `FLOW_TOKEN` in your environment. Do not put a token in command arguments or shell history. `FLOW_TUI_STATE_DIR` optionally selects an absolute private directory; the default is `~/.flow-terminal`.

```sh
pnpm --filter @flow/tui start
pnpm --filter @flow/tui start --help
pnpm --filter @flow/tui start --headless
```

`--help` works offline without credentials. The interactive screen and JSONL mode use the same command handlers. Discovery does not start a model. Sending a message can start the center's configured runner and incur provider usage.

| Command | Behavior |
| --- | --- |
| `/conversations [cursor]` | Load a page of saved conversations. |
| `/open ID` | Observe the latest 20 turns of one saved conversation. |
| `/profiles [cursor]` | Read configured profiles; this does not test provider availability. |
| `/new [--profile ID] [title]` | Create a conversation. A profile must first be loaded with `/profiles`. |
| ordinary text or `/send text` | Submit one ordinary follow-up using the observed conversation revision. |
| `/recover` | Explicitly retry the saved unresolved request with its exact key and body, once; otherwise reload history. |
| `/disconnect` | Stop local observation; center work continues. |
| `/quit` or Ctrl-C | Exit without cancelling work or submitting the draft. |

Enter submits; Ctrl-J adds a newline. Tab completes a unique command name. Chinese, emoji and grapheme deletion use the fixed `@assistant-ui/react-ink` TextInput. Remote text is rendered with terminal and bidi control characters visibly escaped. The editor rejects pasted control characters. Lists and displayed history are bounded; the center retains the full durable history.

Headless input uses one typed command per JSON line, for example:

```json
{"type":"conversations"}
{"type":"help"}
{"type":"quit"}
```

Each output line contains a command result and the same lightweight local snapshot used by the screen. It is a command interface, not a token stream. EOF stops observing. No automatic mutation retry is performed.

Before a create/send POST, the exact request and idempotency key are saved in a private, connection-bound intent file. A lost acknowledgement remains **unknown**. Starting the terminal again does not resend it; `/recover` is explicit. New mutations and conversation switching are blocked until recovery succeeds. The token itself is never stored. The directory must be owned and mode 0700, files mode 0600. An exclusive lock rejects a second terminal on the same connection. After a process crash a stale lock is not stolen automatically: first establish that its recorded local process has stopped, then remove only that connection's `.json.lock`; preserve the `.json` request for explicit recovery. The file sync/rename journal is not a multi-device store or a proof against every power-loss/filesystem failure.

This slice does not implement stream/tool/thinking views, older-history navigation, queue/steer/cancel/decision controls, attachments or a login manager. It does not claim real-provider conformance. Engineering verification uses an isolated synthetic adapter, real local HTTP/PostgreSQL and owned PTYs. See [evidence](../../docs/evidence/tui01a/README.md).
