# ACCESS 自有默认context准备（NOT_RUN）

source `3c0dda7b7a8887ac763d8a1651231374b0f3356d` / actualmetadata `d0f6a62f1c4b9dc940f211b32cce4242628e1d26` clean。入口 `python3 /private/tmp/access01-browser-fourth-k3zdae5a/run.py` 仅在root后续明确交接后执行；目前无gate/无holder/无raw或scratch。未运行任何验证。

原始60秒保守已耗30839ms，本次剩29161ms=14161工作+15000清理；scratch256MiB/raw8MiB不变。此前三次失败原件全保留，预算不重置。未来选择哪些组由独审/影响范围决定；当前同一函数仍含完整原五组，未删/弱化任何断言。

最小caller改动：沿已审第三runner调整对应绝对offset/source-head；worker同一fresh PID/新exclusiveprofile/CDP入口connectOverCDP(noDefaults:true)，必须恰1个context且初始pages只有about:blank，再传ownedDefaultContext。fixture显式pageviewport，不再newContext，也不再另一session切focusoverride；nativehidden前提与tokenempty保留。

已装Playwright源38749/51919说明defaultcontext close→close-browser；worker继续ownPID/终态EOF与必要TERM，不靠context.close假定进程已消失。Browser.close targetclosed处理见62784–62795。只移交worker自己启动并admit的context，不猜已有用户browser/个人profile。原生命周期/日志/资源/异常收尾不扩展。

本轮33来源pin与前三次75份已归档原件逐hash核同；run/worker差异和pins齐。没有Node/productimport/Chrome/HTTP/PG/free或进程采样。共享heavy S01，须实际handback与fresh资源；metadata如后续只封记录而变化，必须显式更新绑定。
