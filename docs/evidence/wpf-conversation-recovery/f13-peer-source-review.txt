# Recovery checkpoint fixed-source review

Target: `f13de5c13e3983b94e16ae857ddc7b01cbba7a26`.
Repository: `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery`.
This is a bounded source review of the three earlier w01 findings and their actual App consumers. It is not a final candidate approval. All line numbers below refer to `git show <target>:<path>`, not the current working tree. SHA-256 and Git blob IDs for 18 fixed inputs are in `sources.json`.

No project file writes, product imports, Vitest, IDB execution, browser, noEmit, HTTP, PG, services, build, installation, or provider calls occurred. Only Git object reads and this small /tmp report were performed. The five root findings about handoff/CAS/namespace/storage classification/logout were not independently re-reviewed; the existing accepted checkpoint guard is cited solely to establish the restore consumer's behavior.

## Result

The three original implementation defects have concrete source changes. The name-limit fix and fresh old-version resolve fix address their original counterexamples. Terminal-state restoration works for fresh empty controllers, but **one P2 App reconciliation gap remains for an already-present receipt with the same key**. There is also a smaller cached-reference verification edge (P3, with an explicit UI workaround).

## P2 — accepted durable checkpoint cannot resolve the same receipt already present as unknown

Locations:
- `apps/web/src/App.tsx:674,682–685,698–701`.
- `apps/web/src/conversations/outbox.ts:77–80,114–121,139–143`.
- `apps/web/src/conversations/projection.ts:317–319,336–350` and `166–198`.
- `apps/web/src/conversations/queue/commands.ts:122,129–133`.
- `apps/web/src/plugin-integration/steering.tsx:127–131`.
- `apps/web/src/recovery/journal.ts:198–203` (existing accepted barrier, not a new CAS finding).

The App's accepted outbox branch deliberately skips `restoreReceipt`, but never clears or reconciles an existing outbox entry with `record.id`. Queue and Steering similarly skip restoration whenever that key already exists, without considering that the durable record can now be terminal. A GET refresh updates conversation facts; it does not settle the local outbox.

Concrete reachable sequence, established from source (not executed):
1. The page still holds original receipt K as unknown. Another tab has resolved K and persisted accepted; alternatively an accepted checkpoint commits while the request signal expires before the subsequent local `accept` (projection lines 317–318 or 336–337).
2. Refresh Saved drafts and receipts, then choose Restore without sending on the now-accepted record K.
3. App restores/open-refreshes the view but skips the existing K. Unknown remains; next Send or Queue still sees an unresolved receipt. Steering likewise retains the unknown receipt even though the selected persistent record contains its accepted command checkpoint.
4. Original-key retry cannot repair this: `journal.prepare` now correctly refuses an already-accepted durable checkpoint and instructs the user to restore instead. Restoring repeats step 3. No duplicate POST is alleged; the defect is the local recovery dead end and false unresolved state.

The CREATE-only variant is stricter: accepted checkpoint can exist before projection binds the newly created conversation at line 319. On Restore, route is derived from the checkpoint, but `existing` selects the old draft projection whose internal id is still null; accepted restoration does not bind it, `refresh()` returns at line 167, and App reports that the center did not confirm the conversation (line 683).

Minimal correction boundary: add a terminal reconciliation path for the same original receipt after checking its full original keys/body, owner/conversation/project and checkpoint identity; do not blindly clear an unrelated/current sending receipt or replace the next draft. Accepted CREATE must bind/open its recorded conversation and negotiate GET without generating another creation key. Queue/Steering should apply the matching terminal checkpoint even when their key already exists. This is a consumer reconciliation issue, not a request to weaken accepted->nonterminal CAS protection.

Necessary later behavior cases (not run here): matching unknown -> durable accepted -> Restore resolves with zero POST and next draft unchanged; accepted CREATE before local id binding opens the bound conversation without CREATE; analogous Queue/Steering terminal reconciliation remains historical and does not overwrite newer server execution state.

## Original w01 A: changes verified, fresh-controller case repaired

- Outbox `49–61`: accepted is rejected as a resendable restoration; rejected remains rejected; original creationKey/turnKey and parsed frozen request are retained.
- App `670–685`: accepted outbox record opens the recorded conversation via GET rather than POST. The same-live-key exception above prevents calling this fully closed at App level.
- Queue `105–115`: restores accepted/rejected accurately; accepted message explicitly says historical, not current queue state. `122` excludes terminal receipts from the unresolved gate; `133` allows dismissal. Original command kind/target/input remains frozen.
- Steering control `127–137`: accepted checkpoint is parsed as a real command reference and compared to task/attempt, ownerVersion, expectedRevision+1, input bytes/digest. Accepted/rejected phases are preserved. `221–222` connects a restored receipt to subsequent validated command observations; `284–289` can clear resolved terminal receipts. Thus the earlier missing command-reference defect is repaired on a fresh entry.
- Actual Steering host `113–130` requires the original loaded task/turn and read authority; it does not reconstruct a new task from saved text.
- The checked checkpoint map accurately calls these source fixes and keeps behavior validation pending. Do not mark the already-present-receipt case as covered by the fresh restoration code or test below.

## Original w01 B: old-version explicit resolve fixed; cached edge remains P3

`conversation-context/controller.ts:211–215` validates the response first, then deletes that exact citation key from `unverified`. Therefore a restored historical reference absent from current search can become usable by authorized explicit resolve. Exact tuple and original version remain intact; no automatic upgrade to currentVersion occurs. App `691` passes saved knowledge into the existing binding; `plugin-integration/knowledge.tsx:33–38,78–85` retains project identity and uses controller.freeze before send.

Smaller source counterexample (P3, not the original permanent block): a controller has previously resolved citation R, then R is removed/consumed (body cache remains), and a saved draft with R is restored into that now-empty selection. Restore marks R unverified (`171–176`), but ordinary `expand(R)` returns the cached body at `202` without a request or clearing verification; freeze at `227` still rejects. The official ReferenceRow's details toggle calls this default expand (`ContextPicker.tsx:50`). Thus the message “Search or explicitly read each reference” is misleading for this cached path. The user can recover using the existing **Check this reference again** button (`59`, refresh:true), so it is not an indefinite block.

Minimal option: when a citation is unverified, bypass the normal body-cache early return and perform its explicitly requested authorized resolve; alternatively make the UI distinguish cached viewing from required fresh verification. Do not simply trust a retained body as a new authorization check. Later targeted case: resolve/remove/restore/default-expand/freeze, preserving old version and making exactly the required fresh read.

## Original w01 C: fixed public filename boundary at both restoration parsers

- Public `packages/contracts/src/attachments.ts:28–30`: max255 UTF-16 units, <=512 UTF-8 bytes, valid Unicode/no path/control chars, .txt.
- `recovery/binding.tsx:47–54` uses this schema for the display name and the public metadata schema; checks metadata reference project.
- `attachments/controller.ts:196–205` also uses the same name schema instead of the old <=240 check; `plugin-integration/attachments.tsx:194–196` calls this actual controller restore from App `692`.
- `"a".repeat(251)+".txt"` now passes the former failing name branch by source inspection. Reference identity/version/digest are retained. A saved ready file deliberately becomes unverified/error until the authorized directory reconfirms the fixed resource; this is not a restored-ready guarantee.
- Full accepted.resource/body truth, multibyte boundary execution, subsequent directory confirmation, and official composer reconstitution still need later behavior tests. This review does not report them passed.

## Frozen-material and test-source boundaries

`conversation-context/receipts.ts:12–23` still deep-freezes the separate ordered knowledge/attachment lists, rejects mixed project references and total count>4. `selection.ts:7,10–22` uses the complete tuple including version/digest/locator and preserves input order. Outbox restore parses creation and turn then uses this same material boundary; Queue enqueue restore uses the public request schema and same helper. No new renderer/runtime authority or body substitution was found in those inspected seams.

Fixed `conversation-recovery.test.ts:156–173` contains tests for both CREATE keys/rejected/accepted helper behavior, legal255ASCII filename+project mismatch, and a fresh restored historical knowledge resolve. These tests were READ ONLY. They do not cover same-live-key terminal reconciliation, Steering accepted checkpoint restore, cached old-reference restoration, or complete browser App reload/IDB behavior. The checkpoint-review-map explicitly says 13 test source cases, typecheck only and no runtime behavior claim; this review preserves that distinction.

Method: reuse existing local find-skills/clean-code/codebase-design baseline. Applied explicit source ownership, existing-authority reuse, narrow state-transition analysis, no new abstraction or runtime experiment. Local skill hashes are recorded for provenance; no reinstall or external lookup.
