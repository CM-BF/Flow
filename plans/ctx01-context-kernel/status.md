# CTX01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-06 04:45:12 UTC |
| 单一status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/context-kernel-probe |
| Branch | codex/context-kernel-probe |
| 工作基线 / HEAD | 75a33dec228e17bbbd0d3be9fd01bc9ac18a0133；本实现待固定 |
| 工作树dirty状态 | 仅领取的实验/计划/证据 |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED（target待固定）：公开行为3/3；60批次/各20，7.878s，0失败；无模型 |
| Review | NOT_STARTED |
| 已集成main状态 / HEAD | 未集成；基线75a33不代表本实验存在 |
| 实现目标 | UNKNOWN |
| 实现范围 | experiments/context-kernel/ |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 固定core的原文回取、独立进程恢复与fork隔离通过；存储开销如实记录 |
| 下一可用交付 | 固定证据交独立方法review；不等同生产context集成 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 架构影响 | 仅实验host封套，不改变生产架构；生产compression owner后续独立设计 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| CTX01-01 | completed | runner_owner | claim v1/provenance/原始npm metadata |
| CTX01-02 | completed | runner_owner | 3/3公开行为；真实OS进程restart/PID/digest验证 |
| CTX01-03 | completed | runner_owner | 原始measurements.json60样本，8,265,090原文bytes |
| CTX01-04 | in-progress | independent reviewer | 交付target待固定；NOT_STARTED |

权威source路径即本status，已发Lead登记；未亲自核dashboard聚合。没有原始模型调用，不消费任何封存预算。
