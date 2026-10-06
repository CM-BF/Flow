# Flow 计划索引

本目录记录 Flow 的设计方向、技术验证和后续实施安排。使用和维护规则见 [AGENTS.md](AGENTS.md)。

## 当前计划

| 编号 | 计划 | 状态 | 用途 |
| --- | --- | --- | --- |
| FLOW-001 | [Flow 产品与技术架构计划](flow-001-architecture/plan.md) | `proposed` | 汇总产品约束、候选 stack、模块边界、验证场景及分阶段落地路线 |
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

本轮按用户授权从 FLOW-003 的 F00 持续推进至 M1：由 Execution Lead 先固定最小公共契约、调度与 runner 失联语义，再按实际可用执行位推进中心、runner 和 Web，容量允许即并行。FLOW-002 的后续选型验证另行记录，不阻塞确定性执行闭环；系统级要求以 FLOW-001 为准。

逐 stack 的技能发现与 clean-code 固定来源、应用记录见 [技能与质量基线](../docs/quality/skills.md)。

## 活跃实施子计划

每行有唯一plan正文以及同目录状态、review；旧日期文件仅作跳转，不再维护副本。

| 编号 | 计划 | 状态 | 独立状态 / review |
| --- | --- | --- | --- |
| C01 | [中心](c01-control-plane/plan.md) | `in-progress` | [status](c01-control-plane/status.md) / [review](c01-control-plane/review.md) |
| R01 | [Runner](r01-runner/plan.md) | `in-progress` | [status](r01-runner/status.md) / [review](r01-runner/review.md) |
| L01 | [CLI](l01-cli/plan.md) | `in-progress` | [status](l01-cli/status.md) / [review](l01-cli/review.md) |
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
