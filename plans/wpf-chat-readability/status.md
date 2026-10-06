# WPF-CHATREAD01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 08:24 UTC / 32c371d389a913f8dd71c3bd8b98dd0697411256 |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 正在为聊天正文和输入框腾出空间，并保留需要处理的提醒 |
| 下一可用交付 | 更紧凑的执行选项和队列，配合可随时打开的详情 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-readability |
| Branch | codex/web-conversation-readability |
| 工作基线 / HEAD | 32c371d389a913f8dd71c3bd8b98dd0697411256 / 当前HEAD由Git聚合 |
| 工作树dirty状态 | 首canonical新增，尚未产品修改 |
| 工作分支状态 | IN_PROGRESS |
| 本片段交付阶段 | implementation |
| 检查状态 | NOT_RUN；先捕获修改前布局 |
| 已集成main状态 / HEAD | NOT_INTEGRATED |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/conversations.css, apps/web/src/conversations/queue/ConversationQueue.tsx, apps/web/src/execution-profiles/ExecutionProfilePicker.tsx, apps/web/src/execution-profiles/execution-profiles.css, apps/web/test/conversation-readability.browser.ts, apps/web/test/conversation-readability.fixture.ts |
| Review | [review.md](review.md)，NOT_STARTED |
| D04 claim | c832542c-0222-4167-bb6f-3746d585a10c v1 active，08:23:06.246Z COMMITTED；08:23:21.603Z live核 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-CHATREAD01-01 | completed | workspace_panels_owner | [receipt](../../docs/evidence/wpf-chat-readability/take-receipt.json)、[quality](../../docs/evidence/wpf-chat-readability/quality.md) |
| WPF-CHATREAD01-02 | in-progress | workspace_panels_owner | 先按固定base读现有展示与fixture |
| WPF-CHATREAD01-03 | pending | workspace_panels_owner | 修改前基线与局部browser待运行 |
| WPF-CHATREAD01-04 | pending | workspace_panels_owner | 固定target/review/聚合待执行 |

架构影响：展示组合调整，拟ExecutionProfilePicker可选纯展示slot；无协议、FSM、权限、连接或依赖改变。首canonical给管理登记；当前尚无本task部署观察，不重复取dashboard。旧65339及其它预览/用户服务保持；本任务只HTTPfixture、0真实模型/DB。
