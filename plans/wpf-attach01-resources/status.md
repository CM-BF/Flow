# WPF-ATTACH01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 10:22:19 UTC |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 所属大task | [WPF-MATURE-03](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-03-attachments/plan.md) |
| co-lead | Web /root |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 文本附件合同与旧客户端兼容用例已实现，47项局部检查通过 |
| 下一可用交付 | 完成小合同独立审查与公共发布，再实现中心上传及固定材料保留 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/attachment-resources |
| Branch | codex/attachment-resources |
| 工作基线 / HEAD | f181d84b5fb3652d62e2a181acff442d42b3e066 / 当前Git聚合 |
| 工作树dirty状态 | 实现已固定提交，当前仅自有metadata收口；最终dirty以Git为准 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | PASSED 311a932f6bef0efe81367569da00c13bf3bf6ac8；作者39合同/legacy兼容+8旧receipt=47/47，根typecheck exit0；[验证](../../docs/evidence/wpf-attach01/validation.md) |
| 已集成main状态 / HEAD | NOT_INTEGRATED |
| 实现目标 | 311a932f6bef0efe81367569da00c13bf3bf6ac8 |
| 实现范围 | packages/contracts/src/attachments.ts, packages/contracts/src/conversation-context.ts, packages/contracts/src/attachments.test.ts |
| Review | [review.md](review.md)，NOT_STARTED |
| D04 claim | ef617d78-eb39-484e-898e-5f057fca50d4 v1 active，2026-10-06T10:06:48.197Z COMMITTED；五scope |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-ATTACH01-01 | in-progress | workspace_panels_owner | [Interface](../../docs/evidence/wpf-attach01/interface.md)、[take](../../docs/evidence/wpf-attach01/take-receipt.json) |
| WPF-ATTACH01-02 | pending | workspace_panels_owner | 后继运行域须exact amend，当前无路由/DB实现 |
| WPF-ATTACH01-03 | pending | workspace_panels_owner | 后继PG/HTTP验收，当前无真实中心/provider证据 |
| WPF-ATTACH01-04 | pending | workspace_panels_owner | phase1固定候选待独审；完整运行域/main接收仍pending |

架构影响：phase1新增typed附件合同与context v2可选分支，旧v1wire不变；未修改生产mount或capability；架构快照更新登记待runtime target/主线接收。后继新增资源与context原子绑定会登记架构更新。唯一source交管理集中登记，未声称dashboard已部署。既有所有预览与个人服务保持不动。

## Handoff

固定phase1实现 311a932f6bef0efe81367569da00c13bf3bf6ac8，base f181d84b5fb3652d62e2a181acff442d42b3e066。三源与14个只读依赖hash见[final-checks](../../docs/evidence/wpf-attach01/additive-checks.json)，真实检查源为196cee3+dirty，非事后SHA执行。47项包含真实旧Web投影/queue/client + mock fetch；不是HTTPserver/浏览器/PG或provider验收。

Root兼容裁决：仅请求非空attachments→v2；无附件/[]或原v1 replay永远v1；新client向旧center纯文字必须完全省略attachments。旧loaded Web可读正文/队列但不展示附件；不加Accept/header或GET阻断。runtime与新Web共享decoder仍后继接入。F01已移出conversations.ts、026已预留，但当前五scope未amend，均不写。
