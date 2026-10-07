# S01P07 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-07T03:42:50.732592+00:00 |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 现有领取receipt仅证明领取；未用其时间推定首次实际开工。原验收尚未完成，诊断修复段时间见inventory-diagnostic-fix.md，不代替task完成时间。 |
| Plan | [plan.md](plan.md) |
| 所属大task | [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | mika |
| 单一status owner / model | status_read / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-claim-recovery |
| Branch | codex/runner-claim-recovery |
| 工作基线 / HEAD | 基线22a0806bc2465e11096949618113833f31766b19；8产品源83a0799293057f7472f0329c61e566708b2a2381；已审输入0a753088f477932140b10b288e907243cb265c27；R2 execution HEAD 44594beb1564732c00fb66721db2fd51b60b87e9 |
| 工作树dirty状态 | 本次恢复时1de74274791d55d9808056456379b038b430aa5f=origin clean；仅归档准备独审，产品/PG inputs/manifest/raw均冻结。 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | R2原8组PG 8/8、10task/80HTTP、exit0，另历史85 distinct non-PG分批共93行为；strict第5轮exit0、3 lifecycle fake与4诊断fake独立口径且未重跑。R1仅0条case结果，原4组capacity PG单列NOT_RUN |
| 已集成main状态 / HEAD | NOT_INTEGRATED；基线为已供给固定 main 22a0806bc2465e11096949618113833f31766b19 |
| 实现目标 | 83a0799293057f7472f0329c61e566708b2a2381（8产品源，R2中心8组已通过；原4capacity仍NOT_RUN） |
| 实现范围 | apps/server/src/runners.ts, apps/server/src/runner-claim-receipts.ts, apps/server/src/index.ts, apps/runner/src/admission-journal.ts, apps/runner/src/runtime.ts, packages/contracts/src/runner-claim.ts, packages/contracts/src/index.ts, packages/client/src/index.ts |
| 阶段 | M2 |
| 优先级 | 3 |
| 任务层级 | 子task |
| 当前产出 | 原8组领取恢复验收已通过；四项原并发消费者的安全fixture适配、类型与收集检查已通过独立准备审查。 |
| 下一可用交付 | 取得唯一PG执行窗口后验证四项原并发消费者，再完成产品交付与主线接收。 |
| 当前阻塞 | ACTIVE: 已获唯一四项PG窗口，待本次fresh准入与实际结果；尚未验证前不标完成。旧R1原因UNKNOWN、旧根KEEP。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：R2结果已审；4capacity source68815/packet1de742于03:36:55Z SOURCE_AND_PREPARATION_REVIEW_APPROVED，0P1/P2；真实4PG NOT_RUN，NOT_INTEGRATED |
| 领取 | [COMMITTED amend](../../docs/evidence/s01p07/claim-amend.json)：9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac v2 / 18 literal |

| TODO ID | 状态 | Owner | 证据 / 检查 |
| --- | --- | --- | --- |
| S01P07-01 | completed | status_read | [接口](../../docs/evidence/s01p07/interface.md)；协议/职责与直接消费者范围已固定 |
| S01P07-02 | in-progress | status_read | contract/client/route/中心事务源码已固定；R2原8组PG与限定结果独审均通过 |
| S01P07-03 | in-progress | status_read | v2 journal/runtime 已接线，新恢复及旧peer直接消费者85不同检查分批通过 |
| S01P07-04 | in-progress | status_read | [R2](../../docs/evidence/s01p07/pg-run-r2-manifest.json)原8组通过；85非PG/strict0原件保留，原4capacity PG未跑，0provider；R1失败不抹 |
| S01P07-05 | pending | status_read | 源审0P1/P2；R2结果已审 / 4capacity准备已审、真实消费者未跑 / NOT_INTEGRATED |

## 架构与登记

计划改变 runner admission 协议、受权自身份和本地日志格式；沿现单 admission loop 与中心 runner→task→attempt 锁序，无新 scheduler。架构视图目标待固定实现；登记与 main 集成由 Lead 负责。

唯一事实源为本 status；Lead 已登记本 WT/branch/plan 路径，尚未核实际聚合。原 S01 实验 claim/结果独立保留，不沿用其 approval 或 main 事实。已接收33源186913B并逐hash核符；24 ignored dependency links已核固定版本，4 @flow仅本WT；0install。原固定基线输入与本 owner 修改分开记录。

CHAT05P01 的[只读接口对照与交接边界](../../docs/evidence/s01p07/chat05p01-interface-handoff.md)已可用；当前没有 writer 移交、release 或 amend。发布入口仍由 runtime 与既有 AttemptControl/EventOutbox 持有，新增协议能力须显式协商。S01P07 v2/18 literal 占用与固定 PG 输入保持不变；此管理观察不表示产品接线或 main 集成完成。

同一接口记录已补“后继聚合资源验收 / 未实现未测”：聚合预算、历史恢复扫描及清理门禁为后继输入，不扩大本片实现或原计划验收。Lead 22:31:37 UTC 的低空间类型 NOT_RUN / NO_HOLDER 仅作历史来源事实，本轮0采样、0检查、0新负载。

2026-10-07 [PG恢复准入](../../docs/evidence/s01p07/pg-window-resumption.md)：fresh claim v2/18 ACTIVE；65固定绑定、30动态SQL、24依赖与231份既有源码闭包无缺失/漂移。原heavy启动线保持，单个有界local若配对则另计完整新增预算；不以旧串行文案默许并跑。此次仅静态核对与一次空间观察，0工程测试/PG/provider，原85非PG、strict5和3fake不重跑。

R1实际窗口 `S01P07-PG-20261007-R1`：02:53:11–02:53:12 UTC，外部 time real 1.00s / exit1；wrapper 0.870s。Vitest PID/PGID97501一次TERM后exit143，双EOF、自有组absent；stdout仅90B横幅，stderr0。fixture receipt及其四个前置记录全部absent；原fixture必须先durable reservation再触DB，未见CREATE证据，未另查询PG，不能声称远端零连接或DROP通过。精确临时根 `flow-s01p07-pg-window-qsnu91s5` 身份仍同reservation，final/sample 1164095B，按unknown保留。原source/manifest不变，未重试；计量错误的具体原因仍未知，不以最后采样成功抹除首fault。外壳及准入事实见同一[运行记录](../../docs/evidence/s01p07/checks/S01P07-PG-20261007-R1.outer.json)。

R1后[最小诊断修复](../../docs/evidence/s01p07/inventory-diagnostic-fix.md)只补首错phase/errno/计数，4项新fake单次4/4、262.528ms、raw734B，自有空TMP同身份清理。原wrapper输入按历史Git冻结，当前修后wrapper不得沿用旧hash启动；产品、fixture及旧raw不变。

2026-10-07T03:09:49Z：[新窗口输入](../../docs/evidence/s01p07/pg-diagnostic-window-request.md)记录03:07:01Z独立诊断批准；仅为保旧输入增加两固定文件名选择及实际输入SHA记录。原65绑定中63未变、30SQL与24依赖静态核符，未执行新检查或PG。claim仍v2/18 ACTIVE；原manifest/raw原字节保留。下一实际窗口须另给namespace与clean execution HEAD，不以准备替代验证。

## 等待记录

| ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| S01P07-W01 | 2026-10-07T02:53:12.952049Z | 2026-10-07T03:20:18Z | 验证失败 | R1未有PG结果；诊断与输入独审完成，收到唯一R2 OPEN后继续实际验证 | R1 finishedAt；本时点fresh接收Mika的S01P07-PG-20261007-R2 OPEN及db_transaction_owner审查转述 |

2026-10-07T03:20:18Z fresh：HEAD=origin `0a753088f477932140b10b288e907243cb265c27` clean，账本available、原claim v2/18 ACTIVE身份一致。Mika转述db_transaction_owner于2026-10-07T03:12:57.210730Z的SOURCE_INPUT_BINDING_REVIEW_APPROVED / 0 P1/P2（63旧绑定/30SQL/24依赖与两literal/inputSHA/预算）。仅归档metadata后固定新clean execution HEAD；R2仍一次原8组/200s/原资源，无新检查或产品修改。X01是否实际local由其owner确认，若活跃完整35,135,488B另叠加floor并确认隔离；不得默认配对。旧manifest/R1原件与qsnu目录不触。

R2 `S01P07-PG-20261007-R2` 实际03:21:23–03:21:27 UTC，内部3.846187s/外部time3.91s、工具exit0，03:21:36读回完成。8selected/8pass/0skip，10task、80HTTP，fixture2046.118ms；专库OID1195575+marker确认、零连接后普通DROP且absent，app/pool/admin/startup闭合，errors/primaryErrors=[]。PID/PGID69706退出0、group absent、双EOF、signals[]；wrapper及fixture两个自有根再次精确lstat ENOENT，本轮无保留资源。raw2243B/TMP样本峰值3036442B低于原上限，不称全时硬峰值或PG/WAL测量；0provider。heavy已即时归还，C02/Web后继不等本metadata。[11份原件与外壳记录](../../docs/evidence/s01p07/pg-run-r2-manifest.json)共12184B；新诊断无首fault，R2成功不能反推R1。C02局部预算在spawn前已叠加；Web9MiB新通知在spawn后收到、组合线复核在R2结束后，按真实先后记录，不补写成事前准入。

2026-10-07T03:29:14.988284+00:00 后继4capacity源码准备：保原4case共4633B逐字不变（SHA2c7da25290c712db3232db38ef0dc7ea7d9377b863440f76faffa73e3439d580），仅realCenter替换为现ClaimCenterFixture的薄适配，4专库串行/累计13task，每库原160HTTP门禁合计640、峰值15连接。fixture只加保旧默认30000的lease参数，capacity仍原300000；原8默认不变，历史包按Git绑定。wrapper只增固定capacity输入/config/30输出预核，不新监督器。固定main15847数据库donor在原module id加载并记录SHA，保持migration import.meta.url；原231输入共同部分仅database.ts有main差异，client相同。见pg-capacity-slot-request.json；types/collect待唯一local，4PG NOT_OPEN。

2026-10-07T03:34:57.772871+00:00 capacity局部验证收束：首strict exit2/788B来自registry自递归ReturnType，收窄为实际receiptPath/processSettled结构后strict0；collect-only准确4项/0执行。原段实际2.159s后停止，诊断/修复/协调间隔保留；另授权后继段3.386s，首启动至末结束146.968s不是90s内连续段。3child末态absent/双EOF，各自空TMP同identity删除，总raw1717B，瞬时TMP峰值UNKNOWN。见[单份记录](../../docs/evidence/s01p07/checks/capacity-local.json)与[准备入口](../../docs/evidence/s01p07/pg-capacity-window-request.md)。0PG/provider/install，local已直接交回C02；原85/8/旧strict未重跑。

2026-10-07T03:41:52.772958+00:00 恢复/独审接收：fresh协调账本available，原claim9ec4dbc8 v2/18 ACTIVE且WT/branch/owner一致。Mika转达architecture_read于2026-10-07T03:36:55Z对source68815dce87cc0a9498802de89448693215d028d6 / packet1de74274791d55d9808056456379b038b430aa5f的SOURCE_AND_PREPARATION_REVIEW_APPROVED、0P1/P2：22bindings113299B、原case正文/main15847 donor、4库清理/aggregate/30outputs/有限selector及strict2→0/collect4已核。只批准准备，4PG仍NOT_RUN；原200s/13task/640HTTP/15理论连接、32MiBTMP/raw1MiB/floor1207959552B不变。实际配对local须按开启时完整预算另加；Mika声明当前X01 local预算9568256B仅为协调输入，不作为我fresh准入或OPEN。无新测试/PG/旧根访问；本次只写status/review，等待下一唯一namespace。

2026-10-07T03:42:50.732592+00:00 Mika授唯一heavy OPEN `S01P07-CAPACITY-20261007-R1`：Web Timing已03:41:04.044Z确认worker/Chrome/group/fixture/双EOF/目录清理归还。本次仅原4组/4serialDB/13task/640HTTP/15理论峰连接，200s/120work/70fixturecleanup、32MiBTMP/raw1MiB不变；保守配对本组单local9568256B+Web9437184B，fresh floor1226964992B。仅metadata固定clean执行HEAD后核原claim/source/22bindings/30SQL/24deps/30输出与组合空间，一次执行，未知不重试/不触旧根；actual结束即归还，不等封存。
