# S01P07 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-07T03:20:18Z |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 现有领取receipt仅证明领取；未用其时间推定首次实际开工。原验收尚未完成，诊断修复段时间见inventory-diagnostic-fix.md，不代替task完成时间。 |
| Plan | [plan.md](plan.md) |
| 所属大task | [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | mika |
| 单一status owner / model | status_read / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-claim-recovery |
| Branch | codex/runner-claim-recovery |
| 工作基线 / HEAD | 基线22a0806bc2465e11096949618113833f31766b19；8产品源83a0799293057f7472f0329c61e566708b2a2381；诊断已审e3b9a3d5b354b75baaabac9da12a691bb5d54514；R1历史execution HEAD 03d5543cebffeffa53924addd331e65d764586ce；新窗口execution HEAD尚未指定 |
| 工作树dirty状态 | 本段开始e3b9a3d5b354b75baaabac9da12a691bb5d54514 clean；仅有限输入selector与新绑定/自有metadata，产品/fixture/旧输入和raw冻结 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | 历史85 distinct non-PG、focused strict5 exit0、3 wrapper fake均未重跑。新增诊断4项fake单次4/4 / exit0另列；R1 PG窗口已消费且0条case结果，不记通过或8 skipped。原4组capacity PG单列NOT_RUN |
| 已集成main状态 / HEAD | NOT_INTEGRATED；基线为已供给固定 main 22a0806bc2465e11096949618113833f31766b19 |
| 实现目标 | 83a0799293057f7472f0329c61e566708b2a2381（8产品源；PG未验） |
| 实现范围 | apps/server/src/runners.ts, apps/server/src/runner-claim-receipts.ts, apps/server/src/index.ts, apps/runner/src/admission-journal.ts, apps/runner/src/runtime.ts, packages/contracts/src/runner-claim.ts, packages/contracts/src/index.ts, packages/client/src/index.ts |
| 阶段 | M2 |
| 优先级 | 3 |
| 任务层级 | 子task |
| 当前产出 | 首次失败证据、有限首错诊断和新输入绑定均已独审通过；原8组中心事务验收获得一次新窗口。 |
| 下一可用交付 | 在R2实际窗口核对输入和资源后执行原8组，交付真实结果与清理事实。 |
| 当前阻塞 | NONE: R2已由Mika明确OPEN，实际spawn仍需fresh门槛；R1原因UNKNOWN且旧目录KEEP，不影响原片继续受控验证。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：原产品SOURCE_REVIEW APPROVED，R1 RESULT_FIDELITY_APPROVED；e3b9诊断与0a753输入绑定均已独审通过，整体VALIDATION_PENDING |
| 领取 | [COMMITTED amend](../../docs/evidence/s01p07/claim-amend.json)：9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac v2 / 18 literal |

| TODO ID | 状态 | Owner | 证据 / 检查 |
| --- | --- | --- | --- |
| S01P07-01 | completed | status_read | [接口](../../docs/evidence/s01p07/interface.md)；协议/职责与直接消费者范围已固定 |
| S01P07-02 | in-progress | status_read | contract/client/route/中心事务源码已固定，非PG合同/客户端通过，PG待窗 |
| S01P07-03 | in-progress | status_read | v2 journal/runtime 已接线，新恢复及旧peer直接消费者85不同检查分批通过 |
| S01P07-04 | in-progress | status_read | [checks](../../docs/evidence/s01p07/checks)：85通过分批与strict0保留；[R1原件](../../docs/evidence/s01p07/pg-run-r1-manifest.json)为fixture证据前中止，未得PG行为结果；0provider |
| S01P07-05 | pending | status_read | 源审0P1/P2 / PG行为验证未完成 / NOT_INTEGRATED |

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
