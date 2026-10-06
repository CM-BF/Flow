# D08 Interface

parseTaskLinks(taskId, original field rows) owns bounded parsing of parent, co-lead and explicit top-level declarations. Duplicate rows cannot become last-wins. Full single markdown [stable ID](link) identifies a declared parent; the original link is display text only. Missing/invalid/multiple values retain a bounded original record with an unknown reason. A declared big task can omit parent; legacy lack of relation metadata is unknown. No name/path/owner inference.

resolveTaskLinks(tasks) uses one registered ID Map and bounded direct-parent checks, not recursive progress aggregation. Parent unregistered, self/cycle/third level and source missing/frozen/stale/conflict remain separately unknown. An ID match alone is not live trustworthy evidence. A registered target can still be safely inspected with an explicit warning. co-lead is always the task's own declaration, never inherited.

Cards and details share one renderer. Navigation uses only the registered task button and its existing document allowlist; raw path/URL never becomes href or /api/document input. All records use textContent. Switching a parent inside an open native dialog must focus the new title, while ordinary close/Escape returns the original invoking control. No registry/server/documents policy change is needed.

No duplication of progress or inferred percentages; no arbitrary filesystem/network reads. Parser raw display text is bounded, while complete source remains available through the existing status document. Temporary fixture sources own their lifecycle; real owner trees are read-only. Actual deployment is separate from local fixture validation.

ID/link consistency: decode the declared local plan path once, resolve it lexically against the source status directory, and compare exactly with registered parent worktree/planDir/plan.md. Do not realpath/stat/read/follow symlinks on this declaration. A mismatch is unknown and cannot silently become the correct parent's action. Co-lead permits current `Web /root（执行管理 d01_owner）`; slash is not a list delimiter. Explicit self-parent remains invalid for every ID, including MATURE records.
