# O13 graph run listing transport

Fixed implementation: 98e5b2012ffb57b357adcfa7ce68b25608ed631c

Consumes the interface-only O13 contract b4f28b9486905c4bee2c468aa39f194e881f0df2. `goalGraphRuns(goalId, {after?,limit?}={}, signal?)` performs one owner GET to `/api/goals/:id/graph-runs`; identity and opaque cursor are URI encoded. Limit/default authorization and cursor validation remain the center responsibility. No retry, mutation, local cache or scheduling is introduced. HTTP errors and cancellation use the existing shared transport; the current caller controls recovery.

Local find-skills discovery/codebase-design/clean-code methods reuse the existing narrow client boundary. One new actual HTTP test verifies default/bounded pagination, original page response, owner authentication, 403 and abort with exact request count; existing strict graph command test remains unchanged. No PG/provider run. Domain and production combination still await O13 fixed source.
