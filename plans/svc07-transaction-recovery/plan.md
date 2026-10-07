# SVC07 事务连接断连恢复

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | SVC07 / completed |
| 创建日期 / 最近更新 | 2026-10-06 20:04 UTC / 2026-10-07 02:20 UTC |
| 所属大task | [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)，追溯 REQ-19/SVC |
| co-lead | mika |
| Owner / model | db_transaction_owner / gpt-6-astra |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/server-transaction-disconnect / codex/server-transaction-disconnect |
| 基线 | 22a0806bc2465e11096949618113833f31766b19 |

目标：中心的公开事务模块在借用连接期间处理连接错误；保留最初失败和提交未知结果，失效连接不复用，后续独立事务仍能成功。首片用受控 fake 验证生命周期，不将其等同真实 PostgreSQL 断连或 HTTP 验证，不归因历史个人中心退出。

保持 `transaction(pool, run, readOnly)` Interface。模块拥有借用期监听、BEGIN/COMMIT/ROLLBACK 与唯一释放；调用者仍拥有业务回调及业务幂等恢复。连接故障只记录状态，不自动重执回调，不在回调仍活跃时提前释放。COMMIT 已收到 ACK 后的连接错误不撤销成功；COMMIT 拒绝的结果保持未知，不以随后 ROLLBACK 成功推断未提交。首次失败对象（含非 Error 值）不能被清理错误替换。

遵守根 [模块化要求](../../AGENTS.md#modular-design)。现有专用插件连接不改动；不引入第二 pool handler、全局 uncaughtException、调度器或取消框架。回调自己的无限等待不在本片解决；release/destroy 发起不等于已观测物理 socket 关闭。

## TODO

- [x] **SVC07-01** 核定窄设计、固定输入、唯一 worktree 与原子领取。
- [x] **SVC07-02** 先写公开 Interface 失败反例，再实现连接错误与清理生命周期。
- [x] **SVC07-03** 完成显式 fake、局部 types、质量复核和固定提交，取得独立 source review。
- [x] **SVC07-04** 受控窗口完成必要直接消费者检查、main 接收与架构基线更新登记；[main回执](../../docs/evidence/svc07/main-receipt.json)绑定6b531d46，架构更新由WebD06接续，未声称图已发布。

## 验收与证据

正常/只读事务、获取失败、checkout 后立即 error、pending 回调断连、查询中错误、COMMIT/ROLLBACK 双失败、HttpError 与非 Error 原值、ACK 后错误、同步归还下一借用、唯一 destroy 与下一独立事务恢复。真实消费者候选是 `server.test.ts` 的 concurrent claims/command retries 和 accepted commands across restart；执行前另核完整源码/SQL、专库和资源窗口，首片不启动 PG。

按 [status](status.md) 记录证据与阶段；独立审查按 [review](review.md) 绑定固定提交。证据和技能记录见 [Interface 与质量](../../docs/evidence/svc07/README.md)。
