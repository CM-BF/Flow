# WPF-RECOVERY01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 13:49 UTC |
| 所属大task | [WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery |
| Branch | codex/web-conversation-recovery |
| 工作基线 / HEAD | 84005a260dfcb668cd38b09c21564d0754a0f513；本首canonical提交前 |
| 工作树dirty状态 | 本任务canonical新增；聚合以实际Git为准 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 恢复方案已获准，正在接入连接与持久记录；用户功能尚未交付 |
| 下一可用交付 | 刷新后保留原草稿与未决发送身份，重新连接后由用户明确恢复 |
| 当前阻塞 | ACTIVE: 浏览器与完整构建等待可用磁盘和中心会话语义核验；轻量实现可继续 |
| 需用户决定 | NONE |
| 检查状态 | NOT_RUN；首canonical，未跑产品检查 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/attachments/controller.ts, apps/web/src/connection/session.ts, apps/web/src/conversation-context/controller.ts, apps/web/src/conversation-steering/SteeringControl.tsx, apps/web/src/conversation-steering/control.ts, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/outbox.ts, apps/web/src/conversations/projection.ts, apps/web/src/conversations/queue/commands.ts, apps/web/src/plugin-integration/attachments.tsx, apps/web/src/plugin-integration/knowledge.tsx, apps/web/src/plugin-integration/session.ts, apps/web/src/plugin-integration/steering.tsx, apps/web/src/recovery/binding.tsx, apps/web/src/recovery/journal.ts, apps/web/test/conversation-recovery.browser.ts, apps/web/test/conversation-recovery.fixture.ts, apps/web/test/conversation-recovery.test.ts |
| 已集成main状态 / HEAD | 本片未实现/未集成；输入main 84005a260dfcb668cd38b09c21564d0754a0f513 |
| Review | [review.md](review.md)，NOT_STARTED |
| 领取 | 6ff988b2-c8cc-4c05-ae12-b3d7af87f2ab v1 active；本人13:49:01Z live核21scope |
| 架构影响 | 新ConnectionSession/Journal与P01私有binding沿原controllers接管；固定实现后交D06后继更新队列，不改图 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-RECOVERY01-01 | in-progress | workspace_panels_owner | [live领取](../../docs/evidence/wpf-conversation-recovery/live-claim.json)，输入/容量研究已读，尚未产品实现 |
| WPF-RECOVERY01-02 | pending | workspace_panels_owner | durable barrier待实现 |
| WPF-RECOVERY01-03 | pending | workspace_panels_owner | App/P01和完整稿恢复待实现 |
| WPF-RECOVERY01-04 | pending | workspace_panels_owner | 定向检查未运行 |
| WPF-RECOVERY01-05 | blocked | workspace_panels_owner | 资源与中心语义验收门槛未满足 |
| WPF-RECOVERY01-06 | pending | workspace_panels_owner | 独审/main未完成 |

## 阻塞 / 风险 / 未验证

pre-provision可用1,584,984,064B，建树后管理报告1,416,241,152B，非当前fresh资源测量。禁止目前install/build/PG/Chrome。中心三语义不阻首代码，但最终cookie/SSE旅程仍需核。旧upload journal跨tabCAS与历史metadata隔离开放，不冒本片修复。

## 下一步与handoff

先Journal/ConnectionSession及原authority接管，再真实App/P01；不得孤立journal交付。当前无实现target/approval。唯一status由本owner维护。

## Dashboard同步

SOURCE_READY待管理集中登记；未读4320/API，不把登记请求写成部署。实际parser证据随后落本任务evidence。
