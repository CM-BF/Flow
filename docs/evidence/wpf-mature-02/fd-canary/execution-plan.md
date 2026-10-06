# C fd canary：编译、预算与清理细则

WPF-MATURE-02-03；owner chatui01_owner / gpt-6-astra，co-lead Mika。当前 **NOT_COMPILED / NOT_RUN**；没有driver入口，本合同不自行启动。旧profile/raw/两次失败窗口冻结。新授权上限为一次编译工具链调用、最多3个合成目标启动、同一60秒含编译/清理/末次持久化、输出证据≤2MiB。fixed source/后继最薄执行器独审通过后，由Mika与其他实际窗口串行安排。无需用户重复许可。

**目的：** 只区分自有C程序继承socket与普通文件fd的fstat/fcntl结果。C不使用Node、stdio通信、socket操作、网络探针、auth或JSONRPC；不验证生产transport或模型。已有XNU main源码中socket stat经MAC policy检查，使这个对照具有判别价值，但不是本机kernel构建/Seatbelt规则证据，更不是旧Node SIGABRT的归因。[sys_socket.c](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/sys_socket.c#L330)、[mac_socket.c](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_socket.c#L200)。

| 顺序 | 目标/stdio | 成功进入下一步的gate |
| --- | --- | --- |
| 编译 | 固定本机clang，一次生成唯一自有binary | 正常close/exit0；私有verbose子命令清单可核；binary是预定无symlink普通文件，≤256KiB且hash固定；否则余项NOT_RUN |
| 1 | 无sandbox的同一个C binary；Node host spawn的三条pipe | 完整绑定nonce/PID报告且exit0；fstat三项socket、fcntl成功。控制不满足则停止，不靠源码猜fd类别 |
| 2 | 原冻结profile加唯一binary literal；仍三条pipe | 启动/报告完整/exit0才允许3；fstat或fcntl的EPERM/EACCES是**测量结果**，不等于启动失败。没有完整报告则停止 |
| 3 | 与2相同profile/binary；fd0/1/2改为三个自有普通文件 | 完整报告与exit0才可比较；其余Node平台初始化、JS七检查全部NOT_RUN，不暗加第4目标 |

**源码/报告：** [C](../../../../experiments/codex-app-server-conformance/fd-canary/fd-canary.c)只用一次open(O_EXCL/O_NOFOLLOW)，先写并fsync entered-main记录，再依序对自身0..2做fstat和fcntl(F_GETFL)：每次调用前errno=0，返回后立即保存返回整数和errno整数/有限枚举，不以ok替代原始返回；最后写complete并fsync/close。没有stdio读写、fork、线程、环境枚举或任意文件读取。每行≤511 bytes、文件≤4096 bytes，无系统错误文字。报告为五行JSONL，按[严格schema](../../../../experiments/codex-app-server-conformance/fd-canary/report.schema.json)解码；host另核同nonce与spawn PID、顺序、字节数、精确owned inode。失败stat不填socket；errno只EPERM/EACCES/EBADF/EINTR/OTHER。header存在但未完成只表示进入main，不能作为测量成功。报告fd若占用0..2立即关闭并exit66，避免改变被测stdio。result/errno矛盾按schema拒绝为unknown。exit64参数、65报告open、66覆盖被测fd、70格式界限、71write、72fsync、73close；无raw perror。

**profile：** [candidate.sb](../../../../experiments/codex-app-server-conformance/fd-canary/candidate.sb)是旧default-deny.sb逐字前缀加单个CANARY_EXECUTABLE精确literal的exec/read/map；host仅绑定本次control/fd-canary。没有其他network/Mach/HOME/Keychain/任意文件grant。原许可Node/Codex literal保留并不授权启动它们。A/B两个独占临时根创建即登记原路径/inode未知，A/control只读源码/profile/binary，A/state私有HOME/TMP/report/stdio，B仅满足原DENY_ROOT绑定，C不读取B。

**编译调用与子进程清单：** 后继host直接spawn固定 `/Library/Developer/CommandLineTools/usr/bin/clang`，不用shell/xcrun；`-v -fno-integrated-cc1 -std=c11 -D_DARWIN_C_SOURCE -O0 -Wall -Wextra -Werror -fno-modules -isysroot /Library/Developer/CommandLineTools/SDKs/MacOSX26.0.sdk -arch arm64 -mmacosx-version-min=15.0 <owned-control/fd-canary.c> -o <owned-control/fd-canary>`。显式env仅PATH=/usr/bin:/bin、HOME/TMPDIR各自空owned目录、LANG/LC_ALL=C、TZ=UTC；不继承process.env。固定clang/ld/SDKSettings和source hash见manifest，实际编译器版本只能在这一次-v输出后记录，不先执行--version/探测编译。预期driver自身+其cc1（同clang）+ld；私有-v日志中只接受这两条固定路径子命令，记录路径/hash/角色，子PID未知必须写unknown，不能把verbose当OS完整进程清单。缺清单/额外工具命令/失败立即停止，不补第二次编译。clang/ld运行不套目标profile；仅本次可信本地工具链和自有输入，不能称编译器已OS隔离。

**60秒/2MiB与清理：** 后继执行器只做有限列表的一发进程调用，不接生产transport，不创建agent loop。start在首次资源创建前；先wx+fsync一次reservation再编译/目标，既有reservation拒绝运行。编译≤20秒，每目标≤5秒且总elapsed≥45秒不再启动；剩余窗口仅清理/持久化。每个目标spawn前持久消费该slot，未知不重发。直属child和编译器自有process group按固定TERM→KILL/close deadline处理；退出与stdio close分开，未确认的组/child不得声称清理完成。编译器派生PID未知、group缺退出证据时明确unknown，不删可能仍使用的根。输出预算包含最终binary（≤256KiB）、可见自有object/复制source/profile/报告、捕获的compiler与目标stdio、安全receipt；预留最后receipt后共同计入2MiB。捕获流有硬byte cap；编译结束时只枚举自己的根并量已知普通文件，不为每次文件写入新增监控。无法确认的编译临时输出单列unknown，不能声称总量完整测量；超界或未知停止后续目标。binary与raw编译文本只临时持有，安全hash/枚举记录后清理，不发布它们。

父stdio pipe只保持打开至close，不发送内容。普通file stdio由host先wx创建/open，C只检查，不写；host在目标close后关闭所有fd。报告先核lstat/fstat同inode/dev且普通文件/no symlink/≤4KiB再解析；只持久化有限schema字段及hash/bytes，私有raw不输出/提交。所有资源从创建起在finally账本：已确认所有进程/组close后才按精确inode清根，未知保留原路径并cleanupComplete=false；不扫描/杀其他PID或服务。最后安全result wx/fsync/close，CLI再报告finalElapsed/withinBudget，文件注明before-result-persistence基准；不可抢占OS同步fsync的限制保留。任何超界/未知关闭/启动失败都封存并停止，余项NOT_RUN，不恢复旧clock或再开batch。

**当前交付边界：** 只有C/source/profile/schema与这页合同，未写或执行process driver、未编译/启动任何目标。静态核只有路径/JSON/前缀差异/hash，不能冒充C编译、SBPL编译或动态通过。后继driver必须先固定hash并补0目标的故障检查：创建即登记、reserve-before-spawn、输出上限、partial report、owned-fd关闭、未知进程保留、最终fsync计时，然后独审整个输入组合才可运行。
