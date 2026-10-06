# 常驻runner与确定性harness

| 字段 | 内容 |
| --- | --- |
| 计划编号 | R01 |
| 状态 | `in-progress` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-05 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | runner_owner / gpt-6-astra（至少Sol） |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-runner` / `codex/m1-runner` |
| 基线 | F00 `542f70b`，公共client补丁 `3995ec1`，计划协作基线 `edca9fc` |

目标：交付常驻runner与确定性harness对应M1公共契约与可核对证据，遵守[公共契约](../../docs/architecture/m1-contract.md)。写入范围以派工单为准，其他feature目录不修改。先按find-skills读取并应用相关技能；每工作段、约30分钟安全停点、交付与合并前应用clean-code。

## TODO

- [x] **R01-01** 常驻领取、心跳、独立租约gate和优雅停机
- [x] **R01-02** 稳定事件序列、有界buffer、响应丢失重报
- [x] **R01-03** fixture各状态、决策、取消、产物和指定verifier
- [x] **R01-04** 公开runner/harness测试、clean-code与提交交付

以上勾选表示功能分支交付，证据绑定 `b393a5196b687bf81fd65ee7785ee198006e344b`；独立review与main集成仍待执行，计划状态保持 `in-progress`。

## 验证和交付

通过公共Interface验证可观察行为，模型模拟和真实模型证据分开记录。检查和证据必须附对应commit；未经验证不勾选。Owner在启动、实质进展、阻塞、交付和review修复后更新[status.md](status.md)，交付后由独立reviewer按[review.md](review.md)只读审查，修复交回owner。分支通过不代表已经集成main。

## 本轮实现边界

- `runRunner({baseUrl,token,workingDirectory,signal,...})` 返回常驻循环 Promise；外部 AbortSignal 表示停机，不生成用户取消终态。一个进程同时执行一个 attempt。
- runtime 负责心跳、独立租约期限、decision/completed 和本地有界 outbox；adapter 通过公开 HarnessContext 提交数据并在动作前核对所有权。
- 仅实现 fixture 六种场景与 `flow.text` v1；真实 Claude 属于后续 R02，当前不调用模型。
- 测试使用 loopback 动态端口和独立临时目录模拟中心 HTTP 接口；本分支不启动或迁移数据库。与真实 C01/PostgreSQL 的联调由 I01 验证。

2026-10-06 review 修复：固定并发 emit 的持久快照与发送批次一致性；ACK 按连续 durable prefix 验证。修复回归与具体提交见 status，独立复审待执行。
