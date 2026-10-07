# Stock helper guard-page 失败：只读归因与最小对照候选

本段仅核已有两轮结果与公开固定源码；未新增native/C进程实验、provider、权限或policy修改。原5产品仍冻结，stock初始化失败不能直接称已定位根因。

## 已有事实与精确源码

本片05:45:25的固定binary出现Rust commit `59807616e1fa2540724bfbac14d7976d7e4a3860`路径的`stack_overflow.rs:526`/EINVAL；stdout空，两文件仍0。Mika既有native-catalog-probe/result-review.json早已记录同commit、同sourceRole与22，但旧运行是app-server ready前失败，非本轮helper请求。这里只复用其脱敏结果，不重读私有stderr，不将相同症状当相同原因。

[固定Rust stack_overflow.rs](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/pal/unix/stack_overflow.rs#L505) 的真实原始字节29791B、SHA256 `4b194ef991ea330619c86a6893544ac9bb598802ef2f8e52a215a5cbf7a52d5a`：macOS从pthread取得当前主线程栈范围（330–335），按page_size对齐（388–403），然后在固定位置匿名映射guard page（505–526）；此panic在后续mprotect之前。[同commit os.rs:400](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/pal/unix/os.rs#L400)（18923B/SHA256 `86437b5b0c1d14a2fc95629f680ddfb291af2bbf7b59e4c76a9dc6c726c2f7c1`）将sysconf(_SC_PAGESIZE)结果转为usize。**源码推断**：如果该调用返回-1，转换和地址/长度计算可能导致无效映射参数；本轮未观察该返回值，不能将其写成原因。

[Apple Libc固定71bbe350… sysconf.c:318](https://github.com/apple-oss-distributions/Libc/blob/71bbe350ab79eef58113991d817ccc6165061a64/gen/FreeBSD/sysconf.c#L318)（18448B/SHA256 `9216bc4ba925827ddf4d7920dd8f5153369c6884777bfcec007224ff934c04cb`）及[getpagesize.c:50](https://github.com/apple-oss-distributions/Libc/blob/71bbe350ab79eef58113991d817ccc6165061a64/gen/FreeBSD/getpagesize.c#L50)（2415B/SHA256 `edb4a8b80b9c177512bcd0d27a905ac11852980de80c2ef1057478094f2519c7`）给出sysconf→getpagesize→CTL_HW/HW_PAGESIZE读取、失败返回-1的公开实现。它不是本机已加载Libc二进制对应源码的证明。

[Codex rust-v0.154.0 base policy:48–49](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/sandboxing/src/seatbelt_base_policy.sbpl#L48)（3910B/SHA256 `5103332ddb8885ee5e1926de6c0ef23a61f4e55e31297506ae05fa4e0b24ba74`）包含hw.pagesize和hw.pagesize_compat。J原policy没有sysctl-read；这使**单一hw.pagesize只读许可**成为优先候选，不能据此照搬上游的fork/exec、Mach/IPC等其他许可。

Apple libpthread固定42d026df…的pthread.c（85414B/SHA256 `20dbfe99ea37add77c34da12d3590d267aacb4e92c862d649db4d43bc3274669`）显示[stacksize/stackaddr](https://github.com/apple-oss-distributions/libpthread/blob/42d026df5b07825070f60134b980a1ec2552dfee/src/pthread.c#L1000)还涉及已存在thread结构和RLIMIT_STACK。故页大小不是唯一可能因子；无需先增加kern.usrstack64或其他名称。

## 下一有限段候选（尚未授权执行）

仍只用own evidence与OPS14，不改生产五源。建议新段总≤15秒、raw≤64KiB、scratch≤1MiB、fresh≥1107296256B、0PG/Chrome/provider；统一monotonic截止给收尾留2秒，最多一次编译/一次策略渲染、2个C只读对照和条件下2个stock helper，全串行。保本次两轮失败及exact source/raw，使用新exclusive目录。

1. 编译一个tiny C，只输出sysconf(_SC_PAGESIZE)、getpagesize及对应errno/正数校验；不做MAP_FIXED或额外文件写。两个进程都受现J策略，第二个仅在原policy后增加`(allow sysctl-read (sysctl-name "hw.pagesize"))`。无裸跑，无sysctl-write，不给通配名或其他读口。
2. 只有原策略查询拒绝/异常而单许可恢复有效页大小的对照成立，才在剩余同段预算内运行原固定stock helper允许目标写/拒baseline两项；仍是同binary/只读stdin/固定FD集合，现写权限、deny网络/fork/其它exec完全保持。首helper失败立即封存，不堆第二条许可，也不启动deny项。
3. 所有payload/文件字节/exit/EOF/owned状态独立保存，checkpoint先于exact cleanup。即使通过，最多证明此次startup/独立helper写文件兼容，不证明app-server派生helper、模型/no-fallback、provider网络或全部writer撤销。所有未知仍保留。

这是可证伪的一项机制候选。若C对照不支持页大小链，或stock仍失败，则记录边界并回到已保存事实，不扩大权限补丁堆叠。
