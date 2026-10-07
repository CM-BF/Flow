# 原ENG后继：实际Darwin写入宿主候选

2026-10-07；只读设计，未新take/实现/启动。I已main ef3a，固定输入见[绑定](readonly-inputs.json)。当前独立writer仍是注入authority；这份候选不签发生产资格。

## 一个具体实现方向

先实现本机已安装 `/usr/bin/sandbox-exec` 的**单写入进程、拒绝派生/委托**候选，而不是把R06 child close改名为revoked。Apple本机man明确该命令已deprecated；这是针对固定Darwin/工具版本的有限支持，平台或策略不符立即unsupported，不作为跨平台保证。旧C rootliteral仅bootstrap PASS；Node rootliteral实为SIGABRT，七项隔离未运行；原生目录成功也没有实际model/no-fallback证据。上述失败和缺口全部保留。

候选实现负责生成固定白名单profile、核真实launch文件与lease目录身份、通过原R06 factory启动、记录同一generation的关闭与覆盖证据。外部Interface仍为 `NativeWriteAuthority.open/close`，不改G/I、公开receipt、runtime或C02唯一pump。内部使用固定可执行文件/参数模板与私有空HOME/TMP；不接task的argv、任意profile、环境或stopped JSON。

写权限只针对该lease的既有calculator文件；baseline/.git、其他源、其他任务根、host日志和authority记录不可写。需零模型实测普通更新、symlink/hardlink/rename、已开FD和目录替换的实际行为，不能靠profile字符串或事后diff。若真实Codex的原子更新需要新增临时文件，先明确精确暂存/rename权限及新的验收，不能默许整个workspace可写。

**停止证明的关键候选是限制写入者集合，而非扫描并杀一串PID。** 目标profile拒绝fork/其他exec、网络与可向其他主体委托写入的IPC；只允许初始固定binary的启动闭包、必要只读系统文件及已登记stdio。必须先核真实OS操作名/效果并验证这些拒绝确实覆盖所选执行体；当前没有该证明。若覆盖成立，唯一被授写主体就是持有R06 ChildProcess handle的这一进程及其线程，受控退出才可与该强制覆盖证据合并形成close.revoked。仅group absent、EOF、turn完成、取消ACK都不充分；未知信号/身份/覆盖或部分open失败保留lease并返回unknown。重启只读原未结算记录，不能按新PID重新授写或自动重跑。

严格无派生是当前calculator-file-only-v1的一个候选实现限制，并非所有工程任务永久禁止shell。若固定Codex无法在此限制运行，本实现拒绝支持；后继可另选显式有限shell及可覆盖全部进程的机制/版本，不静默扩旧policy，也不把无界进程组当替代。

## 身份与模型门槛分别处理

宿主冻结实际assignment(task/attempt/runner/ownerVersion)、lease、realpath/dev/ino、baseCommit、binary及profile digest。先持久记录open意图，最多沿现project8个保留workspace；本地记录放受信project控制区，模型不可写，不放进待检查完整内容集合。一次实例/一次factory，close是幂等观察同一generation；不另加scheduler、通用registry或第二恢复FSM。

OS写入限制不能证明所用模型。生产open还必须得到可信的精确模型来源与禁止fallback约束，绑定固定binary/host配置及本次授权；目录、requested、ThreadStart配置、qualificationDigest字串均不能替代。当前Mika保存材料没有这项证据，因此不能返回`locked-no-fallback`或公开可执行native profile。该门禁与OS实现独立：可先完成真正的受限launch/revoke代码和系统调用验收，缺模型证据仍零turn/拒生产grant，而不是暂停全部宿主实现。

本候选第一段保持network deny、无账号/真实provider。实际推理需要的provider通信与工具网络权限必须另有明确来源和强制分离证据；不能为让app-server启动直接allow network-all，再继续称原file-only已兑现。当前不新建通用网络broker，也不把host写入模型生成文本冒作native文件写改。

## 最窄拟scope与直接消费者

候选子片ID `ENG01J` 尚未fresh登记；建议独立 `engineering-native-authority` / `codex/engineering-native-authority`，base由接收时固定。以下七literal是拟议，当前未领取：

- `apps/runner/src/engineering/native-authority.ts`
- `apps/runner/src/engineering/native-authority.test.ts`
- `apps/runner/src/engineering/native-authority-darwin.ts`
- `apps/runner/src/engineering/native-authority-darwin.test.ts`
- `apps/runner/src/engineering/fixtures/native-authority-canary.c`
- `plans/eng01j-native-write-authority`
- `docs/evidence/eng01j`

`native-authority-darwin`只处理该具体OS策略/固定launch证据；`native-authority`实现现G seam的绑定、一次授予和保守收束。测试从实际R06/G/I Interface消费，不复制transport、exchange、checker或outbox。模型来源尚缺时，真正authority与G/I的直接消费者只能证明零transport拒绝；正向OS syscall证明属于私有Darwin层，不能通过注入任意qualified对象越过生产open门禁。I四产品已交回；需要改它或共享文件时先显式协调，不预占。

先0provider证明的项目：host输入/缺模型来源零transport；实际自有OS进程只能改授权file、越界和派生/委托尝试被内核拒绝；部分启动/取消/退出与永远unknown故障均不会伪revoked；完整关闭与重复open拒绝；G/I两个必要直接consumer沿当次main接缝。tiny C只是受控系统调用测试体，不当模型或Codex执行器；不是又一份合成业务菜谱。实际native binary启动闭包、它的文件工具是否需要额外能力、实际模型身份/no-fallback与真实写改/独立接受另列明确验收，不能由该C通过顶替。

当前ef3a已含C02 stream：G不提供onStream，仍复用唯一exchange，但flush/yield接缝与R1的旧c0输入不同，后继两个直接consumer应绑定新main；不重跑I30或G/H全套。局部OS候选先固定脚本/所选syscall与自有资源，建议一次≤30s/≤2MiB、0PG/Chrome/provider；这是后继预算提案，本页没有启动任何probe。

方法：本地find-skills发现并复用codebase-design/clean-code既定版本；把实际OS授予/关闭集中为一个深Module，模型资格保持明确独立输入，不把多个unknown检查分散到callers。没有新增安装或框架。

设计安全点 2026-10-07T05:04:08.917Z：clean-code复核职责、错误路径与重复；只复用原transport持有child的关闭事实，不暴露/接收任意PID，不复制supervisor。当前尚未证明OS profile覆盖，因此所有受限能力和完整停止均列验收，不签发grant。
