# WPF-ACTIVITY01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 06:15 UTC / 固定3d4985fca060155435b159e0467815bf8e88b8b8 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 可按需查看执行活动与详情，长记录按页显示 |
| 下一可用交付 | 完成独立审查，再把活动模块交给聊天页面接入 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-activity |
| Branch | codex/web-conversation-activity |
| 工作基线 / HEAD | 3d4985fca060155435b159e0467815bf8e88b8b8 / 实际HEAD由Git聚合 |
| 工作树dirty状态 | 六个新源/专测已固定；当前仅本任务metadata收口 |
| 工作分支状态 | COMPLETED |
| 本片段交付阶段 | review |
| 检查状态 | PASSED 61b9349af390c137cc4cfeabd38bad058ec69cb5；22 direct、typecheck、dev7/prod7与独立fixture build；[验证](../../docs/evidence/wpf-activity01/validation.md) |
| 已集成main状态 / HEAD | NOT_INTEGRATED |
| 实现目标 | 61b9349af390c137cc4cfeabd38bad058ec69cb5 |
| 实现范围 | apps/web/src/conversation-activity/projection.ts, apps/web/src/conversation-activity/ConversationActivity.tsx, apps/web/src/conversation-activity/activity.css, apps/web/test/conversation-activity.test.ts, apps/web/test/conversation-activity.fixture.ts, apps/web/test/conversation-activity.browser.ts |
| Review | [review.md](review.md)，NOT_STARTED |
| D04 claim | 51f962ee-7e6f-4806-a9f9-df3838dc27f5 / v1 active，06:04:36.078Z committed，06:04:53.705Z live核；[receipt](../../docs/evidence/wpf-activity01/take-receipt.json) |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-ACTIVITY01-01 | completed | workspace_panels_owner | [接口](../../docs/evidence/wpf-activity01/interface.md)、[技能](../../docs/evidence/wpf-activity01/quality.md) |
| WPF-ACTIVITY01-02 | completed | workspace_panels_owner | reader与身份/代际/reset/详情按需22直接检查 |
| WPF-ACTIVITY01-03 | completed | workspace_panels_owner | dev7/prod7、双主题390/键盘、只读HTTPfixture；不是App接线 |
| WPF-ACTIVITY01-04 | pending | workspace_panels_owner | 已固定target待独立review，source已交manager登记，未实采聚合 |

架构影响：拟增加宿主绑定只读执行活动模块，不增加SSE/自动poll或公共API。固定交付后列入主Lead架构更新队列。0模型/真实DB，旧全部服务保持。

独立预览 http://127.0.0.1:53851/ ，service owner workspace_panels_owner / session46011；HTTP fixture，0模型/真实DB，非App已接线。以当前固定源启，后续只metadata；启动法见[交付](../../docs/evidence/wpf-activity01/README.md)。同模块首版52883已确认自身PID/cwd后关闭重启，所有旧产品/工程预览未改。

Dashboard已由manager一次合采实际展示：2026-10-06T06:14:43.956Z，73源、ACTIVITY source live/issues=[]/human完整、claim51f v1 matchesSource。采样恰逢61b9349+dirty15、当时status仍implementation/targetUNKNOWN/checkunknown/reviewNOT_STARTED/proofunknown，原样保留[过渡摘录](../../docs/evidence/wpf-activity01/dashboard-excerpt.json)，不能改成后来的candidate状态。此后canonical已经更新固定61b/检查，独立review仍NOT_STARTED；本地actual parser核当前字段，不为凑绿色再取API。
