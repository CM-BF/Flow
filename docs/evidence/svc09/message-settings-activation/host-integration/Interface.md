# SVC09A-04：真实双槽宿主消费者候选

本候选沿 FLOW-001/REQ19 与 MATURE02 TODO08/11，只准备隔离安装中的零模型集成。原模块/33不同局部例已审并 main246；本候选没有运行 host、HTTP、PG、SDK/native、浏览器或个人操作。历史任务开工仍 UNKNOWN；本次准备的第一次保留观察为 2026-10-07T14:39:51.563Z，14:44:58.126Z fresh claim 为原 v4 两个 own 目录。

## 固定源码与已审产物

优先采用 [source-composition.json](source-composition.json)：已审 `04da80692e79e2b7c3f6341c7fa76515a3f719a3` 为底，精确替换来自 main246 的11个 SVC09A 产品/测试和 `apps/server/src/runners.ts`，再加已审203ec的 backend-release files.mjs/index.mjs/artifact.test.mjs 三路径（count4、单1GiB/总2GiB不变）。其中 runners.ts 精确为已审 CORE 的 LIMIT 前资格过滤。其余 source 全部保持04da，不冒称等于main246。Lead已受控生成并固定 assembly `098b0d51512dfaa04c30ca7cbe103684720fe29f`（tree `f9f149a4dda976dad500545df1b26f825ac5b59d`），没有改既有 cd27。owner v4仅 own plan/evidence，不自行修改或领取产品。

33个既有宿主直接输入、7个依赖manifest/lock及整个 migration 树在04da/246逐blob相同。`configuration.ts/main.ts` 后续差量是显式plugin配置；普通Claude manifest→configuration/publisher/guard接口在04da已具备；本候选不启用plugin、activeSteering、nativeActivityBodies或其他新分支。`runRunner` 的 adapters、AbortSignal、poll/heartbeat/requestTimeout接缝在04da存在；它与该底的 client/contracts/outbox/admission-journal整体消费，不拼入main后续plugin v3或新outbox半套。发布/目录/messageSettings/maintenance的合同不需更新。实际组合兼容性仍由下一真实消费者验证，静态同字节不冒实测。

现有 SVC06 builder 从 Flow 仓库的固定Git提交 archive；不移动工作checkout，不修改manifest来源、不把cd27重标成新产物。投影归档1000文件/7,897,181逻辑B，仍使用原 archive roots。复用固定SVC06B build-inputs 对6c原输入的继承方式，新增仅assembly target/tree/15个替换pin；锁文件、runtime importer/cache选择未变。原builder一次实际构建已完成：artifact `2515a9069f07f1c6253e4eeb647ec3a105bca1fa3c9561f7bb11dca195bc3bd4`，逻辑总量367105165B，33SQL/81source/271snapshots。15:20:05.813Z获独立限定批准，见[原结果manifest](build/result-manifest.json)及主线 `docs/evidence/i02/svc09a-fixed-build-result-review.json`。原artifact/root/stage KEEP。本入口仍须重新验证克隆的完整inventory、sourceRepository与15路径字节，不能由JSON声明或已有build批准跳过实际宿主检查。

## 唯一旅程与实际调用点

一个 selected journey，不重跑33注入例或CORE5PG矩阵。小 fixture 只建立全新0700安装目录/0600config、marker/OID和动态loopback端口；复用既有 SVC06 私有安装布局与 `loadPreviewConfiguration / withPreviewLock / startPreviewServices`，不调用个人目录或61227/61228。不跑旧27→35迁移旅程；新库由固定artifact的真实center main及33 SQL文件完成当前schema。

| 阶段 | 真实调用与验收 | 证据限度 |
| --- | --- | --- |
| A 默认槽 | 固定 artifact 中 startPreviewServices 启动 center/runner/web；真实center HTTP、runner main真实注册/发布、完整目录读回。仅legacy槽；私有manifest/runner/workdir与已登记nonce/PID绑定，任务/attempt均0。 | 正常runner只在空队列启动；SDK模块可被普通main导入，绝不进入adapter.run/query。不称账号或模型可用。 |
| B 显式槽 | activatePreviewMessageSettings 使用固定两完整choices；真实 POST /api/runners，一次登记，真实新runner main发布，带 settings header 的目录tuple逐字段等于runnerId/profileId/configDigest/configuration/choices。原legacy config/token/manifest/workdir及旧3服务记录不变；四个角色状态逐一记录。 | availability/provider实际缺证据仍unknown/not-probed。目录或PID不冒领取。 |
| C 两槽维护 | maintainPreview bootstrap→refresh→resume，使用同artifact，不换产物。读两槽同operation、独立key/version；drain两槽、active/uncertain0后hold；旧4组确停，新4组记录与nonce更新、目录pin保持，ready-paused两槽均maintenance，显式resume两槽accepting。 | 部分ACK/unknown立即保留同operation/key/version、首错与收尾；不在本旅程自动续跑或注册新runner。实际失败不回填PASS。 |
| D 混合领取 | 空队列下，在原宿主锁内用既有stopOwnedProcess精确停止两个普通runner组，保留center/web。确证两组停止、原journal/outbox无未决，才允许插入两条自有任务。固定artifact的 runRunner + guardExecutionProfile 接受显式注入的测试adapter：只assertOwnership、记录executionIdentity/task冻结值、返回；绝不调用原Claude adapter或SDK query。使用同已发布runner/token/workdir。先提交legacy无pin任务，再提交新profile+settings任务；先仅开settings loop，必须越过旧任务领取自己的settings任务，再开legacy loop领取旧任务。已有runtime拥有claim、heartbeat、outbox、completion与取消；不造第二执行loop。 | 真实socket HTTP/PG分配与ACK、两task/attempt/runner映射为可证明事实；native部分是明确fixture adapter。普通main在这两次claim时已停止，不能称原生进程已经实际领取或执行模型。 |
| E 收尾 | 两条自有任务的真实中心terminal、冻结requested与实际attempt/事件ACK核对；abort并await两runRunner和原在途请求，保存journal/outbox是否clean；然后stopPreview关闭全部实际槽与所有generation，最后数据库零连接屏障/marker/OID核对。 | 不伪造observed或SDK usage。丢ACK/未决journal/进程或DB不可观测保持unknown/KEEP；退出不等于任务取消。 |

旧会话不隐式迁移的产品合同由已审局部证据保留；本最小旅程只核legacy身份/目录不变与无pin任务路由，不冒完整旧native会话恢复、Web/TUI下条草稿或provider后验。后续接受范围按这五阶段逐项，不用单一PASS覆盖未验项目。

## Web 附属输入与fixture边界

只需一个小静态页面服务使原host的Web角色可ready并参加全槽生命周期，不运行WebApp或浏览器矩阵。采用既有 `createWebArtifactPreparer({build})` 受信fixture构造口，给全新小Git fixture（固定source/lock、实际Vite package identity），build只写合成index.html；源头明确 `SYNTHETIC_STATIC_HOST_FIXTURE_NOT_APP_COMPATIBILITY`。由原verifyWebArtifact完整核实际文件，不手改实际Web产物。

artifact模式的maintenance要求已发布Web pointer与report，因此复用旧SVC06隔离 loader fixture 的原report格式/导入/plan/commit；report只断言loader合同，不伪造真实App报告。留在专库私有root并单独标 synthetic，个人部署永远不可复用。browser-session默认off，context null，不触发账号/cookie/retained3或四版本后继。

## 薄入口与所有者边界

| Module | 小Interface与所有者 | 依赖方向 |
| --- | --- | --- |
| host-supervise.py → host-run.py | 唯一入口 `--run-host-once`；原OPS14独立监督整个operator PID，operator内fresh pins/namespace/free、clone/work/cleanup均受原OPS14监督 | 固定host-inputs + host-preparation引用 → 原OPS14/clone |
| host-fixture.mjs | 全新目录/config/marker/OID/端口与合成Web loader；不复用个人凭据 | 固定artifact的原Web prepare/release/目录合同 |
| host-entry.mjs / host-records.mjs | work拥有观察Pool和阶段原件，明文异常/凭据不公开；有界目录/DB测量与第一失败/关闭分别记录 | 原OPS-METER、固定artifact入口 → host-consumer |
| host-consumer.mjs | 默认/显式槽、目录tuple、两槽维护、准确停止native poller | 原preview/maintenance/slots/process → mixed-runner |
| mixed-runner.mjs | 仅注入HarnessAdapter.run；原runRunner拥有HTTP claim、heartbeat、outbox和ACK | 同一artifact runtime/client/contracts/guard/journal |
| host-cleanup.mjs | 原process模块停止全部已登记generation，严格mayDrop决定；未知只KEEP | 工作原件+state → 同一process/observeConnections/PG marker |

这些文件均无顶层artifact产品import/PG/监听动作。定义导入可测，但不得单独运行work或cleanup规避唯一入口。固定输入通过同一 `host-preparation.json` 绑定，不复制完整artifact/81源清单。原SVC06三角色cleanup不直接用于本片，四种角色完整登记；默认键与settings键白名单固定。任何未声明角色、缺失/身份变更、未闭合异步资源拒绝DROP。

原6个纯/自有小文件准备例在15:26:30.391102Z选择，6/6、122ms/698B、两Python AST、组absent/双EOF、15:26:30.517468Z exact空scratch删除。[原reservation](prepare-local-02/reservation.json)固定检查时字节。[validation范围](host-preparation-evidence.json)明确其后三文件小差量：work报告持久失败仍尝试独立cleanup；缺失work disposition成为unknown而不DROP；host-entry按共享meter的complete/bytes/entries判定，保留vanished计数但不将枚举后消失误判unknown。这些后置差量尚未重新运行；遵循当时Web优先窗口只封源/只读审查，不把先前绿例扩大至新字节。

## 预算、动态 SQL 与结束条件

下列为本次候选预算请求，尚未开启实际窗口：

- artifact构建单独沿已审SVC06 builder段：420s work + 0.5s TERM + 2s reap；监督输出≤1MiB/总记录≤2MiB、artifact≤1GiB/100000 entries、原cache/staging与live/fresh预算继承固定原输入，fresh时另计并行实际预算。不能将该时间塞进host段或本次0PG准备。
- host clone≤20s、work≤180s、cleanup≤30s仍共享原215s monotonic准入截止，每次新child扣除已耗时并预留清理。新增最薄host-supervise使用原OPS14，独立对整个operator（含pin/fsync/archive）给215s work + 0.5s TERM + 2s reap，caller监督总包217.5s；不是给内部work/cleanup额外时间。外层仅childPidOnly，不取得detached服务所有权；超时/报告缺失记录UNKNOWN_KEEP。外层结果落盘在监督完成后，不能凭outer0/直属PID absent自动归还服务资源；仍需完整phase与全部8身份/DB闭合。raw总≤2MiB、私有fixture增量≤32MiB/4096 entries，另列克隆artifact≤1GiB与PG≤128MiB，保留1GiB reserve并加所有并行已声明占用。artifact只读来源未变，clone/安装不在已开始PG段临时扩张。
- fresh host最低 `1GiB reserve + 1GiB artifact clone worst-case + 128MiB PG + 32MiB private + 2MiB raw = 2317352960B`，加实际并行预算；所有数量是上界/采样，非原子峰值或物理回收承诺。实际clone可在先行离线段完成并把此部分计入既有保留，但不能因此减少reserve。
- 动态端口仅127.0.0.1，center/Web各一个；禁止61227/61228，无抢占旧端口。每次HTTP≤3s/≤64KiB，公开调用≤96次（目录最大4页、显式查询有限），runtime admission阶段另限≤15s/两条task/两条attempt/每loop并发1/poll500ms；本片没有对所有服务进程HTTP作全局计数；不得把显式driver计数写成全进程总请求上界。
- 中心Pool max8 + pg-boss max3；维护max2、fixture观察max1、admin max1。新旧center远端连接收尾可能短暂重叠，按最多26连接 + 16管理余量准入，不只按空闲态15估算。每个观察Pool显式query_timeout/statement_timeout；admin不与非本库连接交互。
- resident上界按4host wrapper+4actualrole child+work+operator+outer supervisor=11，另保既有ps/lsof/Git并行检查最多5个短子进程，总≤16；不启动SDK CLI/nativequery进程、pnpm、Chrome或新的构建进程。若现有实际工具闭包不能满足此边界，先改候选，不运行中扩权。
- 复用 marker `public.flow_preview_owner`、固定database OID、自建名称 `flow_preview_[24hex]`。业务SQL仅真实注册/发布/claim/维护已有store与本fixture只读核对；不手动填profile、自报catalog或直接分配attempt。由真实scheduler激活两task，不SQL强置dispatch_ready。
- 完整中心停止后复用 `observeConnections` 的有界远端零连接屏障（≤3s、逐query扣remaining、晚到0拒绝），只有工作owner absent/双EOF、所有登记服务组确停、runRunner在途settled、marker/OID同一、无未决事务/intent/outbox且远端0才normal DROP。先耐久checkpoint，再DROP并核剩余[]；任何unknown保留专库/私有root、不要FORCE/盲删，也不读取旧O16/SVC未知资源。
- cleanup为独立受监督owner；若work组unknown，仅能对已登记确切服务身份做安全stop，不允许DROP或清除私有材料。首错与cleanup各自保存，outer0不独自代表通过。私有fixture和artifact均KEEP，本入口不提供目录删除；只有满足mayDrop及marker/OID/零连接屏障才normal DROP新专库。token/adminURL/rawconfig永不进入公开raw。work报告写失败依然进入清理，缺该报告拒绝DROP；清理失败不覆盖work的已有原件。

## 当前交付与实际入口边界

当前组合源码、产物和薄caller已齐，等待一次总体源码/准备审查；PG/host没有启动，`actual-host-once` 尚未创建。唯一实际入口为固定Python调用 `host-supervise.py --run-host-once`，由它监督固定 `host-run.py --execute-host-once`，仅在另外给定真实窗口后由原owner使用；`FLOW_SVC09A_ADMIN_URL` 必须显式给本机postgres管理库，只存在子进程环境/0600私有配置，不能打印或放公开记录。调用前fresh核原v4 claim、全部源码/runtime pins、artifact root dev/ino、operator及outer两个namespace均不存在、总合预算和PG26+16余量。新holder或任何unknown均NOT_RUN；失败不重播该namespace。

构建批准不延伸到这次旅程。实际Web是合成loader输入NOT_APP/NOT_PERSONAL；真实read/send是mixed阶段另行断言的中心HTTP行为。旧33局部、CORE5PG、原Web矩阵不重跑。个人激活、Web/TUI新设置与真实账号/provider仍开放；无需新产品scope、监督器或任务执行loop。

## P2独立期限修复 2026-10-07T15:44:26.777Z

原独审 main729d33836 / docs/evidence/i02/svc09a-host-preparation-review.json 的 SVC09A-HOST-P2-01 REQUEST_CHANGES 保留；它是源码边界发现，不是已发生超时。fixed source `ccf7d057659d99be9c5d42fa035af352eaf647cb` 复用OPS14新增caller-only期限，不实现第二监督循环。外层 `host-outer-once` 与内层 `actual-host-once` 任一已存在拒绝重放；缺phase结果只UNKNOWN_KEEP。

15:41:14.524544→15:41:14.929848Z，新增5/5定向检查（2 Node+3 Python），两组累计402ms/raw955B、absent/双EOF/exact空scratch removed。覆盖tiny child模拟fsync阻塞经独立期限终止、保留先前错误输出、正常caller0不证明detached资源清理；另以真实缺失私有文件/注入落盘失败/共享measurement transient样本覆盖此前三文件差量。原6/6与STATIC_ONLY当时记录保留；本轮没有重跑6/build/import或任何PG/host/provider。原件只有[prepare-local-03](prepare-local-03/summary.json)，结果归属和组事实见两case原report。tiny child的PID/期限/EOF由直接测试断言验证，未另复制一套tiny报告。

## R3 临时路径合同修复（准备，未运行）

2026-10-07T16:24:21.318911Z：R2原FAIL/KEEP与第三guard仅静态发现不变。`host-paths.mjs`只统一词法输入：系统真实`tempfile.mkdtemp`可用的下划线与原字母/数字/连字符，限定同一`/private/tmp/flow-svc09a-host-`单层名称和唯一`input.json`；work、cleanup、validateHostInput共用。词法通过不是所有权证明，原privateJson/rootIdentity的symlink、uid、mode、realpath、dev/ino检查仍承担真实文件身份。不得读取旧root来验证样例。

直接检查实际生成路径→三个消费者；3新路径例与3受影响namespace例最终均通过，7次选择，原夹具漏sourceHead失败保留。累计355ms/2361B、3组absent/双EOF、两个exact空scratch删除。旧33、host、build、PG未重跑。来源与原raw见[本轮结果](host-path-contract-result.json)。

第三轮唯一候选改用`--run-host-r3-once`→`--execute-host-r3-once`，固定`host-outer-r3-once`/`actual-host-r3-once`及`host-preparation-r3.json`；R1/R2原入口仍拒已消费namespace。原215+.5+2外限、26+16连接、全部服务/DB unknown KEEP和无个人/provider界限未改。此候选没有actual许可或资源预约，必须在唯一独审后按最新完整合计floor重新协调一次实际窗口。前文原once入口与NOT_RUN为当时准备历史，不表示可重放R1/R2。

## 2026-10-07T16:48:12.215106Z SQL observation / R4 delta

`readMixedTaskRows(pool, taskIds)` owns the final parameterized text-ID SQL and wraps only that query failure. The existing recorder emits operation phase `mixed-final-task-query`, original source phase, controlled Error name/code and optional validated SQLSTATE; missing code remains null, error message/detail are never published. All original terminal/runner/submission/attempt/loop/journal assertions remain. R3 original unknown is immutable.

R4 outer/inner arguments map only to `host-outer-r4-once` / `actual-host-r4-once`; all earlier consumed namespaces remain refused. Its preparation pins the original R3 packet by exact path/hash, substitutes only the named changed inputs and checks all 19 resulting execution pins plus the unchanged six runtime pins. No copied payload or second supervisor. Original 217.5s, resource limits and unknown/KEEP gates apply; review/fresh shared window are still required.
