# R05D 显式原生启动配置

- 计划编号 / 状态：R05D / in-progress
- 所属大task：[FLOW-002](../flow-002-provider-harness/plan.md)；co-lead：Execution Lead
- Owner：native_center_owner / gpt-6-astra
- Worktree：/Users/citrine/Projects/AgentHarness/Flow-worktrees/codex-native-launch
- Branch：codex/codex-native-launch；base：f181d84b5fb3652d62e2a181acff442d42b3e066

目标：显式受信小配置组合已审native descriptor/transport与原宿主，保留旧Claude和S01行为。遵循[模块化规则](../../AGENTS.md#modular-design)。没有新SDK/scheduler loop，不执行真实app-server/account/provider查询。

## TODO

- [x] **R05D-01** 固定来源、scope、claim与Interface，R05C主线收口释放。
- [ ] **R05D-02** 实现严格配置合同与注入行为检查，稳定小Interface先交。
- [ ] **R05D-03** 接收main.ts writer移交及Mika/R06固定启动recipe/通知观察Interface，完成可证明的最小接线；未具备真实兼容证据时明确unsupported，不伪装可运行。
- [ ] **R05D-04** 固定manifest、局部验证、独审与受控main集成。

当前5源码+本计划/证据scope见claim.json；main.ts尚未take，等待S01 owner停止写入/receipt再原子amend。R06目录、宿主/中心/client/公共exports不在scope，未知通知策略仍属后继受控变更，不能顺手放宽C1。真实诊断仍STOPPED/修复中，以唯一owner回执为准，无新query预算。
