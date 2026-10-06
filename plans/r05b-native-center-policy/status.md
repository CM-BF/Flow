# R05B 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:25 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | [FLOW-002](../flow-002-provider-harness/plan.md) |
| co-lead | Execution Lead |
| 单一status owner / model | native_center_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/native-center-policy |
| Branch | codex/native-center-policy |
| 工作基线 / HEAD | 3d31ba89bc3696e64d15f12f9d8c703e4d7bd914 / 实现4944d1e795326ad9d437c8d6a4ea88f52db619d9；随后仅本status/review/manifest metadata |
| 工作树dirty状态 | 实现源码/测试已提交；本次仅补齐工具转录与hash/bytes metadata，提交后clean |
| 工作分支状态 | completed |
| 本片段交付阶段 | delivered |
| 检查状态 | PASSED：16显式文件157不同检查；settings损坏补充选择1通过；tsc exit0；[证据](../../docs/evidence/r05b/README.md) |
| 已集成main状态 / HEAD | 已集成 3418fe682944145494463dca9e09f89c8b9c2295；20源码hash全同 |
| 实现目标 | 4944d1e795326ad9d437c8d6a4ea88f52db619d9 |
| 实现范围 | apps/server/src/assistant/native-harness.test.ts, apps/server/src/assistant/store.ts, apps/server/src/conversations/commands.ts, apps/server/src/conversations/conversations.test.ts, apps/server/src/conversations/replies.ts, apps/server/src/execution-profiles/index.ts, apps/server/src/execution-profiles/store.ts, apps/server/src/native-harness-migration.ts, apps/server/src/native-harness-policy.test.ts, apps/server/src/native-harness-policy.ts, packages/contracts/src/assistant.test.ts, packages/contracts/src/assistant.ts, packages/contracts/src/execution-profiles.test.ts, packages/contracts/src/execution-profiles.ts, packages/contracts/src/harnesses.test.ts, packages/contracts/src/harnesses.ts, packages/contracts/src/runner.ts, packages/contracts/src/tasks.ts, packages/storage/migrations/025-native-harness-sources.sql |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 普通回复来源隔离、旧数据升级和 Claude 兼容已审并集成主线 |
| 下一可用交付 | 本片段已交付；Codex 原生 adapter 为另行领取的后继 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED：Execution Lead仅19项领域源码；F01 mount由Mika独审 |
| Claim | b205dd73-4edb-4d76-a13b-0fc8a7532b1b v2 |
| 架构影响 | 新增中心静态来源策略与025身份namespace；固定架构图待Lead在集成target登记 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| R05B-01 | completed | native_center_owner | claim.json；固定本机0.154.0 schema与旧中心源码 |
| R05B-02 | completed | native_center_owner | strict union与静态policy；旧会话/profile/runner直接消费者通过 |
| R05B-03 | completed | native_center_owner | 真实PG11/11；旧rows保持；1MiB列表725B/预览4000B；旧中心46/46与preview21/21 |
| R05B-04 | completed | native_center_owner | [fixed manifest](../../docs/evidence/r05b/fixed-manifest.json)；Execution Lead独审通过；[main receipt](../../docs/evidence/r05b/main-receipt.json) |

## Dashboard 同步

本status为唯一手填事实源；等待Lead登记权威source及聚合器展示。大task关联明确，未编辑生成状态。

## 边界

0 provider / 0 app-server / 0 auth。Codex首片仅PG与注入验证，尚无生产受控native执行、会话或Web交付。scope外公共export/mount由Lead完成，不将本分支能力称main能力。

## 独审证据补充

按Execution Lead要求，固化已有工具输出及实际exit/selected，并在固定manifest列出逐文件SHA256/bytes。没有重跑测试，没有修改产品源码。原运行没有独立进程日志；工具转录来源与截取边界在[README](../../docs/evidence/r05b/README.md)明确。审查结论仍待独立reviewer。

## 独立审查结论

Execution Lead只读审查固定实现目标4944d1e795326ad9d437c8d6a4ea88f52db619d9的19项领域源码，APPROVED，无未解P1/P2。20源码/16验证文件/10证据哈希均核对，157不同检查及单选补充1/10未选、tsc0来源已核；未重跑，无provider调用。F01共享mount由Mika独审。当前仅等待受控main集成回执，claim保留，未声称main已具备能力。

## Main 集成回执

已核main 3418fe682944145494463dca9e09f89c8b9c2295 的20个固定源码hash全同，领域独审与Mika共享挂载独审已完成；Lead根noEmit exit0来源在main集成证据。owner未重复运行测试。本次receipt metadata提交并push后停止B1写入，释放claim；新R05C使用独立任务/工作树，不将后继计入本片完成。
