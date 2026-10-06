# ENG01B 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 11:06:16 UTC |
| Plan | [plan.md](plan.md) |
| 任务层级 | 子task |
| 所属大task | [ENG-001](../../../engineering-delivery/plans/eng01-engineering-delivery/plan.md) |
| co-lead | Execution Lead |
| 单一status owner / model | native_center_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/engineering-execution-profile |
| Branch | codex/engineering-execution-profile |
| 工作基线 / HEAD | c5bab40ffd9a334403c0db743f798d10815961f0 / a750dbaa482ddd54aedd08495c66e73cc1458e53 |
| 工作树dirty状态 | clean（本metadata提交后）；源码冻结 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | integration |
| 检查状态 | 123不同检查分轮通过；实际main 4自有进程正常关闭；最终root noEmit0，raw见delivery-types |
| 已集成main状态 / HEAD | ENG01B未集成；基线c5bab40已有已审ENG01A |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 专用工程宿主及恢复验证已获独立审查通过，等待主线接收 |
| 下一可用交付 | 接收可配置的合成工程通路 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED（runner_owner）target a750dbaa482ddd54aedd08495c66e73cc1458e53 |
| 实现范围 | apps/runner/src/engineering, apps/runner/src/main.ts, apps/runner/src/main-concurrency.test.ts, apps/server/src/engineering, apps/server/src/runners.ts, apps/server/src/execution-profiles/store.ts, apps/server/src/execution-profiles/publication.ts, packages/contracts/src/engineering-profile.ts, packages/contracts/src/engineering.ts, plans/eng01b-engineering-profile, docs/evidence/eng01b |
| Claim | 172ae2c2-8910-4bc8-bca3-53d797da175b v2；11 literal（追加store/publication） |
| 架构影响 | 工程profile用途/持久setup与薄main组合；旧runtime唯一，固定架构target待Lead登记 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| ENG01B-01 | completed | native_center_owner | [claim](../../docs/evidence/eng01b/claim.json)、Interface固定6c9fbfde；共享输入见manifest |
| ENG01B-02 | completed | native_center_owner | 自有持久marker，未知lease不重建 |
| ENG01B-03 | completed | native_center_owner | 已合入固定21e0a56c；中心用途门禁与实际main薄入口已验 |
| ENG01B-04 | completed | native_center_owner | 41入口/旧维护+真实main2+role1；shared inputs固定已合 |
| ENG01B-05 | pending | native_center_owner | 固定target/manifest已独立APPROVED；main未集成 |

status唯一事实源，Lead已登记source131；等待聚合器下一次读取。0provider，不把受信fixture配置称为真实模型工程能力。ENG01A已main并release v3，旧scope停止写入。

边界：本片仅固定calculator-v1合成fixture，0provider。source trusted-fixture-setup是持凭证宿主提交的配置分类，不是独立能力证明或OS沙箱；同UID可信配置仍是假设。历史无profile工程receipt可读，旧排队工程不会自动升级或领取；需重新提交明确pin。未知host记录/项目lease保留，不自动清理；保留工作区最多8个。原ENG01A的target-only限制已在新受理路径闭合，不能据此宣称任意模型工程或普通聊天可用。

独立审查：runner_owner 只读核 a750dbaa482ddd54aedd08495c66e73cc1458e53 / delivery 8cf6a00ef9d9d3b36a7889312e7b1ccc16fc438a，20域源、5共享、5直接验证、18保护输入与46原始证据全同；无未解P1/P2，reviewer未重跑测试或调用provider。lost artifact ACK发生在checker退出后，只证明artifact已持久、verification仍pending及uncertain；重启保留journal且零新claim，不证明未知外部checker已停止。源码继续冻结，等待Lead主线回执。
