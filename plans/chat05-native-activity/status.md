# CHAT05 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 06:10:19 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/native-activity |
| Branch | codex/native-activity |
| 工作基线 / HEAD | base 3d4985fca060155435b159e0467815bf8e88b8b8；实现 57d28e9104e9041dbd04a66295294308da94a23d；metadata 后继独立 |
| 工作树dirty状态 | 实现已提交；本次仅交付metadata |
| 工作分支状态 | completed（作者片段；独立review待进行） |
| 检查状态 | PASSED 57d28e9104e9041dbd04a66295294308da94a23d；85/85 局部与直接消费者、tsc、diffcheck；原输出见manifest |
| 已集成main状态 / HEAD | 未集成；base 为 3d4985fca060155435b159e0467815bf8e88b8b8 |
| 实现目标 | 57d28e9104e9041dbd04a66295294308da94a23d |
| 实现范围 | packages/contracts/src/native-activity.ts,packages/contracts/src/tasks.ts,packages/contracts/src/runner.ts,apps/runner/src/native-activity,apps/runner/src/claude.ts,apps/server/src/native-activity,apps/server/src/events.ts,packages/storage/migrations/020-native-activity.sql |
| 阶段 | M2 |
| 本片段交付阶段 | review |
| 优先级 | 1 |
| 当前产出 | 工具进度与有界详情已接入持久记录，等待独立审查 |
| 下一可用交付 | 接入对话页面展示真实活动与明确截断标记 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| CHAT05-01 | completed | runner_owner | ae4cc5c；接口已交消费方 |
| CHAT05-02 | completed | runner_owner | mapper 红→绿 5/5，内容/工具/隔离/边界 |
| CHAT05-03 | completed | runner_owner | 13 HTTP/PG/runtime；身份/归属/重报/迁移/恢复/轻引用读回 |
| CHAT05-04 | completed | runner_owner | claim v3后接线；注入SDK success/cancel与ACK前后丢失恢复，0provider |
| CHAT05-05 | in-progress | runner_owner / Lead | 85/85、tsc、clean-code完成；NOT_STARTED独立review/main待接收 |
| CHAT05-06 | pending | Lead 后继派工 | REQ15：超限原文保留/分页/引用；不在本片段验收，截断字节当前不可取回 |

## 边界与下一步

0 模型/0 云。合成完整 SDK 帧不证明真实 provider 的工具可用性。每个活动仅保存≤64KiB UTF-8片段，truncated可见；超限原文无取回路径，截断JSON回退文本，详见README。工具输入完成与实际结果分开；公开正文与最终回复分开。架构新增活动观察流，集成后由 Lead 更新固定架构基线。

## Dashboard 同步

本文件为唯一事实源，Lead 已确认登记候选；领取回执见 [claim-take.json](../../docs/evidence/chat05/claim-take.json)，claim 7e813531-f77c-4797-ac9c-d81244a571ef v3（Reference与两个native接缝已合法追加）。没有其他 owner 状态写入。

## 固定交付

- [README](../../docs/evidence/chat05/README.md)、[manifest](../../docs/evidence/chat05/manifest.json)、[接口](../../docs/evidence/chat05/interface.md)。
- 完整合入已审O07 c22412b5dd1368e3cdb14cd2c9afb6785b33a0e5与其K02依赖；保留这些模块的独立review事实，不代替本片段review。
- 中心生产挂载/公共exports/client及Web消费由Lead/外部Web owner负责；本分支测试通过不表示当前常驻服务已部署。
