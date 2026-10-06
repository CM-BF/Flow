# Pre-JS stdio hypothesis — read-only, no new run

WPF-MATURE-02-03，2026-10-06 10:23:47 UTC。旧d35c596诊断结果/预算已封存；本页不产生新child许可、不修改profile或transport，不扫描OS事件/私人crash历史。SIGABRT+0 parent stderr的原因仍unknown。

## 已核源码链与事实边界

- 已审R06 index.ts的spawn固定stdin/stdout/stderr为三个pipe。Node v24.20.0的异步pipe创建PipeConstants.SOCKET；libuv v1.52.1的UV_CREATE_PIPE走uv_socketpair(SOCK_STREAM)，其实现使用AF_UNIX socketpair。因此“pipe”不必是匿名FIFO。[Node child_process.js](https://github.com/nodejs/node/blob/v24.20.0/lib/internal/child_process.js#L987)、[libuv process.c](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/process.c#L174)、[libuv tcp.c](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/tcp.c#L593)。
- Node PlatformInit在JS/参数处理之前检查fd0..2；fstat失败且errno非EBADF会ABORT，后续还有fcntl(F_GETFL)、uv_guess_handle及信号/资源初始化。因此没有JS/preload输出不能定位到JS，更不能只归因uv_thread_create。[node.cc stdio checks](https://github.com/nodejs/node/blob/v24.20.0/src/node.cc#L513)、[初始化调用顺序](https://github.com/nodejs/node/blob/v24.20.0/src/node.cc#L1030)。
- 现profile显式deny network*，同时只允许有界文件metadata。这与AF_UNIX线索构成**待证假设**，不证明该机器Seatbelt如何检查fstat/通信，亦没有实际child fd类型、errno或具体deny规则的运行证据。0bytes只是父管道收到空，不能声称子进程没有错误文字。
- 本地静态profile依赖记录包含固定libuv1.52.1 dylib；本次未读取旧child内存/fd，未执行版本命令、helper或新增系统探针。不能将官方源码链替换为现场fd观测。

## 三层证据必须分开

| 层 | 能证明什么 | 当前事实 |
| --- | --- | --- |
| pre-JS fd/OS调用 | 实际继承fd类别、metadata调用返回、固定读写是否成功 | 未观测；AF_UNIX只是固定源码路径推断 |
| Node平台初始化 | stdio检查、信号/资源、后续thread/loop初始化是否走过 | SIGABRT且无定位，阶段unknown；无效CLI参数也在PlatformInit之后，不能当其前置探针 |
| JS canary | preload/peer可运行后七项拒绝与允许断言 | 没有有效报告，七项均未通过 |

## 最小后继合同候选（先审source，再单独定运行窗口）

优先选择一个**不使用Node运行时**的自有小原生synthetic peer，沿R06现有spawn/close接口；不造第二supervisor，不改三个pipe，不扩network/Mach/全盘权限。helper需在实验scope实现并固定binary/source/hash；它的精确可执行/库读取literal属于新的profile candidate差异，必须先审，旧profile不改。当前没有编译/执行许可，本页仅列可判别接口。

helper仅检查自身fd0..2，依次记录fstat返回与errno、成功时的S_IFMT类别、fcntl(F_GETFL)结果；可在metadata成功时用getsockopt(SO_TYPE)/getsockname仅输出family/type枚举，不输出socket路径/对端地址。固定长度stdin读和stdout/stderr固定标记写分别报告字节数/errno；有界poll，SIGPIPE处理固定，无任意payload回显、socket创建、connect、个人文件或环境枚举。R06自动initialize字节若已到达，只验证固定少量非秘密帧前缀/长度，不回报原文；helper不仿造Codex ready/model/turn语义。

报告走ALLOW_ROOT/state中**独占预定普通文件**，不依赖可能受影响的stdio：wx/no-follow、已登记父目录/精确inode、≤2KiB、固定schema、fsync+close。若report文件自身无法建立/持久化，返回明确report-unavailable，不能从空stdout推断成功。host只读这个唯一自有文件并核PID/attempt reservation/nonce/source/profile hashes；有界保留或精确清理规则和外层elapsed沿已审driver，不读取OS历史。helper退出造成R06 ready失败是预期测试现象，不能将其伪装JSONL handshake成功。

建议安全DTO只含 `stage`, `fd:0|1|2`, `kind:socket|fifo|regular|character|unknown`, 每个预定调用的 `ok`, `errno:EPERM|EACCES|EBADF|OTHER|null`, 固定marker字节数、报告提交/关闭事实。任意失败不能拿来源推断补成功kind/errno；OTHER不回传错误文本。源码测试可先用确定性syscall结果验证每种分支/输出上限/失败保留，0child；实际helper验证必须另获窗口，不使用旧第三次额度。

| 后继观测（假设结果） | 可得结论 / 下一步 |
| --- | --- |
| helper报告fstat明确EPERM/EACCES | 仅证明该helper/该候选profile/该fd的metadata失败；与Node早期abort机制一致，但未证明旧Node失败就是同一errno，不能自动放宽规则 |
| metadata成功而固定stdio读写失败 | 将metadata和通信分开；保留具体调用枚举，仍不概括为全部network被拒或允许 |
| metadata/固定通信全部成功 | 排除该helper现场这组操作失败；Node平台其他步骤仍unknown，需后继精确假设，不能算Node/JS/隔离通过 |
| helper不能启动或独占报告缺失 | bootstrap/report未知，停止；不额外child、不把stderr空当原因 |

这个probe会更换可执行文件，所以即便观察完整，也只描述helper自身及同类继承fd，不是复现旧Node内部原位调用。若Lead要求定位旧Node原位errno，需另评估精确owned PID/time的受控OS观测，当前未提供、未读取。优先交付独立configured catalog，不以无界平台研究替代可实施工作。
