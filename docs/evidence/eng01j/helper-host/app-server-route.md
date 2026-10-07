# ENG01J 后继：真实派生路线与写入者收束

本页为只读设计，产品 f15、caller d44 与所有原始结果冻结。独立 stock helper 的一次成功已获审并进入 main f39a；它证明同一文件的真实写入，不证明 app-server 派生、模型资格或完整撤销。当前没有新增运行许可，也没有授出 NativeWriteAuthority。

## 已确定的协议分岔

已读 Mika `07341d4672fb3c83090e685847818b47c34f2559` 的 authority 输入，继承 e7ff/9b9c/6df 固定启动组合和本机 0.154 schema，不重跑 initialize/catalog。精确 schema 摘要、官方固定源码及小段原文见 [inputs](app-server-route-inputs.json)。

| 路径 | 能实际证明什么 / 缺什么 |
| --- | --- |
| 公开 `fs/writeFile {path,dataBase64}` | 固定 `fs_processor.rs:89–90` 明确传 `sandbox=None`；`local_file_system.rs:102–105` 选择直接文件实现。外层 Seatbelt 仍能限制它，但成功也不是内部 FS helper。**不安排这条重复外层文件边界的运行。** |
| 公开 `command/exec` | 无需 thread/turn/model，可令真实 app-server 派生固定 helper；保留上游 command sandbox，再叠加受控文件/进程域。它是实际 app-server→命令→helper 的零模型桥接，不是模型生成 apply_patch→SandboxedFileSystem 的 selected route。 |
| 模型 `apply_patch` | 原固定源码链使用 turn sandbox context→SandboxedFileSystem→SandboxManager Require→同 binary helper。已存 stable ClientRequest 没有直接调用这个内建工具的 RPC；`turn/start` 不是零模型工具调用替代品。不能把公开 fs RPC 或手动 command helper记为该完整路径。 |

来源：[fs processor](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/app-server/src/request_processors/fs_processor.rs#L79)、[local filesystem](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/exec-server/src/local_file_system.rs#L95)、[command processor](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/app-server/src/request_processors/command_exec_processor.rs#L312)。这是发布源码对应的条件结论，非本机已观察派生。

## 下一实际 writer 的最小进程与接口

需要的可写主体是 app-server、上游 sandbox launcher 和 stock helper；线程及后代必须一起归入同一受信代际。R06 保持唯一 stdio transport，G/I 保持任务/lease/收据所有者。现 Darwin 全局 deny-fork 与真实派生直接冲突；只放开 fork 或把 exec 路径限为 Codex，均不足以阻止后代逃逸/委托。当前资料没有可证明收束这些主体的 Darwin 终止域，故**不修改现策略去碰运气**，也不新增 PID 轮询式 revoked。

建议选择一个具体可实现的替代强制层：**专属 Linux cgroup v2 domain + 私有 PID/mount/network/IPC 命名空间**，复用现成受信 runtime，进程仍运行 stock app-server/原生 sandbox/helper，Flow 不实现第二 executor。app-server 与全部后代必须在执行用户代码前入域；域内无可写 cgroup/control socket、宿主服务 socket、额外继承 FD 或迁移权限。根/基础 workspace 只读，只有预先存在的 calculator 文件提供可写挂载，运行状态另设有界私有目录；无特权、无宿主 PID/IPC、无外网，保留上游 sandbox，不能用 `dangerFullAccess` / `externalSandbox` 或 network-all。

该选择的具体停止机制是受信域所有者写 `cgroup.kill`，然后从固定域句柄读取 `cgroup.events populated=0`；内核定义覆盖后代及并发 fork。仍必须先证明无外移/域外委托通道，并关闭后续 admission，才可把域空作为本代全部 writer 已停的证据。域句柄/代际不可被重建同名目录替换。普通 `docker stop/inspect`、PID 列表、R06 close 或 command terminate ACK 单独都不够。[内核公开语义](https://docs.kernel.org/admin-guide/cgroup-v2.html#core-interface-files)

cgroup只解决成员收束，不自行限制文件操作或可执行来源。固定 runtime 配置还须提供实际可用的 LSM/seccomp/只读镜像组合：只允许固定 sandbox launcher/helper/shim 执行，拒绝工作文件执行和目标 chmod/chown/xattr 等数据写之外操作。单文件 rw bind 本身不证明这些拒绝。该配置和上游 Linux sandbox 的兼容性同样是新的明确依赖，缺失时不能先放宽进程策略。

这不是当前机器已具备的能力声明：尚无专属 runtime/cgroup 控制权与不可逃逸配置的固定输入，亦无已固定 Linux 0.154 binary/image。Darwin binary 不能搬进 Linux 执行；新增平台输入/安装/镜像成本需另列。已有 OrbStack/PG 的存在不授予使用其容器、卷或控制通道的权限。若这些前提不能提供，应明确该平台依赖阻塞，不交永远 unsupported 的空壳实现。没有以更弱的 Mac 进程组临时替代。

**最小 host Interface 继续是原 G binding 与 R06 factory，不增公共 FSM。** 实现内部持有一个不可由用户 JSON 伪造的 domain handle，固定 execution identity/lease/baseCommit、目标 dev/ino、native/runtime/策略摘要。部分 open 失败也必须保留该 handle 收尾。close 先封 admission，再杀域并证明同代无活进程、无外部获授 writer；否则 unknown 保留 lease/材料，不做 F snapshot/promotion。单 helper 的 `writeAccess:unknown` 与历史失败保持。

## 固定零模型桥接输入与验收

在终止域前提先获固定后，最短实际请求只用稳定公开协议：R06 initialize/initialized → 一次 `command/exec`，`command` 为固定只读 stdin-launch shim + 固定 helper/请求文件，`cwd` 为私有 workspace，`tty:false`、`streamStdin:false`、`streamStdoutStderr:false`、`timeoutMs:2000`、`outputBytesCap:8192`。显式保留上游 `workspaceWrite` sandbox、`networkAccess:false`、排除两种 tmp 默认写权限；外层只读挂载+单文件可写限制比目录级声明更窄。shim 只做已审 exec-only 的 readonly stdin/关闭额外 FD/同 PID exec，不增加调度循环；Linux 适配及入口摘要须单独核，不能直接使用含 Darwin sandbox-exec 的旧脚本。

请求文件沿原 stock 单行 `operation:fs/writeFile`、calculator URI、`dataBase64:WA==`、`followSymlinks:false`、`sandbox:null`；最后 null 是 helper 内部协议，执行前上游与外层 OS 限制均须已安装。公开 app-server `fs/writeFile` 的路径是绝对路径且参数不同，不能混用。采用只读输入文件是为避开 command/exec 没有公开 started ACK、stdin write 早于 session 注册的歧义；不重试 unknown，也不新造 polling transport。

接受条件必须同时包含：真实 app-server command 响应与 helper payload 成功；目标同 inode/精确 X、baseline 未变；越界写/创建/改名/继承 FD/域外委托有明确拒绝事实；包含持续活跃后代与中途关闭的域终止直接消费者；同代 populated=0 且禁止迁移的配置/归属证据；先耐久 checkpoint 后清理。失败停在本次 exact domain，未知不导出/晋升、不自动再开。首桥接至多一 app-server/一命令/一 helper、无 thread/turn/provider；新平台准备、故障检查与实际运行分别预算，不能沿用 Darwin 10 秒许可。即使这段通过，仍不称模型 apply_patch 或完整工程交付。

## 最窄范围与接入顺序

当前七 scope 仅写本页/inputs/收口记录，五产品不改。后继若采用上述平台，建议新领取 `apps/runner/src/engineering/native-authority-linux.ts` 与 `native-authority-linux.test.ts` 两叶子；只实现一个具体 runtime-backed host，复用现 G/R06 接口，不新增泛型 supervisor。平台专属受信 launch/kill helper 若现成 runtime不能提供，应先列其准确工具路径与权限owner再追加 scope，不能把特权命令藏进 evidence caller。已安装依赖不等于可用 runtime权限。

第一固定交付应是该域的实际 admission/全部停止直接消费者和文件挂载合同，然后才接上面一条 stock command；不是再次跑 fs/writeFile或 catalog。R06、C02 pump、现 G/I/contracts 不需为零模型桥接改动。若后续要把真实模型写入接入 G，以下资格合同必须先由原owner/GO裁决，不能在本片偷偷换字符串。

## 资格的精确冲突与有限选择

现 G 在 `authority.open` **授写之前**要求 `modelAssurance:'locked-no-fallback'`。固定 stable schema 的 ThreadStartResponse `model/modelProvider` 是接受的配置；TurnStartResponse 只有 turn；ModelReroutedNotification 有同 thread/turn 的 from/to，但 reason 仅 `highRiskCyberActivity`，未收到不表示所有 fallback 都不存在。Root 已核 `model/verification` 的 trustedAccessForCyber 也不提供实际模型资格。现接口未提供本次写前、覆盖所有路由的 actual model/no-fallback 保证；不能用新 query证明不存在的字段，也不要求密码学证明或所有未来请求的保证。

两个产品选择须明确其不同含义：保留现 `locked-no-fallback`，等待供应商对**本次执行、授写时点及适用路由**给可消费保证；或另定 `configured-model-and-observed-routing` 的有限合同，准确显示未知，观察到不合格/reroute即停域，晚发现则隔离本次结果且不晋升。后者不是现原生模型门槛已满足，不能直接签旧 grant，须GO明确接受验收含义并由原 G owner改合同。零模型进程域与真实 helper桥接不等待这项产品裁决。

方法：沿已读本地 find-skills、codebase-design、clean-code，复用 R06/上游 sandbox/既有收据；只读职责、生命周期和失败语义核对。新工程测试/native/PG/browser/provider/个人操作均为0，没有读取个人认证配置。官方源码只做固定 URL文本读取并留摘要，不执行源码或生成协议。
