# SVC05 当前个人版本发布准备

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | SVC05 / completed |
| 创建 / 更新 | 2026-10-06 12:39 UTC |
| 所属大task | [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | Execution Lead |
| Owner / model | assignment_review / gpt-6-astra |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-current-release / codex/personal-current-release |
| 基线 | 362af3bac77541e5a60979326bcf4d4b8c947915 |

目标是证明保留的真实网页产物能连接固定新版后端，并形成可审发布前置。遵循[模块规则](../../AGENTS.md#modular-design)。初始片段只准备/隔离验证，已独审接收；后续 GO 窗口 go-svc05-current-release-once 授权唯一 operator 沿已审工具更新固定后台，保留原端口/配置/Webpointer/用户tab，0 自发 provider。复用现有 personal-preview、maintenance 和 Web release，不建立第二部署权威。

## TODO

- [x] **SVC05-01** 核固定目标/现部署/全部保留artifact脱敏事实、最小接口与兼容矩阵。
- [x] **SVC05-02** 随机专库、动态端口、真实factory与真实静态App验证read/send/original-key recover/cap；026/027迁移与历史恢复仅验受影响范围。
- [x] **SVC05-03** 固定原始证据/源码绑定/cleanup、独立review；准备满足不变量后的单次操作方案。
- [x] **SVC05-04** 另获实际窗口后按drain→active0→hold→refresh→fresh preservation→明确resume部署；窗口已完成，实际runtime362/v15，详见live/receipt.json。

## 依赖与边界

当前生产Web与旧保留artifact必须以实际descriptor核验；不能以fixture壳或module单测冒充App。ATTACHI02实际Send/Queue附件接线由Web组推进，固定后另行纳入目标，不把待交付当现有能力。保留原失败与未知；兼容报告只是固定组合的局部证据。请求正文只来自合成数据，真实owner/runner凭据不读取输出或复制进测试。

准备首片要求在不可恢复清理前保存证据checkpoint，只关闭自有浏览器/端口/随机DB，不动个人安装；该阶段已完成。随后实际窗口按单独授权操作并保存checkpoint，已恢复接收且closed。查看截图并记录实际视觉结论，不用网络空闲等待SSE。
