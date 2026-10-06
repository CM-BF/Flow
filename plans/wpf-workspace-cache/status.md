# WPF-WORKSPACECACHE01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 11:35:14 UTC |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 所属大task | [WPF-MATURE-05](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-05-workspace/plan.md) |
| co-lead | Web /root |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 已明确关闭聊天时保留草稿和收据的规则 |
| 下一可用交付 | 关闭干净聊天释放引用，并限制已读正文缓存 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-cache |
| Branch | codex/web-workspace-cache |
| 工作基线 / HEAD | fd1322f9c0c1d085d5e343e39f6216b20d26c264 / 当前Git聚合 |
| 工作树dirty状态 | 开始前clean；当前仅首canonical |
| 工作分支状态 | in-progress / implementation |
| 本片段交付阶段 | implementation |
| 检查状态 | NOT_RUN；尚未产品验证 |
| 已集成main状态 / HEAD | NOT_INTEGRATED |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/conversations/projection.ts, apps/web/src/conversations/queue/ConversationQueue.tsx, apps/web/src/conversations/queue/projection.ts, apps/web/src/conversations/read-cache.ts, apps/web/src/data-renderers/flow-reply-detail.tsx, apps/web/src/plugin-integration/session.ts, apps/web/src/workspace-retention.ts, apps/web/test/conversation-projection.test.ts, apps/web/test/conversation-queue.test.ts, apps/web/test/plugin-integration.test.ts, apps/web/test/workspace-retention.browser.ts, apps/web/test/workspace-retention.fixture.ts, apps/web/test/workspace-retention.test.ts |
| Review | [review.md](review.md)，NOT_STARTED |
| D04 claim | 883321bc-933f-4da0-8f86-f200c02620cf v1 active / 2026-10-06T11:33:51.839Z / 16literal |

| TODO ID | 状态 | Owner | 证据/检查 |
| --- | --- | --- | --- |
| WPF-WORKSPACECACHE01-01 | in-progress | workspace_panels_owner | [Interface](../../docs/evidence/wpf-workspace-cache/interface.md) |
| WPF-WORKSPACECACHE01-02 | pending | workspace_panels_owner | 实际consumer未修改 |
| WPF-WORKSPACECACHE01-03 | pending | workspace_panels_owner | 尚未验证 |
| WPF-WORKSPACECACHE01-04 | pending | workspace_panels_owner | 独审与main接收待实施后 |

唯一source由管理集中登记，尚不声称dashboard已聚合。架构影响：App唯一views权威增加可回收判定；session增加既有binding释放；两个投影复用有界读缓存工具/读代际，命令生命周期不改。固定target后交架构更新队列，不越scope写图。实际read-only fd1322与原53ce apps/web零diff；新base包含已审附件后端/公共client，但没有附件App绑定。
