# 退役接入原发布：固定步骤，尚未执行

输入 source=af51；普通 idle gate、两个失败窗口、原 report/transfer/refresh/resume/publish 工具不改。所有步骤用原外层 supervise、独占 intent/result 和新串行窗口；drain 起累计≤15min，失败未知立即停后继。GO 经 Lead 已批准这一旧 intent 的新语义，**实现/独审与窗口条件仍未自动满足**。

1. 新现场完整身份、源、资源、三报告/产物准入照原流程；退役前基线用既有 center-recovery `snapshot()`（其全表原摘要完整保存），单独绑定精确非空 v1 journal 与原历史文件。它不是普通 idle 通过。`snapshot` 内 362 compatibility 检查用于当前仍运行的旧后台，af51 三报告另按既有材料 gate 核实；不冒充已更新。原 observer 的 idle=false 不改绿。
2. 既有材料导入/搬运与 maintenance bootstrap 按原顺序、原受审入口进行，持久 drain receipt 后停止计时重置。新 `holdAndStopRunner(request, output)` 复用原 snapshot、维护 hold 命令和 `stopOwnedProcess`，只确认停止旧 runner；center/Web 不发信号。请求固定同 operation/drainVersion，原 local holdKey；不得换 key 重投。before/intent/hold receipt 先持久，停止未知只保留，不重启或继续退役。
3. 根据已存 before/hold/stop 结果生成新的0600 request，精确 root/runner/namespace/journal devino、原 hash、config/state hash、四历史文件、holdVersion/op、单次 retirementId。它是新审计输入；原 inFlight UUID 不上 wire，也不进入公开输出。调用 `operator.mjs --retire-once` 的唯一执行入口；实际命令须经既有 Python `supervise()`，不得直接无总限运行。当前未生成个人 request 或 permit。
4. 退役结果为 retired 且独立只读复核原件/新字节/审计、hold 仍成立后，可直接调用既有 `maintenance refresh`：源码支持 maintenance + runner stopped，其他进程必须已确认；它沿原 operation 停 center/Web 并启动固定 af51 三角色，生成 ready-paused。**不先伪装 runner running，也不单独 resume**。未知时不走 refresh。
5. 更新后保存普通 observer 的新事实与整个保留 checkpoint。原前置旧 journal 未决→新 idle 是此次唯一额外允许字段差异，私有备份/审计目录是明确新增；四个历史 result 与其余旧字段保持。四维护列+新增维护audit、预声明 queue_checked_at 仍按原口径；不同 baseline shape 不得直接交旧 compare 凑绿，先通过已保存的逐表/逐文件映射核对，原 raw 永久保留。然后同 op 一次显式 resume，最后独立 Web CAS d629/v3。

边界：当前新 host Adapter 只源码/语法核验；真实hold/DB锁序/runnerstop/全部pending确认和本次退役尚未执行。新增 private audit 的 byte/hash 判定只定位 unknown，不构成原ACK，也不批准自动重写。这里没有第二维护状态机或自动重试循环；任何映射/检查缺证据就停止在 maintenance，由 Lead 核定。
