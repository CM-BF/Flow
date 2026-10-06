# WPF-QUEUE01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 05:20 UTC / 固定main14c61b4062f8040ba6c7239860929366e5bd3fc1 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 已接收排队接口，正在把排队和暂停继续接入聊天 |
| 下一可用交付 | 运行时可排队消息、查看等待列表并显式暂停或继续 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-queue |
| Branch | codex/web-conversation-queue |
| 工作基线 / HEAD | 14c61b4062f8040ba6c7239860929366e5bd3fc1 / metadata HEAD由Git聚合 |
| 工作树dirty状态 | 已核clean输入；仅本任务文档初始化，实际dirty由Git聚合 |
| 工作分支状态 | IN_PROGRESS |
| 本片段交付阶段 | implementation |
| 检查状态 | NOT_RUN |
| 已集成main状态 / HEAD | NOT_INTEGRATED；main14c61只有公共queue能力，无本Web控制 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/projection.ts, apps/web/src/conversations/queue/ConversationQueue.tsx, apps/web/src/conversations/queue/commands.ts, apps/web/src/conversations/queue/projection.ts, apps/web/src/conversations/queue/queue-elements.tsx, apps/web/test/conversation-projection.test.ts, apps/web/test/conversation-queue.test.ts, apps/web/test/conversation-queue.fixture.ts, apps/web/test/conversation-queue.browser.ts |
| Review | [review.md](review.md)，NOT_STARTED |
| D04 claim | b4ea85d0-ad87-4903-9a59-73281ad17752 / v1 active，05:19:31.947Z；[receipt](../../docs/evidence/wpf-queue01/take-receipt.json)，05:19:55 live复核 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-QUEUE01-01 | completed | workspace_panels_owner | 固定输入、正式领取、[技能](../../docs/evidence/wpf-queue01/quality.md) |
| WPF-QUEUE01-02 | in-progress | workspace_panels_owner | 命令/投影实现准备 |
| WPF-QUEUE01-03 | pending | workspace_panels_owner | 页面fixture待实施 |
| WPF-QUEUE01-04 | pending | workspace_panels_owner | 固定实现/独立审查/聚合待办 |

唯一源首commit交manager注册，未实采不声称可见。架构影响为现ConversationProjection连接/可见生命周期内增加queue命令与只读投影，public协议不改；固定交付后交MainLead/D06更新队列，不写其树。0模型/真实DB，所有旧预览和SVC保持原版本；PROFILEI01已main/released，旧源不可恢复写入。
