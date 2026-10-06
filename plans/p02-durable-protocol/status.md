# P02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 03:00 UTC / main最近只读观察51b1a4d09076c9e399c2611820d12bcebfa341b3 |
| 单一status owner / model | assignment_review / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/protocol-dispatch |
| Branch | codex/protocol-dispatch |
| 工作基线 / HEAD | base 72278b22ae81f551dc13d68da2fb45f2ef182038；被测HEAD f942e5a5cbf138993dd7521792dd071a172c17e1 |
| 工作树dirty状态 | 被测实现已提交；本记录提交前仅证据和metadata，交付核验clean |
| 工作分支状态 | completed（分支修复已交付，待独立复审/main集成） |
| 检查状态 | PASSED：target f942e5a5cbf138993dd7521792dd071a172c17e1，runtime15/15（20.64s）+typecheck；未改中心3项保留e295基线；[原始证据](../../docs/evidence/p02/report.md) |
| Review | CHANGES_REQUESTED：两项P2已修复f942e5a，待Lead实际复审，见[review](review.md) |
| 已集成main状态 / HEAD | P02未集成；02:51 UTC观察main=51b1a4d09076c9e399c2611820d12bcebfa341b3，分支验证不替代main |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 目录失败timer与端点初始化P2已修复，5项新故障与15项runtime回归通过 |
| 下一可用交付 | 固定修复target后复审；继续P01-06剩余互操作能力 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | f942e5a5cbf138993dd7521792dd071a172c17e1 |
| 实现范围 | apps/server/src/protocol-dispatch/, apps/runner/src/protocol-dispatch/, packages/contracts/src/protocol-dispatch.ts, packages/contracts/src/protocol-task.ts, packages/storage/migrations/005-protocol-dispatch.sql, apps/server/src/index.ts, apps/runner/src/main.ts, apps/cli/src/index.ts |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| P02-01 | completed | assignment_review | 合同+共享client/harness/outbox/lease与生产入口已接入；endpointDigest固定URL身份 |
| P02-02 | completed | assignment_review | 真PG/HTTP3项：一次许可、binding重启、sending未知、过期不复活、取消pending |
| P02-03 | completed | assignment_review | runtime/租约/产物、ACK超时、实际main进程通过 |
| P02-04 | completed | assignment_review | 生产基线13/13；修复后受影响runtime15/15含真实main与初始化故障，0模型0云 |
| P02-05 | completed | assignment_review | clean-code、原始JSON/hash和固定target已交独立review；P2已修复待复审，未自行批准 |

## 边界 / 未验证

本slice仅A2A 1.0 JSONRPC Task-based持久出站；MCP Tasks扩展、持久elicitation、完整交互与通用全程成本预算仍open，P01-06总项不勾完。取消/失联不证明远端停止，已过期ownership保持C02人工核对。官方peer内存store仅确定性测试夹具；Flow权威状态在真实PostgreSQL。未调用真实模型/公网对端，未作完整协议conformance宣称。

## 下一步与handoff

Lead按review.md固定target只读审查，处理findings后合入main；owner仅维护本status，不把分支完成写成main具备。正式生产入口挂载与smoke已完成，无等待共享实现的阻塞。

## Dashboard同步

本status为P02唯一手填源；Lead登记聚合，不维护第二份手填JSON。交付时将实际HEAD/clean证据回传Lead核对。
