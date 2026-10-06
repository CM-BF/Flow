# TUI01F-03 首次真实旅程：行为通过，清理未确认

2026-10-06 17:17 UTC，唯一窗口 `TUI01F-03-20261006-1714`，source `40508f18432ffc20eadd638b208841a364c72bea` / 后台 `a89f42ab57acb53657af6a2d1b745dabd4d50aa5` 不变。Execution Lead 明确允许一次两项、120s work+60s cleanup观察，fresh至少1GiB+64MiB，raw4MiB/tmp16MiB为观察阈值、共享剩余1GiB；没有provider/个人服务动作。此前source/types批准不扩大为本实际结果批准。

## 原始结果

原用例 **2 selected / 2 passed**，但 **suite failed / exit1**。耗时8.31s（框架7.52s、tests6.10s）。第一项实际公共中心受理A取消后proxy丢一次ACK，持久journal重开，第二公开client建立B，recover仍原A/key/body。第二项真实Ink PTY取消B、观察C、中文emoji多行未发草稿及60×20 resize后退出，C继续运行并由fixture屏障完成；中心最终 A/B cancelled、C succeeded/verification passed。这些是synthetic adapter事实，不证明native/A2A停止或实际App交替。

唯一失败是afterAll `connections` 被原fixture记录为 **unknown**。runnerStopped/proxyStopped/centerStopped/adminClosed均true；fixture PTY PGID75767停止true，外层核测试PGID73722和PTY75767均不存在，未发送停止信号。原fixture没有保留该查询的rows/error，因此目前不能判断是短暂残留连接、查询失败还是实际泄漏，不猜原因。

完整fixture checkpoint已持久化，随后result为 `failed-or-unknown-retained`；**未执行DROP/rm**。保留数据库 `flow_tui01f_44a622c76d68`、私有目录 `/tmp/flow-tui01f-03-20261006-1714/temporary/flow-tui01f-2SAkN5`、外层记录和cache。没有重试或再采PG，没有删其他资源。清理状态不通过，TUI01F-03仍open；后续只可在新的明确范围/窗口下核自己资源。原stderr/exit1/unknown永久保留。

## 资源事实

外层最小实采free 1,212,129,280B、结束1,215,246,336B；raw最大观察78,656B、own tmp/cache最大观察3,085,874B，cache增长0，未触观察阈值。PG/WAL不计入tmp增量，未独立测库字节；这些是采样，不是完整物理峰值/硬空间预留。Node/PTY生命周期结束，数据库未清理，不能将串行进程窗口结束称全部资源清理完成。

外层只复用原Vitest入口，一次reservation，记录source/hash/owned PID和采样；没有替换测试逻辑。源码3文件对40508f及9原保护产品均未改；类型/原36/旧领域没有重跑。本轮0provider、0浏览器、0安装。

[原stdout](outer-stdout.txt) / [原stderr](outer-stderr.txt) / [外层结果](outer-supervisor-result.json) / [fixture checkpoint](fixture-checkpoint.json) / [fixture result](fixture-result.json) / [PTY原结果](fixture-pty.json)。本目录原始文件均逐字复制；后续解释不得覆盖它们。执行临时绝对路径仅为本次资源身份，不是通用重跑命令。
