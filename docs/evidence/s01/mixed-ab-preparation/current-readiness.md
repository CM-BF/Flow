# S01 A/B 当前只读准备核对

2026-10-07T05:46:42Z，status_read / gpt-6-astra；本段从05:45:30Z开始，限只读与metadata。权威WT runner-capacity-probe / codex/runner-capacity-probe，输入HEAD7d537fab43e7a0c4295eb23028be7be9ece8ba02=origin clean。一次协调CLI list确认508f9c85-a27c-4382-bfe9-caca43be4b0e v2 ACTIVE、原5scope/owner/WT/branch相符；未amend/take/release。

复用[已审入口](preparation-deadline-fix/ready.md)：d3ba03a88b8d25d134b7abade7f55f8198b182ba；architecture14:11:28/Mika14:12:06批准保留。新核35原source+5readonly相对da932仅已批准ab-driver/ab-input两处漂移；d3ba的3source+4readonly当前hash均符。15条外部依赖声明逐manifest bytes/hash/name/version一致，6份Node PG运行依赖字节一致，pg-boss与server解析同一pg；固定Node24路径/tsx入口存在，未执行或import。生产Git A/B差异仍只有events.ts及其非运行测试；不重新导出977blob或重复64不同检查。

A=a3e670b906c1b65d586b7730ca19da83109f1dcc，B=aae1eb1054d75e78273e7c91ed048aeac80195da。只比较events.ts已审优化，非当前main/S01P07、更非128真实SDK容量或SLO。共同observer和固定顺序保持；顺序/观察器/共享背景为混杂。没有新优化收益结论。

300s/512MiB原总账与绝对deadline不变：preparation15s、每侧135s/240MiB，共同32MiB含4MiB最终预留；B须A成功且全部资源闭合、剩余≥150s/足够byte才启动。每侧128fixture任务/attempt，总≤256；0provider。当前docs/evidence/s01/mixed-ab-run根精确不存在，未消耗窗口。

结论：SOURCE_READY / EXECUTION_PENDING，唯一阻塞为未授新独占实际窗口及当次共享PG/WAL/磁盘准入。解除需Mika确认独占时段、唯一namespace/clean executionHEAD，开前fresh至少1GiB保留+512MiB实验余量并明确PG/WAL及其他负载余量；当前不采样磁盘、不借旧resource值准入。总可见byte不是物理磁盘/WAL硬上限。0PG/Chrome/native/provider/安装/源导出，Web当前窗口不被本段占用。

本次metadata为新管理观察，不改原manifest/raw/已消费窗口快照；quality方法沿Interface既有本地find-skills/codebase-design/clean-code固定来源。唯一当前状态仍plans/s01-runner-capacity/status.md。
