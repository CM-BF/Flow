# Second HTTP result: bounded static triage

Actual: the repaired hidden/queued-dispose case passed. The backlog case completed its all-three-final-text wait but failed the peer-second-before-third condition at test65. The raw does not contain the request ordering or identity of the failed pair. This is not enough to identify a unique product cause. Previous backlogPASS is retained and does not cancel thisFAIL.

Source facts: fixture logs both metadata and patch requests; this assertion filters patches. FIFO grants queued hosts before a releasing host can reacquire, with two active leases. A peer that remains in flight need not yet be in the waiting set. Requiring every peer, including the late starter, to enter batch2 before any enters batch3 may impose stricter lockstep progress than work-conserving FIFO. This is a hypothesis, not a reason to weaken the assertion without review.

Minimum next evidence: bounded existing patch-read order (at most33 for these three fixed81-patch streams), late-join index/cursors, and precise waiting versus in-flight point. A real-response barrier can fix late-join occupancy before checking eligibility-aware FIFO handoff. Preserve the firstFAIL, secondFAIL, all original throughput/cursor/peak/cache assertions until the source/acceptance decision is reviewed. No product edit, diagnostic HTTP rerun or third-phase grant was made here.
