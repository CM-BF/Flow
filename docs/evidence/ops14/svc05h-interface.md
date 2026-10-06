# SVC05H 薄调用者迁移

来源固定 main 78fb37704d708e3b3b6ea4f1810947f012666196 的两个既有文件；旧 owner release 后 OPS14 claim v2 接收，仅此二文件，不改 operator.mjs、授权、nonce、个人服务或 SVC07 冻结候选。

`supervise(argv, work_seconds=118, exit_seconds=2)` 保持签名。固定本仓库相对路径加载唯一 `tools/owned-process-supervision/supervise.py`，无复制循环。当前 cwd / 环境与 argv 传至显式 Launch，环境不输出；CHILD_PID_ONLY / 默认 SEPARATE，Policy(work,0,exit,65536)。仍只停止本次自己 spawn 且未回收的 operator PID；不停止 detached 服务组。

保留原 operatorPid / operatorExit / deadlineExceeded / operatorStopped / elapsedMs / stdout / stderr / serviceSignals。新增 supervision 记录实际 ownership、capture、EOF、最早错误、次生错误、保留/观察字节与信号。正常结果必须 exit0、无任何监督错误、所有实际pipe EOF、已知child absent；否则 unknown。spawn失败不自造operatorStopped。明确新64KiB合计输出上限，溢出停止自己operator且unknown，不将截断输出当成功。

进程监督包含 operator 内的同步写盘等待；调用返回后父进程的 JSON print / 持久证据不在 Module 的deadline内。此迁移没有扩大旧许可，新实际恢复必须另行绑定当前 source 和新授权，不复投旧已消费authorization。本次仅运行两个受控直接consumer，不执行 --execute-center-once 或真实服务。

验证：原normal改为同时检查stdout/stderr分流及EOF；原真实pipe阻塞仍验证 deadline、SIGKILL、独立子进程存活，再由测试自行TERM并确认其group absent。原两用例身份不变，断言仅增强。
