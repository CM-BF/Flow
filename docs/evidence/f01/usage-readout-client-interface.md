# COST01A shared read Interface

`FlowClient.taskUsage(taskId, signal?)` → `TaskUsageReadout`, one owner GET `/api/tasks/:id/usage-readout`. Encodes identity, preserves nullable totals/subtotals and coverage, existing error/abort/no-retry semantics. No new query knobs, auth mode, provider call or accounting computation. DTO fixed27d4; host route independently reviewed/mounted.
