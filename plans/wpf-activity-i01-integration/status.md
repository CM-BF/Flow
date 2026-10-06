# WPF-ACTIVITYI01 状态

| 字段 | 当前值 |
| --- | --- |
| 最近更新时间 | 2026-10-06 07:18 UTC |
| 单一status owner / model | w01_owner；派发 gpt-6-astra / ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 本片段交付阶段 | integration |
| 当前产出 | 聊天工具与思考活动已通过审查，支持按需展开和离线恢复 |
| 下一可用交付 | 将已验证的聊天活动界面接入主线 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-activity-integration |
| Branch | codex/web-conversation-activity-integration |
| 工作基线 / HEAD | 86a36eaeffbf09f0a3772c3d1509c17dc0a76f92；实现ba341d77672ba8456197d64d54193aee79719e46 |
| 工作树dirty状态 | 17实现/受控依赖路径已提交且与审查目标相同；本轮仅审查记录提交，最终交付clean由Git核验 |
| 工作分支状态 | implemented / approved |
| 实现目标 | ba341d77672ba8456197d64d54193aee79719e46 |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/conversation-activity/native/NativeActivity.tsx, apps/web/src/conversation-activity/native/projection.ts, apps/web/src/conversation-activity/native/tool.tsx, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/plugin-integration/activity.tsx, apps/web/src/plugin-integration/react.tsx, apps/web/src/plugin-integration/session.ts, apps/web/src/plugins/types.ts, apps/web/src/plugins/validation.ts, apps/web/test/conversation-activity-integration.browser.ts, apps/web/test/conversation-activity-integration.test.ts, apps/web/test/native-activity.test.ts, apps/web/test/plugin-host.test.ts, apps/web/src/conversation-activity/projection.ts, apps/web/test/conversation-activity.test.ts |
| 检查状态 | PASSED ba341d77672ba8456197d64d54193aee79719e46；本次60相关/typecheck/build/dev与prod离线各1；原e930的74/dev11/prod10保留 |
| Review | APPROVED ba341d77672ba8456197d64d54193aee79719e46；root 07:17:38Z独审，ACTIVITYI-R1 CLOSED |
| 已集成main状态 / HEAD | 本片未集成；固定输入86a36eaeffbf09f0a3772c3d1509c17dc0a76f92 |
| Claim | 122210f6-eaac-4cc7-840d-3bd7db1626d9 v1 active；06:54:17.091Z本人live核准17scope |

## TODO

| TODO ID | 状态 | Owner | 证据 / 下一步 |
| --- | --- | --- | --- |
| ACTIVITYI01-01 | completed | w01_owner | native9tests及真实页面验证 |
| ACTIVITYI01-02 | completed | w01_owner | P01三类贡献与绑定read ports实际工作 |
| ACTIVITYI01-03 | completed | w01_owner | 旧e930完整74/dev11/prod10；ba341相关60/离线专项与typecheck/build通过 |
| ACTIVITYI01-04 | in-progress | w01_owner | 固定ba341独审已通过；待Lead主线接收 |

## 下一步 / handoff

固定ba341已获root独立APPROVED，R1关闭；[review](review.md)区分作者检查与root独立7 adapter/CUA抽验。实际预览http://127.0.0.1:51454保留；[交付证据](../../docs/evidence/wpf-activity-i01/README.md)及[修复](../../docs/evidence/wpf-activity-i01/revision.md)。受控C03依赖889f精确cherry-pick为07da10c，两文件hash已核，不属于自有写权。最终metadata提交后停止实现修改，交管理统一REVIEW_READY；保留claim等待明确main接收或修复。不自行取部署dashboard样本，聚合核验由manager协调。[计划](plan.md) · [质量](../../docs/evidence/wpf-activity-i01/quality.md)。

架构影响：新增typed footer slot与宿主活动读取口；图更新输入target ba341，待Lead接收后协调对应架构owner，不改后端/协议。

## 风险 / 未验证

fixture不代表真实provider，未验证真实中心/模型、Firefox/Safari或屏读。CHAT06 stream不在本片；generic原模块仅消费已审C03输入，旧中心timeline兼容由Lead负责。main尚未集成；本片批准不覆盖后继组合。
