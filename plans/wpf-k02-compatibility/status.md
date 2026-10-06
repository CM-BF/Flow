# WPF-K02C01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 05:54 UTC / 3d4985fca060155435b159e0467815bf8e88b8b8 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 正在让聊天正确保留并核对所属项目 |
| 下一可用交付 | 交付兼容旧中心的项目身份校验，保持聊天与排队行为 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-compatibility |
| Branch | codex/web-context-compatibility |
| 工作基线 / HEAD | 3d4985fca060155435b159e0467815bf8e88b8b8 / e9a0259151fcb215e1bd607b5461d81412da2742，实际HEAD由Git聚合 |
| 工作树dirty状态 | 首canonical文档新增；尚未修改Web实现 |
| 工作分支状态 | IN_PROGRESS |
| 本片段交付阶段 | implementation |
| 检查状态 | NOT_RUN；三契约输入before/apply/after哈希通过 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；base含QUEUE，未含本片reader |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/conversations/projection.ts, apps/web/src/execution-profiles/selection.ts, apps/web/test/conversation-outbox.test.ts, apps/web/test/conversation-projection.test.ts, apps/web/test/conversation-queue.test.ts, apps/web/test/execution-profiles.test.ts |
| Review | [review.md](review.md)，NOT_STARTED |
| D04 claim | 5ab6863c-1e0b-4690-8097-9f95b26421f7 / v1 active；05:52:04.217Z committed，05:53:47.969Z live核验；[receipt](../../docs/evidence/wpf-k02-compatibility/take-receipt.json) |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-K02C01-01 | completed | workspace_panels_owner | [输入](../../docs/evidence/wpf-k02-compatibility/input-verification.json)、[技能](../../docs/evidence/wpf-k02-compatibility/quality.md) |
| WPF-K02C01-02 | in-progress | workspace_panels_owner | 两个既有生产接缝，尚未提交 |
| WPF-K02C01-03 | pending | workspace_panels_owner | 局部行为与类型检查待执行 |
| WPF-K02C01-04 | pending | workspace_panels_owner | 待固定target和独立审查；等待Lead注册聚合源 |

共享输入例外仅原样 Lead patch 三 contracts，见input-verification；不代表 K02 后端已批准。0引用UI/0context请求/0模型/0真实DB。所有旧预览保持。本片不改变模块所有权/运行架构，仅现有身份校验扩可选字段；公共输入新能力尚未开放。
