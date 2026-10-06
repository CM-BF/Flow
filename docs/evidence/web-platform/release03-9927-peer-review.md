# RELEASE03 9927 fixed source-only review
Verdict: APPROVED_SOURCE_SCOPED. Blocking findings: 0.
Reviewer: /root/workspace_panels_owner. No runtime approval or new gate.

Old implementation: c18bd6630cbdbb431460688a0f6bea9248f4151f
Reviewed implementation: 9927bb071494ec16a9d8091a6ba5edb4ea72c18a
Actual metadata HEAD: b6c13e0190771fd42e8f34d75cab7ab37adbf6c2
WT: /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-current-preview-compatibility
Branch: codex/web-current-preview-compatibility; observed working tree clean.
Scope: complete browser.ts delta and relevant existing verification/worker/compatibility context; unchanged fixture hash checked. Local find-skills/codebase-design/clean-code methods reused. No product import, tests, types, HTTP, PG, Chrome, resource sampling, project edits or dependencies installed. Only this /tmp report written.

## Exact chat fix
browser:396–403 now takes Locator, asserts one visible chat and one visible exact Files button, clicks within that chat, and checks its own composer chip. :424–452 binds the prepared conversation region by exact title `RELEASE03 fixed attachment`, reuses it for both chooseFile calls and Send/input/Queue-next/retry/receipt checks. Project text files remains a page-level exact portal dialog. No first()/nth() suppresses ambiguity. All frozen attachment reference, v2, same key/body/turn/item, independent-next-draft and zero-cancel assertions remain. This addresses the actual c18 strict locator failure by source inspection; new UI journey has not run.

## Six prerequisite constraints
1. **Exact original evidence / binary:** :42–44 retains history10 and defines all12 as exactly +app.json/app-failure.png. :77–87 selects the exact set, checks actual directory equality, pins every file through unchanged bounded/no-follow reader, limits total bytes, parses only .json. PNG and log are hashed bytes, not parsed. Missing/extra/duplicate names fail the exact-array comparison. Branch mode is subsequently confirmed by pinned outcome, not trusted merely from a filename.
2. **Failed B truth:** :95–98 requires source outcome historyPassed=true, passed=false, compatibilityId=null; mode/phaseB are respectively history/NOT_RUN or all/FAILED. :117–120 requires all app.json==worker.app, false App/worker/supervisor result and a real error. All outer/worker/cleanup error lists stay empty; an infrastructure/cleanup failure cannot become reusable A. Existing history-only NOT_RUN condition is retained. This intentionally does not require the historical overall run to have passed.
3. **Two owned children:** :106–115 retains owner/DB removal/timestamps and requires exactly2 distinct PIDs for all, exactly1 for history; each positive PID must have exitCode0 and signalCode null. No arbitrary nonempty count/first-child shortcut. Actual ownership cleanup is not re-executed here.
4. **Exact A identity / full B tail:** :74–94 preserves prior sourceCommit, historyContract, exact backend input, artifact/release and non-test protocol hashes. :122–131 requires worker.history equality, exactly attachment-only/mixed, both passed, current unchanged assertHistoryFacts on the FULL original wire, and contiguous ranges from0. History requires end==wire.length; all requires end<wire.length. No slicing/relabeling of stored raw. The unchanged fixture validates range bounds and individual request/response identities inside its range. No new blanket responseBody hash check rejects intentionally token-redacted runner registration bodies.
5. **Full cumulative budget:** :99–104 retains complete/timing/elapsed conditions, history permitted<=60000, all permitted<=180000, previous+permitted<=180000. Unchanged :155–164 counts each complete prior run's FULL elapsedMs, matches independent gate.previousRuntimeMs and enforces cumulative180000. The historical 12326ms cannot be discounted to its A portion. No budget reset or extra attempt granted.
6. **Prerequisite only:** :132–133 carries sourceMode/sourcePhaseB into the proof; :291 binds returned worker evidence to it. :509–512 carries verified history into a fresh app worker but does not set App pass. :531–540 requires actual App result plus cleanup; unchanged :335–358 requires successful new result, observations, verified prerequisite and clean supervisor before importing/verifying a compatibility receipt. Original B failure is preserved; it is not retroactively promoted by a later B run.

## Evidence binding and limitations
All12 original raw files still hash-identical to the prior independent c18 report; they total 191936 bytes. Historical modeall/A success/B Files failure is existing evidence, not a fresh execution of 9927. Root separately owns full A/runtime evidence review and manager any later admission. This verdict does not establish actual Playwright success, TypeScript success, runtime parser execution, production eligibility or overall RELEASE completion.

Browser SHA256 old: fd5a216059bfc85600dfb832c00b7948bd89f35d7f4d985a203017ee7a8d0e10
Browser SHA256 reviewed=current=metadata: fe3219fa3787eb27c4159f442c01884b64085cb7e3dda32d78213a18afdc084e
Unchanged fixture SHA256 old=reviewed=metadata: 353aabc21dffc9461015f2d798e3a6894f5eeb58714368de21a75bf18d38a1bb
Prior raw manifest/report: /tmp/release03-c18-files-and-history-review.md
Prior report SHA256: d9e36a0bdd687bd79c27f84da6c0fbd40149f66df38769e1461bd4f83d006906
