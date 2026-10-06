# SVC06 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 13:30 UTC |
| Plan | [plan.md](plan.md) |
| 任务层级 | 子task |
| 所属大task | [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | Execution Lead |
| 单一status owner / model | assignment_review / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release |
| Branch | codex/backend-release |
| 工作基线 / HEAD | 280289008a5a3779e4e5e6453181b96062ed9514；固定源码 6d276baee6d3fbf14eb4b638a9ad773ffcec988d，metadata 另提交 |
| 工作树dirty状态 | 当前仅本 claim 独审收口 metadata；源码保持 6d276 不变 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 实现目标 | 6d276baee6d3fbf14eb4b638a9ad773ffcec988d |
| 实现范围 | tools/personal-preview/backend-release, tools/personal-preview/preview.mjs, tools/personal-preview/maintenance-host.mjs, tools/personal-preview/maintenance.test.mjs, tools/personal-preview/cli.mjs, tools/personal-preview/README.md |
| 检查状态 | 分轮 8 个不同作者行为观察（1 个为空间门槛改变前历史版本），最终 JS 语法 12/12；完整构建两次失败保留、尚无 fixed artifact 正例；0 provider |
| 已集成main状态 / HEAD | 本计划待本批发布；SVC05实际runtime为362/v15，Web8d8/v2保持 |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 旧启动兼容和停服务前拒绝保护已获独立批准；完整固定产物尚未运行，等待资源恢复 |
| 下一可用交付 | 空间满足后验证完整固定产物，再确认不依赖开发目录也可启动和恢复 |
| 当前阻塞 | ACTIVE: 完整产物构建等待至少 2.5 GiB 可用空间；小范围验证继续，个人服务未操作 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED 6d276baee6d3fbf14eb4b638a9ad773ffcec988d，仅有界保护/legacy 小片；完整 fixed artifact gate 未完成 |
| Claim | 3346a60d-0b50-4c73-bf22-9b258f8b1381 v4，9 literal scopes；见 amend-receipt.json |
| 架构影响 | 候选runtime artifact与开发checkout解耦；实际实现target后更新固定图 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| SVC06-01 | completed | Execution Lead | plan / source-observation / claim |
| SVC06-02 | completed | assignment_review | accept/amend receipt；Interface |
| SVC06-03 | in-progress | assignment_review | 固定 6d276；完整构建资源阻塞，seed 仅只读核算 |
| SVC06-04 | in-progress | assignment_review / 独立reviewer | [检查与限制](../../docs/evidence/svc06/README.md)；完整 pinned journey 未验 |
| SVC06-05 | pending | 独立operator | 无个人操作许可 |
