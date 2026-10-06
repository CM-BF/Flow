# S01 确定性 Runner 容量验证

创建/更新：2026-10-06 06:25 UTC。状态 in-progress；owner Mika / gpt-6-astra。Goal Owner 已批准最小实验方向。权威 worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe`，branch `codex/runner-capacity-probe`；已审主线基线 `115b0dbdfa02db5483f9e9699852682ce699633c`。

目标：在真实中心、PostgreSQL、独立 runner 进程及持久 outbox 上，区分持久会话数、中心声明容量、实际执行并发与本次确定性工具负载。先找出最小容量缺口，不把观察者、数据库行数或模拟模型当真实 provider 容量。父要求见 [FLOW-001](../flow-001-architecture/plan.md) 与 [FLOW-002](../flow-002-provider-harness/plan.md)。

## TODO

- [x] **S01-01** 核对 B01/LAB01/LAB02/R03 权威来源、固定证据及缺口。
- [x] **S01-02** 固定有预算、资源归属和通过条件的实验合同。
- [x] **S01-03** 仅在新 experiment 目录实现薄实验入口、计量和资源清理，完成功能 smoke。
- [ ] **S01-04** 经 Lead/Web 协调窗口，运行首个 128 持久会话背景 + 4 runner / 16 task 场景；按瓶颈再运行 1 runner 对照及声明容量场景。
- [ ] **S01-05** 独立方法/结果审查，发布事实、清理与 main 接收记录。
- [ ] **S01-06** 根据结果另立产品修复或更大容量片段；真实 provider/工具预算另行授权。

## 已确认合同与边界

可逐步执行的 [实验合同](../../experiments/runner-capacity/README.md) 与 [机器可读参数](../../experiments/runner-capacity/contract.json) 是本片段实施输入。已确认：0 模型/云调用；只写新 plan/evidence/experiment 三目录；不改变生产 runner、scheduler、池或 outbox。并行队伍仍 Mika + K03 worker 两槽；K03关键审查优先。

先运行一项最小真实执行窗口，不能一次展开完整矩阵。正式计时由 Execution Lead 协调 Web；未取得具体时间窗口前只做源码、合同与低成本功能准备。若正式失败，保存原始失败及归属，不能换种子/删断言/重复至满意。需要产品变化时按新 owner/scope/claim 处理。

架构影响：实验只消费现有公开接口与 runner runtime，没有产品接口、数据库 schema 或生命周期变化；无需修改产品架构图。生产瓶颈成立后的改动另行登记。

## 完成条件

S01-01/02 是文档片段，不代表压测已运行。实验交付须包含固定源码 commit/hash、实际配置/总任务数、样本数/分位数、事件身份全量核验、声明与有效容量、真实浏览器关闭后的执行事实、独有资源清理及独立 review。分支结论与 main 集成分别记录。

2026-10-06：初始合同。最小场景与实施/正式窗口分开，后继容量目标保持开放。
