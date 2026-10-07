# COST01A 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 14:30 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | [COST-001](../../../execution-cost/plans/cost01-execution-cost/plan.md) |
| co-lead | Execution Lead |
| 单一status owner / model | assignment_review / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/cost-usage-readout |
| Branch | codex/cost-usage-readout |
| 工作基线 / HEAD | 8dd6fe7978bb85674d9dbd945fc94084967536c1 / 实现 27d4f5431bff06d44a42588896fc0b435d0f556d；收口前metadata f2ba0a8a4cad542e1487dd40e1ccbaaffceca3a9 |
| 工作树dirty状态 | 产品源码停写；本次仅plan/evidence收口，提交后核clean |
| 工作分支状态 | completed |
| 本片段交付阶段 | delivered |
| 检查状态 | PASSED：27d4f5431bff06d44a42588896fc0b435d0f556d；新9项公开HTTP/PG + 原5项producer分轮14不同；noEmit0，见README |
| 已集成main状态 / HEAD | 已集成 main/origin 61744371606f3ee890a9d64e21b33f52940d6e14；固定观察，5领域源逐字一致，见 [main-receipt](../../docs/evidence/cost01a/main-receipt.json) |
| 实现目标 | 27d4f5431bff06d44a42588896fc0b435d0f556d |
| 实现范围 | apps/server/src/usage-readout, apps/server/src/usage.ts, packages/contracts/src/usage-readout.ts |
| 阶段 | M2 |
| 优先级 | 3 |
| 当前产出 | 主线已提供任务输入、缓存、输出及估价的统一读取能力，明确标出缺测和覆盖不足。 |
| 下一可用交付 | 本片段已交付；阶段归因、预算和界面呈现保留为后继。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED：27d4f5431bff06d44a42588896fc0b435d0f556d；native_center_owner只读无P1/P2 |
| Claim | f3a39671-81b7-4f42-81d9-673925a7cd36 v2；已停写，推送后原子release，以协调账本回执为准；见 main-receipt |
| 架构影响 | 新 owner 只读投影；共享 exports/client/default factory 已独审进入上述 main，架构基线同步由 Execution Lead 协调；本收口无结构变化 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| COST01A-01 | completed | assignment_review | 合同/Interface/source-facts已固定 |
| COST01A-02 | completed | assignment_review | 唯一贡献函数/有界只读路由 |
| COST01A-03 | completed | assignment_review | 14不同检查分轮、0provider、四随机库清理 |
| COST01A-04 | completed | assignment_review | 独审APPROVED；main已接收，五源一致 |

## 技术事实与限制

原 usage.ts 仅持久累计 input/output/cost；缓存原值在 sample JSON。共享纯基线函数已由原写入和新读口双消费者复用，没有第二套累计账本；Lead 移交的 usage.ts 已保持原累计语义。

worktree 创建前可用 1,394,163,712 B，估算已跟踪文件按 4 KiB 取整 162,824,192 B；创建后约 1.147 GiB，未安装。保留至少 1 GiB 共享余量，不启动大复制。

## Dashboard

本 status 是唯一手填事实源。Execution Lead 已实际聚合158源，本项live/errors=[]；最终metadata时间按本机UTC记录。COST-001 的阶段归因/全局预算/三端完整验收仍 open。

共享磁盘低于1GiB reserve（Lead原14:13手填时间已纠正，不作为采样时间），已完成检查自然收尾且自有随机库已DROP；不再启动新PG/安装/大构建。当前仅固定可审片段，后续需要新检查须先解除资源限制。

## 主线接收

2026-10-06 14:30 UTC 核 main/origin 与远端同一固定提交，27d4领域、fb0薄client、7150生产接线均为祖先。五领域文件对已审实现和当前工作树逐字一致。生产1/1与types0沿已核证据，不在本次重跑；个人运行环境未更新。原14不同检查和历史manifest/raw保持原样。
