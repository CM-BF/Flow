# WORKSPACECACHE01 validation

Fixed implementation `4ec291c2381faa0fc212cf598b8126b9feecae71`, base `fd1322f9c0c1d085d5e343e39f6216b20d26c264`. Author workspace_panels_owner / gpt-6-astra ultra; recorded 2026-10-06 11:50:48 UTC. [Candidate](candidate.json), [all source/evidence bindings](checks.json).

Final direct consumers: **133/133 PASS**, four exact test paths, Node24 / Vitest4.0.18; [direct-final.log](direct-final.log). Web `tsc --noEmit` exit0: [types-final.log](types-final.log). Actual invocation was canonical HEAD `44b4f79e40234da7c124ead37145f0bbac7f99b8` plus dirty source, preserved [checks-invocation.json](checks-invocation.json); its 14 hashes equal the fixed implementation. No retrospective SHA substitution. Read-only 206 source/fixture/shared dependencies equal base; no shared, Thread, runtime, outbox, commands, dependencies or feed edits. Source diffcheck0. No production build, model, real center, DB or personal service test.

## Actual App HTTP fixture and time budget

The real App/official Thread consumed simulated HTTP through existing public client. Seven runs used **68.689 seconds cumulative**, including measured cleanup; remaining **21.311 seconds is unused**. Every invocation reserved >=10 seconds for cleanup and recorded fulfilled browser+fixture cleanup. Actual cleanup finished within each reservation. Raw report times are machine measured, not an inferred percentage. All original reports/logs retained; no more browser experiments planned.

| Run UTC | Elapsed | Result and cause |
| --- | ---: | --- |
| 11:44:20.944 | 8.243s | Script counted `/turns?limit=20`; actual public request includes `after=0`. Product close count already passed; assertion path corrected. |
| 11:44:44.424 | 13.217s | Four consumer scenarios passed; capacity setup reached32 but ambiguous New chat locator (sidebar and toolbar) stopped next action. |
| 11:45:18.619 | 13.765s | Capacity/route/protected reopening passed; script selected31 after splitting32 and therefore intentionally hid32 in that pane. Corrected order, no product change. |
| 11:45:51.845 | 8.937s | Split success; narrow resize left sidebar open and intercepting Retained chats. Script closes actual sidebar, no force click. |
| 11:46:47.041 | 6.769s | Two panes, draft isolation, keyboard focus and 390 light/dark passed. |
| 11:47:31.676 | 9.034s | Meaningful product red: CREATE/Send accepted after close left a no-material alias resident (1/32 instead of0). |
| 11:48:05.759 | 8.724s | App now checks current groups after receipt and releases only a closed, unprotected view; a new draft after send remains protected. Passed. |

Exact ISO starts and full failures are in [checks.json](checks.json). Six original scenarios plus the late-acceptance scenario all have passing actual observations across these runs, not a single uninterrupted green suite. Script selectors fixed under the same budget. The last run binds all14 current source hashes; earlier reports are preserved against their true bytes. Earlier production differs from target only in App's small current-group ref / accepted-after-close release branch; test/source hash changes (browser selector corrections and subscription assertions) are separately listed by each manifest. The last real App regression covers that App delta; do not say earlier six ran after it.

Observed: eight closed-clean conversations removed panes and left only initial draft, reopening generated fresh history reads; late body/history were ignored and reread explicitly; selected knowledge and text survived close with no resolve prefetch; Send/Queue unknown retried the exact original key/body, with independent draft; 32 includes initial +31 protected conversations, new allocation did not change current route, resident protected navigation worked, clearing one draft and closing released a place; two visible split panes independent; ordinary Escape returns Retained chats invoker and explicit reopen focuses exact tab. No cancel requests. Browser pageErrors empty for all reports; expected injected socket drops logged by Vite are unknown-receipt fixture behavior.

Screenshots actually inspected: [desktop light](2026-10-06T11-46-47.041Z-desktop-light.png), [390 light](2026-10-06T11-46-47.041Z-narrow-light.png), [390 dark](2026-10-06T11-46-47.041Z-narrow-dark.png). Viewport changes wait fonts+two animation frames and record DOM dimensions; no duplicate-header sampling workaround. Older desktop image retained as history.

## Red/green and limits

[red-direct.log](red-direct.log) is initial missing new-module imports. [generation-red.log](generation-red.log) contains6 reproduced old-reader failures (121 total), then [first-direct.log](first-direct.log) 7 failures were old tests calling explicit reads without activating visibility; prerequisites corrected while original assertions kept. [consumer-first.log](consumer-first.log)130 pass; [types-first.log](types-first.log) two new mocked queue detail shapes lacked existing queue metadata, corrected. Final133 includes real delegated projection+host unsubscribe invocation, hidden/hash-awaited/old catch+finally isolation, record/UTF8 bounds, receipt preservation and invalid body200.

Closed-clean is classified by authoritative local material. Accepted-after-close rechecks current groups and draft contents; alias migration never becomes a second view. Protected receipt controllers remain alive. Heap, all history/metadata, legacy task detail/feed/runtime/stream caches and network server memory are outside the UTF8 body budget. Final-release public snapshots drop owned body/history references and session subscriptions; this does not claim GC/heap measurement. 32 is the total resident conversation cap; original baseline's32 was still-open tabs, not32 close cycles. Attachment App bindings are not present in this base: future owner must add actual input items, pending capture/submission and journal-unknown to the existing session protection seam. No claim of attachment production protection, cross-reload receipt recovery or Arc layout completion.

Browser automation has stopped. For an independent reviewer, direct checks can be rerun without modifying author reports. Any new browser experiment needs its own explicitly recorded budget; do not silently consume unused time or rewrite these reports.


## Independent review

Root已正式 APPROVED /0 blocking（owner转录2026-10-06 11:53:23 UTC），精确绑定4ec291c2381faa0fc212cf598b8126b9feecae71。独立四文件133/133、3.85秒；原样[log](root-independent-tests.log)和[audit](root-independent-audit.json)。Root逐读14源与命令/知识生命周期、14hash/206readonlydeps/16scope、逐审7份browser/raw/source复用边界并目视390dark；未重新跑browser/types。作者与reviewer证据来源分开，main仍未接收。

全历史diffcheck存在原测试日志尾空白/尾空行（consumer-first、direct-final、direct、first-direct、generation-red、red-direct、types-*及独立log），原样保留；source implementation diffcheck0，不声称所有raw文本零空白。


## Main acceptance

2026-10-06 11:57:35 UTC owner实核main/origin `017adc276a888a218bed3ef9963bc4dabbc6cec2` 与获审14源逐字相同，详[main-observation](main-observation.json)及[Lead原始来源比较](lead-main-source-comparison.json)。Lead Web types0归其组合验证，133与原分次browser未重新运行。登记/4320部署证据未到，不另fetch或把main接收冒充部署。
