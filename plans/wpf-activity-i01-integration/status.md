# WPF-ACTIVITYI01 状态

| 字段 | 当前值 |
| --- | --- |
| 最近更新时间 | 2026-10-06 06:55 UTC |
| 单一status owner / model | w01_owner；派发 gpt-6-astra / ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 本片段交付阶段 | implementation |
| 当前产出 | 正在把工具与思考记录接到每轮聊天下方 |
| 下一可用交付 | 可展开查看工具状态和思考内容的聊天界面 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-activity-integration |
| Branch | codex/web-conversation-activity-integration |
| 工作基线 / HEAD | 86a36eaeffbf09f0a3772c3d1509c17dc0a76f92；启动记录 |
| 工作树dirty状态 | 首份文档待提交；尚无实现改动 |
| 工作分支状态 | in-progress |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/conversation-activity/native/NativeActivity.tsx, apps/web/src/conversation-activity/native/projection.ts, apps/web/src/conversation-activity/native/tool.tsx, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/plugin-integration/activity.tsx, apps/web/src/plugin-integration/react.tsx, apps/web/src/plugin-integration/session.ts, apps/web/src/plugins/types.ts, apps/web/src/plugins/validation.ts, apps/web/test/conversation-activity-integration.browser.ts, apps/web/test/conversation-activity-integration.test.ts, apps/web/test/native-activity.test.ts, apps/web/test/plugin-host.test.ts |
| 检查状态 | NOT_RUN |
| Review | NOT_STARTED |
| 已集成main状态 / HEAD | 本片未集成；固定输入86a36eaeffbf09f0a3772c3d1509c17dc0a76f92 |
| Claim | 122210f6-eaac-4cc7-840d-3bd7db1626d9 v1 active；06:54:17.091Z本人live核准17scope |

## TODO

| TODO ID | 状态 | Owner | 证据 / 下一步 |
| --- | --- | --- | --- |
| ACTIVITYI01-01 | in-progress | w01_owner | 已批准typed边界；开始原生projection |
| ACTIVITYI01-02 | pending | w01_owner | footer与宿主read port |
| ACTIVITYI01-03 | pending | w01_owner | 局部/实际App fixture |
| ACTIVITYI01-04 | pending | w01_owner | 固定实现后独审与主线接收 |

## 下一步 / handoff

先完成typed活动深模块与局部行为验证，再接官方Thread。唯一source待manager登记；未采集部署dashboard，不声称已展示。[计划](plan.md) · [review](review.md) · [质量](../../docs/evidence/wpf-activity-i01/quality.md)。

架构影响：新增typed footer slot与宿主活动读取口，固定候选交Lead协调图更新；不改后端/协议。

## 风险 / 未验证

尚未执行产品检查；fixture不代表真实provider。CHAT06 stream不在本片，现有generic模块只读，旧中心timeline兼容由Lead负责。
