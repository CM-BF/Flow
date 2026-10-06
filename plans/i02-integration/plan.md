# I02 后续公共能力集成

| 字段 | 内容 |
| --- | --- |
| 计划编号 | I02 |
| 状态 | `completed`（本批集成，长期目标继续） |
| 创建日期 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 父计划 | [FLOW-001](../flow-001-architecture/plan.md) |
| Owner / model | Execution Lead / gpt-6-astra ultra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration` / `codex/m2-integration` |
| 基线 | d444608ab6c796c731e44e51a892868bf39bec2a |

本阶段集成已审查独立feature，必要交叉场景只在真实集成点执行；保持原完整目标并滚动后续项，不把此阶段完成当长期目标终点。技能沿用本任务find-skills/codebase-design/clean-code/tdd；每工作段/合并前核查兼容性/错误路径和范围。

## TODO

- [x] **I02-T01** C02恢复审核与中心迁移/直接消费者集成，明确operator assertion边界。
- [x] **I02-T02** M02 backend/CLI公共首段集成，投影乱序提交、queryTasks与恢复接口并存。
- [x] **I02-T03** P01官方SDK互操作首段集成，外部durable binding/Tasks能力缺口独立记录。
- [x] **I02-T04** D03高层dashboard集成并更新4320真实预览/源核对。
- [x] **I02-T05** 接受新Web官方Thread/布局和M02消费成果，执行真实跨任务/CLI/恢复/证据旅程，保留UI与backend各自review。

[status](status.md)逐项真实更新，[review](review.md)绑定已审实现target；模型5/5封存，不因集成追加。历史M1通过继续成立，新UI整改和后续能力不继承旧review。
