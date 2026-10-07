# SVC06B 受管更新候选

本候选只准备下一次更新。个人实际运行、新网页与三保留网页组合均未由本片重验，当前不占执行窗口。新后台已独审并交主线 b37e404da18d8b63a5b38ad20cf55850a9781dd5；其 source 与产物 ID 分开固定。SVC09A 两槽宿主不在此候选中。

## 固定输入与历史界限

| 对象 | 固定身份 |
| --- | --- |
| 新后台 | artifact `cd27b441d9e95c0e972bc6a502c74d1f22dc0041f0398c7f099f4a1372bcab6b`，source `04da80692e79e2b7c3f6341c7fa76515a3f719a3` |
| 新产物原件 | `/private/tmp/flow-svc06b-artifact-IhwFGS/backend-artifacts/<cd27>/manifest.json` 与 `root/`；准确路径见[descriptor](actual-first/result-descriptor.json)和[result manifest](result-manifest.json) |
| 最后已审个人运行 | 13:47–13:49 held continuation：backend 与独立 Web host 均 7d1/source6c；中心 accepting/v21；Web d629/v3；三个 retained 保持 |
| 历史出处 | main b37e404d 中 `docs/evidence/svc06/update-diagnostics-candidate/personal-held-continuation-r1/{RESULT.md,final.json,result-manifest.json}`；原结果 target acbdc40358a858256967a7322109331a28f4a2fb |
| 配置合同 | 既有 `browser-session.json` 205 B，文件 SHA256 `ce38dbfa3b79b6cef3a18aadab0974ffc1860e256a5ecdc59f93396255c39f4a`；normalized context 见下表；配置及 token 不复制、不输出 |
| 新网页 | 原 Web owner 的准确 descriptor、source、报告和独审仍待交。不得用旧 7272 候选或当前 moving main 代替 |

历史 accepting/v21、PID、任务及文件身份只是历史输入，不是当前个人 fresh gate。本准备只读固定 Git/已封原件，没有个人 I/O。旧 held 段最终观察到用户原 queued task 自然进入 running，但完整 requestId→receipt→本地 assignment 因果链未被持久证明，`actualClaimRecovery=UNKNOWN` 保持。

04da 对 6c 的 `tools/personal-preview/`、package/lock/workspace 与 storage migrations 路径零 diff；仅原审 late Logout 三 leaf 与 test support 组合。此次新工具的 retention 修改不改变 cd27/7d1 的任何字节，也不以当前已混入 SVC09A 的主线替换宿主输入。

## 后台保留：事实、策略和工具责任

[单份固定输入与尺寸记录](managed-update-inputs.json)绑定原构建、迁入和 held 回执，不读取旧私有配置正文。

| Backend artifact | source | 含 manifest 的逻辑字节 |
| --- | --- | ---: |
| c7b85f49cf077460402083cfed577b034a19d256c8592020115d28512060542d | 422f4b150e5801d6010e5bbd6b53574e35384f87 | 366,318,536 |
| 7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920 | 6c0fdcda8858aac33489c48c1948e902dd6a3d7e | 367,041,727 |
| cd27b441d9e95c0e972bc6a502c74d1f22dc0041f0398c7f099f4a1372bcab6b | 04da80692e79e2b7c3f6341c7fa76515a3f719a3 | 367,045,616 |
| 合计 | 三项保留，不删除/退役 | 1,100,405,879 |

固定6c的旧 `LIMITS.artifacts=2` 是准备/迁入工具限制，不是 manifest 版本或运行宿主限制。正式小片仅改 `backend-release/files.mjs`、`index.mjs`、`artifact.test.mjs`：单一 LIMITS 定义最多 **4 项**、单项 **1 GiB**、合计 **2 GiB**。第四槽留给另行固定的设置后继，并不把 SVC09A 纳入本次发布；不从 Web 的 count4 策略继承，也不承诺无限保留。

`assertBackendRetention({count,bytes}, addition)` 是纯容量 Interface：调用方持有原 store lock，并已经完整校验全部保留产物。无 addition 只核当前集合；`{kind:'build'}` 必须预留完整1GiB；`{kind:'import',bytes}` 的 bytes 必须来自完整 verifier 的总字节，包含 manifest，不能用声明大小代替校验。非法/未知数量或模式拒绝，超 count/bytes 拒绝；Interface 不证明 artifact 内容、来源、store 白名单或迁入授权。

原 prepare 调用与后继 import 共用该 Interface。旧两项加最坏构建预留为1,807,102,087B，仍可满足2GiB；三项后再预留1GiB则超过2GiB，必须拒绝。此时实际已验证 import 仅能使用剩余1,047,077,769B，第四槽不保证任意1GiB产物可入。原单产物 verifier、Node/manifest/hash/内部链接/权限/unknown stage/32条构建记录守卫不变。

`host.mjs:backendById/backendRuntime/assertInstallationSource`、maintenance bootstrap/refresh/resume 都逐产物调用 `verifyBackendArtifact`，不调用 store count 准入；该 verifier 没有全 store count 检查。因此本次正式工具演进不要求重建已审 cd27，旧 manifest 继续可读。旧固定工具的 count2 仍原样存在于旧产物：以后若错误地用它在满 store 中重新 prepare，会保守拒绝，不能偷偷绕开。

旧 `migration-adapter.mjs`（5c29e13a5d251e4fb6b99d7d1277ace85dee24dc）不直接可用于本次：它固定 null backend、policy 不存在及 `[c7b,7d1]` 白名单。新薄装配需显式绑定已有 backend7d1、Web host7d1、已存在 policy 原字节与完整 `[c7b,7d1]` 集合，再加入 cd27；使用新版受信工具的共用容量门。沿原 `migrateOnce`、preview→store 双锁、完整 verify、fsync intent/checkpoint 和 exclusive no-replace rename，不复制第二状态机，不改旧装配或旧运行原件。当前 callable Module 已固定为7324a2a0，复用原锁/协议/只读runner SQL，见[current-migration-interface](current-migration-interface.md)；6个不同直接例通过。Module已于15:11:41.542Z独审批准并main96b424777接收；实际fresh参数、报告集合和本次OPS14实例调用仍待封定，不声称现场已经可执行。

## Web 兼容的准确 tuple

全部新报告必须是 `flow-web-api-v2` / format2，并绑定：

| 字段 | 必须值 |
| --- | --- |
| backendHead | `04da80692e79e2b7c3f6341c7fa76515a3f719a3`，不是 cd27 artifact ID，也不是 Web host source6c |
| context | `{format:1, publicOrigin:"http://127.0.0.1:61228", policySha256:"81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638"}` |
| retained artifact A | `461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90` |
| retained artifact B | `caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe` |
| current retained artifact C | `d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88` |
| 新网页 artifact D | 原 Web owner 待交的精确 descriptor/source/manifest；当前 UNKNOWN |

每个 report 及 read/send/recover/negotiation 四原件必须同 backend/context/artifact，完整 hash 与实际 App/cookie 证据绑定，原 owner 独审后使用。旧 C3 的 backend6c 报告不能替代；配置文件 SHA 和 normalized policy digest 也不能混写。新页面的晚到 Logout/连接 cookie 场景须由原 Web owner 明确覆盖，本构建内部加载不证明它。

backend 更新前至少三个 retained 的新 tuple 必须齐备；新网页发布前 D 的新 tuple 同样须齐备。原 release pointer 只确定 current/retained/CAS，保其历史 backendHead/compatibilityIds 与字节；configured load 根据明确 expectedBackendHead04da + expectedContext 找新报告，不自动改写 pointer。已有 Web 上限4项/192MiB/32 reports 与本页 backend 策略分别计算；报告实际数量/大小与新页面资产预算须 fresh 验证。

## 最小操作顺序（尚未执行）

1. 固定新薄迁入装配/参数及前述独审，取得新唯一 namespace 和当前共享窗口。fresh 核所有工具/Node/解析依赖、源 artifact 全 manifest、安装 realpath/dev/ino/私有权限、全部保留项、现配置/token/profile/runner身份、Web pointer、marker/库、三 owned 组及维护状态；保存无正文的受保护历史投影。变化或未知立即停止，历史v21不能当当前CAS。
2. 原迁入协议将 cd27 一次迁入，保留 c7b/7d1 和所有旧文件，完成 checkpoint 与完整 verify。没有后台/Web/任务修改。不重复旧 R2 迁入、旧 replace-host、旧 report/policy 写入。新04da报告只按新固定清单导入，既有205B policy不重写。
3. 从**当前已选7d1**的真实 `root/tools/personal-preview/maintenance-host.mjs` 调用公开 `maintainPreview({directory,action:'bootstrap',backendId:cd27})`，固定 Node 和该 artifact 内的 tsx loader、cwd=root。7d1入口由 state.backendArtifact 合法确认；未生成新 operation 前直接从 cd27 调用会被安装身份门拒绝，不能预填 state。bootstrap 内在 drain 前验证 cd27、现策略身份与三个新 report tuple，并合法创建新 operation/CAS。旧 e655 operation 已结束，不复用其 request/hold/resume keys。
4. 从此新 operation.backendArtifact=cd27 的合法 `root/tools/personal-preview/maintenance-host.mjs` 执行后续 refresh/resume，同一 operation、同一固定目标。保留配置真实 repository；不切开发 checkout、不以 moving-main CLI 选择来源。正常 drain 等现有用户工作完成；active/uncertain、admission v2、outbox/final proposal/journal 的完整有界事实有未知即 KEEP，不套用旧 v1 intent 退休许可，不取消/重发任务。
5. 既有 refresh 在 hold 下真实停止旧 Web/runner/center并启动 cd27 center/runner；独立 Web host可保7d1，其真实工具闭包与cd27同6c，应在前置资格中核实，不能把 Web host source当新backend。ready-paused后先持久checkpoint：全部旧组（尤其center）确停、原64表旧列/任务/会话逐值保留，新增合法迁移/audit显式归因，未知不覆盖。6c→04da迁移文件零差异，但运行仍走原 factory；不得因这条静态事实跳过保留校验。
6. checkpoint通过才同op一次显式resume，然后分开记录新服务实际启动、中心accepting/CAS、实际领取证据。若只有PID/profile/clean v2或claim status missing，`actualClaimRecovery=UNKNOWN`；仅自然用户工作形成中心receipt与本地assignment完整绑定才可升级。0 operator query、无制造任务/重投。新Web第4项发布是另一准确CAS步骤，依赖D真实报告和全部旧namespace保留，不顺手刷新用户tab。

原61227/61228、installation/runner/profile、DB身份、用户任务/会话、token/config、d629/v3及旧3retained均必须按阶段合同保留；自然用户推进须按事实独立归因，不能要求清空任务才能证明保留。合法 maintenance state/PID/backend descriptor/audit变化单列，不伪称全文件始终不变。

## 资源、失败与下一交付

拟复用已审迁入120s+.5TERM+2reap、raw2MiB/新增512MiB，maintenance从新实际开始最多900s+2reap；进入窗口前以实际完整预算和当时团队floor中更严格者准入，live1GiB，不沿用今天构建floor作未来事实。cd27逻辑367,045,616B，CoW实际独占physical UNKNOWN；stage与最终发布是同份payload原子移动，原artifact/tmp和旧个人两项均保留。512MiB不是物理保证，元数据/报告/诊断和并发/KEEP必须计入fresh总量。

只复用OPS14及既有持久phase receipts。失败/unknown停后继，锁按原 finally 正常释放，不能声称锁永远保留；有已消费副作用先核持久checkpoint，禁止自动新namespace重试、rollback、删journal或退役资源。监督对象仅自有operator消费者，detached个人角色只按原公开生命周期/nonce停止，不凭外层group absent猜全服务终态。

本次可调用薄入口与显式依赖闭包见[current-entry-interface](current-entry-interface.md)，固定source6c417850；默认strict-v1保留，v2与history ports及原红/绿证据见[current-entry-result](current-entry-result.json)。参数模板仍ready=false，现阶段不读取个人或启动操作。

当前交付：产物独审/主线receipt、尺寸/来源、已审并main fd9dd5a9的集中retention工具；当前迁入Module及参数/guard已独审通过。仍缺：可调用装配独审及现场参数/监督实例固定、三个 retained 和新网页的04da/context报告及审查、届时fresh现场事实/实际窗口。后续长期退役策略仍open。此处不为准备占用资源，不重复build/import/App旧绿项。
