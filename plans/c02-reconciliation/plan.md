# C02 受审计的 uncertain 核对与安全恢复

| 字段 | 内容 |
| --- | --- |
| 计划编号 | C02 |
| 状态 | `in-progress` |
| 创建日期 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 父计划 | [FLOW-001](../flow-001-architecture/plan.md) |
| Owner / model | runner_owner / gpt-6-astra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-reconciliation` / `codex/m2-reconciliation` |
| 基线 | `e845eb069c594989117fadf380335650efef27a2` |

用户已授权整个 Flow plan 的后续实现。本任务增加 uncertain 的事实查询、人工观察记录、安全终止和显式新任务恢复。设计见 [C02 架构](../../docs/architecture/c02-reconciliation.md)，继承 [M1 恢复边界](../../docs/architecture/recovery-boundaries.md)。不将 lease 到期当作进程/工具停止证明，不自动重派，不启动模型。

写入范围：apps/server（m2-workspace 模块和其 test 除外）、packages/storage 的 002-reconciliation migration、此计划三文件、docs/evidence/c02、C02 架构。公共 schema/client 由 Execution Lead 提供，禁止另造共享 schema。

## TODO

- [x] **C02-T01** 核对规则、独立基线、技能与设计，协调唯一公共接口。
- [ ] **C02-T02** 只读核对接口、真实时间戳、不可变观察审计与幂等。
- [ ] **C02-T03** 明确停止/副作用确认后安全终止，释放容量/session，阻止迟到旧 owner。
- [ ] **C02-T04** 操作者显式 retry，新任务 provenance，保留原始历史。
- [ ] **C02-T05** 真实 PG/动态 HTTP 安全、冲突、重启与行为验证，clean-code 和可审查交付。

以真实 HTTP seam 测试用户行为（已经派工授权），不以私有实现 mock 代替数据库原子性。专属 flow_c02，不操作其他测试 DB 或固定端口。独立 [review](review.md) 初始 NOT_STARTED；状态事实源由本人维护 [status](status.md)，main 集成单独核验。
