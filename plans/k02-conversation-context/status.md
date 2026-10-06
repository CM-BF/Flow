# K02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 05:41:41 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | b01_bounded_reads / gpt-6-astra ultra；lead mika |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/conversation-context |
| Branch | codex/conversation-context |
| 工作基线 / HEAD | base fb906cb42391971a8b315dbd813f7633927d7265；首接口待固定 |
| 工作树dirty状态 | 首合同/schema/计划待提交 |
| 工作分支状态 | in-progress |
| 检查状态 | NOT_RUN；接口stub尚未实现 |
| 已集成main状态 / HEAD | 未集成；base fb906cb42391971a8b315dbd813f7633927d7265 |
| 实现目标 | 未固定 |
| 实现范围 | apps/server/src/conversation-context, apps/server/src/knowledge/storage.ts, apps/server/src/conversations/admission.ts, apps/server/src/conversations/commands.ts, apps/server/src/conversations/state.ts, apps/server/src/conversation-queue/commands.ts, apps/server/src/conversation-queue/controls.ts, apps/server/src/conversation-queue/promotion.ts, apps/server/src/conversation-queue/queries.ts, apps/server/src/conversation-queue/store.ts, apps/server/src/reconciliation.ts, apps/server/src/runners.ts, packages/contracts/src/conversation-context.ts, packages/contracts/src/conversation-queue.ts, packages/contracts/src/conversations.ts, packages/contracts/src/runner.ts, packages/storage/migrations/018-conversation-context.sql |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 2 |
| 当前产出 | 已固定公开原文与私有执行材料的隔离方案 |
| 下一可用交付 | 可选知识引用随对话发送和排队冻结保存 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| K02-01 | in-progress | b01_bounded_reads | [Interface](../../docs/evidence/k02/interface.md) |
| K02-02 | pending | b01_bounded_reads | 未执行 |
| K02-03 | pending | b01_bounded_reads | 未执行 |
| K02-04 | pending | b01_bounded_reads / Mika | 未执行 |
| K02-05 | pending | b01_bounded_reads / Lead | 未集成 |
| K02-06 | pending | Goal Owner / 后继owner | 后继范围保持开放 |

claim347d4777-d430-4f06-8cba-ed8b180f2ba9 v1 ACTIVE，COMMITTED05:38:49.721Z，[receipt](../../docs/evidence/k02/claim-receipt.json)。开工核base/branch/clean与liveledger吻合，唯一worker顺序转入此WT。K01已release不再写。新context/input表和runner私有projection seam为架构影响，target固定后交Lead同步。server/index/client/CLI/exports与Web由各owner接线，本scope不修改；runners.ts/runner.ts先交小接口供Mika审查后协调handoff，不自行release。
