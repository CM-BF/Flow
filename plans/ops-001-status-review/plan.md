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

- [x] **OPS-001-05** 用户完整目标滚动规则、22项原要求验收追溯与C02/P01/M02来源登记；2026-10-06新增，工程检查见status。

- [x] **OPS-001-06** 三队并发预算与直接技术路由（2026-10-06）：本任务4人（Goal Owner、Execution Lead、2 workers）；外部Web最多4人；Mika队最多2人，合计不超过10。任何队增人先协调，不反复探测或通过新用户task绕过实际cap。

Execution Lead可主动直发Web用户task `01a10ec2-ff1a-76d0-a277-446baf89b19d` 与Mika用户task `01a10f3f-4ef0-7ca2-8e66-f1947fa4b295`，带任务ID、固定SHA、实际边界、所需动作。外部两Lead之间可双向直投。Execution Lead本身是subagent，没有可直投的独立用户task；外部回本task注明“收件人ExecutionLead”，Goal Owner立即桥接，不额外增加技术审批。不创建新task来绕过此限制。关键里程碑、scope冲突、全局容量与用户决策抄Goal Owner；owner status/evidence仍唯一事实源，消息不是第二进度账本。发现直接回唯一writer（跨队经该Lead），consumer合同直接发消费方，降低无必要中转。
