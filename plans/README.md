# Flow 计划索引

当前滚动入口见 [完整验收矩阵](flow-001-architecture/full-plan-matrix.md) 与各 owner status；下文按日期保留的批次记录是历史观察，不代表当前运行状态。2026-10-06 05:29 UTC：main `eb14991a` 已含 O05、O04、知识读取优化、聊天配置接入；K01/SVC02 已审并在共享入口集成，O06 与聊天队列 UI 正在实施。常驻中心/runner 仍为历史 `75a33`，尚未执行安全刷新。

本目录记录 Flow 的设计方向、技术验证和后续实施安排。使用和维护规则见 [AGENTS.md](AGENTS.md)。

## 当前计划

| 编号 | 计划 | 状态 | 用途 |
| --- | --- | --- | --- |
| FLOW-001 | [Flow 产品与技术架构计划](flow-001-architecture/plan.md) | `in-progress` | 汇总产品约束、候选 stack、模块边界、验证场景及分阶段落地路线 |
| FLOW-002 | [Provider 登录与 Harness 对比计划](flow-002-provider-harness/plan.md) | `in-progress` | Hermes / T3 Code / Paseo 源码复用、已有登录、原生 SDK 与 HarnessAgent 对照及证据 |
| FLOW-003 | [首轮执行与 Agent 分工计划](flow-003-m1-execution/plan.md) | `completed` | 个人自托管首版、Goal Owner / Execution Lead 职责、期望10槽/运行时实测容量、worktree/写入范围与端到端验收 |

## 当前进度

- 已将架构讨论、设计原则及常见协议支持要求整理成计划。
- PostgreSQL、Web UI、复用现有 harness、插件扩展和低上下文切换成本是用户明确提出的方向。
- 已确认前后端分离、正式 CLI、中心连接多个执行后端、前端断线后任务继续，以及各模块预留插件边界。
- 已确认聊天读取分层：上层保留正文和仅含 ID/title 的折叠引用，下层内容按展开加载；具体毫秒级性能预算仍待验证。
- 已确认需要支持 A2A 等常见协议；A2A/MCP 优先、ACP 接入及 AG-UI 展示适配的具体范围见计划第 5.3 节，协议版本和实现排期仍为建议。
- 已审查 Hermes、T3 Code、Paseo 的固定版本源码和许可证，记录登录、凭据归属、RPC 与常驻执行的可复用模块。
- 已使用本机已有登录运行原生 Claude、原生 Pi 与 HarnessAgent + Pi 的小任务和恢复接口冒烟；详细限制与结果见 FLOW-002。
- Claude HarnessAgent 本地容器与 bridge 依赖已准备，创建会话时登录解析器刷新返回 HTTP 400，尚无模型调用；失败证据与后续排查已记录。
- 已发现累计 usage 和资源发现控制差异，尚不能据此声称省 token、恢复可靠或支持 100+ 并发。
- 已确认首版优先个人自托管：一个中心连接本机或远端 runners；原生Claude候选已通过有界系统验证，生产最终选型未定；M1 调度选择 pg-boss，范围及短验证见 F00 记录。
- 已明确职责：Goal Owner（主 agent）负责用户沟通、总体目标、优先级协调和目标验收；Execution Lead（独立 Astra Ultra agent）负责架构、契约/骨架、client/CLI、工程检查、技术派工与集成，以及计划和索引维护。
- 用户期望总并发上限10（含Goal Owner和Execution Lead），所有ready独立任务尽量并行；当前运行时第5worker实测被拒绝，实际cap4，暂有两个执行workers。实际并行度取用户上限、运行时cap和ready任务数的最小值。用户已授权正式开工，F00 骨架、契约和调度短验证完成；后续从同一已提交契约基线在独立 worktrees 派发功能任务。
- F00 已建立工程 workspace、公共契约与薄 client，完成 PostgreSQL/pg-boss 短验证；中心、runner、CLI/Web均已接收，真实整浏览器退出的系统旅程与93/93检查通过；独立review和main集成已完成。

用户已授权长期持续推进 Flow，完整 FLOW-001/002 是必须满足的基线，M1已完成只是基础，原计划完成后仍依据收益与证据迭代。[完整验收矩阵](flow-001-architecture/full-plan-matrix.md)逐项保留要求、证据和缺口；C02/P01/M02已实际启动，完成后验收/集成并领取下一ready项。不得停在单批次或降低验收。

逐 stack 的技能发现与 clean-code 固定来源、应用记录见 [技能与质量基线](../docs/quality/skills.md)。

## 活跃实施子计划

每行有唯一plan正文以及同目录状态、review；旧日期文件仅作跳转，不再维护副本。

| 编号 | 计划 | 状态 | 独立状态 / review |
| --- | --- | --- | --- |
| C01 | [中心](c01-control-plane/plan.md) | `completed`（M1已验收） | [status](c01-control-plane/status.md) / [review](c01-control-plane/review.md) |
| R01 | [Runner](r01-runner/plan.md) | `completed`（M1已验收） | [status](r01-runner/status.md) / [review](r01-runner/review.md) |
| L01 | [CLI](l01-cli/plan.md) | `completed`（M1已验收） | [status](l01-cli/status.md) / [review](l01-cli/review.md) |
| W01 | [Web与双主题](w01-web/plan.md) | `completed` | [status](w01-web/status.md) / [review](w01-web/review.md) |
| D01 | [工程执行 dashboard](d01-execution-dashboard/plan.md) | `completed` | [status](d01-execution-dashboard/status.md) / [review](d01-execution-dashboard/review.md) |
| I01 | [M1集成验收](i01-integration/plan.md) | `completed` | [status](i01-integration/status.md) / [review](i01-integration/review.md) |
| OPS-001 | [计划状态与review规范](ops-001-status-review/plan.md) | `completed` | [status](ops-001-status-review/status.md) / [review](ops-001-status-review/review.md) |

总计划状态：[FLOW-001](flow-001-architecture/status.md) / [FLOW-002](flow-002-provider-harness/status.md) / [FLOW-003](flow-003-m1-execution/status.md)。

总计划审查：[FLOW-001](flow-001-architecture/review.md) / [FLOW-002](flow-002-provider-harness/review.md) / [FLOW-003](flow-003-m1-execution/review.md)。

新计划从 [plan模板](templates/plan.md)、[status模板](templates/status.md)、[review模板](templates/review.md) 建立。每个owner更新自己的status，Execution Lead维护跨任务汇总。

W01与D01外部成果已接收，分别为b04df958与6783562；权威owner工作树已核验clean，不再等待派发。

W01与D01由用户外部执行分队完成，原冻结基线eacee76保留；[共同交接与独占范围](../docs/handoffs/external-web-dashboard.md)。

M1最终独立APPROVED target `da7ce435e03e7abad1227353e473a35a6e9b1349`；[真实Web与native系统证据](../docs/evidence/i01/m1-system.md)。整合typecheck/93测试/Webbuild已通过；main和origin/main已于01:46 UTC集成14fea3d；最新metadata HEAD另由Git核验。

| 新增任务 | 状态 | 权威资料 |
| --- | --- | --- |
| R02 原生adapter | completed（branch） | [plan](r02-native-harness/plan.md) / [status](r02-native-harness/status.md) / [review](r02-native-harness/review.md) |
| LAB01 两个性能toy | completed（branch） | [plan](lab01-performance/plan.md) / [status](lab01-performance/status.md) / [review](lab01-performance/review.md) |
| D02 dashboard来源同步 | completed（branch） | [plan](d02-progress-sync/plan.md) / [status](d02-progress-sync/status.md) / [review](d02-progress-sync/review.md) |
| LAB02 observer短诊断 | completed（branch） | [plan](lab02-observer-probes/plan.md) / [status](lab02-observer-probes/status.md) / [review](lab02-observer-probes/review.md)；独立方法review通过 |

[工程/管理质量台账](../docs/quality/architecture-health-2026-10-06.md)记录后续P2。M1是持久执行基础；M2优先统一跨任务解释/决策入口，不把目前task页当最终心流体验。

## 当前完整目标批次（2026-10-06 02:32 UTC）

| 任务 | 实际状态 | 唯一owner工作树/状态 |
| --- | --- | --- |
| C02 核对恢复 | completed；独立审查后已集成 | `Flow-worktrees/m2-reconciliation/plans/c02-reconciliation/status.md`；runner_owner |
| P01 协议接入 | SDK首段已审；durable出站后继open | `Flow-worktrees/protocol-adapters/plans/p01-protocols/status.md`；assignment_review |
| M02 统一工作入口/公共契约 | backend/CLI片段已完成并集成；Web由WPF-M02交付 | `Flow-worktrees/m2-workspace/plans/m02-unified-workspace/status.md`；Execution Lead |
| D03 高层进度与metadata语义 | 已审并集成，4320已更新 | `Flow-worktrees/dashboard-human-view/plans/d03-dashboard-human/status.md`；runner_owner |

上表新feature正文在其权威worktree，集成后补本仓库相对链接；不复制未合入副本制造第二状态源。

[Web平台管理 WPF-001](web-platform/plan.md) 已接收至3493088文档快照，权威外部owner后续变化按实际commit接收；其子项不与主线P01/D03重复派发。M02后端与CLI已进入main8c57f2f；真实统一Web入口由外部WPF-M02独占实现。I02集成状态见[plan](i02-integration/plan.md)/[status](i02-integration/status.md)/[review](i02-integration/review.md)。

## 当前协调片段

[D04 多 Lead 领取](d04-coordination/plan.md) 已完成并部署；[status](d04-coordination/status.md) / [review](d04-coordination/review.md)。G01 首图命令、P02 Task-based A2A 持久出站、F01共享 client/CLI/生产入口和WPF-M02统一Web已分别审查，在I02接收集成。O01目标命令和E01零模型上游probe滚动推进；自然语言完整交付/插件生命周期/容量仍未完成。

新增唯一source O01：`Flow-worktrees/goal-orchestration/plans/o01-goal-orchestration/`；WPF-PERF01：`Flow-worktrees/web-performance/plans/wpf-perf01-web-performance/`。二者已收到committed claim；各Lead可对无冲突ready scope自助take，进度仍只维护owner status。registry共30来源，数量为本次登记事实而非每份plan均已完成。

[D05架构视图](d05-architecture-view/plan.md) 已独立审查、集成并部署4320；五视图依据固定main3773db5，独立status/review与领取记录。产品预览49922明确为已审M02 HTTP fixture，不称main生产服务。

[X01完整插件管理计划](x01-plugin-management/plan.md) 已按c21731c独立文档审查通过；[status](x01-plugin-management/status.md) / [review](x01-plugin-management/review.md)。产品生命周期、npm宿主与隔离仍待实施，Web trusted host不等于完整插件管理。

R03远端租约和CHAT01持久对话已领取并在独立owner树实施，当前registry新增唯一来源；尚未集成的正文以登记owner树为准。普通自然对话与目标编排分别验收，fixture回复不代表模型对话。

2026-10-06 04:43 UTC：新增独立来源 [CTX01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-kernel-probe/plans/ctx01-context-kernel/plan.md)（实验owner树 context-kernel-probe，main未收正文时看dashboard只读源）与 [WPF-PROFILE01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-execution-profiles/plans/wpf-profile01-execution-profiles/plan.md)（web-execution-profiles）；领取已确认，登记不代表完成。

2026-10-06 05:17 UTC：新增唯一来源 K01（项目知识原文与检索）、WPF-PROFILEUX01（聊天配置摘要优化）、SVC02（真实预览安全更新）；各自已领取且三件套存在。权威目录分别为 `Flow-worktrees/knowledge-source-store/plans/k01-knowledge-sources`、`web-execution-profile-summary/plans/wpf-profileux-execution-summary`、`preview-refresh/plans/svc02-preview-refresh`；当前均实施中。登记不代表当前常驻中心已更新。

2026-10-06 05:29 UTC：O06 唯一来源为 `Flow-worktrees/goal-graph-runs/plans/o06-goal-graph-runs`；WPF-QUEUE01 为 `web-conversation-queue/plans/wpf-queue01-ui`。D06 沿原 task/plan/evidence 迁移权威工作树至 `dashboard-architecture-current`，旧 `dashboard-architecture-refresh` 只读保留历史；当前基线固定 `eb14991a`，本轮未批准/未集成。registry 总计65来源，数量不是完成率。

2026-10-06 05:45 UTC：K02 聊天固定知识引用与 O07 原生目标拆分工具已各自领取独立范围，唯一工作源已登记。K02权威工作树 `conversation-context`、计划 `plans/k02-conversation-context`；O07权威工作树 `native-graph-tools`、计划 `plans/o07-native-graph-tools`。两领域未实现批准，不将接口/stub当功能。SVC02真实预览已升级fb906cb/v3接受，后续main前进不等于再次部署。

- WPF-CHAT06S01：聊天逐段正文读取；唯一source `web-conversation-stream/plans/wpf-chat06-stream`，已登记领取/实施，App挂载后继。

- CHAT08：原生对话中的补充指令；唯一source `native-active-steering/plans/chat08-native-active-steering`，仍0provider实施。
- CHAT06P01：流式正文存储成本测量；唯一source `assistant-stream-cost-probe/plans/chat06-stream-cost`，方法准备，真实测量待协调窗口。

- WPF-PERF03：聊天消息复用；唯一source `web-message-reuse/plans/wpf-perf03-message-reuse`，不变消息转换优化实施，不声称浏览器延迟收益。

- WPF-CONTEXT01：聊天知识引用选择；唯一 source `web-knowledge-selection/plans/wpf-context01-knowledge-selection`。独立选择模块已领取，实际 Send/Queue 接线仍后继；登记不代表功能完成。
