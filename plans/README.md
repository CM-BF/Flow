# Flow 计划索引

本目录记录 Flow 的设计方向、技术验证和后续实施安排。使用和维护规则见 [AGENTS.md](AGENTS.md)。

## 当前计划

| 编号 | 计划 | 状态 | 用途 |
| --- | --- | --- | --- |
| FLOW-001 | [Flow 产品与技术架构计划](2026-10-05-flow-architecture-plan.md) | `proposed` | 汇总产品约束、候选 stack、模块边界、验证场景及分阶段落地路线 |
| FLOW-002 | [Provider 登录与 Harness 对比计划](2026-10-05-provider-auth-harness-evaluation-plan.md) | `in-progress` | Hermes / T3 Code / Paseo 源码复用、已有登录、原生 SDK 与 HarnessAgent 对照及证据 |

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
- 部署优先级、harness 接入路线和调度选型仍未最终确定；原生 Claude / Pi 与相应 AI SDK 适配层均保留。
- 尚未初始化 Flow 应用。依赖安装与模型调用仅用于隔离选型实验，未接入正式中心、数据库或前端。

下一步按 FLOW-002 完成关键接入与恢复验证，再选择首个生产 adapter；系统级验收继续参考 FLOW-001。后续独立子项目在本索引登记，并链接到父计划。
