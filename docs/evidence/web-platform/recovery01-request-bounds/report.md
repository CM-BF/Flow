# RECOVERY01 request-capacity evidence (read-only, not journal implementation)

Fixed source: `cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd`. Diagnostic executed 2026-10-06T13:22:35.769Z, Node v24.20.0 + existing Zod 4.6.5. No HTTP, PG, browser, provider, install, service operation or project write. Source objects/hashes: `source-manifest.json`; reproducible pure-memory program: `probe.mjs`; actual schema checks and byte results: `results.json` in this same /tmp directory. Skills method: previously read local find-skills/clean-code; bounded fixed-contract inspection, explicit units, executable constructors; no skill install or new feature plan. Temporary loader copies only change `.js` relative import extensions to `.ts` for Node native type stripping; original source SHA256/Git blobs are recorded.

## What is proved

For the public compact `JSON.stringify` bodies used by FlowClient, the following are conservative UTF-8 serialized-body upper bounds (bytes, not characters). All extrema were parsed successfully by the fixed public schemas. U+0001 is one legal non-whitespace UTF-16 unit and one UTF-8 input byte, but serializes as six ASCII bytes (`\u0001`); use it rather than pretending text length equals JSON size. A bounded arbitrary string of N UTF-16 units requires at most 6N+2 bytes including JSON quotes; valid surrogate pairs take fewer bytes per unit. Fixed UUID/digest/enum fields and integer decimal widths are included.

| Request body | Complete compact JSON bytes | Qualification |
| --- | ---: | --- |
| CREATE with optional profile+project, title180/model180 | 3,248 | Public schema ceiling; actual configured model syntax is ASCII and reduces this to 2,348. Existence/authorization is not asserted. |
| follow-up turn, text16000, four knowledge refs, explicit attachments=[] | 100,055 | Maximum over all five joint-four knowledge/attachment mixtures. |
| turn, three knowledge + one attachment | 100,011 | Largest mixture with nonempty attachments (v2). |
| turn, four attachments | 99,883 | Full refs, not filename/body copies. |
| queue enqueue, text16000, four knowledge refs | 100,041 | Queue separately requires text UTF-8 <=16000, so the control-character construction still reaches the conservative ceiling. |
| queue enqueue, three knowledge + one attachment | 99,997 | v2 mixture. |
| queue cancel-item / pause | 36 each | Body only: expectedQueueRevision. Both path identity and original key are additional persistent fields. |
| queue resume | 824 | expectedQueueRevision + 128-unit expectedTaskId. Preserve explicit null versus actual ID. |
| task cancel | 2 | Exactly `{}` body; target taskId/original key absolutely must survive. |
| owner steer accept | 99,160 | text16384 bytes, attemptId128, revision2147483647, public ownerVersion safe-integer ceiling. Existing Web ownerVersion gate is narrower. |

CREATE + maximum joint-four turn bodies sum to **103,303 B** (100.882 KiB). New-conversation initial turn revision is actually 0, so using the maximum revision is deliberately an overestimate. This is a valid upper bound for all admitted requests, not a claim all maxima can be admitted simultaneously: selected-material execution input is separately limited to16000 UTF-16 units /49152 UTF-8 bytes after metadata+source compilation, and profile/project/identity/existence/CAS/authority can reject constructed extremes. In particular a control-character requested model is schema-valid but not supported by the catalog. No server admission was attempted.

The two individual arrays' public request schemas allow4 knowledge+4 attachment refs, but the joint context and Web freeze boundary reject combined count>4. The purely parser-valid ceiling is103,846 B(turn)/103,832 B(enqueue); do not describe these as admissible eight-reference requests.

## Envelope and reserve implications

128 KiB means131,072 B;32 KiB means32,768 B;4 MiB means4,194,304 B. Public bodies alone fit128 KiB with margin, including two-step CREATE+turn. This **does not prove a full journal record fits**. The new record schema must bound and measure its complete serialization before any network dispatch. Preserve one copy of each immutable body, not both a raw serialized string and a duplicate parsed object.

An explicitly illustrative two-step record including schemaVersion/logicalId/kind/connectionScope/viewKey, both200-visible-ASCII original keys, both bodies, bound conversationId, state and everUnknown measures107,379 B when bodies are objects; storing those bodies as JSON strings measures124,533 B because backslashes/quotes are escaped again. The latter leaves only6,539 B before128 KiB for any omitted real metadata. This is a caution, not a proposed canonical schema or its validation. Server command keys only impose length<=200; an extra-conservative schema-only bound allows1,202 B per encoded key string. Ordinary generated UUID keys are much smaller. Do not assume all generic200-unit keys are HTTP-header-valid. The public client transports keys in headers separately from bodies.

Budget explicitly: journal schema/version, command discriminator/phase, stable local logical ID, non-secret connection/recovery namespace and stable view identity, route target IDs (conversation/item/task), exact original key(s), exact parsed/frozen bodies preserving optional omission versus[], request digest(s) if used, everUnknown, created/updated timestamps, bounded failure code/short summary, and minimal accepted identities. Endpoint/baseURL/free-form error/snapshot strings need their own finite limits; public request DTO bounds do not bound those UI/envelope fields. Credentials and tokens are never persistence fields.

Measured **illustrative minimal accepted identity objects**, using128-unit IDs and max revisions, require811 B(create conversationID+revision),2,391 B(turn conversationID/turnID/taskID/number/revision),1,618 B(queue conversationID/itemID/sequence/queueRevision),3,376 B(steer task/attempt/command/nativeSession IDs, ownerVersion/revisions/userUUID/inputDigest+bytes). They make32 KiB growth reserve plausible, but the exact future schema/transition/index overhead must still be enforced. Persist verified identity/state rather than full ConversationTurn/TaskSummary, assistant text, complete ACK, unbounded server error or a second user-body copy. Ordered frozen refs remain in the original request; do not silently re-resolve versions or overwrite them with a newer response.

**CREATE is one logical command with two physical POST stages**: persist creationKey+turnKey and both original bodies before stage1. After valid CREATE, durably bind the resulting conversation ID before turn POST; after a crash, replay the original CREATE if still unknown, never create a new key/title/profile/project or regenerate a turn revision. A prepare-only creation record has request=null and must not fabricate a turn. The second stage must not require an unreserved fresh command allocation once CREATE is committed.

**Stop has two distinct operations**: queue pause with original CAS/key and task cancel with its own original key+explicit task target, even though cancel's body is{}. Retrying an unknown cancel cannot derive its target from the queue's new currentTurn. Queue cancel-item additionally persists itemID; resume persists expectedTaskId/null. Steer persists original task target+attempt/ownerVersion/revision/text+key; accepted receipt identity is not permission to retarget a new attempt. Minimal identity still must be validated via the existing public decoder before persistence.

**Global admission is conjunctive, not a promised occupancy**:128×32 KiB reserves alone =4 MiB, so128 nonempty reserved commands cannot all fit.32×128 KiB drafts also =4 MiB before metadata/commands. A128 KiB command+32 KiB reserve costs160 KiB; at most25 such records fit4 MiB before all other state. Counts32draft/128logicalcommands are independent ceilings; admit only if actual serialized bytes + outstanding reserved growth + index/envelope overhead fit global budget. Unknown/unresolved records must not be silently evicted to meet these caps. Reservation should be atomically charged before POST and consumed by bounded updates, not merely checked after acceptance. This research does not establish browser storage quota, UTF-16 storage allocation, crash atomicity, multi-tab concurrency or implementation capacity.

**Draft128 KiB has a separate gap**: public submitted text is bounded, but arbitrary unsent editor text need not already satisfy the request schema. Do not infer every editable draft fits. Measure actual draft serialization (text, current selected immutable refs, profile/project and binding metadata), explicitly handle persistence rejection while retaining the live draft; never truncate it or send without refs. Ready/unknown upload journal and body re-selection are separate existing mechanisms, not included as full uploaded file-body copies in each command.

## Exact fixed-source anchors

Use `git show cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd:<path>`; line numbers below are for that object, not moving worktree files.

- `packages/contracts/src/tasks.ts:14` idSchema max128 UTF-16 units.
- `packages/contracts/src/conversations.ts:9–29` requested model180/title180, creation profile/project, turn text16000/revision/mode/optional refs.
- `packages/contracts/src/execution-profiles.ts:9–10` catalog ASCII model syntax180 and UUID/UUID/64hex profile reference.
- `packages/contracts/src/knowledge.ts:4–7,14–21` UUID source/version<=16, locator numeric limits262144/span4096, citation projectID/digest.
- `packages/contracts/src/attachments.ts:31–42` upload reference and array max4; no attachment body or filename in submitted ref.
- `packages/contracts/src/conversation-context.ts:6–10,105–112` context limits and combined selection helper (see exact symbol `conversationContextTemplate`).
- `packages/contracts/src/conversation-queue.ts:6–19` all four queue write bodies: enqueue/cancel/pause/resume. No edit/reorder write is declared in this fixed contract.
- `packages/contracts/src/active-steering.ts:5–13` owner steering body/UTF-8 limit/no NUL or lone surrogate. Runner receipt/mailbox/finalize inputs are a different actor/API and are not browser journal commands in this scope.
- `packages/client/src/index.ts:385–387,404–406,439–457,475–476` compact serialization, routes and separate original keys; task cancel exact{}.
- `apps/server/src/tasks.ts:25–42` operation+key idempotency, max200, canonical original input digest and immutable replay.
- `apps/server/src/conversations/commands.ts:13–25,29–40` supported model/thinking, project, create versus turn operation, turn CAS/mode, freezeContext.
- `apps/server/src/conversation-context/store.ts:18–23,46–60` compiled execution limits/joint reference+raw-byte budget.
- `apps/web/src/conversations/outbox.ts:18–31,58–86,89–106` exact two-stage keys/bodies, prepare-only discriminant, immutable retry/bind/everUnknown.
- `apps/web/src/conversations/projection.ts:290–329` original CREATE→bind→turn dispatch and shared ACK checks; receipt does not overwrite newer execution facts.
- `apps/web/src/conversations/queue/commands.ts:13–29,98–106,117–130` all five UI queue command variants including cancel-task, original-key retry and frozen command.
- `apps/web/src/conversations/queue/projection.ts:122–132` pause/refresh/expectedTaskId guard before explicit cancel target capture.
- `apps/web/src/conversation-context/receipts.ts:12–22` joint4 and project freeze boundary.
- `apps/web/src/conversation-steering/control.ts:12–20,55–72` current local receipt shape, bounded ID/revision gates, accepted metadata.

## Limit of conclusion

This is fixed-schema byte accounting and actual in-memory parse/serialization evidence, not RECOVERY01 implementation, storage design approval, a public-limit change, an end-to-end recovery test, or a provider/center capacity claim. It supports the proposed128 KiB initial body-containing budget only after the final bounded envelope passes full-byte admission, and highlights the need to charge32 KiB growth reservation inside the global4 MiB budget.
