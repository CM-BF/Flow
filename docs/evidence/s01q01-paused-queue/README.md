# S01Q01 源码准备证据

固定产品基线 `b79121e1944f10f82a416d98d776c0f55bf9c943`；[源输入](source-inputs.json)含 252 fixed Git paths、mode、bytes/hash，合计 1,237,032B；未复制 node_modules、其他任务 raw 或私人数据。[原子领取](take-receipt.json)。源 operator 先 no-checkout，再本 worktree sparse 设置与 read-tree 初始化；空 index 的暂时 D 状态已在首次项目写入前恢复，最终初始工作树 clean，没有删除共享文件。

## 后继真实验证（NOT_OPEN）

先选两新增用例；通过后按影响选现有错误回滚/fair scan、limit、pause/completion/promote 与显式 resume/ACK 用例，不跑 128 基准或全库。固定 Node24/pnpm9.15.4/Vitest4.0.18；本树源/动态迁移闭包与真实已有依赖入口需紧前绑定，内部 @flow 必须指本树。本段无任何工程 child/types/test/PG/HTTP。

当前 queue.test.ts fixture 本身不能冒充已准备好的安全执行入口：它仍把回执写入旧 docs/evidence/chat04，CREATE ACK 用 created bool、关闭缺统一绝对 deadline/marked identity。未来在当前合法测试叶或自有 evidence 内适配已审 marked DB owner/OPS14 方法，不能写旧 scope、不按随机库名猜拥有、不 force DROP、unknown KEEP；先固定入口独审再窗口。

配置连接上限静态合计 **24**：admin1 + fixture SQL pool10 + fixture boss2 + createServer business8 + center boss3；不是实测连接峰值。初始新增两用例只用一个 center，无第二 center；autoQueueScan=false 仍有 lease sweep/pg-boss 背景。若选择原双 center 用例还需另计 pool2+business8+boss3，不能沿用 24。新测试数据最多 23 conversations/24 queue items/3 promoted tasks，短文本合计小于 2KiB（非数据库物理字节）。原公平性消费者额外数据单独计。

未来候选一次 ≤90s（50s work/30s cleanup/10s receipt），逻辑 DB≤64MiB末 sample不作硬峰值，local/raw≤2MiB，动态127.0.0.1端口/唯一带 marker 数据库。每次 SQL/HTTP 在剩余 deadline 内，不把 HTTP abort当SQL已停止；owner app/boss/pools 确认关闭、身份再核、0connections后普通DROP、lstat/DBabsence回执。未知创建/启动/关闭保留确切 identity/原失败，不继续下一场景。资源与窗口尚未申请，此处只是最小候选。

## 方法与质量

本地 find-skills → brainstorming/codebase-design/clean-code；需求设计已由 GO/Mika 授权，未重复审批/安装。clean-code 固定 sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。应用：不扩调度器职责，SQL 候选选择与锁内权威复核分别保留；测试从真实 API/PG 状态断言，不镜像 SQL。实际技能内容 hash 见 skills.json。源码完成后复核命名/单职责/错误路径和已有断言保留；实际 red/green NOT_RUN。

## 固定源交付

2026-10-07T16:31:06.487336+00:00：实现 target `42c6c8cf81d3d648fc3477109e66db6c843aefe3`，两源SHA见source-checkpoint.json。clean-code收尾：一个candidate predicate，无新抽象/重复状态；锁内暂停复核和异常隔离未改；原测试全文从新增两例前后拼回与base逐字相等。当前没有执行证据，不将静态行为推导写成red/green。源码准备 STOP，claim保留待独审/下一有界入口准备。

## 2026-10-07 fixture preparation successor (PG NOT_OPEN)

The one-line `promotion.ts` predicate remains byte-identical to `42c6c8c`. The test now delegates resource ownership to this task's `pg-fixture.ts`, adapting the marked DB lifecycle from the fixed `b79121e` X01-removal reference. No new product fixture path or supervisor is introduced. Every original business assertion and both new cases remain; the normalized test-body proof is in `fixture-preparation.json`.

- Dedicated generated DB `flow_s01q01_<32hex>`, explicit CREATE intent/ACK then OID/owner/marker and fsynced receipt. Unknown CREATE or record failure never licenses DROP. It never reuses CHAT04 evidence paths.
- Factory import is performed inside tracked work before DB creation. Factory starts/listen promises are tracked; closing prohibits new starts, aborts listening, joins pending operations, and final close verifies `server.listening === false`. An unresolved operation/close/identity is KEEP. Timeouts are observations, not cancellation proofs.
- Planned common 120s frame: 70s work / 40s cleanup / 10s receipt, measured from external operator's actual start; only a **proposal**, no live permit. Auxiliary/admin SQL have 1500ms statement and 1800ms client limits; production business/scheduler defaults stay unchanged. The fixture's test-only boss also keeps its package defaults. Each HTTP request gets remaining-work cancellation and count cap256. Response-body storage/total candidate bytes need final actual caller binding; this source stage does not claim an enforced DB/local peak cap.
- Configuration totals are 24 connections (1 admin +10 fixture +2 fixture boss +8 factory +3 factory boss). The existing two-center case adds2 helper pool +8 business +3 boss =13, peak configured37. No package worker is enabled. Timers/background jobs are still present with `automaticQueueScan:false`.
- Finish closes all known servers, fixture boss and pools, verifies matching DB identity plus up to20 bounded activity observations, checks identity again, performs ordinary DROP only with zero connections, then confirms absence and closes admin. Failed or unknown facts retain DB/evidence. No FORCE, external signals or old KEEP access.
- Only the two new mixed-paused/ready and pause-race cases are initial future candidates. Running all historical cases needs an explicit separate selection/time/request budget; preserving assertions is not execution evidence.

The fixed source closure contains252 files/1,237,032B including fixed migration SQL and package entries. A private ignored `.source` receives that fixed Git content plus explicit current test/promotion/helper overlays. Seventeen installed dependency aliases and three `@flow` aliases point respectively to fixed existing package directories and this supply; no moving-main internal package resolution, installation or full node_modules copy. `types.tsconfig.json` inherits ES2023 and `noEmit`; command candidate:

```text
/opt/homebrew/opt/node@24/bin/node docs/evidence/s01q01-paused-queue/node_modules/typescript/bin/tsc --noEmit --project docs/evidence/s01q01-paused-queue/types.tsconfig.json
```

This command was **not run**. Mika drained engineering before the first launch at17:17:38Z; no OPS14 child/PID/TMP/PG/HTTP was created. Caller+focused type and bounded real lifecycle evidence remain required. Subsequent actual execution must bind the fixed source/helper, a new marked record root, explicit `FLOW_S01Q01_PG_OPEN=reviewed`, actual start/head/window and fresh manager resource floor. Merely setting environment variables is not authorization. OPS14 still owns process supervision; fixture owns only its DB/servers/pools. Synthetic or static source review cannot approve a PG window.

## 后台失败传播修复（2026-10-07T19:27:05.171494+00:00）

唯一新局部入口：[failure-local/summary.json](failure-local/summary.json)，运行只一份[iterations](failure-local/iterations.json)。固定source `01dfc89e43fb7793bc3d022b05ea34c129755073`。后台首错现在拒绝后续work；正常清理后仍抛原错误，回执可同时为资源CLOSED与验证FAILED；清理unknown保原cause，持久回执失败保双错。

7/7纯fake资源故障用例及focused fixture types通过，原red1失败和首green4失败/3通过原件保留；无真实PG/HTTP/数据库创建。外部FS/Pool/Boss被内存Adapter替换，真实fixture admission/finish路径不替换。真实paused扫描、整个历史suite/types与实际120秒生命周期仍NOT_RUN。上方原90秒提案及历史旧fixture说明仅历史，当前不据此OPEN；正式候选需完整运行绑定、预算与新窗口。4child19:22:32.454554Z全部归还，停止launch。

## 新完整准备片段（2026-10-07T19:53:58.685272+00:00）

唯一[局部结果入口](preparation-local/summary.json)；[固定运行输入](runtime-inputs.json)283文件/36个alias位置（17外部各两处、2内部），产品252路径/33SQL，当前test/promotion/fixture覆盖逐字绑定。原第三client alias未供给且在固定闭包中无引用，不算有效第三alias；本次无安装/扩大供给。

完整queue类型已通过；首次6个未定义首项错误保留，新增明确守卫，原断言不删。Vitest list只收集两条目标名称，0实际测试hooks/PG；Python caller7纯例通过（最终复跑绑定最终entry），不称实际收尾。局部sampler逐run绑定配置/fixture/caller；252供给只作最终完整绑定，不冒称每次前后全闭包采样。

未来唯一argv在runtime-inputs；[许可](closed-permit.json)为CLOSED/过期、实际permit和namespace不存在。候选140秒=70work（含加载/CREATE）+40cleanup+10child结果+10TERM/KILL+10父receipt；共用origin。正常单center24配置连接，两个用例不启第二center，后者另13须另选范围。OPS14仍监督child、fixture仍管理带marker数据库；未知KEEP，无新调度器/observer/强删/重试。

**真实准入尚未完成**：caller将保留目录最终逻辑总量连同receipt预留按raw2MiB校核，外包络8MiB，但不采临时峰值；数据库大小采样未实现，旧64MiB只是历史提案。完整实际预算须独审与经理后继确认，不把本候选当PG READY或已获运行许可。原两条真实PG测试与剩余队列验收仍NOT_RUN。

## 当前准入补强（2026-10-07T20:23:52.494436+00:00）

唯一[本段记录](admission-local/summary.json)绑定 `7da2a44608fd92e578863e6d6e39ad18aae98a13`。db20:03:44对9d1bc8的CLOSED准备与原局部证据批准已归档，实际准入缺项在本段补齐代码，仍需增量独审与经理新窗口。

- 清理前有界扫描record/TMP：总8MiB（含256KiB父回执预留）、TMP4MiB/1024项、总2048项、每次最多2秒并受总origin+138限制；所有对象身份复核后逐项删除，未知/超限KEEP。是安全点观察，不是实时硬配额/峰值证明。保留原first/raw/关闭事实。
- 已标记DB在created、listen结束与DROP前采pg_database_size；128MiB采样阈值，另规划128MiB WAL储备。后者非WAL测量，前者非峰值；保守实际资源候选至少DB128+WAL128+local8 MiB另加经理共享余量，旧64MiB/90秒不再适用。24配置连接不变；未选双center37。
- 实际fetch流读取每响应262144B、累计2097152B/最多256次；超限停止新work、保首错并关闭，cleanup receipt载httpCount/httpBytes。正文仍可被业务json/text正常读取。
- 140秒共同origin70/110/120/130/140不变；future真实permit及fresh ledger/admission放Git树外相邻私有路径，60秒fresh exactclaim/version/scope/HEAD/clean/window/fullresource sum，加本树3条有界Git只读核验。没有读取私有值/创建actual文件。CLOSED候选不能当许可。

纯caller11、fakefixture13及两focusedtypes通过；首caller8/11原失败保留。最后一次child后仅把actual permit/admission改为Git外部相邻文件，避免输入本身让source dirty；这一薄read seam未再执行，不能把历史11例当完整入口重跑。5child actualFULLRETURN 2026-10-07T20:19:35.111707+00:00，无新PG/HTTP/Chrome/provider。命名/职责/错误与重复经本地clean-code/codebase-design安全点复核；不增加资源框架。

## 换根清理修复与外置准入接线（2026-10-07T20:35:15.546469+00:00）

固定实现 `103232eeab0f861e1ab87f496e9b9f0f1c068965`，唯一[本段记录](rootguard-local/summary.json)。db20:31:58对7da2/a4a的SOURCE_CHANGES_REQUESTED仅1P2：原remove_sampled直到删项后才核root身份。现在在首删前、每项读取前与删除前、最终root.rmdir前核non-symlink目录/canonicalpath/dev/ino与期限。sample后根被rename并换同原目录symlink会在零删除处拒绝；已开始清理后换根也会停止下一项，保留尚未删内容。此为观察到替换时的fail-closed，不声称OS强隔离。

15/15 caller纯例绑定本次最终可执行字节；包含原11与新4（首删前换根/项间换根/外置sibling准入run接线/树内拒绝）。外置permit合法路径可完成fresh事实核对，测试在private配置/namespace/child之前截断，无真实请求。此前该薄读取NOT_RUN缺口现在由纯mock覆盖，真实PG仍NOT_RUN。fixture13、类型、收集未改未重复。单child 2026-10-07T20:34:06.594010+00:00 FULLRETURN，raw114B、finalabsent/MERGED EOF/ownTMP exactENOENT；初始EPERM观察保持原样，无新failure/signals。

本地find-skills/codebase-design/固定clean-code安全点：删除责任仍单一，check_root仅封装本操作不变量；原错误和UNKNOWN门禁保持，不增加生命周期框架。原各失败/审批/资源口径均保留。新运行输入和CLOSED许可已更新hash，仍须独审与新经理实际窗口。

## 本片验证与selector审结（2026-10-07T21:14:11.497220+00:00）

原[实际结果](pg-run-4799eda499494ac79f211b89ead71ea8/interpretation.json)由db21:08:19忠实性批准：两目标真实PGpassed/32skipped，原callerFAIL仍保留。selector修复 `d78ffd7c691682c1e78d7a2b7d2617521527e9ca` 的[局部记录](selector-local/summary.json)19pure通过，db21:13:07增量批准、P2关闭。只有状态pending/skipped可未选，两个精确目标各一次passed，缺/重/failed/额外executed/unknown/suite失败拒绝。原child/resource判定没改。

源准备/真实PG/纯解释分别绑定不同SHA；没有在新source重跑PG，也不把本次CAS的一种合法分支说成两分支均发生。旧运行input/permit/raw完整冻结，当前候选窗口已消费，后续不能直接复用旧manifest或permit。本片待主线接收，所有工程STOP。

2026-10-07T21:55:40.275Z main收口：见[唯一main回执](main-receipt.json)。两产品/main/已审源/本树字节一致；原交付owner记录零diff；计划四项全部完成，无新工程或PG。复用已读find-skills/codebase-design/固定clean-code：最小predicate、职责/错误保真与历史证据界定保持。仅metadata，提交push后全STOP、release独立回执不回写本树。
