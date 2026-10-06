# Prepare 静态 guard 核验，未执行

2026-10-06 14:06 UTC。Root提供fresh available=952800KiB，低于1GiB，更低于启动阈值1GiB+128MiB；本次没有再轮询df。Recovery第2types完成不改变这一拒绝条件。gate.json、artifact-result.json、supervisor-result.json均不存在；0build、0源/cache/服务操作。仅AST解析supervise.py并对git固定84005的两工具原字节做hash核验，未运行supervisor/driver、未另作实验。

固定输入：工具84005a260dfcb668cd38b09c21564d0754a0f513，source实际5069586a9f17332de526e101eca3a4250cbc8d91、approved provenance9eec51b72c6432b5b41df52f5b8fa783eb45e65b、releaseId388371a4972c469b8ace623454594132。

原工具未改：
- web-artifact.mjs SHA256 `e2997e95f2d1bff4c90f21f08ba646c941d3805a6a3aa7a40ae0ad5afe43296e`
- environment.mjs SHA256 `07f37e7d6ca07e1b48899811bf05e3f8ff76eacb33831f74b6e8f277414d16b6`
- supervisor SHA256 `49b1118911e0d291dbb475c366948d0ed1467309e1efc5681ce0002828d90e15`
完整六文件hash在static-guard-review.json。

## 已表达的守卫

- 缺fresh claim/window/root gate即不spawn；再次核source506 clean、工具hash、cache owner/realpath、consumer快照与free阈值。
- sandbox默认允许读/执行但deny其他file-write，仅本run+两精确cache+/dev/null允许；TMPDIR/TMP/TEMP仅ownscratch，HOME不改。配置旁EACCES fallback会失败，不放宽权限。
- prepare独立session/PGID，internal build继承；100s工作/120s总预留20s清理，内部90s timeout。异常/空间阈值/监测错误导致退出工作并对自身group TERM3s后KILL；不停止其它process。
- 500ms采样，启动free≥1GiB+128MiB，≤1GiB+64MiB中止；dist16MiB/128files/单8MiB、cache正增长4MiB/config临时单1MiB、捕获stdout+stderr1MiB。
- 无存活自身group才删除本run partial stages；原cache不删，不可归因的新增cache报告保留。正式tool执行verify并在父进程再次核sourceHead/tree/lock/releaseId/format；保存结果和采样。

## 执行前还需收紧的脚本事实（本次仅记录，未修/未跑）

1. **清理错误必须统一失败**：当前finally把stage删除或wait异常加入cleanup数组，但并非每种cleanup错误都把success置false；一次prepare成功后出现清理错误仍可能输出success=true。真正执行前须将任何cleanup error / 未知进程退出 / 未完成stage清理纳入失败条件，不能仅读success而忽略cleanup。
2. **1MiB目前只硬截captured stdout+stderr**：JSON采样、cache前后清单、descriptor/report写入未共享该总预算。计划总体日志≤1MiB需对全部诊断输出实行剩余预算和有限清单，不把capture limit说成总日志已落实。
3. **时间与空间不是硬quota**：同步stat/inventory/cleanup与部分工具读可能跨过采样或截止；共享并发和OS swap无隔离。即使阈值守卫修完整，也只表示及时检测/尽力中止，不证明1GiB绝不会瞬时跌破。外层被系统终止/掉电时finally不保证执行，残留需由原operator核身份处理。

这些是/tmp监督器的静态检查结论，不是产品finding、不改变固定SVC工具、不构成build批准。先保留脚本，等待fresh资源恢复及新的明确执行通知；收到前不创建gate/不claim/不启动。
