# 轻量Web与浅深双主题

| 字段 | 内容 |
| --- | --- |
| 计划编号 | W01 |
| 状态 | `completed` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-06 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | W01 owner / 派发 gpt-6-astra / ultra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web` / `codex/m1-web` |
| 基线 | 以 [外部交接](../../docs/handoffs/external-web-dashboard.md) 冻结提交为准 |

目标：交付轻量Web与浅深双主题对应M1公共契约与可核对证据，遵守[公共契约](../../docs/architecture/m1-contract.md)。写入范围以派工单为准，其他feature目录不修改。先按find-skills读取并应用相关技能；每工作段、约30分钟安全停点、交付与合并前应用clean-code。

## TODO

- [x] **W01-01** 读取应用assistant-ui/ai-elements和本地前端技能
- [x] **W01-02** 中心驱动任务/决策/结果/按需证据与重连
- [x] **W01-03** 可扩展主题注册/tokens，浅色深色完整主要状态
- [x] **W01-04** 键盘/窄屏/长记录/减少动画、双主题UI证据及review

## 验证和交付

通过公共Interface验证可观察行为，模型模拟和真实模型证据分开记录。检查和证据必须附对应commit；未经验证不勾选。Owner在启动、实质进展、阻塞、交付和review修复后更新[status.md](status.md)，交付后由独立reviewer按[review.md](review.md)只读审查，修复交回owner。分支通过不代表已经集成main。

外部 W01 owner 已接管并实施，独占 worktree/branch 保持不变。跨任务索引由原 Execution Lead 更新。

独占 `apps/web/**`、`plans/w01-web/**`、`docs/evidence/w01/**`。公共 contracts/client、根 manifest、migrations 不修改；根 lock 仅可按交接中的明确例外在本 worktree 临时生成用于安装验证，交付恢复并提供 patch，由 Execution Lead 统一提交。fixture/mock 只能是浏览器测试 Adapter，不得宣称真实中心或 harness 已验收。

## 已交付范围

2026-10-06：实现及修复提交 `866c20e8462f295736f685541e2ecb9ba8639101`。W01-02/03 完成为公共 HTTP fixture 验收范围，真实中心集成仍待原 Execution Lead。W01-04 的键盘/窄屏/长记录/减少动画/截图已通过，独立review发现W01-R1已修复并在866c20e复审APPROVED，该TODO完成。详细[检查与截图](../../docs/evidence/w01/validation.md)。
