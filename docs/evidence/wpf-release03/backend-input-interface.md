# RELEASE03 fixed backend + A/B admission

Current source target `269103d44f153f13a2f35fadb08bf11d4f62e48d`; both scripts are frozen after root independent SOURCE approval (15:55:02Z; source only). Newtarget imports/types/PG/Chrome **NOT_RUN**. Original362 failedA raw remains byte-identical: [result](history-result-152729.json), tenfiles80,470B,3,874ms consumed/176,126ms remaining. There is no current execution gate.

## Backend input

The trusted external fresh gate supplies `backend={path, head, tree, metadata:[{path,sha256}]}`. It is not a candidate self-report. Canonical registered realpath, actual exactHEAD/tree and cleanworktree are required. Implementation is pinnedb29807979a5589678a61d3fb84781950cf366396 with sole parent362. Its changed set must be exactly store.ts and attachment-history.test.ts; each regular100644 source equals approvedcde SHA256. Implementation→runtimeHEAD must match the external gate's exact metadata path list, unique and at most32 regularfiles, each≤256KiB and hash-checked. Paths are additionally restricted to this backend owner's own literal plan/evidence prefixes with json/md extensions; there is no docs/** or test exemption.

Current finalized source/dependency input is root-reviewed [af51 audit](backend-input-reviewed-af51.json): HEADaf51c621696230fbced12227670f014ca73bd8a1/tree308c41b2dc46d9fdf1d40bf7d51a5fe6e9949fd6,13 exactmetadata and10readonly dependency identities. The earlier [003792 peer review](backend-dbaa-peer-review.md) is historical and exposed dbaa's too-narrow one-path guard. No candidate source is copied/edited here; ignored dependencies remain Lead-controlled and require fresh read-only identity admission, not new links from this writer.

Supervisor validates before CREATE; worker validates again immediately before importing `pathToFileURL(backend.path + '/apps/server/src/index.ts')`. Local client/contracts/tools stay362 and are protected by a separate diff. `sources.json` labels actual candidate path/HEAD/tree/factory and the unchanged local inputs separately. Same tuples are repeated observations, not OS-enforced immutability; owner keeps the candidate frozen during a run.

## Gate modes and bounded evidence

`history` executes the two realHTTP/native-observation A cases and stops before Chrome. `app` requires an additional `history` object:

```
history: {
  run: 'an-existing-successful-A-run-id',
  sourceCommit: 'actual sources.json.head from that A run',
  contractSha256: 'the reviewed exact history-region SHA256',
  files: [{name: 'sources.json', bytes: 0 /* actual length */, sha256: 'actual hash'}, ...]
}
```

This is a schema example, not a working gate. `sourceCommit` means the **actual A execution HEAD**, often a metadata commit; it is not the source implementation reviewtarget. Manager independently binds actualhead to the approvedA implementation/sourcehashes when granting B. The current B implementation review and hashes have their own freshadmission. B-only does not require its whole harnessHEAD to equal A's.

Exactly10 pinnednames are permitted: sources.json, history.json, wire.json, worker.json, cleanup.json, supervisor.json, outcome.json, budget.json, database-owner.json, process.log. Gate hashes come from root's actualA review, not a co-located self-authored passedflag. Loader accepts only one existingrun under this canonical `runs` directory, validates actualdirectory/non-symlink/realpath, exactcontents (thus no scratch/hard-stop), O_NOFOLLOW regularfiles and boundedlength/hash/stablefstat. Totalfilebytes and retained evidence remain8MiB. Hashchecking detects divergence from the independent gate; the local coordination gate is not a signature or OS securityboundary.

The same `assertHistoryFacts` validates liveA and reusedA: publicDTO shapes, expectednative history fallback, identities/digests, exactordered materialrefs, actualturn/report/history/detail wire responses and bodyhashes. Two distinct cases must cover the retained wire ranges and match worker/supervisor results. It rejects old362FAIL, malformed/tampered evidence, wrongcase/tuple/contract, missinghistory, unknowncleanup, or incompletebudget.

Historycontract hash is the raw UTF8 region between exactly one markerpair around syntheticRunner/createMaterials/the sharedassertion/checkHistory; no trim or newline normalization. Currenthash `59cde31c515e29ef9856cfd5733a8d2ce9733fff31dc8dec466232abd5507086` (11859 bytes). It is recorded before the nextA, never backfilled into oldruns. Relevant localprotocol inputhashes and the whole backendtuple also match acrossA/B. B orchestration outside this region can change under independentreview without forcing same-inputA reruns; any material historybehavior change still requires newA/sourceapproval.

Cleanup proof cross-checks database-owner.databaseName with cleanup.databaseName and requires CREATE/created/markerWritten/databaseRemoved true, noerrors, exitedsoleworker, consistentbudget/timestamps and mirroredsupervisor/workerraw. **cleanup.json does not contain the marker value**: marker itself is recorded only in database-owner.json; actual verified SQLmarker→DROP is attested by the fixedsource and independently reviewed runtime cleanup, not a fictitious cross-file markerequality. A-only outcome.passed and supervisor.checksAndCleanupPassed can correctly befalse because noB/compatibilityId exists; loader uses actualA facts and cleanupevidence, not these aggregateflags.

## Runtime budget and success

Every freshgate now also supplies `previousRuntimeMs`, equal to the sum of all completed existingrun budgets. Prior directories/budgets are real/non-symlink, bounded4KiB, positiveelapsed; unfinishedattempts block. Current3874ms cannot reset on a backend change. Newrun names cannot overwrite oldraw. Appmode uses the existingfull128/64MiB resource margins and at least20scleanup within cumulative180s; A uses32/16MiB and≤60s. No new resource or run authority comes from this interface.

Appmode verifies pinnedA before CREATE, records `history-attestation.json`, then creates a newownedDB/Chrome and runs actualApp only; history array is empty and provenance explicitly says reused, not executed again. It shares no oldserver/token/DB. FinalSVC import still requires validA proof + actualB observations + zeroownedcleanup errors; Bfailure cannot become green because A passed. Actualartifact d629/sourceHead506/releaseId388371a4972c469b8ace623454594132 remain separately fixed, and the actualstatic host verifies bytes. Personal update remains the originaloperator's separate authority.

Detail contract correction: GET body is ConversationContextDetail, not ConversationContextReference. Current region checks the actual detail identity and ordered frozen metadata/body against the accepted reference without requiring execution-input reference fields. This changed history region has not run; prior 1a7 is not approved.
