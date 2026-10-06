# RELEASE03 Files locator / sealed A-from-all review
Fixed c18bd6630cbdbb431460688a0f6bea9248f4151f; execution metadata ba7dea68ddaeb7238d47d0a31eddaec30a7783aa. Read only two source blobs plus preserved raw. Reused local find-skills/codebase-design/clean-code: ownership, failure preservation, narrow interface. No import/tests/HTTP/browser/PG/space sampling/project edits. Suggestions are NOT runtime approval.

## Observed locator failure
browser:378–383 uses page-wide exact Files plus visible. app.json/worker.json record two actual matches: global icon (aria-label/title Files) and Files inside region `RELEASE03 fixed attachment`. Existing app-failure.png shows composer Files; pageErrors=[]. Only plain Send check completed. This is harness ambiguity, not evidence of an attachment product failure.

Minimal fix: after project preparation (:403–404), select the expected conversation region by exact accessible title, assert unique/visible, and pass it to chooseFile. Use `chat.getByRole("button", {name:"Files", exact:true})`, not first()/nth()/negative icon selectors. The raw error supplies this role/name. Keep Project text files dialog page-level by exact title (portal), then Browse files/Use existing.txt within it. Assert the chip within the same chat. Title is the known prepared conversation title, not changing draft text.

Follow-through: chooseFile occurs twice (:404,:420), both need the same chat owner. Queue next is exact **radio**, not Center queue disclosure; scope it to chat. Send message, Message input, retry/receipt assertions can use that owner too. Knowledge and file dialog actions already use exact dialog containers. No separate Attachments-labelled click exists in this worker. Only Files ambiguity was observed; later queue/retry controls were not dynamically validated. Preserve every original key/body/ref assertion (:408–430).

## Minimal A-from-all admission extension (design only)
verifyHistoryAdmission:75–114 currently rejects this run: exact10 files, history/NOT_RUN, <=60s permitted, one child, and A end==wire.length. Keep that branch. Add one explicit reviewed source-kind branch for all/successful A/failed B, bound to pinned outcome, not caller assertion alone.

1. Require exact original10 PLUS app.json/app-failure.png; pin size+SHA for all12, exact directory set, regular no-symlink bounded reads and total<=8MiB. PNG is binary: :81 presently JSON-parses everything except process.log, so exempt PNG. Never crop/edit old raw into a history-only directory.
2. All branch: outcome.mode=all/historyPassed=true/phaseB=FAILED/passed=false/compatibilityId=null. Require worker.historyPassed=true/worker.passed=false/worker.app.passed=false plus nonempty error and worker.app==app.json. Preserve outer/worker/cleanup errors=[] and supervisor.result==worker/cleanup equality. checksAndCleanupPassed=false must not become true. Failed App raw/screenshot remain in proof.
3. Preserve owner marker, DB removal and timing checks. Actual all-run has exactly2 distinct owned PIDs (worker+Chrome), both exitCode0/signalCode null; validate both, not just first or arbitrary nonempty list. A-only retains one-child rule.
4. Keep two labels, backend head/tree/path/artifact, current historyContract and non-test protocol bindings. fixture:273–318 already validates each bounded wireRange via slice without modifying raw. Require contiguous ranges from0. History-only keeps end==wire.length; all allows final A end<wire.length, hashing the entire B tail. Actual [0,20],[20,39], full wire67. Never relabel filtered wire as original.
5. All permitted may exceed60s but <=180s and previousMs+permittedMs<=180000; elapsed<=permitted, cleanup timestamps and complete=true remain. Here permitted172017/previous7983/elapsed12326. Charge FULL all-run12326 once through existing cumulative scan (:138–146), not A duration. Cumulative20309ms is arithmetic, not new allowance/gate.
6. Reuse grants only A prerequisite to separately admitted B. Fresh B must satisfy actual checks+cleanup before compatibility receipt (:318–340). Keep original failed B provenance explicit in history-attestation/result; never retroactively label overall PASS.

All six are coupled; changing only mode/count can reject valid raw or weaken proof. Root separately verifies A facts/cleanup; manager controls future gate. I did not execute assertHistoryFacts/verifier.

## Fixed source SHA256
apps/web/test/web-current-preview.browser.ts fd5a216059bfc85600dfb832c00b7948bd89f35d7f4d985a203017ee7a8d0e10
apps/web/test/web-current-preview.fixture.ts 353aabc21dffc9461015f2d798e3a6894f5eeb58714368de21a75bf18d38a1bb

## Raw SHA256: all-20261006-164711-15b54e
app-failure.png 767dd49678fdb83a41192e55c9df9c4532e7de10da036628902d8a6f7e7b869a
app.json e430516442a395fcb00bc06510cddd61534d9eac8f4f54f500bad15d4206df04
budget.json bf6dcf76be58f8ffa29d35bb3f561e3c6dc05000d9c21e70282cc61e2369a671
cleanup.json 6db59c1782760399a6e5dd424f08db5fed3dcc43d68dbd476786ebb05c7010a1
database-owner.json 26c7e4618e705fe5f20f7e8b794b68fb74b1b7ce9e9dad1c46471be4e7a0f971
history.json 960d62b355e36aa1f0a3ab2ac4fbcaf3bed30810924376830914d738678832ad
outcome.json 4059ca8b2ba00147d5e4a255d3710a22ec4fc0db25a6d8427e4f2ada41c32844
process.log 119618847811d66593e9207678215b1dcabd710eee7edb5988646be99197e64c
sources.json 705a1a8dcce18bed7a318c45816f3c24b275eb057e12fbd66761fa7cf351c176
supervisor.json 7d3daea3bf3a8b42fee3b56f7bd049890ccc7e903968f7cb091fed1ebddab49e
wire.json 0625c4f54e11ccd7e6a8f63b2b54d2fe159d18330231a215af2c53a4707e07eb
worker.json d0c2eec40f45a8ccc92ce50f5fd5e7c3cf6308392a91e872c057e90a95c7afb4
