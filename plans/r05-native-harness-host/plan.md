# R05 原生 harness 宿主 Interface

| 字段 | 内容 |
| --- | --- |
| 计划编号 | R05 |
| 状态 | in-progress |
| 创建日期 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 父计划 | [FLOW-002](../flow-002-provider-harness/plan.md)，FLOW002-T09；[AQ-01 历史记录](../../docs/quality/architecture-health-2026-10-06.md) |
| Owner / model | assignment_review / gpt-6-astra |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/native-harness-host / codex/native-harness-host |
| 基线 | d7e1e64e7792f4d1ad4933db042f10f266ad0cca |

目标：集中原生 adapter 配置知识，保留宿主权威与既有兼容性；当前只实施 A 的行为保持配置/descriptor 提取。AQ-01 是历史架构线索，不自动断言当前仍存在其原描述的 usage 缺陷。

## TODO

- [x] **R05-A01** 核验独立工作树、原子 claim 与有限 Interface。
- [x] **R05-A02** 提取 Claude 配置与公开 profile 描述，fixture 与旧入口兼容，生产启动消费 descriptor。
- [x] **R05-A03** 局部 red/green、直接消费者、类型检查与 clean-code；固定源码及原始证据。
- [ ] **R05-A04** 独立 review、修复、main 接收与 claim 收口。
- [ ] **R05-A05** 独立后继：执行结局 settled/unknown 的明确语义；本片不修改 Promise<void> 或宿主终态。
- [ ] **R05-B01** 后继：中心认可的 final/profile/session 来源与命名空间、兼容前进迁移。
- [ ] **R05-C01** 后继：真实 Pi SDK 零远程调用 conformance，再到 PG task/Web 普通 final。

## 当前设计与取舍

[有限 Interface](../../docs/evidence/r05/interface.md) 使用 flow.native-harness.v1，将 adapter 与公开 descriptor 成对返回。Claude manifest 的解析、默认值和 profile 描述进入 runner 私有 native-harness 模块。profile 发布、pin/用途/port 校验留在宿主 execution-profiles 模块；旧 describeExecutionProfile 导出保留兼容转出。

loadRunnerConfiguration 的旧 adapters/profile/activeSteering 结果与普通字符串路径继续兼容，新增 harnesses 供 main 消费。descriptor 不送中心、不进入现有 profile JSON、不授予权限；没有声明的可选 port 不可用。fixture 无公开 profile；A2A 仍走独立 durable-dispatch driver。

边界：不修改 runtime、claude adapter loop、harness enum、中心/Web、索引/锁；不改变 S01 journal/容量与 CHAT09 pinned/unpinned 行为。B/C 不因 A 提取完成而勾选。0 query、0 provider、0 个人服务操作。

## 验证与交付

公开测试 seam 为 loadRunnerConfiguration、loadRunnerAdapters、describeExecutionProfile、guardExecutionProfile 与真实 runner main 子进程；已获本片派工授权。先通过新增 descriptor 行为断言观察 red，再做最小提取，运行受影响配置/profile 与 goal configuration 直接消费者；原 profile 字面 JSON/hash、steering pin/port/unpin 不删断言。仅局部测试和必要类型检查，不运行全库或模型。证据在 [docs/evidence/r05](../../docs/evidence/r05/)，唯一进度在 [status](status.md)，独立结论在 [review](review.md)。
