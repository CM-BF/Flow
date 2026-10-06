# C fd v2一次窗口：测量未完成，已停止

窗口 `go-c-fd-v2-851fd8c7-once`，执行HEAD `c44189e41d2432cf502fc282920ecbda1c390081`；组合851fd8c7 / source391f67b4。11:25:58.700Z fresh v4 ACTIVE、clean、45绑定及input/manifest一致，无预约/result/raw；唯一入口一次于2026-10-06T11:26:01.333Z开始。

1 compile正常exit0；5条verbose为编译器报告的命令清单，PID均unknown，不能当独立进程观察。固定输出校验通过。控制目标exit0，实际报告fd0/1/2均socket，fstat和fcntl成功。第二个受限profile目标SIGABRT、父管道stderr0B、report=null；第三目标NOT_RUN。失败阶段target-2-health/类别unclassified，原因unknown；不能推断具体pre-main阶段、拒绝规则或旧窗口失败原因。隔离和真实Codex能力均未通过。

[安全CLI](safe-cli.stdout)：measurementComplete=false；cleanupComplete/descriptorsClosed/outputAccountingComplete=true，retainedRoots=[]。清理由已审driver的身份/final inventory门禁确认，本回执没有另扫临时目录。1416.999375ms为结果持久化前，1427.775042ms为结果持久化后CLI写前；工具exit1，不把CLI当隔离成功。编译原流仅本地0600留存，见[哈希/权限清单](compiler-raw-inventory.json)，未回显或自动Git原文。运行可见计量290398B，含prepared104454、capture11679、artifact166418（含raw持久副本）、receipt7847；CLI5145B与实际安全归档另见[预算清单](archive-accounting.json)。输出完整性仅可见owned产物/verbose输出口径，不是全系统IO证明。

[结果manifest](run-manifest.json)绑定安全结果及固定输入；原README/approval请求保留运行前历史快照。新运行许可已消费，无重试、无第三项补跑、无Codex/SDK/provider/auth/network/个人服务。当前结果待独立只读复审；既有R06/薄consumer可独立交付。

时间边界：raw-inventory与人工归档metadata在runtime结束后另行整理；其实际字节仍完整计入尾预算，但不声称这些后续持久化发生在1427ms或原60秒内。整体“全部归档持久化≤60秒”未获证明，不倒推窗口整体通过。
