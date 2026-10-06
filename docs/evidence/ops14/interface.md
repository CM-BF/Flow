# OPS14 Interface v1 — 独立外层进程监督

唯一 public 调用：`supervise(launch: Launch, policy: Policy) -> Report`。标准库 POSIX Python，导入无 spawn。`Launch` 是受信 argv / 绝对 cwd / 显式 env 与有限 ownership enum；不接收 PID、PGID、日志句柄、callback、任意 probe 或资源清理动作。每次最多 spawn 一个被监督 child，stdin 为 DEVNULL，stdout/stderr 分开且共享总 byte 上限。

`childPidOnly`：只停止本次 child；即便 child 已 spawn detached center/runner/Web，绝不向其 group 发信号。`newChildSession`：本次 child 为新 session leader，只管理初始 process group；不承诺会追踪逃逸的 detached 后代。group 保留 absent / present / unknown 三态，观察或 signal 的 EPERM / 未知阻止升级。

`Policy`：有限 workSeconds、termGraceSeconds、killGraceSeconds、combinedOutputBytes。TERM grace 为零用于 SVC05H 原直接 KILL deadline 形状；组模式先 TERM 后有依据 KILL。外层独立于 operator，监督过程中没有任何 caller I/O / callback / 日志 flush / report fsync；child 的 reservation/final persistence 挂起也受期限约束。spawn OS syscall 与进程调度非硬实时；不声称对内核不可中断操作有 hard kill 保证。报告写盘在返回后由 caller 承担，不得把它当停止许可或模块总墙钟证明。

`Report`：自己 spawn 的 pid、ownership、exit、elapsedMs；有界 stdout/stderr bytes 与 observed/retained counts / EOF；firstFailure 的固定 phase/code/type/safe message 与 secondaryFailures；signals、ownedState。未捕获原异常 message、argv 或 env，以免泄密。默认 unknown 保留外部资源且不重试。只证明选定所有权范围的当前观察，不证明任意后台活动或 DB 清理。

调用顺序：caller 先完成耐久 reservation → supervise 固定 child → 报告耐久化 → caller 按自身 marker / resource 规则决定后续；模块不接受阻塞 on_spawn callback。首两个兼容 consumer 是 SVC05H 118+2 秒只 operator PID、SVC07 有限 group +64 KiB 输出形状。原包装器仍冻结，当前只用受控子进程；正式接入需精确移交 scope / 原行为对照。O16 动态多组 IPC guard 不强行统一。

实现细节约束：使用 POSIX waitid(WNOWAIT) 保留自己 leader 的 PID，所有 group 信号在 reap 前完成，reap 后绝不再 signal。Darwin 对只有 zombie 的 group 可能返回 EPERM；保留该 unknown 观察且永久停止信号升级，只有 reap 自己已确认退出的 child 后再次只读观察到 ESRCH 才记录当前 absent。未知不会被当 absent；过去的观察保存在报告。成功只代表本接口范围，caller 仍核业务结果。停止后在同一剩余 cleanup 期限内读管道，EOF 未到明确为不完整，不因正常 child exit 取消期限。

报告中的 ownedState 是最后一次所有权范围观察；signal EPERM 保持 signal=unknown 且禁止升级，如果随后只读观察明确仍存在，ownedState=present（不会改写成 absent 或掩盖 signal failure）。
