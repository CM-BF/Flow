# S01P07：空闲领取与丢响应恢复

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | S01P07 / in-progress |
| 创建 / 最近更新 | 2026-10-06 20:06:48 UTC |
| 所属大task | [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead / Owner / model | mika / status_read / gpt-6-astra |
| 原验收追溯 | S01-06：领取可恢复与长期运行资源边界；不另建容量目标 |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-claim-recovery / codex/runner-claim-recovery |
| 基线 | 22a0806bc2465e11096949618113833f31766b19 |

目标：保持默认 500ms 空闲轮询，使重复空领取不再改写本地持久日志；丢失领取响应后能通过同一稳定身份查询或重发，最多分配一个 attempt。保留原日志 durability、当前 ownership/lease/cancel 检查和已执行副作用未知时的保守阻塞。

遵循[统一模块规则](../../AGENTS.md#modular-design)，采用已批准的 [最小接口](../../docs/evidence/s01p07/interface.md)。v1 空 body HTTP 接口继续兼容；新 runtime 默认使用显式 v2，不通过 fallback 掩盖不支持。没有退避、调度器、缓存、迁移或新服务。

## TODO

- [x] **S01P07-01** 冻结协议、自身份、事务回执和日志职责；直接消费者范围齐备。
- [x] **S01P07-02** 中心复用原分配内核，非空回执与 attempt 同事务；完成 client/route 受权接线。
- [x] **S01P07-03** runner 默认 v2：持久机会、同 key 恢复、原 fatal/drain 与 pre-adapter heartbeat 保持。
- [x] **S01P07-04** 通过必要 contract/client/journal/runtime 与隔离 PG 事务检查，绑定真实选择数及清理证据。
- [ ] **S01P07-05** 独立固定提交 review、直接消费者与 main 接收；唯一 status/dashboard 同步。

## 验收与限制

当前分别完成历史85不同非PG行为、R2中心8组PG、原capacity4组PG以及各自局部strict；原失败与修后证据保留，本次4组结果待独审/main接收。无provider调用；所有实际窗口已归还，不授权重跑。验证分层见接口页；旧 v1 unknown 与已持久 assignment 重启不运行 adapter，不能将本片描述为任意崩溃窗口的自动恢复。历史 S01 的空轮 API 计数不等物理 I/O；本片尚无优化实测。
