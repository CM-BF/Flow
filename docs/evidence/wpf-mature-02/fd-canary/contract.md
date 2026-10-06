# C fd canary：一页合同

WPF-MATURE-02-03，owner chatui01_owner / gpt-6-astra，co-lead Mika。**NOT_COMPILED / NOT_RUN**；本片仅C源码、候选profile、报告schema、运行设计。无driver入口。旧raw/profile/失败窗口不变；固定source及后继薄host组合独审后，Mika安排串行窗口。

| 输入与顺序 | 判别与停止规则 |
| --- | --- |
| 一次固定本机clang编译 | 固定source/tool hashes，显式空HOME/TMP/env，不经shell/xcrun；正常close/exit0、唯一binary≤256KiB、子命令清单可核才继续 |
| 目标1：无sandbox C，三条host pipe | 必须得到完整同nonce/PID报告，三个fstat都实测socket、fcntl成功；否则停止 |
| 目标2：同C+候选profile，三条pipe | 完整报告/exit0才继续；fstat/fcntl明确拒绝是可比较的测量结果；启动/报告失败停止 |
| 目标3：同C/profile，自有普通file stdio | 与目标2对照。无额外Node、JS、Codex、provider、网络或auth执行 |

[C源码](../../../../experiments/codex-app-server-conformance/fd-canary/fd-canary.c)只检查自己的fd0..2，不做stdio通信/socket操作。每次fstat/fcntl前errno=0，返回后立即保存返回值和errno。报告先写入唯一owned state精确路径，O_EXCL/O_NOFOLLOW；若open得到fd<3关闭并exit66，避免掩盖缺失stdio。五行JSONL≤4KiB，先fsync entered-main，再逐fd记录，最后complete/fsync/close。stdout/stderr失败不会承担报告传输职责；报告缺失/不全仍unknown。

[严格报告schema](../../../../experiments/codex-app-server-conformance/fd-canary/report.schema.json)要求有序start/fd0/fd1/fd2/complete；host另核nonce/PID/owned inode/字节界限，拒绝result/errno矛盾。只有有限类型/errno枚举与整数，无路径、内容、环境或错误文本。失败fstat保留kind unknown，不由控制或源码回填socket。

[候选profile](../../../../experiments/codex-app-server-conformance/fd-canary/candidate.sb)保留原profile逐字前缀，仅添加自有固定CANARY_EXECUTABLE literal的exec/read/map，所有network/Mach/HOME/Keychain边界不变。原许可Node/Codex路径不授权本窗口运行它们。

新额度：最多3目标+最多1编译调用（子命令如实列、未观测PID为unknown），同一60秒含资源准备、编译、运行、清理、末次持久化。计入2MiB：binary≤256KiB、可见object/复制source/profile/report、捕获stdio与safe receipt；编译临时输出未能量明即unknown，不能声称完整预算通过。start先于资源创建，wx reservation先于编译/目标；≥45秒停止新增目标，固定TERM/KILL/close与精确inode清理收尾，未知进程/资源保留，余项NOT_RUN。没有重试、第三方进程/服务操作、私人历史扫描或第二轮窗口。

[执行细则](execution-plan.md)列精确编译命令、固定工具链、子命令清单、资源/输出计量、最终fsync与失败清理。薄host尚未实现，不将文档当可执行预算证明；后继需固定组合hash和0目标故障检查，再独审批准运行。

依据只支持假说：当前[XNU soo_stat](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/sys_socket.c#L330)在条件编译下可经[MAC socket_check_stat](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_socket.c#L200)返回拒绝。它不是本机kernel/政策/errno证据；即使C对照明确，也不证明旧Node SIGABRT原因或后续Node平台/JS阶段通过。
