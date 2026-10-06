# 计划状态与独立审查规范

| 字段 | 内容 |
| --- | --- |
| 计划编号 | OPS-001 |
| 状态 | `completed` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-05 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | Execution Lead / gpt-6-astra（至少Sol） |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review` / `codex/plan-status-review` |
| 基线 | F00 `542f70b`，公共client补丁 `3995ec1` |

目标：交付计划状态与独立审查规范对应M1公共契约与可核对证据，遵守[公共契约](../../docs/architecture/m1-contract.md)。写入范围以派工单为准，其他feature目录不修改。先按find-skills读取并应用相关技能；每工作段、约30分钟安全停点、交付与合并前应用clean-code。

## TODO

- [x] **OPS-001-01** 迁移三个既有plan并保留跳转stub
- [x] **OPS-001-02** 统一plan/status/review模板与稳定TODO ID
- [x] **OPS-001-03** 创建活跃feature自己的状态和审查记录
- [x] **OPS-001-04** 相对链接、TODO映射和原实验hash检查后提交

## 验证和交付

通过公共Interface验证可观察行为，模型模拟和真实模型证据分开记录。检查和证据必须附对应commit；未经验证不勾选。Owner在启动、实质进展、阻塞、交付和review修复后更新[status.md](status.md)，交付后由独立reviewer按[review.md](review.md)只读审查，修复交回owner。分支通过不代表已经集成main。
