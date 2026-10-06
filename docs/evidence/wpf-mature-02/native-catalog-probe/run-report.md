# 唯一 native 目录窗口：握手前失败

执行HEAD `02106c8173dfd3b39f2f369b53eab8c4e6ef2a00`，go-native-catalog-probe-once 已消费。2026-10-06 17:44:57 UTC前/后tool观测同秒，+1秒保守上界支持45秒；tool wall0.364166334s与内部post-result/pre-CLI436.690458ms分别记录，不互相等同。工具/outer exit1。后续人工归档与review/Git在运行时钟之外、bytes仍入archive。

1个固定native PID35228，R06 ready前DISCONNECTED/SIGABRT；model/list 0次，目录未生成，通知/server-request均0。调用方没有turn/auth/login/模型推理请求；native自身网络尝试、账号、实际模型和账单未知。不是目录成功或完整隔离/native写权限资格，不能关联旧Node失败原因。

R06 confirmed-exited、childCloseObserved与stderr streamEnded均true；344B完整stderr被保留为独立0600私有文件。owner按同inode/hash授权读取到内存，未打印正文：仅确认Rust panic/fatal-runtime-error文字类别，具体操作/数字errno未知。原文不入Git，待指定独审者有界诊断后另作精确同inode删除；outer207B仅hash/stat未读正文。

两个本次根与精确known子路径均独核absent，retainedRoots[]；这不意味着独立私有诊断文件已删除。前后完整样本logical17874B/allocated24576B，均≤8MiB；活动峰值unknown/非硬配额。wholeWriterSettlement unknown。

post-persistence已知runtime189714B + CLI3625B + outer639B =193978B。receipt+CLI6794B≤32768；outer=207capture+207disk+225其它/self/finalreceipt。prepared168751只计一次、stderr capture344与两disk688分别计；删除不扣账。实际archive见archive-result.json；raw≤1MiB仅保留材料，stdout累计wire=null，不能声称全wire上限。本次没有重试/新grant或后继授权。

[原机器结果](result.json)、[post-persistence CLI](safe-cli.stdout)、[工具时点](tool-receipt.json)、[完整分项](runtime-accounting.json)、[精确清理](cleanup-check.json)、[私有artifact身份](private-artifacts.json)。原机器结果为pre-persistence snapshot，最终值以CLI与独立分项为准。结果忠实性审查PENDING。
