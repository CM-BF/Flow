# OPS14 局部证据

仅 stdlib POSIX Python / 自有受控子进程。0 PG、Chrome、provider、个人服务；未迁移两个真实包装器。最大 raw 文件约 67 KiB，未创建私有文件目录/依赖；-B 禁止 bytecode。初次允许 ResourceWarning 的未知 child 在同一测试 finally 中用自有 PID 正常终止并 reap / absent 核实；这是 fault-injection 的手工收尾，不是模块自动重试。

| 分轮 | 实际选择 / 通过 | 范围 |
| --- | --- | --- |
| tests-first | 10 / 8，exit 1 | 首实现，group zombie 的真实 EPERM 两红 |
| group-failure-detail | 2 / 0，exit 1，重叠 | 两红的诊断追加；仅 stdout + 工具 exit 回执，无当次完整测试源 hash |
| tests-second | 12 / 11，exit 1 | group read-only 再观察和停止后 pipe 收束改变，重选直接消费者；一处测试将明确 present 误期望为 unknown |
| signal-final | 1 / 1，11 未选，exit 0 | 仅纠正该断言；SIGNAL_UNKNOWN 与无升级断言保留 |

共 **12 个不同检查** 分轮均有通过证据；不是宣称最终一次 12/12。第二轮实现 SHA 与最终实现相同；最后只改一个测试断言 / 增强 secondary failure 检查。局部检查最长约 1.82 秒，外层限制 12+1 秒；最后单例 timeout 10 秒。三次有 gate 的运行记录有 fresh free，均 ≥1 GiB+4 MiB。两红诊断追加复用同一工作段余量，只记录真实工具输出；没有伪造 fresh 采样。

两个形状：SVC05H 原 118+2 / childPidOnly 以短比例时间模拟真实 pipe write 挂起；独立 detached stand-in 仍存活，测试 finally 单独终止自有 stand-in 并核 absent。SVC07 64 KiB stdout+stderr 溢出 / 新 session；观察 / signal EPERM 注入保持 unknown 或明确 present、禁止升级。新组 leader 先 exit 的真实 descendant 被收束；正常 exit / EOF / cleanup error / late TERM 输出均有直接检查。原 provider / PG / 个人服务时限与真实场景尚未验证。

Darwin zombie EPERM 不是 absent：报告保留 unknown observation，禁止再 signal，只 reap 自己已知退出的 child 后重新只读观察。fresh ESRCH 才确认为 absent。不存在 reap 后 signal recycled group 的路径。

通过没有把长期资源清理收进模块；组 outside-session 逃逸仍 open。两真实 consumer 需双方 owner 正式移交后迁移，OPS14-04 保持 pending。
