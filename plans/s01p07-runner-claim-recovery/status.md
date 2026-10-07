# S01P07 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-07 02:49:24 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | mika |
| 单一status owner / model | status_read / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-claim-recovery |
| Branch | codex/runner-claim-recovery |
| 工作基线 / HEAD | 基线22a0806bc2465e11096949618113833f31766b19；8产品源83a0799293057f7472f0329c61e566708b2a2381；PG准备ac3b8532fb23a9c8549c0b32e225a31327bc85f9；本次只读核对HEAD 31ece087e01c3691aaa883072ea20d7d39805a90 |
| 工作树dirty状态 | 本次更新前HEAD 31ece087 clean；本次仅恢复准入metadata，产品/PG输入冻结 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 检查状态 | 85 distinct non-PG分批通过；focused strict5 exit0（含最终PG fixture静态类型）；外层3纯fake另列。原CLI/UUID/types失败原样保留；新8组PG NOT_OPEN / NOT_RUN，原4组capacity PG单列NOT_RUN；本次0测试 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；基线为已供给固定 main 22a0806bc2465e11096949618113833f31766b19 |
| 实现目标 | 83a0799293057f7472f0329c61e566708b2a2381（8产品源；PG未验） |
| 实现范围 | apps/server/src/runners.ts, apps/server/src/runner-claim-receipts.ts, apps/server/src/index.ts, apps/runner/src/admission-journal.ts, apps/runner/src/runtime.ts, packages/contracts/src/runner-claim.ts, packages/contracts/src/index.ts, packages/client/src/index.ts |
| 阶段 | M2 |
| 优先级 | 3 |
| 任务层级 | 子task |
| 当前产出 | 空闲复用领取身份与丢响应恢复的非数据库检查已通过；中心事务验证的固定源码、依赖和动态迁移已重新核齐。 |
| 下一可用交付 | 完成中心事务专库验证，随后补必要容量消费者验收并交独审、推进主线。 |
| 当前阻塞 | 实现与依赖供应NONE；heavy已归还且无其他预约，仅待本片唯一运行namespace与OPEN、实际local配对预算确认。原4组容量PG仍另列未运行。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，SOURCE_REVIEW APPROVED / VALIDATION_PENDING |
| 领取 | [COMMITTED amend](../../docs/evidence/s01p07/claim-amend.json)：9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac v2 / 18 literal |

| TODO ID | 状态 | Owner | 证据 / 检查 |
| --- | --- | --- | --- |
| S01P07-01 | completed | status_read | [接口](../../docs/evidence/s01p07/interface.md)；协议/职责与直接消费者范围已固定 |
| S01P07-02 | in-progress | status_read | contract/client/route/中心事务源码已固定，非PG合同/客户端通过，PG待窗 |
| S01P07-03 | in-progress | status_read | v2 journal/runtime 已接线，新恢复及旧peer直接消费者85不同检查分批通过 |
| S01P07-04 | in-progress | status_read | [checks](../../docs/evidence/s01p07/checks)：85通过分批；CLI1、UUID2仅定向修后补验；strict修后0，原3类失败保留；0PG/provider |
| S01P07-05 | pending | status_read | 源审0P1/P2 / PG待窗 / NOT_INTEGRATED |

## 架构与登记

计划改变 runner admission 协议、受权自身份和本地日志格式；沿现单 admission loop 与中心 runner→task→attempt 锁序，无新 scheduler。架构视图目标待固定实现；登记与 main 集成由 Lead 负责。

唯一事实源为本 status；Lead 已登记本 WT/branch/plan 路径，尚未核实际聚合。原 S01 实验 claim/结果独立保留，不沿用其 approval 或 main 事实。已接收33源186913B并逐hash核符；24 ignored dependency links已核固定版本，4 @flow仅本WT；0install。原固定基线输入与本 owner 修改分开记录。

CHAT05P01 的[只读接口对照与交接边界](../../docs/evidence/s01p07/chat05p01-interface-handoff.md)已可用；当前没有 writer 移交、release 或 amend。发布入口仍由 runtime 与既有 AttemptControl/EventOutbox 持有，新增协议能力须显式协商。S01P07 v2/18 literal 占用与固定 PG 输入保持不变；此管理观察不表示产品接线或 main 集成完成。

同一接口记录已补“后继聚合资源验收 / 未实现未测”：聚合预算、历史恢复扫描及清理门禁为后继输入，不扩大本片实现或原计划验收。Lead 22:31:37 UTC 的低空间类型 NOT_RUN / NO_HOLDER 仅作历史来源事实，本轮0采样、0检查、0新负载。

2026-10-07 [PG恢复准入](../../docs/evidence/s01p07/pg-window-resumption.md)：fresh claim v2/18 ACTIVE；65固定绑定、30动态SQL、24依赖与231份既有源码闭包无缺失/漂移。原heavy启动线保持，单个有界local若配对则另计完整新增预算；不以旧串行文案默许并跑。此次仅静态核对与一次空间观察，0工程测试/PG/provider，原85非PG、strict5和3fake不重跑。
