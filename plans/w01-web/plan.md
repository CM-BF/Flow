# 轻量Web与浅深双主题

| 字段 | 内容 |
| --- | --- |
| 计划编号 | W01 |
| 状态 | `in-progress` |
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
- [x] **W01-05** 官方Thread元素/composer、Arc式紧凑chat侧栏、Codex式竖栏、chat tab split/merge、右侧AI Elements Terminal/FileTree及tabs
- [ ] **W01-04** 键盘/窄屏/长记录/减少动画、双主题UI证据及review

## 验证和交付

通过公共Interface验证可观察行为，模型模拟和真实模型证据分开记录。检查和证据必须附对应commit；未经验证不勾选。Owner在启动、实质进展、阻塞、交付和review修复后更新[status.md](status.md)，交付后由独立reviewer按[review.md](review.md)只读审查，修复交回owner。分支通过不代表已经集成main。

外部 W01 owner 已接管并实施，独占 worktree/branch 保持不变。跨任务索引由原 Execution Lead 更新。

独占 `apps/web/**`、`plans/w01-web/**`、`docs/evidence/w01/**`。公共 contracts/client、根 manifest、migrations 不修改；根 lock 仅可按交接中的明确例外在本 worktree 临时生成用于安装验证，交付恢复并提供 patch，由 Execution Lead 统一提交。fixture/mock 只能是浏览器测试 Adapter，不得宣称真实中心或 harness 已验收。

## 已交付范围

2026-10-06：实现及修复提交 `866c20e8462f295736f685541e2ecb9ba8639101`。W01-02/03 完成为公共 HTTP fixture 验收范围，真实中心集成仍待原 Execution Lead。W01-04 的键盘/窄屏/长记录/减少动画/截图已通过，独立review发现W01-R1已修复并在866c20e复审APPROVED，该TODO完成。详细[检查与截图](../../docs/evidence/w01/validation.md)。

## 用户明确拒绝后的Thread整改

按用户要求采用官方完整Thread element及依赖元素，不能把现有自制ThreadPrimitive壳改名。保留HTTP行为，撤去蓝灰装饰/大标题/过多卡片，基于官方默认视觉作最少Flow适配。新实现需重新截图/回归/review，不沿用历史approval。

用户追加明确范围：新任务通过官方Composer提交，已受理任务因公共契约无追加消息/编辑/重试接口隐藏composer，不伪造能力。split/merge仅调整视图，同任务保持独立历史、观察与命令，关闭视图不取消中心任务。右侧panel由独立worktree owner实施后明确cherry-pick；数据限公共task文本/引用，不能暗示PTY/任意文件系统。先保留具名plugin slots/command边界，完整plugin系统由后续独立计划管理。

2026-10-06新整改实现target `cb4a39211e264538704ba9d474eeb08fc4b2759c`：W01-01/02/03/05按新证据完成实现与owner验证，W01-04保留独立review未完成。旧交付已集成main；本次新整改尚未集成。
