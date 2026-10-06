# R05B 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:20 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | [FLOW-002](../flow-002-provider-harness/plan.md) |
| co-lead | Execution Lead |
| 单一status owner / model | native_center_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/native-center-policy |
| Branch | codex/native-center-policy |
| 工作基线 / HEAD | 3d31ba89bc3696e64d15f12f9d8c703e4d7bd914 / 302b7fd5cb4c91b829c2f1b6cb038dd308acc3ff首接口；随后受控接入F01 migration mount |
| 工作树dirty状态 | 首接口已提交；PG测试及已识别session策略调整待提交 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | PASSED：16显式文件157不同检查；settings损坏补充选择1通过；tsc exit0；[证据](../../docs/evidence/r05b/README.md) |
| 已集成main状态 / HEAD | 未集成；启动main为3d31ba89bc3696e64d15f12f9d8c703e4d7bd914 |
| 实现目标 | 未提交 |
| 实现范围 | [精确22项范围](../../docs/evidence/r05b/claim-current.json) |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 普通回复来源隔离、旧数据升级和 Claude 兼容已验证，待独立审查 |
| 下一可用交付 | 审查后集成普通任务回复能力；尚不提供 Codex 会话或原生进程执行 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| Claim | b205dd73-4edb-4d76-a13b-0fc8a7532b1b v2 |
| 架构影响 | 新增中心静态来源策略与025身份namespace；固定架构图待Lead在集成target登记 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| R05B-01 | completed | native_center_owner | claim.json；固定本机0.154.0 schema与旧中心源码 |
| R05B-02 | completed | native_center_owner | strict union与静态policy；旧会话/profile/runner直接消费者通过 |
| R05B-03 | completed | native_center_owner | 真实PG11/11；旧rows保持；1MiB列表725B/预览4000B；旧中心46/46与preview21/21 |
| R05B-04 | pending | native_center_owner | 未独审、未集成 |

## Dashboard 同步

本status为唯一手填事实源；等待Lead登记权威source及聚合器展示。大task关联明确，未编辑生成状态。

## 边界

0 provider / 0 app-server / 0 auth。Codex首片仅PG与注入验证，尚无生产受控native执行、会话或Web交付。scope外公共export/mount由Lead完成，不将本分支能力称main能力。
