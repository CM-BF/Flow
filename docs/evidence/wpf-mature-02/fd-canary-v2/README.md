# C fd诊断v2：最小原文留证与固定失败分类

当前仅候选，**新增编译0 / 新增目标0 / 新运行授权0**。旧窗口mika-c-fd-20261006-110819的FAIL/0target、raw/manifest/accounting以固定6d1d97581efa9d66019bc30c05fabaed8e672ba0保留；[已审失败回执](previous-result-review.md)只批准事实准确性。没有补跑，旧11679B stderr未保留，不能恢复或据源码猜定旧失败原因。

本候选source checkpoint `391f67b42d4ec272ec679a33c0812517afd69090`。后继[driver-input](driver-input.json) / [manifest](manifest.json)独立于旧fd-canary目录；原同路径host/parser源码可在新commit改动，但旧证据始终按历史commit核验，不能用当前WT冒充旧hash。C/profile/schema、command.mjs与R06复用Module保持原已审代码。

## 仅三项行为变化

1. 仅对固定自有C编译阶段，在检查exit/verbose/产物之前保存原始stderr、stdout。每条流仍≤65536B；写入本目录固定compiler.stderr/compiler.stdout，0600、O_EXCL/O_NOFOLLOW、fsync、finally close。安全结果仅文件名、captured bytes/hash、created/persisted/closed，不回显正文。新raw磁盘副本在创建/写入前作为artifact再计一次，共享2MiB预算，不能放进预算外。失败/半写/未知close保留原始状态，最后root/fd清理仍finally；不覆盖既有文件、不扩大进程/目录/profile权限。
2. failureStage为固定执行阶段，failureCheck为十项有限compiler类别或unclassified；Error不保留远端actual/expected/body，安全结果不复制原文。创建/复制/inventory/编译执行/输出持久化/health/二进制/命令清单/各target准备执行health报告清单与control均有固定阶段。未知、failed、不完整捕获及cleanup问题继续失败，不为留证跳过任何gate。
3. compilerInventory用有限的纯数据词法解析，不调用shell/eval。固定quoted executable；参数可bare或整token双引号，quoted仅解码双引号、反斜杠、$转义。每行≤16384B、token≤4096B、≤2048tokens，仍总stderr≤65536B、≤8个固定clang/ld命令、唯一-o、输出必须匹配owned inventory、frontend/linker必须存在。未知格式/超界/未知exe/丢输出仍拒绝。

依据是官方固定LLVM18.1.8：[Compilation.cpp#L148](https://github.com/llvm/llvm-project/blob/llvmorg-18.1.8/clang/lib/Driver/Compilation.cpp#L148)在-v路径把CCPrintOptions作为Quote传入；[Job.cpp#L190](https://github.com/llvm/llvm-project/blob/llvmorg-18.1.8/clang/lib/Driver/Job.cpp#L190)强制quote可执行文件、参数使用Quote；[Program.cpp#L76](https://github.com/llvm/llvm-project/blob/llvmorg-18.1.8/llvm/lib/Support/Program.cpp#L76)确定三种转义。因此全参数必须双引号及JSON.parse不是该格式保证。此依据不证明本机Apple构建或已销毁旧raw采用了此格式，也不是旧窗口归因。

## 验证与未执行

[checks/affected-final-result.json](checks/affected-final-result.json)与stdout绑定最终source：26/26通过、9项有意未选。包含15新增logging/lexer行为及11直接消费者；原9项新行为先9/9 red，再green。中间green9、regression10、lexer18各有重叠且是历史中间版，不累计成额外独立检查。最终Node24直接惰性import成功、stderr空；host/report/entry三文件语法检查通过。没有实际clang/help/version/C target/SDK/provider/auth，无真实transport或31子进程套件。检查只用fake child及自有临时文件。

## 后继候选recipe与预算

未来必须由Mika对本v2固定source/input/manifest独审，再取得新明确命名窗口；当前不执行。其时仍fresh核writer v4、完整clean metadata HEAD和本v2目录无预约，Node24唯一入口为：

```sh
/opt/homebrew/opt/node@24/bin/node experiments/codex-app-server-conformance/fd-canary/execute-reviewed.mjs --reviewed-fd-window-v2
```

不得用旧参数/旧目录补跑。候选沿一次编译、最多三目标、60秒含hash/编译/运行/清理/结果持久化和CLI、2MiB总输出；源/toolchain固定校验、slot先wx/fsync、save-temps=obj、unknown保留、TERM/KILL/close/unref规则不变。preparedEvidence实际预扣、32KiB运行收据与128KiB归档尾部预留不变，新增compiler raw两份通过artifact重复计入预算。只固定自有合成C编译原文，不收进程env/凭据/个人crash，不扩R06生产stderr。实际raw留0600本地证据文件并纳入后续bytes/hash清单；不得console回显、不得把尚未检查的raw自动复制到产品/UI。

同步OS IO不能硬抢占；unknown编译临时输出或未确认close仍不宣称完整accounting。未来若日志持久化失败，明确类别和原始记录状态，不能因日志不完整继续目标。未开启窗口前本README及input不是执行许可。
