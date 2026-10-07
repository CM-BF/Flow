# 新 pair 第一次实际：FAILED，完整 RETURN

固定 Web 779a/c231 + backend cd27/04da，运行输入 HEAD 53980，harness 2f679（browser 字节沿8964）。[Root 源审](root-source-review.json)与[native边界](root-native-boundary.json)接受准备；[实际独审](root-failed-actual-review.json)只接受失败/完整清理，不是兼容通过。

实际 outer exit 1，worker exit 1；唯一末行 terminal 与 result/budget/raw-manifest hash 核同。首段180000ms CLOSED：保守56504ms，未用123496ms不转信用。[原件索引](index.json)、[完整归还](outer/return-receipt.json)。marked DB正常DROP、center/proxy closed、三已知PID/PGID全ABSENT、双outer与四inner EOF/drop0、scratch与exact admin输入删除。parent.fixtureCleanup 原始 UNKNOWN 保留，不能覆盖它；真实fixture-cleanup原件和独立RETURN说明实际没有遗留运行资源。

整体 FAILED：旧三App仅各旅程完成，`reports:null`，0正式导入报告；新App到 late-logout 前置等待失败，不能发布。[只读诊断](diagnosis.json)：新App24条wire没有Cookie SSE或stream GET，也没有logout POST。harness在UNKNOWN原key恢复之前等待accepted流，源码与缺失前置一致。统一错误未保具体substep/stack，故deadline是源码推断，不伪造为原始exception。当前没有观察到后台迟到logout响应，更不能判定04da回归或已安全。

本批只归档和只读诊断，没有第二次运行。后续原两harness窄修保持UNKNOWN/原key恢复、真实Cookie/SSE、迟到headers与旧三App断言，固定后集中审；不改后台、App或两已交回产品。
