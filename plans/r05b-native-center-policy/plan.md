# R05B 中心原生普通 final

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | R05B / in-progress |
| 创建 / 更新 | 2026-10-06 |
| 所属大task | [FLOW-002](../flow-002-provider-harness/plan.md) |
| co-lead | Execution Lead |
| Owner / model | native_center_owner / gpt-6-astra |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/native-center-policy / codex/native-center-policy |
| 基线 | 3d31ba89bc3696e64d15f12f9d8c703e4d7bd914 |

目标：中心用有限来源策略接收 Codex 普通任务的严格配置与 final，保留旧 Claude 配置 JSON/hash、消息身份和已有状态语义。采用[项目模块化规则](../../AGENTS.md#modular-design)，不复制独立设计权威。

## TODO

- [x] **R05B-01** 确认职责、固定原生 schema、独立 worktree 与精确原子领取。
- [ ] **R05B-02** 新增严格 Codex 配置/final、识别来源、task admission 与默认旧目录过滤。
- [ ] **R05B-03** 前进 migration 025 与真实 PostgreSQL 旧行升级、身份隔离、重复事件和直接消费者验证。
- [ ] **R05B-04** 固定实现提交与证据，独立 review 后受控集成 main。

## 范围与验收

精确写范围以[已提交领取回执](../../docs/evidence/r05b/claim.json)为准。B1 仅普通 task/final 与中心配置；Codex conversation、目录协商、Web、真实 native 进程、模型调用、认证、resume/queue/steer/stream/goal ports 均没有在本片实现。默认旧目录在 SQL limit 前只选 Claude；Claude 会话拒绝 Codex profile。共享 exports/server mount 由 Lead 持有并集成。

旧 Claude codec 不变；Codex 独立严格分支，不填 Claude permissionMode/thinking/USD/maxTurns。access:none 是 Flow 请求意图，原生 never/read-only 配置并不证明无工具执行。observed thread 配置与 actual unknown 分开。

验收由公共 schema、中心事务、真实独立随机 PG 数据库验证：旧 rows/profile 摘要升级保持、重复 migration、来源 namespace、未知 source/version、raw turn/item 身份复算、当前 runner/task/session 绑定、fence、ACK 重复与异内容冲突、UTF-8 上限、默认目录与旧 Claude 直接消费者。固定 Node24/pnpm9.15.4/Vitest4.0.18。注入对端不证明生产 Codex 已可执行。
