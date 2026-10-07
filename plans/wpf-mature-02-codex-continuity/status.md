# MATURE02C02 状态

| 字段 | 当前事实 |
| --- | --- |
| task ID | MATURE02C02 |
| 层级 | 子task |
| 所属大task | [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| 最近更新 / 最近main同步核验 | 2026-10-07 02:38:35 UTC；main集成仍未完成 |
| 阶段 | M2 |
| 优先级 | 2 |
| 本片段交付阶段 | implementation |
| 工作分支状态 | in-progress |
| 当前产出 | 首次公开接口验证5项通过；已定位并修正测试把会话存储目录误当工作目录的问题，定向回归准备完成但未运行。 |
| 下一可用交付 | 验证同一会话存储支持不同轮次的工作目录，再安排第二轮公开接口的定向验证。 |
| 当前阻塞 | ACTIVE: 连续会话仍缺修正后的实际通过证据；先等待定向注入检查，真实PG须另有新窗口。旧失败临时目录KEEP。 |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/codex-conversation-continuity |
| Branch | codex/codex-conversation-continuity |
| 工作基线 / HEAD | eae85567ba5dfb650ba71b473917130f87b5945c |
| 工作树dirty状态 | 恢复时d5e94525=origin且clean；当前仅fixture、直接回归/有限诊断与own metadata小diff。原R1 manifest/raw和准备manifest保持历史字节；无产品改动。 |
| HEAD（最近观察） | d5e94525d8d9bc0119059f9c4c541b2b669a46be |
| claim | 8ad6536b-1194-44a4-9078-a92215bec7a2 v2 ACTIVE，21 literal，amend COMMITTED 2026-10-06T21:25:31.797Z |
| 实现目标 | 413420a1c0abc76850ab61f8bf67c9d9ac81a494 |
| 实现范围 | packages/contracts/src/execution-profiles.ts, packages/contracts/src/tasks.ts, packages/contracts/src/native-harness.ts, apps/server/src/execution-profiles/store.ts, apps/runner/src/native-harness/descriptor.ts, apps/runner/src/native-harness/codex/adapter.ts, apps/runner/src/native-harness/codex/exchange.ts, apps/runner/src/native-harness/codex/turn.ts, apps/runner/src/native-harness/codex/wire.ts, apps/runner/src/native-harness/codex/index.ts, apps/runner/src/native-harness/codex/session-storage.ts |
| Review | 413420a1 SOURCE_REVIEW_APPROVED / VALIDATION_PENDING，mika + architecture_read 2026-10-06T21:26:29Z附近；0P1/P2，仅固定源码范围。3ccae21a test delta与3c33ca4a PG helper窄修已SOURCE_REVIEW_APPROVED/VALIDATION_PENDING；外部运行记录入口原三P2已复审关闭；依赖kind修复e1e91177已独审0P1/P2；group UNKNOWN窄修与4项纯函数已独审通过；Mika + status_read于2026-10-06 21:59 UTC批准fd5bc893 PG_PREPARATION_APPROVED，0P1/P2，准备批准历史保留；2026-10-07 R1 actual失败结果经root只读核与repository_map独立忠实性审通过0P1/P2；仅失败事实批准。cwd fixture源码修正/新检查仍待审、NOT_RUN。 |
| 检查 | 合同red 1/3；首5文件log 50/53，fixture时间戳修后定向7/7、exit0。直接consumer65/66、exit1；随后仅post-terminal真实交付与抽取影响8/8、43未选、exit0；类型1个fixture推断诊断已窄修，先resource NOT_RUN，恢复后唯一finalfocused types exit0/2.417s/raw0B（含PG源码静态、不执行）。旧检查0PG；本次R1公开PG 6选/5过/1失败，worker与outer exit1；DB与服务清理收据完整，外层TMP按失败KEEP。0Codex/provider/install。 |
| main集成 | NOT_INTEGRATED；基线 eae85567ba5dfb650ba71b473917130f87b5945c |
| Dashboard | Lead已登记至178来源；本次修正解析字段，等待下一次正常聚合；不改生成JSON。 |
| 架构影响 | 私有持久存储绑定与单 exchange 的 start/resume 选择；具体实现待固定后登记图更新 target。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| C02-01 | in-progress | chatui01_owner | [Interface](../../docs/evidence/mature02c02/interface.md)，已实现；新contract/storage反例通过；R1旧目录分页/sentinel等5项真实PG通过，整组失败结果待独审 |
| C02-02 | in-progress | chatui01_owner | 原单FSM start/resume，7项注入通过；旧post-terminal确定化真实交付反例已通过，收据在fixture-delta-* |
| C02-03 | in-progress | chatui01_owner | 6项public API首次实际5过/1失败；第二任务轮询预算耗尽，未达连续恢复验收。见 ../../docs/evidence/mature02c02/pg-MATURE02C02-PG-20261007-R1.report.md；窗口CONSUMED/CLOSED，不自动重试；[cwd诊断与窄修](../../docs/evidence/mature02c02/cwd-regression-diagnosis.md)准备1项注入回归，尚NOT_RUN |
| C02-04 | pending | chatui01_owner | [Interface后继](../../docs/evidence/mature02c02/interface.md#后继生产路径本次未领取)记录config/launch先4源、main后2源及publisher ACK→storage顺序；均未领取，实际trusted recipe/持久root生命周期待定；evidence.ts还需固定0.154 global remote-status严格分类，均未领取/未改。真实两轮另排；后继核合法32/512分片因终身通知计数>256误拒风险，保留stream/公开thinking，不改未领evidence/R06。 |
| C02-05 | pending | chatui01_owner | 目录协商/client、conversations小harness policy与增量migration、Web/TUI未领取；state/replies须消费REQ15批量Interface |

供给唯一入口：[source-request](../../docs/evidence/mature02c02/source-request.json)，291项1548050逻辑B（已供给）；
依赖：[dependency-link-request](../../docs/evidence/mature02c02/dependency-link-request.json)，17已装第三方+3本树@flow，只请求20个ignored links。供给回执已归档 source-provision-receipt.json；owner未安装或自行物化。

检查原件：contract-red-*、continuity-first-*、continuity-green-*、direct-consumers-*、focused-types-first-*。首5文件收据退出码误用日志推断，独立 continuity-first-correction.json 将实际进程退出码标UNKNOWN；50pass只引用Vitest报告，未声称整组成功。

公开API原准备包（历史批准，R1已消费失败）：[固定输入](../../docs/evidence/mature02c02/pg-source-manifest.json) → [资源与接收条件](../../docs/evidence/mature02c02/pg-window-request.md)。源码/metadata准备不占共享PG运行时段。

R1 唯一结果：[报告](../../docs/evidence/mature02c02/pg-MATURE02C02-PG-20261007-R1.report.md) → [manifest](../../docs/evidence/mature02c02/pg-MATURE02C02-PG-20261007-R1.manifest.json)。原source/claim v2保持，失败根KEEP；Dashboard等待正常聚合本status，无额外运行检查。

当前唯一小检查准备：[cwd-regression-check-request](../../docs/evidence/mature02c02/cwd-regression-check-request.json)，1项/30s/0PG与真实native；未获新执行窗口，原R1目录保持KEEP。
