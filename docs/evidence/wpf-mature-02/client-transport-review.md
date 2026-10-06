# F01 transport 独立review收据

当前APPROVED：d6d5089c680f862e34a8e4d25f8f65d03057e70e；status_read/gpt-6-astra 2026-10-06 13:38:04 UTC，Mika13:38:16接收。原5be P2 CLOSED，0剩余P1/P2。精确两行令Bearer credentials=omit，cookie/connect仍include；2source=d6/WT、3raw=e1e94/WT逐hash核同，manifest摘要6256bf63…a460。1red→3green（44ms）、types0；review未新跑browser/PG/tests。以下保留原finding。

status_read/gpt-6-astra，2026-10-06 13:18:17 UTC，CHANGES_REQUESTED；Mika独立复核接受。固定5be830e2614d45dbaa023e98923fc74f470b37ec，1P2/0P1。Bearer分支省略credentials时Fetch默认same-origin，同源cookie可能与Authorization同发；须明确omit，cookie（含connect一次Bearer）保持include。原test:83 undefined改omit，先red再green；既有无cookiejar的Node HTTP检查不能证明浏览器默认行为。[规范](https://fetch.spec.whatwg.org/#concept-request-credentials-mode)。

manifest SHA feb79ef22517571e2596b1d3e0f78c9b37585f74f67b08bcd5e8e5e36bd6add1：3source=5be/WT，3raw=c1a173/WT（不在impl），1DTO31824=5be/WT，7项bytes/hash吻合。其余delta无P1/P2，reviewer未改文件/重跑browser、PG或测试。修复由F01 owner，本文仅跨task收据，不复制其进度。
