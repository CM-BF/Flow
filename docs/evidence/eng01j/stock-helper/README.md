# ENG01J stock helper 零query事实段

本入口仅实现已批准[候选](../stock-helper-candidate.md)，原5产品源码与策略不改。运行前准备状态NOT_RUN；唯一命令为 `/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/eng01j/stock-helper/run.py --run`。run-once目录exclusive，绝不覆盖/复投。

- OPS14原supervise复用，策略由Node24直接调用已审createDarwinWriteProfile渲染（一个≤1.5秒纯子进程）。随后最多两个串行stock helper，每个≤3秒工作/.2秒TERM/.3秒KILL；不是app-server或模型。
- 每次spawn按同一monotonic开始扣准备耗时，工作最后允许到7.5秒，收束到8秒，余2秒作文件事实/耐久证据与exact清理；父进程10秒alarm不等待任何持久化。底层不可观察或调度异常仍unknown，不保证硬实时OS行为。超时未落终局即保留reservation与scratch。
- 只读请求FD覆盖stdin，exec-only shim不fork，OPS14 spawn的同PID exec sandbox-exec后进入固定binary；所有额外FD关闭。helper始终在原Seatbelt内，无裸helper、关闭sandbox或network-all。固定原binary与policy/supervisor/sandbox-exec全部fresh SHA检查。
- 原始stdout/stderr预算：policy4KiB、各helper20KiB，合计最多44KiB，低于64KiB总raw上限；外层只输出一条有限汇总。scratch上限1MiB，记录末采值而不冒连续峰值/硬配额。输出超限由OPS14立即停止，未知不清理；target只预建1字节文件。
- 每次helper进程exit/EOF/owned_state均保存；随后独立检查JSON payload与两个文件真实字节。helper error+exit0不被判写成功。第一项失败不启动第二项、不换策略、不自动重跑。
- checkpoint保存最终文件字节、原始进程报告及所有自有组状态后，才能按目录dev/ino和EOF/absent正常删除scratch；失败事实保留。父期限到而缺终局视unknown。

状态类别：仅一次真实stock helper独立初始exec兼容事实。即使通过也不证明app-server派生helper路径、网络/provider、模型资格、整个writer停止或NativeWriteAuthority grant。

方法：复用本片已安装find-skills/codebase-design/clean-code；监督与持久化职责分开，无新loop/transport/生产policy。此次静态复核修正了stdin必须单行JSON及exec-only的精确参数数目，均在首次运行前修正，无运行失败被覆盖。

## 实际首轮（2026-10-07T05:43:52.515343+00:00）

固定入口ccf977a5b78b2acef67f1196db715d74fdb12317，outer exit1，263ms。策略渲染完成，shim因未确认FD上界在exec之前退出；stock helper实际0次，第二项未执行，语义用例0完成。两组absent/双EOF，raw1539B，末采scratch1175B，checkpoint后确切dev/ino目录正常删除。原失败不修改，无自动重试；不得将此脚手架拒绝称为native工具失败。详见[result-analysis](result-analysis.json)、[原result](run-once/result.json)、[原工具回执](run-once/outer-tool.json)。

## 同scope新有限段：FD实际集合修正

新入口`--run-fd-fix`用exclusive run-fd-fix目录，原run-once不变。移除RLIMIT任意上界假设；单线程exec-only在dup/close请求后只枚举一次`/dev/fd`（≤256合法数字项），关闭>2；仅容忍listdir自身瞬态FD的EBADF，其他错误拒绝。随后只做fcntl/fstat，不再打开文件，确认stdin只读regular、stdout/stderr为监督pipes后exec。OPS14原Popen默认close_fds=True不改。

同一个≤10秒段先加1个≤.8秒dummy exec，parent故意把自己打开的一个写FD标inheritable；在实际OPS14→shim→exec的child核该FD不存在、stdin只读且字节确切、1/2为pipes、host文件未变。之后原Node策略渲染和最多2个stock helper。四个子进程串行；总raw上限仍64KiB（dummy2KiB+policy4KiB+helper各20KiB=46KiB），同一截止与cleanup不放宽。不是重新运行已通过生产/syscall或模型检查。原失败保留，新段来源为Lead在原263ms清理后明确授权局部修正与新有限段；assignment/X01本队local均已归还。
