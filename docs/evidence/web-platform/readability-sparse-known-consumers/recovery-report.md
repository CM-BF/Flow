# Recovery next8ed / two readability sparse candidates

**Conclusion: no direct path, final realpath, intermediate symlink traversal, or declared recursive-directory overlap was found with any of the12exact candidate directories.** This is limited to the current next8ed manifest's exact dependencies and its two entry scripts' explicit file references. It does not authorize sparse changes or certify all future work free of dependencies.

Input manifest `/private/tmp/recovery-browser-next8ed-0v6ddc46/manifest.json` SHA `4db938e316990f45c90561fd0357035ed3de8e25d13f6450973f1a0b3afa7546`; metadata `000a4182a3416bf9a8f5685ae2dbbf8f5f950b06` / source `8ed2741327779e57d717653d10c2180e1897c26a`. Candidate Git identities resolve as activity `be977a23cff08edf6ac46d18750c3400bf9a2218` and conversation `cd26404fd0a3eed6c0053ae374d198ee5e5fc4fb`. This report did not inspect their running previews, personal processes or owner ledger; those remain separate manager/Lead responsibilities.

## Exact scope checked

For each of `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-readability` and `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-readability`, only `docs/evidence/{w01,d06,i01,chat06p01,d01,wpf-perf01}` was treated as a sparse candidate. Neither own evidence directory nor either node_modules/preview/service was a deletion candidate. All12absolute paths and realpaths are in audit.json.

Checked19source entries,9fixed public inputs,11package directories/manifests and their recorded realpaths,11runtime-file entries and recorded realpaths,Nodebinary/Chromeplist,25prior raw entries,2prior budget files,source/runtime approval files,old4d preparation references and current preparation/manifest files. After de-duplication `114` exact paths/declared recursive directories were checked. Path resolution records intermediate symlink destinations, not just lexical/finalpaths, so a link through a candidate then out elsewhere would also be flagged. No filesystem breadth scan was used. All hits are empty.

## Why the known delayed reads stay outside these scopes

- Browser `apps/web/test/conversation-recovery.browser.ts:11–12` derives its own Recovery root/evidence. Lines57–63 read its19source files and own `browser-runs/*/budget.json`;68–71 scan only its evidence-root legacy budget names. Its recursive retained-evidence accounting stays inside Recovery's own `docs/evidence/wpf-conversation-recovery`, which is outside all12targets.
- The same file137/274 imports its sibling fixture;279–280 imports the declared public client/contracts. Fixture `apps/web/test/conversation-recovery.fixture.ts:10–11` derives the same root/evidence and233 imports same-tree server plus pg/Vite/publicclient. No explicit reference in either entry names the two old readability evidence roots or the six candidate evidence names.
- @flow directory paths resolve into the Recovery worktree. Existing third-party package/runtime links resolve into **web-attachment-production/node_modules**, not either readability worktree. Node and Chrome are the already pinned system paths. This does not license editing shared dependency targets.
- Root/approval/history records and all25old raw files used by this preparation are in Recovery's own evidence or existing `/private/tmp` preparation directories. Keeping61108/55616 previews/node_modules is outside this report; it gives no permission to stop/alter them.

## Limits / no activity

The future manager gate/adminenv are placeholders, not yet bound files; no credentials were read and no newenv/gate created. Future run/scratch names and the full dynamic module closure were not guessed. Any new intake must recheck its actual paths. This is not an all-future-dependencies certificate, not a runtime pass, and not a statement about other agents or previews. No project/sparse/registry change, imports/tests/HTTP/PG/Chrome, personal/proc/service inspection or free-space sample. Reused local find-skills/clean-code methods. Only this own/tmp report/audit was written.
