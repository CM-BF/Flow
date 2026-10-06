# 轻量Web与浅深双主题

| 字段 | 内容 |
| --- | --- |
| 计划编号 | W01 |
| 状态 | `accepted` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-05 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | reserved-external；待用户另开task后确认owner / 至少Sol |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web` / `codex/m1-web` |
| 基线 | F00 `542f70b`，公共client补丁 `3995ec1` |

目标：交付轻量Web与浅深双主题对应M1公共契约与可核对证据，遵守[公共契约](../../docs/architecture/m1-contract.md)。写入范围以派工单为准，其他feature目录不修改。先按find-skills读取并应用相关技能；每工作段、约30分钟安全停点、交付与合并前应用clean-code。

## TODO

- [ ] **W01-01** 读取应用assistant-ui/ai-elements和本地前端技能
- [ ] **W01-02** 中心驱动任务/决策/结果/按需证据与重连
- [ ] **W01-03** 可扩展主题注册/tokens，浅色深色完整主要状态
- [ ] **W01-04** 键盘/窄屏/长记录/减少动画、双主题UI证据及review

## 验证和交付

通过公共Interface验证可观察行为，模型模拟和真实模型证据分开记录。检查和证据必须附对应commit；未经验证不勾选。Owner在启动、实质进展、阻塞、交付和review修复后更新[status.md](status.md)，交付后由独立reviewer按[review.md](review.md)只读审查，修复交回owner。分支通过不代表已经集成main。

派工保留：`reserved-external / awaiting-dispatch`。用户将自行创建外部task；内部调度不得重复启动W01。这不是已运行状态。
