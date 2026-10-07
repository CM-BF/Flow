# ENG01J-05 单文件 helper 准备接口

本实现从原471四个TS源增量；C与R06/C02/G/I不变。源启动输入固定e7ff，结果9b9c/seal6df正例复用，不再model/list。find-skills本地发现沿原任务，实际应用codebase-design的窄责任/状态所有者、clean-code的错误与资源边界；brainstorming设计已获Lead明确授权。

`createStockHelperProfile`仅接受完整固定recipe/hash，保原只读启动闭包、deny-fork/network/Mach/个人路径。删原Node执行许可，唯一初始exec固定Codex；私有runtime/control只读、runtime/state可写，与只读workspace必须不重叠，唯一预存calculator.mjs允许data写。该派生policy尚未真实运行；原recipe的启动正例不能证明此新组合。系统只读路径包含原Node依赖，是已审输入的保守继承，不称最小权限证明。

`prepareDarwinStockHelper({directory,runtimeDirectory,startupRecipe,contents})`不创建文件/进程，不返回NativeWriteAuthority。检查Darwin、canonical/self/0700目录、独占regular目标≤64KiB、固定native/sandbox摘要，contents复制并限1KiB。固定recipe17,393B，request≤8KiB。动态库仍来自固定系统/安装路径，摘要不使加载目录不可变；真实运行前须复核实际依赖closure/source稳定。

`takeLaunch(signal)`只可取一次，abort或identity变化也消费。返回sandbox-exec的固定argv、最小私有HOME/TMPDIR/CODEX_HOME、immutable requestLine与stdio要求。准确命令为 `/usr/bin/sandbox-exec -p <派生policy> <固定0.154 binary> --codex-run-as-fs-helper`；stdin一行 `operation:fs/writeFile` / params `{path:file URI,dataBase64,followSymlinks:false,sandbox:null}`。内部sandbox:null是上游helper协议；外部Seatbelt必须在exec之前已安装。调用方沿现OPS14 + 已审exec-only只读stdin/关闭额外FD，不向R06送此请求；R06会initialize，helper不懂该协议。没有第二executor或新agent loop。

`observe(completion)`只解释实际监督owner回执与目标当前文件。要求spec已交出、exit0、最终owned absent、双EOF且无failure、stdout≤16KiB且单JSON成功形状；然后NOFOLLOW读取同inode/self/nlink1目标，大小/字节与冻结contents完全一致，最后stat仍一致才返回observed-write。非零、error但exit0、尾部不全、替换/未知均unknown；写入副作用不得据unknown重试。此观察不等于终止证明；所有结果的writeAccess始终unknown。权限/同用户恶意修改/逃逸writer与模型资格未由本接口解决。

原host准备/R06 factory保持独立且不改；readonly材料准备不是NativeWriteAuthority.open。真实独立helper0query执行留下一固定工作段；app-server→helper派生与可信全部writer停止仍open，不能根据child/组absent签revoked。模型≥Sol/no-fallback、网络与个人认证均未调用。

## 本次局部检查

5新例：recipe允许范围/完整性拒绝；prepare+冻结请求+注入结果；identity变化/abort不重发；过大/重叠/非私有输入拒绝。3文件fixture例仅显式Darwin准备环境启用，读取fixed binary核hash但绝不执行。普通Vitest原3canary仍显式skip，原pure例不变。新测试实际读取本目录startup-input.sb，属于必须保留的真实fixture闭包。测试只注入文件结果，不能说stock写入通过。

本组局部≤60s总/输出+私有≤4MiB，fresh≥1,107,296,256B；单份run内分轮，失败保留。固定OPS14监督，清理只在owned absent/双EOF/原scratch identity且checkpoint耐久后；任何unknown保留。真实stock运行目前NOT_RUN，不占PG/个人窗口。
