当前后继见 [生命周期修复](../browser-lifecycle-repair/interface.md)。以下保留b17交付当时的准备说明；实际root/manager/populated限定审已完成，后续addendum见当前review。

# 历史 b17 browser lifecycle source review entry

Target `b17bb05c797cfccc8dbeb4c3de26e57143600bec` changes only `runBrowserCheck` and required imports. [Audit](audit.json) pins all seven sources, unchanged check bodies and the complete task-links script; [root prior structure review](root-structure-review.json) is not final wrapper approval.

The external parent owns the 60,000ms cumulative budget, with 15,000ms cleanup, from before Git/hash/setup. The child verifies the parent PID, exact deadlines, scratch/output, source and absolute Playwright pins; it never writes the budget. Each entry needs a separately reviewed populated binding/sandbox and a fresh one-use gate. No such binding or grant has been created.

Chrome inherits the worker process group; the child signals its own Chrome PID only. Parent TERM/KILL/reap and group-absence proof precede scratch deletion. Fixture cleanup, server close and Chrome exit remain separately reported. Parent monitors 64MiB own temporary logical/allocated observations, retained evidence 8MiB and 1MiB log; shared free start 1GiB+128MiB and stop 1GiB+64MiB are polling guards, not hard quotas. Other processes/OS swap remain outside attribution.

The private supervisor draft adds only the pinned Playwright entry digest to the child gate after the earlier reviewed hash; its current hash is in audit.json and needs review. It has not been executed or syntax/import checked. No dependency links/cache writes, browser, PG, real registry, free sampling or build occurred.

Historical Node result remains abd2 7 leaf + parent 8/8, cumulative3950ms; it does not validate this wrapper or full browser behavior.
