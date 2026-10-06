# WPF-ATTACH01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 10:50:41 UTC |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 所属大task | [WPF-MATURE-03](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-03-attachments/plan.md) |
| co-lead | Web /root |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 文本附件的中心保存、恢复和固定材料执行已通过独立审查 |
| 下一可用交付 | 将已审附件模块接入公共客户端与正式中心，再接聊天上传 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/attachment-resources |
| Branch | codex/attachment-resources |
| 工作基线 / HEAD | f181d84b5fb3652d62e2a181acff442d42b3e066 / 当前Git聚合 |
| 工作树dirty状态 | 实现已固定8701a6；本次仅metadata收口，提交后clean，实际Git聚合为准 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | integration |
| 检查状态 | PASSED 8701a6cf547248e70aa5758f05da1d7d314ae9c0；78直接检查（29PGHTTP+49合同/legacy），根types0，3DB清零；原执行339086+dirty见runtime-checks |
| 已集成main状态 / HEAD | NOT_INTEGRATED |
| 实现目标 | 8701a6cf547248e70aa5758f05da1d7d314ae9c0 |
| 实现范围 | apps/server/src/attachments/attachments.test.ts, apps/server/src/attachments/context.test.ts, apps/server/src/attachments/fixture.ts, apps/server/src/attachments/index.ts, apps/server/src/attachments/storage.ts, apps/server/src/conversation-context/store.ts, apps/server/src/conversation-queue/commands.ts, apps/server/src/conversations/commands.ts, apps/server/src/conversations/queries.ts, apps/server/src/conversations/state.ts, packages/contracts/src/attachments.test.ts, packages/contracts/src/attachments.ts, packages/contracts/src/conversation-context.ts, packages/contracts/src/conversation-queue.ts, packages/contracts/src/conversations.ts, packages/storage/migrations/026-attachment-resources.sql |
| Review | [review.md](review.md)，runtime固定target APPROVED，root 10:49:15 UTC；phase1 APPROVED另保留 |
| D04 claim | ef617d78-eb39-484e-898e-5f057fca50d4 v2 active，2026-10-06T10:28:42.374Z COMMITTED；十八scope |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-ATTACH01-01 | completed | workspace_panels_owner | [Interface](../../docs/evidence/wpf-attach01/interface.md)、[take](../../docs/evidence/wpf-attach01/take-receipt.json) |
| WPF-ATTACH01-02 | completed | workspace_panels_owner | 运行域实现与作者验证已固定；[原回执](../../docs/evidence/wpf-attach01/runtime-amend-receipt.json) |
| WPF-ATTACH01-03 | completed | workspace_panels_owner | 29项隔离PGHTTP含实际runner/fake adapter；[运行验证](../../docs/evidence/wpf-attach01/runtime-validation.md)，无provider |
| WPF-ATTACH01-04 | pending | workspace_panels_owner | phase1及运行域独审均通过；main接收仍pending |

架构影响：新增attachment resources/namespace/bindings与026、项目锁后pin/GC、context v2及private execution输入编排；旧v1不变、CREATE稳定false而GET能力动态。共享mount/client未改；固定架构快照待主线接收后登记target8701a6，owner由管理协调，不越scope写图。唯一source交管理集中登记，未声称dashboard已部署。既有所有预览与个人服务保持不动。

## Handoff

固定phase1实现 6bc2918cf35a652e241e6378c3b6297cac179adb，base f181d84b5fb3652d62e2a181acff442d42b3e066。三源与14个只读依赖hash见[final-checks](../../docs/evidence/wpf-attach01/resource-checks.json)，真实检查源为52317c4+dirty，非事后SHA执行。49项包含真实旧Web投影/queue/client + mock fetch；不是HTTPserver/浏览器/PG或provider验收。

Root兼容裁决：仅请求非空attachments→v2；无附件/[]或原v1 replay永远v1；新client向旧center纯文字必须完全省略attachments。旧loaded Web可读正文/队列但不展示附件；不加Accept/header或GET阻断。runtime与新Web共享decoder仍后继接入。F01已移出conversations.ts、026已预留并在runtime v2精确amend内；indices/client/mount仍不写。

2026-10-06 10:26 UTC：root独立限定APPROVED上述target，独立49/49；类型检查仍作者证据。小合同交管理集中公开输入队列；目前未收到main接收。此为当时phase1边界；10:28 runtime v2已正式amend，后继结果另绑target。

## Runtime安全段

2026-10-06 10:29:57 UTC：原子amend v2已live核18scope。小合同phase1 target6bc2918/metadata339086已独审并交公共队列；当前runtime是新实现段，不能继承49/49/APPROVED。F01/TUI01B indices/client/mount/shareddecoder不写；无provider，后续PG用唯一DB和动态端口，不运行会写旧evidence的测试fixture。

10:39 runtime实质进展：隔离PG+动态HTTP已验证26项，原始失败与修正见quality；继续事务中断和完整局部矩阵。真实provider/个人服务均0调用。

10:46固定runtime交付：target 8701a6cf547248e70aa5758f05da1d7d314ae9c0；[candidate](../../docs/evidence/wpf-attach01/runtime-candidate.json)、[checks](../../docs/evidence/wpf-attach01/runtime-checks.json)、[README复跑](../../docs/evidence/wpf-attach01/README.md)。当时独审NOT_STARTED/main未集成（后续正式结论如下）。当前实现源冻结，仅metadata；原始77/78-first与首失败日志不改，不能混成最终执行事实。

10:49:15 UTC root正式限定APPROVED target8701a6；独立78/78、3自有DB清零，16源码/19只读依赖与两个phase1合同字节核实。独审原[日志](../../docs/evidence/wpf-attach01/root-runtime-direct.log)与[审计](../../docs/evidence/wpf-attach01/root-runtime-audit.json)原样归档；types为作者证据。当前只metadata交付，全部产品源码停止写入、claim保留待main。公共client/decoder/mount、真实App上传与provider均未验，不代表MATURE03整体完成。
