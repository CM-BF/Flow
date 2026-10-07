# ENG01J：复用已能启动的组合，分开补齐写工具与停止

本页仅既有源码与归档证据的只读收敛，不授权运行。原五产品保持471/bf8固定；不再猜sysctl名称、重复model/list、裸跑helper或关闭上游sandbox。`pagesize`单名负例与Mika更早的同类负例重叠；本队原raw照存，但不是新增平台机制发现。

**可直接继承的正事实。** Mika `native-remote-status` source `e7ff1a8382f622929aab64aeebc0f0f0546778e8` / result `9b9c1182d2e649d2a68f3d3c7de980bac0e71fed` / seal `6dfbb213405013dea8b039670e93c6a4d8d283a3` 已获20:42:21限定独审：同一0.154 native SHA `4f859826…afcc` 在固定 candidate SHA `ba856d7949bd2d305789995058e4b11edc4df16eb1504d67c3b160a2821b77cf` 下完成initialize及一次6项catalog。今回核该policy当前字节与固定source完全一致；没有重跑。原J失败不能覆盖该正事实，目录也不签模型资格。

| 层 | 实际可复用 / 下一缺口 |
| --- | --- |
| 启动只读能力 | 继承上述**完整已记录组合**作为兼容基准，而非认定某一新增规则足够。它含固定动态库/元数据路径、Sandbox syscall67、`hw.pagesize_compat`及固定系统配置读取；仍拒network/Mach/fork。J只覆盖系统目录与exec/data-write，缺少该启动闭包。上游0.154 base还含fork/exec、命名sysctl及平台IPC规则；不是已证明最小权限集，不能整份提升为工程grant。 |
| 文件工具 selected route | 已归档源码链是apply_patch→environment filesystem/sandbox→SandboxedFileSystem→SandboxManager Require→同binary `--codex-run-as-fs-helper`，并有Darwin关闭额外FD接缝。可以复用stock实现及生成的sandbox；无须fork exec-server。**本机仅initialize/catalog已选中，实际apply_patch派生route尚未观察。** 独立helper单请求也不等该app-server路径。 |
| 模型与网络 | 当前actual model/effort/tier/tools仍unknown；目录/requested配置不能代替≥Sol/no-fallback。已有组合拒网络；后续provider通路须独立限定，不能用network-all或放宽账号读取解决启动。 |
| 全部writer停止 | R06仍唯一stdio/直属child所有者。现OPS14最终group absent只覆盖已拥有组；上游kill_on_drop、close/EOF也不证明派生/受托writer全灭。放开fork之前必须给出可信终止域及继承覆盖证据；未知保持lease、不得F snapshot/promotion或签G revoked。 |

**最小实现选择。** 下一片先复用Mika固定启动recipe与原R06，而不是再造bootstrap policy：用一个私有、固定输入的工程recipe组合，明确将启动只读资源、私有运行状态目录和工作文件写权限分开。Mika state子树的可写范围只属于其自有运行状态；不能原样映射到工程workspace。workspace仍只读，唯一预先存在calculator.mjs data写，禁create/delete/rename/link；固定native/sandbox-exec/动态加载输入、只读stdin与三条stdio pipes，保现实际FD限制。若stock工具确需其它写行为，先改明确recipe合同或拒绝该操作，不暗放宽。

先能交付的是**固定stock helper兼容与文件边界组合**，仍无完整authority grant。拟最窄产品范围为现 `native-authority-darwin.ts`（显式recipe边界）、`native-authority.ts`（复用固定输入与R06）、两个直接test，以及原plan/evidence；不动canary/C02/runtime/contracts。新增Mika recipe输入的物化及权限差异须单独固定，旧471源/原实验不得重写。当前尚无改这四源或运行的新授权，本页仅scope候选。

**完整宿主的决定点。** 若接真实app-server→helper，必须允许受控同binary派生及其sandbox launcher，同时让所有后代继承相同写边界、禁止向域外委托写入。现归档资料未给出Darwin上可保证这些进程全部收束的终止域，不能用路径allowlist或PID轮询补成证明。下一实现应选择现成、可独立关闭的隔离进程域；如只能用管理式VM/容器，应把可写workspace放在域内，主机仅在域停止确证后导出snapshot，不能把guest停止或mount撤除猜成已证。具体域的可用性、终止与委托覆盖尚无固定输入，需先只读选定平台，不能先扩fork后伪造revoked。现有 `NativeWriteAuthority.open/close` 接口足够承接，不加第二executor/生命周期FSM；缺证明时可继续交付兼容机制，但不启生产写授权。

事实来源：Mika权威树 `docs/evidence/wpf-mature-02/native-remote-status/{driver-input,run-manifest,result,result-review}.json`、`experiments/codex-app-server-conformance/native-remote-status/candidate.sb`、`native-pagesize/run-report.md`；本片[上游路径](../native-helper-compatibility.md)、[helper合同](../stock-helper-candidate.md)、[页大小独审](pagesize-independent-review.json)。版本/tag对应是来源线索，不是本机binary可复现构建证明。方法沿已读find-skills/codebase-design/clean-code：复用真实正输入、保一个R06、分开能力/资格/撤销；0新测试/import/PG/provider/个人读取。
