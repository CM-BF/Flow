# 页大小与主线程栈元数据：两个helper候选（NOT_OPEN）

原native结果固定fcd9e59e/seal7a72，1目标ready前SIGABRT已消费，344B诊断原件KEEP。本片新授权最多一次现成clang调用及2个轻量C目标，compile/所有后代/两helper/清理/末次证据/CLI合计30s，新文件与捕获/副本/人工归档合计2MiB；0新Codex/Node synthetic/PG/SDK/provider/login/安装。该预算与原native旧snapshot分开。

GO及Mika安全读取已确认旧错误包含Rust commit59807616e1fa2540724bfbac14d7976d7e4a3860、stack_overflow.rs:526、os error 22；旧有限分类只找errno=语法不意味着无错误码文本。固定Rust [os.rs:400–402](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/pal/unix/os.rs#L400-L402)将sysconf页值直接cast usize；[stack_overflow.rs](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/pal/unix/stack_overflow.rs#L514-L526)的guard mmap失败打印OS错误。Apple当前[sysconf](https://github.com/apple-oss-distributions/Libc/blob/main/gen/FreeBSD/sysconf.c#L318-L326)与[getpagesize](https://github.com/apple-oss-distributions/Libc/blob/main/gen/FreeBSD/getpagesize.c#L49-L64)说明hw.pagesize查询/缓存候选，但main不是安装libSystem证明。-1转usize导致异常mmap只是可判别假设，不能当旧native因果结论。

现fd-canary只fstat/fcntl、旧binary已清；有固定clang/ld/SDK且无安装。新C只读sysconf(_SC_PAGESIZE)、getpagesize和直接sysctl MIB {CTL_HW,HW_PAGESIZE}，每调用前errno=0、返回后立即保存。pthread_self只取自己的stacksize/address-present，不新建线程、不输出指针、不mmap/MAP_FIXED；pthread errno仅诊断、正页值伴非零errno不自动判失败、页值≤0不作模除或usize转换。直接sysctl rc/value/len避免缓存正值被误称权限已放行。

A=原37023逐字前缀+两臂共同exact CANARY_EXECUTABLE exec/read/map fixture；B=A+唯一 `(allow sysctl-read (sysctl-name "hw.pagesize"))`。A不能叫完全原profile。保留原fork/Mach/network/Keychain/Users deny，不改原candidate，不读用户/全局配置。两臂同binary hash、同args/env、regular stdio，同一allow根下各自空state子目录/报告nonce；helper退出0表示完整观测，负syscall也是合法测量。未知child/group/FD/报告完整性/计量立即停、余项NOT_RUN，不重试。

唯一compile recipe沿已审编译清单：固定clang `-v -fno-integrated-cc1 -save-temps=obj -std=c11 -D_DARWIN_C_SOURCE -O0 -Wall -Wextra -Werror -fno-modules -isysroot <fixedSDK> -arch arm64 -mmacosx-version-min=15.0 <owncontrol/pagesize.c> -o <owncontrol/pagesize>`。固定cwd和TMPDIR均own；编译stdout/stderr先0600有界留证再health/parser；.i/.bc/.s/.o/binary全部实际计量，verbose cc1/cc1as/ld只是reported命令非独立PID观察。compilerInventory与runOwnedCommand复用，未另造监督器。编译后代/清理/产物不明即停。

两个目标精确为 `sandbox-exec -D ALLOW_ROOT=<own-allow> -D DENY_ROOT=<deny-own> -D CANARY_EXECUTABLE=<same-own-binary> -f <owncontrol/{baseline,pagesize}.sb> <binary> <own-allow/state/{a,b}/report.json> <nonce32>`；环境固定PATH=/usr/bin:/bin、HOME/ TMPDIR各自own、LANG=C/LC_ALL=C/TZ=UTC。单global origin；compile≤12s，两helper各≤4s且最迟global22s不再启动，TERM250ms/KILL750ms及全部清理/fsync/CLI在30s内。own root创建即登记、unknown保留；只在全部expected writer closed后bounded inventory/同inode删除。

计量上限2MiB：prepared≤256KiB、compiler/两目标实际observed streams与磁盘副本分开、binary≤256KiB、所有own输出+目录metadata逐项计量；32KiB receipt/CLI、8KiB outer、128KiB archive并留至少24KiB结果尾部。2048B以下单report逐对象严格nonce/PID/字段；父regular描述符不冒充子观察。收据明确已观测输出/可见编译产物范围，未观测临时写删峰值unknown；任何不完整不判预算通过。实际前fresh精确HEAD/claim/disk/输入/预约不存在，再由Mika命名单次OPEN。当前0compile/0helper、无检查执行；先源码/固定组合局部独审。

方法：现有本地find-skills、clean-code（固定sickn33 bdacd76方法基线）与brainstorming bounded路径，GO/Mika已批准此窄设计准备；不安装技能。模块仅一个C观测器、薄顺序caller/固定入口，复用进程owner与编译词法；成功测量不等于native修复或账号/模型资格。

Caller实现采用一个host（固定A/B顺序、owned文件收据/逐项inventory、严格report）和一个惰性entry，唯一process owner仍runOwnedCommand，编译词法沿compilerInventory。runtime必须包含command静态依赖stderr-capture.ts。宿主显式NODE_DISABLE_COMPILE_CACHE=1；目标及compiler六项env不继承NODE_*。入口提前核固定输入和其自身输出缺席，outer先预约的8路径由最终OPEN外部fresh核，不能把wx当全量preflight。全程以outer启动前UTC至工具真实exit确认≤30s，内部performance从Node启动计，末次落盘与CLI回调独立门禁。

固定C/A/B checkpoint fde671c974baf7fa2cdca5e9333e8f1eb0afcba7已获architecture_read SOURCE_REVIEW无P1/P2、Mika接收；只批准三源，不覆盖新caller/执行。原10个fake用例只注入command函数、不触实际spawn/clang/helper，含负观测、诊断errno、非法报告、一次compile/A/B参数、unknown停B、copy失败保原件、最终receipt失败、同clock门禁；已分轮通过10+2，详quality；本真实窗口未运行。含compiler副本失败保根。拟一次Vitest4 configLoader native/1worker +Node24 inert import+sh -n，合计30s/raw16KiB/cache32MiB，起跑需Mika精确小窗及fresh资源/claim。

执行检查已经收束：12 distinct fake分轮，原生惰性import与shell语法0，初次0tests保留。严格compiler stream gate在verbose parser之前；regular读前先进入保留状态、sameidentity closed-file size sample入账，超限/未知不删原件。这不将文件最终size冒称wire累计，也不声称编译全系统IO峰值。最终组合只等待固定inputs/prepared/archive核验与Mika唯一OPEN。
