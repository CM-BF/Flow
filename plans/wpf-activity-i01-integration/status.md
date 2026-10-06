# WPF-ACTIVITYI01 状态

| 字段 | 当前值 |
| --- | --- |
| 最近更新时间 | 2026-10-06 07:09 UTC |
| 单一status owner / model | w01_owner；派发 gpt-6-astra / ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 本片段交付阶段 | review |
| 当前产出 | 聊天活动展示已完成，正在修复离线时仍尝试读取的问题 |
| 下一可用交付 | 审查完成后将聊天活动界面交给主线 |
| 当前阻塞 | ACTIVE: 独立审查发现离线读取缺口，正在修复 |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-activity-integration |
| Branch | codex/web-conversation-activity-integration |
| 工作基线 / HEAD | 86a36eaeffbf09f0a3772c3d1509c17dc0a76f92；实现e93070cc08339325cd299105f5805ca871a07ea8 |
| 工作树dirty状态 | 15自有源码/测试与受控2文件依赖已提交；当前仅文档/证据dirty，共享与根lock无差异 |
| 工作分支状态 | implemented / awaiting-review |
| 实现目标 | e93070cc08339325cd299105f5805ca871a07ea8 |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/conversation-activity/native/NativeActivity.tsx, apps/web/src/conversation-activity/native/projection.ts, apps/web/src/conversation-activity/native/tool.tsx, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/plugin-integration/activity.tsx, apps/web/src/plugin-integration/react.tsx, apps/web/src/plugin-integration/session.ts, apps/web/src/plugins/types.ts, apps/web/src/plugins/validation.ts, apps/web/test/conversation-activity-integration.browser.ts, apps/web/test/conversation-activity-integration.test.ts, apps/web/test/native-activity.test.ts, apps/web/test/plugin-host.test.ts, apps/web/src/conversation-activity/projection.ts, apps/web/test/conversation-activity.test.ts |
| 检查状态 | PASSED e93070cc08339325cd299105f5805ca871a07ea8；74局部、typecheck/build、dev11browser；production10实际App通过 |
| Review | CHANGES_REQUESTED e93070cc08339325cd299105f5805ca871a07ea8；ACTIVITYI-R1 P2 offline reader |
| 已集成main状态 / HEAD | 本片未集成；固定输入86a36eaeffbf09f0a3772c3d1509c17dc0a76f92 |
| Claim | 122210f6-eaac-4cc7-840d-3bd7db1626d9 v1 active；06:54:17.091Z本人live核准17scope |

## TODO

| TODO ID | 状态 | Owner | 证据 / 下一步 |
| --- | --- | --- | --- |
| ACTIVITYI01-01 | completed | w01_owner | native9tests及真实页面验证 |
| ACTIVITYI01-02 | completed | w01_owner | P01三类贡献与绑定read ports实际工作 |
| ACTIVITYI01-03 | completed | w01_owner | 74局部、dev11/prod10/typecheck/build通过 |
| ACTIVITYI01-04 | in-progress | w01_owner | 固定实现后独审与主线接收 |

## 下一步 / handoff

固定e93070c已交root独审；最终dev11/prod10均通过，等待独立review。实际预览http://127.0.0.1:51454；[交付证据](../../docs/evidence/wpf-activity-i01/README.md)。受控C03依赖889f精确cherry-pick为07da10c，两文件hash已核，不属于自有写权。唯一source待manager登记；未采集部署dashboard，不声称已展示。[计划](plan.md) · [review](review.md) · [质量](../../docs/evidence/wpf-activity-i01/quality.md)。

架构影响：新增typed footer slot与宿主活动读取口，固定候选交Lead协调图更新；不改后端/协议。

## 风险 / 未验证

初步局部与浏览器检查不是最终通过；fixture不代表真实provider。CHAT06 stream不在本片，现有generic模块只读，旧中心timeline兼容由Lead负责。
