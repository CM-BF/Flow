# Settings scan-error delta — PREPARED / NOT_RUN

New candidate `/private/tmp/msgset-b4` retains the complete b3 source separately. Root b3 review `918b68510b8ea6026098ac602af4ed02edd20e818f185207e68c05f4023785dc` remains CHANGES_REQUESTED_SCOPED_PREPARATION_NOT_RUN with the sole SCAN-ERROR/P2 finding; it is copied unchanged here.

Only executable delta: import Python errno, add a two-line `scan_error` callback and pass it to `os.walk(onerror=...)`. An error is ignored only when `error.errno == errno.ENOENT` (a directory vanished during observation). Permission, I/O and all other scan errors are re-raised. Existing file-lstat FileNotFound handling is unchanged. Existing resource callers then record FAIL and perform owned-group/scratch cleanup; the final resource observation still does not use a work-deadline guard. No generic walker or permission expansion.

Worker, aliases, runtime configuration and carried budget remain byte-identical to b3. Binding changes only the supervisor hash; state stays PREPARED_NOT_REVIEWED_NOT_RUN, nativeChromeBoundaryApproval remains null. The six project sources are not modified. The original b3 files and previous b2 raw are not edited.

Budget remains 13,748ms used / 46,252ms remaining including 15,000ms cleanup; previous retained evidence remains 360,142B. Native Chrome still lacks the custom outer write/egress limits and requires genuine Lead acceptance plus independently reviewed fixed scripts, fresh claim/dependencies/resources and a separate shared window before any run. This correction supplies no approval or gate.

Validation is source/diff and byte/hash comparison only: no candidate parser/import/test/Node/Chrome/PG/HTTP, resource sampling or filesystem error probe. Manual clean-code check: the one observation-error seam now propagates non-ENOENT errors without changing ownership, retry, cleanup, business assertions or limits. Full runtime behavior remains NOT_RUN.

The retained architecture/tradeoff description is `/private/tmp/msgset-b3/report.md`; its hash is pinned in source-audit.json. Current hashes and the two minimal diffs are in manifest.json. This candidate awaits root's delta review.
