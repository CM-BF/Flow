# WPF-CHAT01 准备状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 03:25 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | d01_owner（准备管理）/ gpt-6-astra ultra |
| Worktree / Branch | web-platform-management / codex/web-platform-management；仅准备文档 |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | U11完整能力与分阶段验收已落盘；原w01_owner只读调查共享缺口 |
| 下一可用交付 | 已支持/缺失接口表与主线唯一owner/最小合同；Web独立领取方案 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | UNKNOWN |
| 实现范围 | UNKNOWN |
| 检查状态 | NOT_RUN（真实对话实现）；准备文档另查 |
| Review | [review.md](review.md)，NOT_STARTED |
| main集成状态 | 未实施/未集成 |

| TODO ID | 状态 | Owner | 证据/依赖 |
| --- | --- | --- | --- |
| WPF-CHAT01-01 | in-progress | d01_owner管理 / w01_owner只读 / MainLead共享安排 | root已转交优先需求，父REQ41～45已持久化；接口调查中，尚未分配共享writer |
| WPF-CHAT01-02 | pending | 待独立claim owner | 需中心conversation/turn/run/消息与发送语义；不把fixture或每次newtask当持续对话 |
| WPF-CHAT01-03 | pending | 共享catalog与Web各唯一owner待定 | capabilities/模型/effort/授权资源真实接口尚待核验 |
| WPF-CHAT01-04 | pending | 共享轻引用投影与Web各owner待定 | 需首屏/SSE payload与detail授权检查 |
| WPF-CHAT01-05 | pending | 中心/runner持久命令与Web各owner待定 | 队列/steer受理与实际生效契约待明确 |
| WPF-CHAT01-06 | pending | 待实际支持能力与owner | 不调用付费语音服务，未实施不冒充可用 |
| WPF-CHAT01-07 | pending | 独立reviewer/Lead | 无实现target，无独立产品review |

49922保持原用户tab/固定HTTP fixture服务；I01已有55049开发收尾继续，不抢其活跃App scope。PERF02只准备暂停、没有amend/take/新tree。本nested准备计划经父WPF-001下钻，不登记第二实施源；正式接收owner落平级canonical后本目录转stub。
