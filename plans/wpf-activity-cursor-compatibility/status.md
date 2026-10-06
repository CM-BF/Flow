# WPF-ACTIVITYC01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 07:01 UTC / 固定86a36eaeffbf09f0a3772c3d1509c17dc0a76f92 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 已确认活动列表翻页兼容规则，正在修复过滤后的空页读取 |
| 下一可用交付 | 活动列表能越过隐藏的流式记录，继续显示普通活动 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-cursor-compatibility |
| Branch | codex/web-activity-cursor-compatibility |
| 工作基线 / HEAD | 86a36eaeffbf09f0a3772c3d1509c17dc0a76f92 / 实际HEAD由Git聚合 |
| 工作树dirty状态 | 启动metadata新增；尚未修改产品 |
| 工作分支状态 | IN_PROGRESS |
| 本片段交付阶段 | implementation |
| 检查状态 | NOT_RUN |
| 已集成main状态 / HEAD | NOT_INTEGRATED |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/conversation-activity/projection.ts, apps/web/test/conversation-activity.test.ts |
| Review | [review.md](review.md)，NOT_STARTED |
| D04 claim | 5896b272-19d9-4727-aee4-1d8dd36d5fec v1 active；07:01:00.918Z committed；07:01:14.315Z live核 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-ACTIVITYC01-01 | completed | workspace_panels_owner | [输入来源](../../docs/evidence/wpf-activity-cursor-compatibility/input-provenance.json)、[领取](../../docs/evidence/wpf-activity-cursor-compatibility/take-receipt.json)、[质量](../../docs/evidence/wpf-activity-cursor-compatibility/quality.md) |
| WPF-ACTIVITYC01-02 | in-progress | workspace_panels_owner | 已读固定旧reader与C02真实HTTP断言，准备最小校验修复 |
| WPF-ACTIVITYC01-03 | pending | workspace_panels_owner | 待实际reader红绿验证 |
| WPF-ACTIVITYC01-04 | pending | workspace_panels_owner | 独立review未执行；由manager登记唯一source，等待聚合展示 |

边界：仅旧 generic 活动 reader 兼容，无 App 新接线、正文stream消费或共享改动。contract fixture不是历史HTTP raw capture；本片0模型/DB，不操作旧服务。架构影响为现有分页规则修正，无新增模块/依赖，固定交付供Lead登记。
