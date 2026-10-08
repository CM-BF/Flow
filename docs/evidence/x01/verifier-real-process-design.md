# X01-07 真实 verifier 进程旅程（设计，NOT_RUN）

本文件是 X01 原验收的下一直接消费者用例设计，不新增 task、调度器、数据库权威或执行监督器。当前只写文档，未授源码供给或实际窗口。固定生产输入 main `7001fab804a082aa7f2cf01b72022ea17ee80225`；既有 driver 输入为父树 `9af0b6c37d32e63d2fe1450de98bcd2ef056cc53`。main 没有该 driver，不能把父旧副本冒充当前生产源码。

## 已具备与尚未证明

AV center/v4/client/036 已 main97353e4f；VAR/CENTER 已 main728d3165；runtime 已 mainec7e72f0；SDK identity 已 main866f0a9c。固定回执及原验证边界见 [本段来源](verifier-parent-metadata-start.json)。AV 5真实PG、VAR 5领域PG、factory9例、runtime25局部例与SDK29 distinct分轮分别成立；它们不等于真实 server/main + runner/main + PROCESS verifier 的完整公共旅程。原失败、未知和旧原件均保留。

父 driver `apps/server/src/plugin-runtime/process-runner-pg.test.ts:45–92` 已有 main 进程启动、EOF、退出与停止；`:122–193` 已有唯一 PluginDatabaseFixture、registry/material、marked DB 与 owner 清理；`:196–269` 是原两 semver 任务。`:160` 仅配置 runner store，因此旧通过证据是 in-process 与已知 ACK 后重启，不是 PROCESS verifier 或 T7。下一实现仅参数化必要 fixture/package/config setup并新增精确标题一例；原绿 semver 例源码和断言保持，运行时不选它。

## 最小 Interface 与权属

| 职责 | 直接复用入口 / 不变量 |
| --- | --- |
| 公共受理 | main SDK `FlowClient.admitPluginVerificationTask`；同 key/规范化 input，64KiB ACK、requestIdentity 与 project/binding 核对，坏 ACK 为 UNKNOWN，不自动换 key 或重试 |
| 来源与项目 | public project create/add-node 产生唯一源 task；每次受理先取 fresh project revision，传 expectedSourceProjectRevision；精确 task/attempt/artifactId/version，中心原文≤8192B与digest，不用 latest 指针或SQL造产物 |
| 中心 | main `server/main.ts` 的受信私有配置 reader → factory既有routes/reportEvents；exact material artifactSHA/treeDigest/hostApi→algorithm trust，默认不开 verifier。配置为本 fixture 自有0600文件，不读取个人配置 |
| runner | main `configuration.ts:106–122` 显式 executionMode=trusted-process 与 verifier.trustedAlgorithms；不隐式 toolExecution。`runtime.ts:138–160` v4 journal资格；`:321–341` load/invoke grant与typed artifact/verification；既有outbox批次含settled completed |
| 执行 | `plugins/execution.ts:88–145` 的 shared verification-input/精确材料/独立算法校验，注入 PROCESS.invokeVerifier；错误无 in-process fallback，UNKNOWN保 journal/outbox，不重invoke |
| 生命周期 | 原 fixture/OPS14 单一所有权；load→factory→listen→work→close及持久化均共用绝对期限，未知 KEEP，不把 Promise timeout 当进程退出 |

未来候选产品测试写面仅父当前已持 literal `apps/server/src/plugin-runtime/process-runner-pg.test.ts`，支持证据仅 `docs/evidence/x01`。本段没有产品写权或新增 scope。server main/index 由 CENTER/Original assembly owner管理，runtime/config由RUNTIME、process host/worker/protocol/resources由PROCESS管理；本候选不改这些产品。准备前 fresh claim/head/最新main以及完整直接依赖；若确需产品接缝或新测试叶，先由对应owner STOP/amend，再合法take，不能借文档设计开写。

## 一个用例，三个真实任务

1. **T1 普通来源。** 从公共 project create/add-node 创建一个 fixture harness task，由真实 runner/main 的现 fixture adapter 完成并上报 artifact。其正文含真实 adapter 文本前缀，不是 JSON；保留服务端记录的精确 artifact 四元组与内容digest。不得 SQL seed task/attempt/artifact/ref/receipt，也不新造 JSON producer。当前v4资格 SQL允许无plugin binding的普通任务；用同一capacity1 runner可串行领取。
2. **T2 明确失败但已收束。** verifier material 通过既有 public fetch/install 路径实际安装、授予 verifier 能力并启用；材料采用已审有限 JSON-object verifier，固定包与算法身份。SDK public admit 引用T1产物，真实v4 claim→load/invoke授权→PROCESS worker→JSON输出artifact+typed verdict。预期 `failed / invalid-json` 与 settled failed completion。不能把 semver正文 `-1` 的 `not-object` 混成 invalid-json，也不把 typed reason当HTTP错误code。
3. **T3 成功。** fresh项目revision后，public admit 引用 **T2实际输出JSON artifact** 的task/attempt/artifactId/version与实际hash，requiredKeys=['verdict']。不是T1原文或npm package artifact。中心受理不要求源任务 succeeded/passed，也不检查artifact currentflag；它核当期项目、精确四元组、大小、hash及非自引用。T2失败并已settled不删除该历史JSON artifact，因此T3应产生center-approved passed与succeeded completion。

每次来源均由公共读取取得精确身份；只读SQL可交叉核最终持久化与数量，不能代替公共建数。真实注册、fetch/install、grant/enable前置允许先建立bootstrap center并正常关闭后启动trusted center；同一时刻只有一个center，不并跑pool。

## 必须通过的直接断言

| ID | 同一真实case中保留的断言 |
| --- | --- |
| VR-A | 恰3 task；T2/T3由public admission产生，project各新增一个node，binding/ref/receipt唯一；已知ACK同key回放返回同身份，不多task、不多invoke |
| VR-B | v4显式verifier资格、不可变kind/material/config/algorithm与source四元组/inputDigest正确；load/invoke两phase同attempt/ownerVersion/binding/invocation，当前grant真实有效 |
| VR-C | 实际 PROCESS.invokeVerifier 到worker路径，已知owned PID/执行材料/输出与正常退出清理证据；不能仅由配置、cwd或mock调用推断worker真正执行 |
| VR-D | T2 invalid-json/failed与T3 passed分别绑定自身真实output artifact与typed verdict；center从冻结source独算，artifact+verification+settled terminal同事务成立，源历史不改 |
| VR-E | 同原driver确认全部owner进程/EOF/listener、0conn普通DROP+absence、sameidentity TMP有限清理；unknown保原cause/KEEP，不force/terminate外部owner |

worker实际观察优先复用既有PROCESS资源所有者与原监督收据。准备时须明确该记录如何关联T2/T3及真实worker退出；若现有公开/fixture观察面不足，记为准备阻塞并申请最窄test seam，不能用测试假回调或任意sleep替代inflight/worker证明。授权撤销、取消UNKNOWN、跨版本复用与整体移除要求仍沿原矩阵开放；本case不把既有局部负例冒为真实main旅程已覆盖。

## 候选运行边界与解除条件

候选共180s=110work+60cleanup+10final，1marked DB/17配置连接保守上限；bootstrap/trusted两个串行center生命周期，registry及当前center最多2个业务listener（预留port选择也要登记、关闭后才bind）；1capacity1 runner，T2/T3两个串行worker。outer/Vitest、main进程、fetch/install解包tar等完整actual/potential组清单须在后续prepare从实装确定，不能把本估算当已核峰值。TMP32MiB/4096entries、raw1MiB、DB/WAL128MiB与一次global1GiB收尾reserve仅候选规划，另加当时有效paired/KEEP，不获得实际资源。

HTTP必须分别覆盖owner public调用与runner轮询/heartbeat；现main真实进程不受旧fixture.request计数完整覆盖，因此160不能无依据沿用为全量已强制cap。准备段应从固定idle/heartbeat/claim退出策略给出可执行总上界与计数路径，必要更新候选声明；未闭合前NOT_READY。材料fixture源码/归档hash、所有实际动态SQL和loader/worker依赖闭包也待prepare固定；本段不复制旧closure、构建材料或运行检查。

解除顺序：固定设计独审→授权独立source/prepare段与精确scope/供给→必要pure/types/collect仅准备→独立准备审与唯一manager grant→fresh输入/claim/root/space/全资源后一次实际。失败原件保留；任何后继运行不是复用旧PG余额。

**T7独立边界：** 本case仍是固定源码树真实进程验收。真实可重定位发布artifact由Original releaseowner后续以同旅程运行，并核module-relative tsx、worker/protocol/resources/host/execution、@flow/plugin-runtime与依赖均来自工件。仅cwd变更且源码仓仍可读不证明无源码依赖，也不称OS sandbox；本片不修改个人发布工件。完整X01-04/05/06/07及原验收矩阵仍OPEN。
