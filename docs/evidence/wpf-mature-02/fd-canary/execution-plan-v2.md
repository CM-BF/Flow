# C fd canary：当前可审组合合同

WPF-MATURE-02-03；owner chatui01_owner / gpt-6-astra，co-lead Mika。当前 **NOT_COMPILED / NOT_RUN / WINDOW_NOT_OPEN**。本合同替代旧 execution-plan.md 的编译临时产物口径；旧文件/manifest保留其历史target。C/profile/schema保持722032083d2cdfc6790103d18749c333c1b8f9e1，architecture_read于2026-10-06 10:48:20 UTC仅批准该三源。后继组合须固定独审并由Mika给明确窗口。

目的仅为观察自有C程序fd0/1/2的fstat/fcntl结果，对比继承socket与三个自有普通文件。最多一次clang工具链调用、最多三个目标启动，单一60秒涵盖入口hash核验、编译、运行、清理和结果持久化/CLI交付；2MiB包括预先绑定的准备证据、捕获流、自有编译产物/报告、运行收据及安全归档余量。0真实Codex/SDK/provider/auth/网络探针，旧失败窗口保持封存。

| 顺序 | 输入与门禁 |
| --- | --- |
| 预检 | 同树clean metadata HEAD由Mika窗口回执固定；入口核Node、全部运行源码、准备证据与固定clang/ld/sandbox/SDKSettings哈希。任一不符不调用compiler。 |
| 编译 | 先wx/fsync总预约和compile slot，再唯一clang调用。固定cwd=own control、output=control/fd-canary、TMPDIR=own state/tmp；-v、-fno-integrated-cc1、-save-temps=obj，20秒。必须close/exit0、组不存在、捕获完整、全部可见产物及verbose声明输出可核、binary≤256KiB，才允许目标。 |
| 目标1 | 同binary无sandbox，stdio三pipe；完整nonce+PID五行报告/exit0，三fstat为socket且fcntl成功，才进入2。 |
| 目标2 | 原冻结profile加唯一CANARY_EXECUTABLE literal、同binary/pipe；完整报告/exit0才进入3。报告中保存的EPERM/EACCES是有效测量，启动/报告缺失则立即停止。 |
| 目标3 | 与2相同profile/binary，fd0..2为三个自有普通文件；不启动Node后继。每目标≤5秒。 |

**唯一职责与复用。** host.mjs只拥有本次顺序、预算、预约、两个临时root/自有fd与清理；command.mjs只拥有一次detached child/group和有限停止；report.mjs只做固定报告/编译verbose的纯解码。execute-reviewed.mjs是惰性入口与固定输入门禁，host.test.ts只用fake child/已解码报告和自有临时文件。复用已审R06 stderr-capture.ts字节复制边界，不复制其JSONRPC/stdio协议或agent loop；无生产transport启动。扩展目标或grant要另审，当前接口不接受任意shell命令。

**保留编译输出。** 同一次clang调用的-save-temps=obj把中间输出留在最终output所在目录；-v子命令仅允许固定clang/ld、有限frontend/assembler/linker以及own control的-o输出，最多8条，必须含frontend与linker。实际数量不预设两条；PID为unknown，仅记录verbose命令证据，不冒充OS后代全集。任何未知/未引号命令、输出外置或声明输出消失均unknown并停止。遍历两个own root（含own TMPDIR）≤64项/深度4，无symlink；未生成的可选.i/.bc/.s/.o不强求存在。SDK headers为输入，不做全盘IO监控。工具链内部未声明且已删除的临时输出仍无法证明被完全计量；当前口径仅“可见自有文件+verbose声明输出”，不声称系统级全量写入审计。

依据：[Clang当前官方选项](https://clang.llvm.org/docs/ClangCommandLineReference.html#cmdoption-clang-save-temps)、[固定LLVM18.1.8参考](https://releases.llvm.org/18.1.8/tools/clang/docs/ClangCommandLineReference.html)。本机clang.1第870–871行列-save-temps，984–986行列TMPDIR/TEMP/TMP；本地手册hash绑定在driver-input，手册不证明实际compiler版本。未运行help/version/预编译；执行只以固定binary bytes/SHA识别工具链，verbose正文保持私有、不回显。

**预算。** driver-input的preparedEvidence列表逐字节/hash绑定、预扣实际合计。运行硬预留32768字节收据池及131072字节后续安全归档池；其余才可用于捕获流和产物。每stdout/stderr≤65536 bytes、报告≤4096、binary≤262144，输出artifact按每路径已见最大size累加。编译后及每目标后核清单，超界停止；未能核最终inventory或未知child/资源均outputAccountingComplete=false，不因可见字节较少而通过。没有文件系统写入硬配额，编译期间同步OS IO不可抢占，事后发现越界必须如实失败。输入Node/clang/SDK读取不算输出；复制的source/profile仍作为产物计入，准备证据与运行副本分别计量。

**生命周期。** 首次stop固定TERM→250ms KILL→750ms有界观察返回，多次close/error不延长。成功依赖child close而非exit、process group仅ESRCH算gone。强制返回时destroy pipes并unref尚未知child，使CLI可返回；这不是确认进程已消失，root必须保留。由此失败时实际未知子进程可能仍存在，禁止后继启动。每root在mkdtemp返回即登记原路径，未知inode或准备失败保留并报告；普通文件fd创建即登记，finally关闭。只有所有child/group/fd已确认、root inode未变及完整最终清单才删除精确own root。没有FORCE共享服务或外部路径删除。

**持久化/结果。** 预约已消费后失败/未知禁止重试或新clock。batch-result注明before-result-persistence；CLI envelope给after-result-persistence-before-cli-write时间与精确encoded字节，stdout callback之后的真实耗时决定exit code。CLI0要求measurement、cleanup、accounting、result persisted、全预算同时成立；仍不是Node七canary/隔离/真实模型通过。报告保留原result/errno，不推断具体Seatbelt规则。raw compiler stdout/stderr仅内存，最后不归档；提交仅有限枚举、计数、hash、owned路径及C五行安全报告。安全归档必须再以实际文件清单核≤预留128KiB，不能凭预留视为已发生。

[README精确执行recipe](README.md)是实际入口；本合同没有自行运行许可。
