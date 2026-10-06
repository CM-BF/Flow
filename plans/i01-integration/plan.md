# M1 集成验收

| 字段 | 内容 |
| --- | --- |
| 计划编号 | I01 |
| 状态 | `in-progress` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-05 |
| Owner / model | Execution Lead / gpt-6-astra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-integration` / `codex/m1-integration` |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |

在独立 integration worktree 合入经过审查的 features，核验 M1；独立审查未通过不得更新 main。复用 Node/TypeScript/PostgreSQL 任务技能发现和本地 tdd/codebase-design/clean-code 方法，测试跨公开 HTTP/进程 Interface，不读取数据库断言实现细节。隔离数据库 flow_i01，仅测试初始化重建其 schema。

## TODO

- [x] **I01-01** 独立复核 C01/R01/L01，修复 blocking findings
- [x] **I01-02** 中心、两个独立 runner 进程与 CLI 进程持久受理/重连/决策/取消/折叠证据/失联集成测试
- [x] **I01-03** W01 两主题真实浏览器关闭/后台继续/CLI决策/Web重连
- [x] **I01-04** R02 真实 harness 的系统闭环与随机 fixture/恢复对照证据
- [ ] **I01-05** clean-code、最终检查/独立review，明确 main 集成和用户目标证据

不把 API/fixture 通过写成浏览器、真实模型、跨机或容量通过。每阶段更新 [status](status.md)，具体审查记录见 [review](review.md)。
