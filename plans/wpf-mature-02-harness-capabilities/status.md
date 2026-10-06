# WPF-MATURE-02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 12:58:08 UTC / 2026-10-06 12:15:20 UTC（main362af3 R06五源已核） |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-02](plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities |
| Branch | codex/claude-codex-capabilities |
| 工作基线 / HEAD | 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7；受控main41315b / e47df6a78e3ed627a726dae805f84903a33e0a9d（已审C收口；本次Node设计metadata HEAD由Git核） |
| 工作树dirty状态 | 源码d17ad56a已提交，当前只准备input/manifest/archive和review metadata；交审前核clean。R06/peer/preload及旧raw未改。 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | 最终55/55原纯检查+清理delta6/6（2新，51未选）（39新+16直接旧）与Node24 native惰性import0；0实际目标/listener/compile/PG/provider。中间语法失败原样保留，固定source/完整manifest正在收口。 |
| 已集成main状态 / HEAD | 目录本片delivered：main21e0a56c4b2b65a04a1e8d510a9d132e77c3894b，4源=c9/测试=a761已逐blob核；未重新merge本树。R06五源077已由main362af3bac77541e5a60979326bcf4d4b8c947915接收；薄consumer仍待集成确认；不代表个人服务部署 |
| 实现目标 | Node source d17ad56ad47ec065cea107ba4ab15fc7afd56b0e；组合packet正在固定，实际NOT_OPEN |
| 实现范围 | 新node-rootliteral实验；diagnostics/run-diagnostics.mjs导出/计量私有helper；isolation/compose-canary.mjs固定场景/资源清理接缝；本计划与证据 |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | Node三步实现与纯检查已完成，正在固定输入与资源预算；尚未启动真实目标。 |
| 下一可用交付 | 固定Node实现、零目标行为检查与完整输入包，交独立审查后等待唯一运行门禁。 |
| 当前阻塞 | ACTIVE: Node/Codex完整隔离、真实模型资格与全部writer停止仍未验证；C成功不能替代。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：Mika于12:37:56 UTC批准ff927712设计；宿主固定loader窄适配获准。Node源码固定待组合独审，实际窗口NOT_OPEN。 |
| 已审语义片段 | 0d0524c3439363d1fe60aad63f62817ba51fa2a5，历史27/27且独审APPROVED；旧manifest/raw不变，final算法副本现由薄入口替代 |
| 架构影响 | Node复用已交回R06唯一进程owner、旧owned canary与私有sink；新增仅实验接缝，未改变生产Interface/运行生命周期。ENG当前仅资格/撤销输入建议，无新公共合同。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-02-01 | completed | chatui01_owner | [领取回执](../../docs/evidence/wpf-mature-02/take-receipt.json)，固定基线/计划/来源登记 |
| WPF-MATURE-02-02 | completed | chatui01_owner | [manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)，27/27本地行为检查；status_read独审APPROVED；未集成 |
| WPF-MATURE-02-03 | in-progress | chatui01_owner | C rootliteral固定测量已审；[Node三槽小接口](../../docs/evidence/wpf-mature-02/node-rootliteral/design.md)设计已审、实现待组合审，0新运行；实际catalog仍未验证，旧窗口不恢复。 |
| WPF-MATURE-02-04 | in-progress | chatui01_owner | 已接入独审通过的生产投影，薄入口27/27且独审APPROVED，待集成；[原生配置目录设计](../../docs/evidence/wpf-mature-02/native-catalog-seam.md)已实现首个目录合同/reader/routes并局部验证，c9c6e891已独审APPROVED；client/Web与共享能力全链路尚未完成 |
| WPF-MATURE-02-05 | pending | d01（Web子任务owner） | 按本大task接口独立交付，尚未获得本task跨端验收证据 |
| WPF-MATURE-02-06 | pending | chatui01_owner | 真实续接/账号/取消恢复未验收 |
| WPF-MATURE-02-07 | in-progress | chatui01_owner | 纯语义固定target已独审通过，待集成；后继隔离片另审 |
| WPF-MATURE-02-08 | pending | chatui01_owner | 完整目标未验收 |
| WPF-MATURE-02-09 | pending | R05共享owner / d01 | 下一条配置可变与历史/当前/队列冻结分离；CAS/未知ACK/恢复/跨harness，04测量失效，见唯一interface |

## 跨lead接口与handoff

唯一接口请求：[interface](../../docs/evidence/wpf-mature-02/interface.md)。R05共享host/main/config/contracts及生产transport/adapter apps/runner/src/codex由ExecutionLead/assignment_review及其runner worker维护；R06 runner_owner独占transport与进程生命周期；本owner仅固定schema/模型事实与已解码实验conformance，Web d01挂本bigplan。claim v5保留实验/证据/计划与四个目录合同/领域文件；store.ts与R06五源均已停写并部分交回。当前[COMMITTED receipt](../../docs/evidence/wpf-mature-02/r06-source-handback-receipt.json)明确七个保留scope；client/index不在范围。

## Dashboard同步与限制

本status是唯一手填事实源。已只读核main1737cd6a5c8bbb1d5793325ee924802bfbe2a2e9 registry将本task映射到此权威树/status；这不证明4320服务已刷新。claim 0dd97484-f0ce-4738-8075-505bd5e2541a v5 ACTIVE（amend 12:15:20.438 UTC，仅再移除R06五源）；无真实app-server/auth/模型/外部网络执行；唯一自有loopback合成运行见下段。目录schema不是账号或模型可用证明；首片不替代整体目标。

## 固定证据与边界

历史源/结果/审批以[review索引](review.md)及[canonical](../../docs/evidence/wpf-mature-02/interface.md)为准。原语义27、薄consumer27与目录33+1均独立绑定；R06五源19纯检查已main接收/交回，不重跑。旧隔离/C失败窗口封存，rootliteral4757/e47仅C测量PASS，不能替代Node或实际Codex资格。旧archive快照按原Git解释，当前metadata不冒称其hash未变。

完整02仍缺真实隔离catalog、模型/设置端到端、账号/续接/恢复及用户验收。目录configured/not-probed、源码字段/可注入Interface均不证明entitlement、实际fast/model/access或全部writer停止。未知阻native promote，不阻0模型fixture/checker/snapshot。架构影响只实验固定组合；生产seam/main边界由Lead同步工程架构，个人服务部署未知。

方法沿本地find-skills/brainstorming/codebase-design/用户固定clean-code sickn33@bdacd76，详[质量记录](../../docs/evidence/wpf-mature-02/node-rootliteral/quality.md)。不重复安装/测试；本status唯一手填进度，当前摘要不复制别task状态。04 producer eccb本owner只读独审已收口，权威后继由04维护。

## 当前Node准备阶段

[设计与实现合同](../../docs/evidence/wpf-mature-02/node-rootliteral/design.md)及[只读来源](../../docs/evidence/wpf-mature-02/node-rootliteral/source-check.md)。设计ff927712已审，当前实现待组合独审；claim v5 fresh ACTIVE七scope。58 distinct纯检查（55原+2清理+1outer预算，非全量重跑）/native惰性加载通过，不等于实际Node隔离。宿主使用固定Node24 transform与六模块resolver；目标env不继承loader。控制close.reason必须DISCONNECTED，canary必须CLOSED，协议异常/额外输出使stdoutBoundConfirmed=false。外层time+UTC与内部时点分开；无新actual OPEN。旧C归档仍是e47等历史快照，新工作不冒称其hash或运行时间仍当前。
