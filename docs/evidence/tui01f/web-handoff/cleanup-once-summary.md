# Independent F04 cleanup after the failed journey

This is a separately authorized cleanup-only action, not a rerun or a passing journey. The original one-shot red, raw evidence and then-current KEEP decision remain unchanged in `one-shot-manifest.json`.

The cleanup ran at 2026-10-06 20:59:20 UTC: outer process exit 0 in 587 ms. Exact database `flow_tui01f_bb02a6d703a3`, marker `3b98f9e6-4f13-48bb-aaee-8723d9141dd9`, zero tasks, empty connection observation, owned groups 18112/19956/24633 absent, and private directory dev 16777234 / ino 123194387 all matched. It saved an exclusive durable checkpoint before normal DROP and removing only the matched private directory. Database query returned no remaining row; directory absence was confirmed; admin pool closed. No FORCE, new task, browser, PTY or provider call.

[Original result](cleanup-once-result.json), [checkpoint](cleanup-once-checkpoint.json), [process envelope](cleanup-once-run.json), and [fixed bindings](cleanup-once-manifest.json) are preserved. The window was returned to Execution Lead immediately after completion. The old O16 retained database/directory and the older unknown-inode TUI03 directory were not touched.

**Metadata correction:** the original process envelope incorrectly says `PG: 0`, inherited from the pure-check wrapper. This action did use PG and normal DROP; see the separately saved [correction](cleanup-once-metadata-correction.json). The wrapper is archived verbatim as `small-check-cleanup.py`; neither raw envelope nor stdout was rewritten and no action was rerun for metadata.

Actual TUI01F-04 remains failed: no original TUI request was captured and no task was created. The preparation approvals do not establish the cross-client behavior. Next work is source-only diagnosis of terminal startup and failure recording; no additional runtime permit exists.
