# Parent monitor 退休与失败账 reconciliation

固定 `344f12cc9407a1cce8d17e2d9371cf8d0fb9a4b5`，前源 `67f8fd25a129ef5c8882f07e54de87e20ed24429`；仅原 browser parent 55+/8-，18其他源逐blob相同。当前 **root限定接受生命周期源码+局部实证**，没有PG/Chrome运行或新gate。

本次 created-turn 原记录仍整体FAIL：原budget.complete=false保持原字节。Root [实际独审](continuous-fourth-root-review.json)接受失败与owned清理而非casePASS，charge11109；browser有限段47205/150000、余102795，旧90k封套64134.08675不改。

## 最小Interface

- timer使用checkpoint("monitor")，正常finally先monitorRetiring=true，再stopped/clearInterval/await原monitor。仅已退休timer的尾部work-liveness不再误报deadline；前置workguard和资源/IO检查始终执行。directcheckpoint不借用退休例外；真实workerexit-poll的await后仍working()，工作deadline、hardAt、所有SIGINT/SIGTERM和清理路径不变。
- 私有Gate可给至多8条唯一reconciledFailures（run、旧budgetSHA、own evidence下单文件名reviewFile与reviewSHA）。仅exacthash独立FAILED决定、确认DB/fixture/组/scratch/EOF清理且保守charge可继续原累计；missing/错run/未知run/错hash/重复/路径越界/cleanupunknown/低计费全拒绝。
- 原FAILED不改为PASS、不改旧budget或重用gate。此为原有限段的显式失败计费接缝，不改变worker业务、selected验收和公共协议。[本次精确候选](monitor-retirement-reconciliation.json)不是allowRun。

## 实际局部检查

2026-10-07 07:13:16 UTC封存：新授权20,000ms含5,000ms清理段，实际总 **5973.709124955349ms**。32项定向受控检查PASS（331.680458ms）；受影响Web noEmit exit0（5640.727458ms）。原始[segment](monitor-retirement-local/segment.json)、[32项日志](monitor-retirement-local/barrier.log)、[检查源](monitor-retirement-local/barrier.cjs)和0B types原log保留。

通过TS AST提取实际旧/新closure、timer注册、finally退休前缀、workerexit-poll以及prior扫描，并在VM控制filesystem barrier；未import产品/执行supervisor。旧版确定复现false deadline，新版同barrier不误报；真实工作deadline、directcheckpoint、退休后的低free/evidence/scratch/IO错误、迟到interrupt仍失败。Hash-bound root实际失败原件在同helper/扫描验证charge11109；拒绝路径保留。

这证明受控交错，不证明上次浏览器唯一动态根因，不代真实PG/Chrome复验。两自有Node PID35438/35814收尾groupAbsent；networkdeny与项目/依赖只读，0HTTP/PG/Chrome/provider/install/build/emit。结束前tmp80951B，后报告追加另计，所有留存远小于1MiB；原old50/119/33绿未重复。已装Node24/TS5.9.3和root配置沿既有只读resolver，无新依赖。

Root [正式针对独审](monitor-retirement-root-review.json)已接受344f/32/noEmit，fresh核两Node ESRCH与旧budget原hash；不是浏览器复验或完整feature批准。下一同created-turn选组可按常规fresh gate exact reconciliation/实际资源办理，不需新源码许可。
