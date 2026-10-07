# SVC09A R3：完整生命周期后混合断言失败

唯一入口150,659ms/exit1，work146,499ms，cleanup282ms。原primary为`host-consumer / UnknownError / code:null`，保持不可精确归因。已存22个工作阶段覆盖默认legacy、settings完整tuple、双槽drain/hold/refresh/resume，以及两条synthetic task各由对应注入adapter实际领取；observed/native资格仍unknown，provider0。最后持久phase为mixed-final-admission-status，未写mixed-real-claims/work-complete，不称完整旅程通过。

8个真实generation均由原helper停止；13个自有PID/PGID只读观察absent，4份监督双EOF/无signals。原清理`fullGenerationsStopped=true/workComplete=false/mayDrop=false/cleanupConfirmed=false`不改。新库OID1334399连接[]、admin关闭；2026-10-07T16:36:44.486680Z实际归还，数据库与私有root继续KEEP。旧R1/R2不动，没有自动重投。

固定源码显示末尾SQL将text任务ID与uuid[]比较，属于明确caller/schema合同差异；原SQLSTATE未保存，只能作为后继静态修复依据，不能倒造本次首错。[结构化分析](host-r3-result-analysis.json)和[真实归还](host-r3-window-return.json)保留观察与推断区别。
