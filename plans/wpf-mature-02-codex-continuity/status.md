# MATURE02C02 状态

| 字段 | 当前事实 |
| --- | --- |
| task ID | MATURE02C02 |
| 层级 | 子task |
| 所属大task | [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| 最近更新 / 最近main同步核验 | 2026-10-06 22:00:02 UTC；main最近核验为基线，未集成 |
| 阶段 | M2 |
| 优先级 | 2 |
| 本片段交付阶段 | review |
| 工作分支状态 | in-progress |
| 当前产出 | 持久会话接口已通过源码审查、注入恢复与类型检查；公开任务链路等待专库验证。 |
| 下一可用交付 | 两轮独立执行复用同一自有会话存储的公开任务接口。 |
| 当前阻塞 | ACTIVE: 真实公开任务 API 准备包已独审通过，等待专用 PG 窗口交接；已完成的注入与类型验证不代表真实native恢复。 |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/codex-conversation-continuity |
| Branch | codex/codex-conversation-continuity |
| 工作基线 / HEAD | eae85567ba5dfb650ba71b473917130f87b5945c |
| 工作树dirty状态 | 最近fd5bc893 clean/pushed、准备包独审通过；本次只记录批准metadata，输入/执行源/旧raw不变。final focused types已实际exit0。 |
| HEAD（最近观察） | fd5bc893cbb3c577e6cb1a6d3c902c149b9025a5 |
| claim | 8ad6536b-1194-44a4-9078-a92215bec7a2 v2 ACTIVE，21 literal，amend COMMITTED 2026-10-06T21:25:31.797Z |
| 实现目标 | 413420a1c0abc76850ab61f8bf67c9d9ac81a494 |
| 实现范围 | packages/contracts/src/execution-profiles.ts, packages/contracts/src/tasks.ts, packages/contracts/src/native-harness.ts, apps/server/src/execution-profiles/store.ts, apps/runner/src/native-harness/descriptor.ts, apps/runner/src/native-harness/codex/adapter.ts, apps/runner/src/native-harness/codex/exchange.ts, apps/runner/src/native-harness/codex/turn.ts, apps/runner/src/native-harness/codex/wire.ts, apps/runner/src/native-harness/codex/index.ts, apps/runner/src/native-harness/codex/session-storage.ts |
| Review | 413420a1 SOURCE_REVIEW_APPROVED / VALIDATION_PENDING，mika + architecture_read 2026-10-06T21:26:29Z附近；0P1/P2，仅固定源码范围。3ccae21a test delta与3c33ca4a PG helper窄修已SOURCE_REVIEW_APPROVED/VALIDATION_PENDING；外部运行记录入口原三P2已复审关闭；依赖kind修复e1e91177已独审0P1/P2；group UNKNOWN窄修与4项纯函数已独审通过；Mika + status_read于2026-10-06 21:59 UTC批准fd5bc893 PG_PREPARATION_APPROVED，0P1/P2，ACTUAL_NOT_OPEN。 |
| 检查 | 合同red 1/3；首5文件log 50/53，fixture时间戳修后定向7/7、exit0。直接consumer65/66、exit1；随后仅post-terminal真实交付与抽取影响8/8、43未选、exit0；类型1个fixture推断诊断已窄修，先resource NOT_RUN，恢复后唯一finalfocused types exit0/2.417s/raw0B（含PG源码静态、不执行）。0PG/Codex/provider/install。 |
| main集成 | NOT_INTEGRATED；基线 eae85567ba5dfb650ba71b473917130f87b5945c |
| Dashboard | Lead已登记至178来源；本次修正解析字段，等待下一次正常聚合；不改生成JSON。 |
| 架构影响 | 私有持久存储绑定与单 exchange 的 start/resume 选择；具体实现待固定后登记图更新 target。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| C02-01 | in-progress | chatui01_owner | [Interface](../../docs/evidence/mature02c02/interface.md)，已实现；新contract/storage反例通过记录见 checks，旧目录真实PG待窗口 |
| C02-02 | in-progress | chatui01_owner | 原单FSM start/resume，7项注入通过；旧post-terminal确定化真实交付反例已通过，收据在fixture-delta-* |
| C02-03 | pending | chatui01_owner | 6项public API专库源码已审；生命周期两P2源码复审关闭/types0；外部记录入口及固定包已独审通过；实际6用例NOT_RUN，等待共享窗口交接；注入不代表真实native恢复 |
| C02-04 | pending | chatui01_owner | R05D main/config/launch尚需trusted factory/storage接线；evidence.ts还需固定0.154 global remote-status严格分类，均未领取/未改。真实两轮另排；后继核合法32/512分片因终身通知计数>256误拒风险，保留stream/公开thinking，不改未领evidence/R06。 |
| C02-05 | pending | chatui01_owner | 目录协商/client、conversations小harness policy与增量migration、Web/TUI未领取；state/replies须消费REQ15批量Interface |

供给唯一入口：[source-request](../../docs/evidence/mature02c02/source-request.json)，291项1548050逻辑B（已供给）；
依赖：[dependency-link-request](../../docs/evidence/mature02c02/dependency-link-request.json)，17已装第三方+3本树@flow，只请求20个ignored links。供给回执已归档 source-provision-receipt.json；owner未安装或自行物化。

检查原件：contract-red-*、continuity-first-*、continuity-green-*、direct-consumers-*、focused-types-first-*。首5文件收据退出码误用日志推断，独立 continuity-first-correction.json 将实际进程退出码标UNKNOWN；50pass只引用Vitest报告，未声称整组成功。

公开API单窗口准备（NOT_OPEN）：[固定输入](../../docs/evidence/mature02c02/pg-source-manifest.json) → [资源与接收条件](../../docs/evidence/mature02c02/pg-window-request.md)。源码/metadata准备不占共享PG运行时段。
