# Owned process supervision

Python 标准库 Module 只启动并监督一个自己的 child，不接收外部 PID / group；导入不启动进程。完整[Interface](../../docs/evidence/ops14/interface.md)是使用合同。

```python
launch = Launch((python_executable, "operator.py"), absolute_cwd, explicit_environment,
                Ownership.CHILD_PID_ONLY)
report = supervise(launch, Policy(118, 0, 2, 65536))
```

`childPidOnly` 只 signal 自己 spawn 的 PID；detached 个人服务永不 signal。`newChildSession` 管理自己创建的初始 process group；TERM grace 后仅在已知状态允许时 KILL。不追踪逃逸 group 的后代，不宣称 OS 隔离。两种模式均创建新 session，但信号范围不同。caller 不得 reap / auto-reap 本模块 child，且应在 supervisor 外部先保存 reservation。

报告分离 first_failure、secondary_failures、exit_code、owned_state、signals 和 observations。捕获 stdout / stderr 分别保留原始 bytes，共享 output_bytes 上限；首次溢出立即进入停止。`eof` 为管道事实，正常 child exit 不代表 EOF，也不撤销剩余期限。停止后剩余 cleanup 预算内收束管道；不完整输出如实保留。报告不自动脱敏 child 原始输出；caller 只运行自己的受信 operator 并沿自身证据策略处理。错误 message 仅固定 code 文本，不带 argv / env / 原异常值。

所有监督 I/O 都是 nonblocking pipe / selector；没有 caller 日志或 fsync callback。operator 的阻塞报告写入不会阻塞监督决定。caller 返回后的报告保存不在模块期限内；不能据此声称整个调用方报告文件已经耐久。内核 spawn / signal 调度不具硬实时保证，unknown 不许可清理外部资源或重跑。

当前为独立模块及原 SVC05H / SVC07 调用形状的受控测试；两原 wrapper 尚未迁移。它们的实际 PG / 个人服务 / release 验收没有重跑。O16 动态多组 guard 保持独立。

局部入口：`python3 -B tools/owned-process-supervision/supervise.test.py`，共 12 个不同受控检查；外层工作预算 12 秒 / 收尾 1 秒，fresh 1 GiB +4 MiB。实际分轮记录见[证据](../../docs/evidence/ops14/README.md)。
