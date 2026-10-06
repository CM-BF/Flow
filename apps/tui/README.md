# Flow terminal — conversations and goals

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
| `/turn number` | Observe one turn from the loaded history; the latest turn is selected initially. |
| `/activity [next]` | Load a page of activity references; no tool or thinking body is fetched. |
| `/detail number` | Read the selected activity's public body, when available. |
| `/reply` | Read the complete recorded final reply through its bound conversation/turn reference. |
| `/page number` | Read another 2,000-character display window of the current body. |
| `/back` | Return to assistant text and follow its latest window. |
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

When the center supports the negotiated patch protocol, assistant text grows automatically. The terminal follows one turn and shares its stream validation and final-settlement rules with the Web client. Interrupted or incomplete drafts remain visibly incomplete; only the center's explicit settlement can replace a draft with the final reply. Older centers retain the final preview path.

Activity and full-reply details are read only on request. Redacted activity has no public body; truncated activity is a fragment, and the remainder cannot be recovered through this view. Activity pages become visibly stale when the task changes, until `/activity` refreshes them. Observation allows at most two concurrent reads and four waiting reads, one activity page of 20 references, four cached bodies of at most 64 KiB each, and the stream protocol's 1 MiB / 256-block / 4,096-patch bounds. Display paging leaves original text and digests unchanged.

In conversation mode, older-history navigation, queue/steer/cancel/decision controls, attachments and a login manager remain separate work. No real-provider conformance is claimed. The original conversation slice used isolated HTTP/PostgreSQL fixtures; this observation slice uses real local HTTP fixtures, an owned PTY and existing Web consumers, with no model call. See [conversation evidence](../../docs/evidence/tui01a/README.md) and [observation evidence](../../docs/evidence/tui01c/README.md).

## Observe and control an existing goal

Select one saved goal explicitly. Without `--goal`, conversation behavior is unchanged.

```sh
pnpm --filter @flow/tui start --goal GOAL_UUID
pnpm --filter @flow/tui start --goal GOAL_UUID --headless
pnpm --filter @flow/tui start --goal --help
```

Goal mode uses the public goal session controller. Ordinary text stays in a local draft; Enter does not interpret it as an execution request. Ctrl-J inserts a newline. Reads and commands are explicit, and `/observe` refreshes execution state. There is no automatic dispatch or model explanation.

| Command | Behavior |
| --- | --- |
| `/plan [next]` | Read a page of node titles, input versions and dependencies. |
| `/observe [node IDs]` | Refresh the listed nodes, or the current plan page, without reading material bodies. |
| `/history [next]` | Read immutable explanation references, 20 per page. Historical evidence does not assert current validity. |
| `/goal`, `/input NODE VERSION`, `/explain VERSION` | Explicitly read the fixed goal, input or explanation body. |
| `/artifact NODE [execution\|accepted]` | Read the artifact bound to the currently observed execution or accepted delivery. |
| `/decision NODE` | Read the observed pending decision body. |
| `/decide NODE approve\|reject`, `/cancel NODE` | Submit a command using the observed task and decision identities. Cancellation acceptance does not prove the runner has stopped. |
| `/command JSON` | Submit an explicit public `GoalSessionCommand`; the existing `goal/execute` command runs a fixture. This mode does not implicitly authorize native execution. |
| `/recover` | Recover an unresolved request with the original key and body. A version rejection refreshes observation without sending a replacement. |
| `/page NUMBER`, `/quit` | Page the displayed content locally, or close observation without cancelling background work. |

JSONL uses the same handlers, for example `{"type":"observe"}`, `{"type":"history"}`, `{"type":"input","nodeId":"NODE","version":1}`, or `{"type":"quit"}`. Domain writes use `{"type":"command","command":...}`; their schemas and authority remain in `@flow/interaction/goal`. Exact request bodies and keys are saved before submission. Restarting never resends them automatically.

Goal journals use a separate connection-and-goal namespace. They share private file permissions, atomic replacement and exclusive locking with conversation journals; existing conversation filenames and JSON are unchanged. A goal can therefore be observed separately from a conversation, but two writers to the same goal journal are rejected. Draft text is local and is not a durable journal entry.

Plan/history pages contain 20 references; one observation contains at most 50 nodes. Bodies are read only on explicit expansion, cached by the public controller and labelled as recorded content. Refresh `/plan` and `/observe` to check current validity. The screen shows bounded windows of at most 1,600 Unicode code points, adapted to terminal size. It does not silently truncate the stored body. Private journal and JSONL bounds remain 192 KiB.

This goal slice is checked with two public clients, real local HTTP/PostgreSQL, actual JSONL and an owned terminal. It covers stale versions, lost acknowledgements, decisions, cancellation, artifacts, 57 historical references, Chinese/emoji/multiline input and resize. Browser handoff, real providers and the complete TUI→Web→TUI journey remain unverified here. See [goal evidence](../../docs/evidence/tui01d/README.md).
