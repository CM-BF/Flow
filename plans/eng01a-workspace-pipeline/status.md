# ENG01A 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 10:40:12 UTC |
| Plan | [plan.md](plan.md) |
| 任务层级 | 子task |
| 所属大task | [ENG-001](../../../engineering-delivery/plans/eng01-engineering-delivery/plan.md) |
| co-lead | Execution Lead |
| 单一status owner / model | native_center_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/engineering-workspace-pipeline |
| Branch | codex/engineering-workspace-pipeline |
| 工作基线 / HEAD | f181d84b5fb3652d62e2a181acff442d42b3e066 / 040fdede227fe22504972ea7a053c23f14a30f52 |
| 工作树dirty状态 | 14源码冻结；仅本scope metadata收口 |
| 工作分支状态 | integrated |
| 本片段交付阶段 | delivered |
| 检查状态 | 80不同检查：E0 10、E1模块18、直接消费者47、真实PG纵向5；root noEmit0；详见validation.md |
| 已集成main状态 / HEAD | c5bab40ffd9a334403c0db743f798d10815961f0；14源码精确相同，组合3PG/root类型检查通过 |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 受控合成代码已能真实写改、独立检查并读回固定差异与结果；整片已通过独立审查并集成主线 |
| 下一可用交付 | 本片段已交付；显式工程配置与持久恢复转ENG01B |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，E0 APPROVED / E1 APPROVED（runner_owner） |
| Claim | 7830846a-55a7-4a3b-b889-7a1bb2a1e21b v2；本scope停止写入，metadata推送后原子release |
| 实现目标 | 040fdede227fe22504972ea7a053c23f14a30f52 |
| 实现范围 | apps/runner/src/engineering/adapter.ts, apps/runner/src/engineering/checker.ts, apps/runner/src/engineering/integration.test.ts, apps/runner/src/engineering/resources.ts, apps/runner/src/engineering/workspace.test.ts, apps/runner/src/engineering/workspace.ts, apps/server/src/engineering/verification.test.ts, apps/server/src/engineering/verification.ts, apps/server/src/events.ts, apps/server/src/evidence.ts, apps/server/src/runners.ts, packages/contracts/src/engineering.ts, packages/contracts/src/runner.ts, packages/contracts/src/tasks.ts |
| 架构影响 | 新workspace/checker/receipt小Module，center只验关联；runtime/outbox复用。架构固定数据待Lead于已审target登记 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| ENG01A-01 | completed | native_center_owner | [claim](../../docs/evidence/eng01a/claim.json)、[Interface](../../docs/evidence/eng01a/interface.md) |
| ENG01A-02 | completed | native_center_owner | 受信工程intent/checker receipt与targetRunner过滤 |
| ENG01A-03 | completed | native_center_owner | 不可变基线与完整内容集/命令资源边界 |
| ENG01A-04 | completed | native_center_owner | 独立Git/PG真实纵向与unknown恢复 |
| ENG01A-05 | completed | native_center_owner | [main receipt](../../docs/evidence/eng01a/main-receipt.json)；独审/main已完成 |

本status为唯一手填事实源；Lead已登记authority（registry125）。0模型，旧只读native、个人服务与既有预算保持。

限制：本片是0模型受信synthetic setup。targetRunnerId仅路由pin；误指普通fixture仍会领取但无工程verification，最终uncertain；后继ENG001-04关闭工程profile/能力登记缺口。不是任意公开配置的日用工程能力，不证明同UID恶意代码隔离、原生provider或跨进程project重建。
