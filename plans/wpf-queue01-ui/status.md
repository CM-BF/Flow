# WPF-QUEUE01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 05:40 UTC / 固定main14c61b4062f8040ba6c7239860929366e5bd3fc1 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 聊天执行中可继续排队，等待消息可查看、暂停继续或单独取消 |
| 下一可用交付 | 集成已通过审查的聊天排队操作 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-queue |
| Branch | codex/web-conversation-queue |
| 工作基线 / HEAD | 14c61b4062f8040ba6c7239860929366e5bd3fc1 / metadata HEAD由Git聚合 |
| 工作树dirty状态 | 实现已固定，当前仅本任务metadata/evidence收口；实际dirty由Git聚合 |
| 工作分支状态 | COMPLETED |
| 本片段交付阶段 | integration |
| 检查状态 | PASSED 309ec0e37bc92cc0f91d8f3bfd8f9e9f6519432c；51 direct、typecheck/build、dev11/prod11 HTTP fixture；[验证](../../docs/evidence/wpf-queue01/validation.md) |
| 已集成main状态 / HEAD | NOT_INTEGRATED；main14c61只有公共queue能力，无本Web控制 |
| 实现目标 | 309ec0e37bc92cc0f91d8f3bfd8f9e9f6519432c |
| 实现范围 | apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/projection.ts, apps/web/src/conversations/queue/ConversationQueue.tsx, apps/web/src/conversations/queue/commands.ts, apps/web/src/conversations/queue/projection.ts, apps/web/src/conversations/queue/queue-elements.tsx, apps/web/test/conversation-projection.test.ts, apps/web/test/conversation-queue.test.ts, apps/web/test/conversation-queue.fixture.ts, apps/web/test/conversation-queue.browser.ts |
| Review | [review.md](review.md)，APPROVED 309ec0e37bc92cc0f91d8f3bfd8f9e9f6519432c |
| D04 claim | b4ea85d0-ad87-4903-9a59-73281ad17752 / v1 active，05:19:31.947Z；[receipt](../../docs/evidence/wpf-queue01/take-receipt.json)，05:19:55 live复核 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-QUEUE01-01 | completed | workspace_panels_owner | 固定输入、正式领取、[技能](../../docs/evidence/wpf-queue01/quality.md) |
| WPF-QUEUE01-02 | completed | workspace_panels_owner | 独立commands/read projection，51局部检查，见验证 |
| WPF-QUEUE01-03 | completed | workspace_panels_owner | 官方Thread/AI Elements Queue，11开发+11生产App旅程、双主题390px |
| WPF-QUEUE01-04 | completed | workspace_panels_owner | root05:40:36固定target APPROVED；交Lead集成，main仍未集成，F01独立pending |
| WPF-QUEUE01-F01 | pending | 待Lead另领owner | 跨reload/换连接原key恢复尚未实现；稳定无凭据namespace与journal后继，不凭同文GET猜受理 |

唯一源已登记并实际被4320聚合。架构影响为现ConversationProjection连接/可见生命周期内增加queue命令与只读投影，public协议不改；固定交付后交MainLead/D06更新队列，不写其树。0模型/真实DB，所有旧预览和SVC保持原版本；PROFILEI01已main/released，旧源不可恢复写入。

开发预览 http://127.0.0.1:58071/ ，服务owner为workspace_panels_owner，session3035；moving worktree/HTTP fixture/0模型0真实DB。启动：`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-queue.fixture.ts --queue-preview`，独立动态端口以stdout为准。该服务不由测试cleanup关闭。

固定交付[README](../../docs/evidence/wpf-queue01/README.md)含启动、限制和截图。架构影响：ConversationProjection拥有独立QueueCommands与Queue read projection，命令receipt和GET动态事实分离；官方Thread新增可选Input与submit受控接缝，显式queue沿公开composer.send({startRun:false})。接口/运行图target为309ec0e37bc92cc0f91d8f3bfd8f9e9f6519432c，交MainLead/D06待集成后更新，不写D06范围。未知receipt跨reload/换连接原key恢复仍F01未完成。

独立review：root05:40:36 APPROVED当前实现；独立51 direct与CUA局部旅程已执行，作者22 browser只源码hash/报告复核未独立重跑。未执行真实中心/PG/模型；author branch完成、review通过与main集成保持分开。

Dashboard单次实采2026-10-06T05:41:16.755Z：65源，WPF-QUEUE01 source live、issues=[]，human complete=true/stage integration；checks passed、review approved都绑定309ec0e，两proof unchanged；claim b4ea85 v1 active/matchesSource=true。采样Git HEAD309ec0e、dirty=true仅当时27项metadata/evidence，原样保存[摘录](../../docs/evidence/wpf-queue01/dashboard-excerpt.json)。main对当前target not-contained，不把review通过当已集成。之后仅metadata提交，11实现/脚本保持零diff。
