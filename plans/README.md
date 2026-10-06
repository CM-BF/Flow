# Flow 计划索引

本目录记录 Flow 的设计方向、技术验证和后续实施安排。使用和维护规则见 [AGENTS.md](AGENTS.md)。

## 当前计划

| 编号 | 计划 | 状态 | 用途 |
| --- | --- | --- | --- |
| FLOW-001 | [Flow 产品与技术架构计划](2026-10-05-flow-architecture-plan.md) | `proposed` | 汇总产品约束、候选 stack、模块边界、验证场景及分阶段落地路线 |
| FLOW-002 | [Provider 登录与 Harness 对比计划](2026-10-05-provider-auth-harness-evaluation-plan.md) | `in-progress` | Hermes / T3 Code / Paseo 源码复用、已有登录、原生 SDK 与 HarnessAgent 对照及证据 |
| FLOW-003 | [首轮执行与 Agent 分工计划](2026-10-05-execution-assignment-plan.md) | `in-progress` | 个人自托管首版、Goal Owner / Execution Lead 职责、四槽滚动派工、worktree/写入范围与端到端验收 |

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
- 已确认首版优先个人自托管：一个中心连接本机或远端 runners；harness 接入路线和调度选型仍未最终确定。
- 已明确职责：Goal Owner（主 agent）负责用户沟通、总体目标、优先级协调和目标验收；Execution Lead（独立 Astra Ultra agent）负责架构、契约/骨架、client/CLI、工程检查、技术派工与集成，以及计划和索引维护。
- 首轮总并发为 Goal Owner + Execution Lead + 最多两个执行子 agents；中心、runner 和 Web 各有 feature owner，依赖与空闲执行位决定滚动顺序。用户已授权正式开工，F00 技能与规则准备开始；后续从同一已提交契约基线在独立 worktrees 派发功能任务。
- 尚未初始化 Flow 应用。依赖安装与模型调用仅用于隔离选型实验，未接入正式中心、数据库或前端。

本轮按用户授权从 FLOW-003 的 F00 持续推进至 M1：由 Execution Lead 先固定最小公共契约、调度与 runner 失联语义，再按最多两个执行子 agents 滚动推进中心、runner 和 Web。FLOW-002 的后续选型验证另行记录，不阻塞确定性执行闭环；系统级要求以 FLOW-001 为准。

逐 stack 的技能发现与 clean-code 固定来源、应用记录见 [技能与质量基线](../docs/quality/skills.md)。
