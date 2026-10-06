# Sandbox67唯一窗口：测量未完成，诚实FAIL

窗口`go-c-sandbox67-once`已消费，不重试、无剩余运行授权。执行HEAD `5df7b43efe29f6b4f7a76f604b637e7c52f20293`；组合4dec/sourcef960；开始2026-10-06T12:07:13.069Z。实际1次编译/2个C目标，0Codex/Node目标/SDK/provider/auth/network/log collection。

| 阶段 | 观测 |
| --- | --- |
| compile | PID48399，exit0，直属close/groupGone确认；5条verbose命令为reported清单，非独立后代PID观察。 |
| 无profile socket控制 | PID48424，exit0，有完整5记录；fd0/1/2均socket，fstat返回0/errno0，fcntl返回2/errno0。 |
| 新profile regular目标 | PID48445，SIGABRT，code=null，report=null；直属close/groupGone确认。父确认三个own regular fd及mode0600，但不代替子fstat/errno观测。streams=null是file stdio；0capture不等于空管道或无子输出。 |

`failureStage=target-2-health`、`failureCheck=unclassified`。单条Sandbox syscall67候选未获得有效子报告，不能推断该权限无效/充分、实际syscall结果、pre-main位置或SIGABRT根因。C/profile其余grant不变，不追加vnguard/sysctl/Mach/path。

measurementComplete=false、CLI1；compilerInventory/result持久化确认、descriptorsClosed/cleanupComplete/outputAccountingComplete=true、retainedRoots=[]、rootCreationUnknown=false。这些清理与计量事实不等于隔离通过。清理为已审host按精确owned身份执行的回报，没有扫描临时目录或私人历史作替代证明。

785.954291ms是结果持久化前；794.116208ms是结果持久化后、CLI写入前的最终gate采样；工具exit1、无session。60秒覆盖自动runtime证据/cleanup/result/CLI；后续人工归档/review/Git在时钟外、bytes仍计128KiBtail。同步OS IO不可抢占的限制保留。

runtime已量303090B（prepared115530 +capture11679 +artifact166512 +receipt9369），CLI5596B；receipt+CLI14965/32768B。原始stderr11679B、stdout0B，0600固定文件只作stat/hash/inode核验，未读正文/未Git，保存磁盘副本已再次计artifact。精确安全清单为同clock自动[compiler inventory](compiler-inventory.json)；[safe CLI](safe-cli.stdout)、[工具回执](tool-run-receipt.json)、[固定结果manifest](run-manifest.json)、[实际归档计量](archive-accounting.json)。未知仍未知，不扩成全系统IO或全部writer停止证明。
