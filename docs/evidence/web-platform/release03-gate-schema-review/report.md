# RELEASE03 manager gate schema seam review

Observed 2026-10-06T15:49:53.087003+00:00. This is a read-only management input review, not a runtime gate, product approval, or successful A attestation. No allowRun file was created. No disk-space sampling, process scan, product import, types, HTTP, PG, browser, build, install, service or model call occurred. Only this temporary directory was written.

The original /tmp/w01-release03-app-attestation/report.md was reviewed with the actual prior gate and complete negative A raw. During this review W01 froze implementation `1a7c42ac90e73471cce1fc8e1d56f4d0e60c2098`, metadata `a92cb7fd5531973ae33501e38f38f23f568077d7`. Both current scripts equal that target, branch is codex/web-current-preview-compatibility, and the worktree was clean before and after these checks. Earlier moving hashes are superseded only for the present schema review; they were never approved targets. W01 reports normal push; this check establishes local fixed/current identity, not a new remote-push observation. The final interface incorporates the schema corrections communicated during review.

## Conclusion and corrections

The manager can provide the concrete inputs required by the new schema. No successful A exists, so no app-mode history proof can currently be issued. Full new-source review and later fresh runtime admission remain separate gates.

1. `backend.metadata` is now required. The old proposal's path/head/tree example omitted it. Use exactly the 13 literal path/hash pairs independently pinned in root's af51 audit, copied in audit.json. The fixture's prefix restriction and at-most32 check are only defensive validation; they do not authorize the candidate to add entries. Do not expand from candidate manifest.json. Sort once by path and reuse the same array order for A and B, because backendInput deep equality includes it.
2. `previousRuntimeMs` is now required. It is 3,874 now, verified from the complete old budget. After the next A it becomes 3,874 plus actual new elapsed time, and likewise includes every completed later attempt. Changing backend or mode cannot reset the 180,000ms total. The remaining total now is 176,126ms. Retained old raw is 80,470B and remains charged against the original 8MiB total.
3. `history.sourceCommit` means the actual A `sources.json.head`, commonly a metadata HEAD. It is not the approved source implementation target. The old example demonstrates the difference: source implementation432b, actual execution HEADe212. Manager independently pins approved implementation, the metadata HEAD and both source hashes for each fresh A/B admission. Final interface now states this correctly.
4. Old cleanup has no `marker` field. Only database-owner.json contains the marker; cleanup has databaseName/markerWritten and cleanup facts. Do not ask for a nonexistent cross-file marker equality. Fixed cleanup code verifies the actual SQL marker before DROP; the future independent A review must validate that source-bound cleanup and raw ownership facts. Final interface now makes this distinction.
5. Old negative A `sources.json` has no backendInput, historyContractSha256, artifact or releaseId. These must be generated before the next A by the new source. Never backfill the old run. It also genuinely failed both history cases, so even a syntactic conversion could not authorize B.
6. An A-only run can have outcome.passed=false and supervisor.checksAndCleanupPassed=false because no B/compatibilityId exists. Eligibility uses actual two A results, wire, source identity, cleanup and budget, not those aggregate booleans. Do not change them to manufacture success.

## Exact fixed input

Backend registered path: /Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility. Implementation `b29807979a5589678a61d3fb84781950cf366396` has base362; final HEAD `af51c621696230fbced12227670f014ca73bd8a1`, tree `308c41b2dc46d9fdf1d40bf7d51a5fe6e9949fd6`. Two source files are the approved cde store/test, plus exactly13 independently audited metadata files. This pass compared all15 current bytes with fixed Git blobs and hashes, checked the exact metadata changed set and clean HEAD/tree. The earlier003792/11 metadata tuple is historical and must not enter a fresh gate.

All ten backend dependency realpaths/version/package.json hashes in the root audit were rechecked read-only. This proves these ten identities, not every transitive file or executable behavior. It is separate from the RELEASE runner's existing17 readonly links. The backend's @flow/contracts points to its own fixed tree; no moving @flow/dist substitution or new link is authorized.

Frontend remains prepared format2 releaseId388371a4972c469b8ace623454594132, artifact/manifest digestd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88, sourceHead5069586a9f17332de526e101eca3a4250cbc8d91 with9eec provenance. This pass uses its existing independent integrity binding, not a fresh import/build or compatibility claim.

New fixed harness source hashes:
- fixture.ts: 6ae1fcdd23bbf6643047d05a0e6bdf8442667119c583a39141b55df5edc2308e
- browser.ts: f741966746e4222380288c93f92e6fbec092ff042633717752b785cc69943ffa

History contract: `612f03112126a305785bfce31e51843de05c380724fb2226739b40fe0a37dbe8`, exactly10340 raw bytes between the unique BEGIN/END markers, excluding markers and without normalization. It includes syntheticRunner, createMaterials, the shared assertHistoryFacts helpers and checkHistory. The hash does not alone cover all supervisor/import behavior; relevant changes outside the marked region still need source review and may require new A. The new source records contract/backend/artifact identity before A. No old source record is altered.

## Future externally pinned A proof

Only after a real successful A and root's retained-evidence review may manager pin the ten exact names: sources.json, history.json, wire.json, worker.json, cleanup.json, supervisor.json, outcome.json, budget.json, database-owner.json, process.log. audit.json includes the real ten lengths/hashes for the old NEGATIVE run solely as an inventory example; those are not eligible pins for app mode. A future successful set must be computed from that future directory and independently reviewed.

Gate history must name an existing canonical runs child, not arbitrary paths, current B, symlinks, scratch, hard-stop or unexpected files. Loader checks exact names, bounded regular-file reads, bytes/hash and before/after fstat. Manager pins actual A execution HEAD, reviewed implementation/source hashes separately, marked-region hash, exact backend tuple/metadata, artifact and local protocol input hashes. No co-located passed flag grants reuse.

Raw semantics are available in actual file shapes: wire rows are flat method/path/status/body/responseBody/responseSha256/dropped/key fields, not nested request/response structures. Validate both ordered case labels and contiguous wire ranges; v2 input, exact ordered refs/task/attempt/owner and report acceptance; actual report/history/detail responses and body hashes; unknown/metadata-unavailable materials with null revision and preserved execution digest. Check history.json equals worker.history, supervisor.result equals worker, exact owned DB name/marker evidence, removed DB, no cleanup errors, sole worker exited and complete bounded budget. Root's source audit is not a substitute for this runtime evidence.

For app reuse compare A/B backendInput exactly, including metadata order; artifact/releaseId and local protected protocol hashes must match. B source implementation can differ under its own independent review. A and B must not share DB, server or auth secrets. Successful A proof plus actual B observations and owned cleanup are prerequisites to a SVC compatibility result; publication remains the original operator's separate authority.

## Admission boundaries retained

A start1,107,296,256B / stop1,090,519,040B, at most60s including20s cleanup. App start1,207,959,552B / stop1,140,850,688B, original cumulative180s/8MiB. These are prior approved values, not a fresh available-space observation. Nothing in this report admits a run or reserves the shared PG/Chrome window. Before any future run manager must separately check the fixed review, original four-scope live claim, unchanged source/backend/dependencies, actual shared window and fresh resource threshold. No extra candidate paths are inferred.

## Method and limits

Applied existing local find-skills method, codebase-design boundary separation and clean-code review of one authority per input, explicit schema names, immutable evidence and failure semantics. This task did not install skills, alter plans/status/parser, or create a parallel state source. The report is a temporary intake for the existing canonical management records. Source/schema consistency is confirmed; new implementation runtime and successful A/B are still NOT_RUN.
