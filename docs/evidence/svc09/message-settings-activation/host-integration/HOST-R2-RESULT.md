# SVC09A R2：读取输入前失败

唯一R2入口outer 3,953ms/exit1；work80ms、cleanup81ms均为`ERR_ASSERTION`。Python生成的新目录`flow-svc09a-host-e143n0_5`含合法下划线，而两入口先行正则排除了下划线。源码顺序与固定argv证明在读取input/setup前拒绝；未创建fixture数据库、连接或宿主，也未进入双槽或mixed旅程。

机械克隆3,699ms/exit0；其stdout所写后续完整verifier是预期步骤。本次work提前拒绝，克隆后`backendRuntime`完整校验没有运行，不能称本次clone已通过完整运行验证。

4个实际监督PID/组已absent、双EOF/no signals，专用admin预检pool先前关闭。16:16:36.884252Z归还实际运行窗口；克隆/私有目录KEEP，原`complete=false`及cleanup exit1保持。R1 DB/tmp与所有原件不动，0provider/个人操作/自动重试。
