# 唯一C fd窗口：已消费并停止，测量未完成

窗口 `mika-c-fd-20261006-110819`；执行clean HEAD `cdb900d95d26f5a3ee8b35a43805e4212789a683`，已审组合 `cf69dddff65d31a821a6c13b984ea0ef6d5fa648`。入口原样仅调用一次；fresh claim v4 ACTIVE、预约不存在、input/manifest hash与独审一致之后启动。无追加help/version/编译/目标/读取crash或销毁的raw。

| 事实 | 观测 |
| --- | --- |
| 实际开始 | 2026-10-06T11:08:42.729Z |
| 工具前/后时点 | 11:08:42 UTC / 11:08:45 UTC（秒精度工具clock，不冒充子进程精确结束） |
| 编译 | 1个slot/1次调用；PID19033，exit0，signal=null，closeObserved=true，groupGone=true |
| 编译捕获 | stdout0B；stderr11679B，完整/无截断/observer失败；仅hash6ffc601603291ed1b4a0e26848c16b42334adf8b74646e62550f3afb592b4c3c，不保存或回显正文 |
| 后继目标 | 0个slot/0启动，三个目标全部NOT_RUN |
| 失败边界 | 编译后的固定产物/verbose核验未完成；compilerOutputAccounting=unknown；没有进一步归因证据，不能猜是哪一条检查 |
| 测量 | measurementComplete=false，无C fd结果，不说明socket或Seatbelt实际行为 |
| 清理 | cleanupComplete=true，descriptorsClosed=true，rootCreationUnknown=false，retainedRoots=[]；这是已审host的结果，不额外声称独立核验了未保存的删除路径 |
| 计量 | outputAccountingComplete=false；prepared100984 + captured11679 + artifacts153999 + receipts2265 = 可见268927B。可见值不是完整产物计量证明 |
| 持久化/时间 | resultPersisted=true；batch-result在末次持久化前elapsed1048.044042ms；safe CLI在结果持久化后、stdout交付前finalElapsed1054.934625ms |
| 最终工具结果 | exit1；withinBudgetBeforeCliDelivery=false（accounting unknown使整体gate失败）；CLI encoded1674B |

[原样safe CLI](safe-cli.stdout)、[工具回执](tool-run-receipt.json)、[batch结果](batch-result.json)、[一次预约](batch-reservation.json)、[编译slot](slot-compile.json)与[结果manifest](run-manifest.json)。[归档实际计量](archive-accounting.json)将准备证据、32KiB运行收据池及128KiB尾部区分；host捕获/产物/receipt可见值加CLI交付/安全归档仍只是保守可见合计，完整accounting保持unknown，不能据此声称整体2MiB成功。

raw compiler流只在运行内存，最终未归档。组/直属child已确认关闭，自己的root/fd清理完成，不能把compiler exit0或cleanup通过当诊断测量、Node七canary、隔离或真实provider通过。当前 **STOPPED / WINDOW_CONSUMED**；不重试、不恢复旧clock，不存在第2次编译或第4目标入口许可。进一步实际诊断需新的内部预算/可判别方案，本次不实施。旧诊断失败及源/raw不变；既有R06/薄consumer的独立集成收据仍有效，不等待本诊断。
