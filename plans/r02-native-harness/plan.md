# R02 原生 Claude 只读 adapter 与有界验证

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | R02 / `in-progress` |
| 创建 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | runner_owner / gpt-6-astra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-native-harness` / `codex/m1-native-harness` |
| 基线 | `39f2e178df5914e2610c796bbd98537e459ea9c8`，合入 R01 修复后 `1fdb14fc3fad7ca215ee6d30fd96dd1d7367f3fe` |

目标：在现有 HarnessAdapter / runRunner 注入入口实现固定 Claude SDK 0.3.290 的最小只读 adapter。只读取 operator 明确指定材料的私有快照；每次 PreToolUse 检查所有权和精确路径。默认 fixture 不变。runtime 独占 decision/completed；取消通过 SDK AbortController 退出。保存 native session/resources、最终文本产物与 flow.text1 verifier，按 session 累计 modelUsage 上报 SDK 估算，恢复基线未知时保留 unknown。

写入范围：apps/runner、此计划目录、docs/evidence/r02。不修改共享 contracts/client/lock、登录或 Flow 源码。模型只可 Read 指定材料，shell/web/未知工具禁止；实现代码由达到 Sol 门槛的 owner 写入。R01 独立复审修复已在原分支完成并明确合入本分支。

## TODO

- [x] **R02-01** 只读 adapter、隔离材料、逐工具所有权/路径 gate 与取消
- [x] **R02-02** native session/resources、产物/verifier 与 modelUsage unknown baseline
- [x] **R02-03** 公开 HarnessAdapter / SDK 外部 seam 模拟测试与 clean-code
- [x] **R02-04** 有界真实未知随机材料读取、同 host 恢复与无历史对照，分别记录限制
- [ ] **R02-05** 提交、状态/证据同步与独立 review 交接

## 验证与限制

最多 5 次真实 query，每次 maxTurns<=4、maxBudgetUsd<=1、timeout<=90s；调用失败计数且不无限重试。权限拒绝、取消、ownership 拒绝优先在本地 SDK seam 验证，不为凑数启动模型。真实小实验不能替代父任务后续中心/CLI 系统验收；不验证跨机恢复、容量、wrapper 登录修复。不输出原始凭据、账户信息或 transcript。

[status](status.md) 是唯一手填事实源，分支验证、review、main 集成分别记录。[review](review.md) 绑定确切 commit；空模板不表示 approval。技能及检查记录见[证据](../../docs/evidence/r02/README.md)。

2026-10-06：57条本分支模拟/公共回归与类型检查通过；真实3/5读取/恢复/无历史对照通过，剩余2次交I01系统验收；普通manifest入口已实现。勾选表示branch产物与证据，不表示review通过或main集成。
