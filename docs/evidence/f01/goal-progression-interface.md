# F01 O14 production candidate

Existing factory owns migration030, authenticated routes and one shared non-overlapping queue/progression sweep. Both modules retain their own admission authority; each failure is logged independently. onReady plus the existing1s timer drive bounded scans; automaticQueueScan=false disables this lifecycle in module tests. preClose stops new work, waits the in-flight scan before disposing the pool. No second scheduler.

CLI exposes bounded owner authorize/read/revoke through the same FlowClient, fixed JSON/key and existing error/signal handling. Revocation stops later admission without cancelling existing tasks. Mechanical intermediate artifact permission never implies owner semantic acceptance.

Verification: one HTTP CLI red→green33ms and root types0. Real production two-node/default readiness/interval/restart and in-flight shutdown tests have been written but NOT_RUN due disk reserve. They own a random marked DB/tmp, require >=1GiB+32MiB before creation, normal DROP after no connections, no provider. No current product approval is inferred from the old domain review.

find-skills used existing local codebase-design/clean-code: Interface is the existing lifecycle, each module retains state; no duplicated admission FSM or new timer. Product and direct-consumer scope only; no unchanged whole-suite rerun.
