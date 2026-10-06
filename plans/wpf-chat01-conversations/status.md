# WPF-CHAT01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 03:38 UTC / 尚未核验本feature main集成 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 唯一source与正式claim建立；冻结contract/public client已受控消费；开始outbox/草稿分离模块 |
| 下一可用交付 | 最小持续对话独立HTTP fixture预览；后续真实中心/模型按主线安排验收 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations |
| Branch | codex/web-conversations |
| 工作基线 / HEAD | I01最终b5844442699733558a152c12392ea78f26c393a4 / 合同cherry-pick bac6a6efe6fa4866bac4d777ee61b703a0e2c7e3；Lead精确compat输入a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0；实际HEAD由Git聚合 |
| 工作树dirty状态 | 共享冲突按Lead指令解除，输入已独立提交；仅自有metadata新增，未覆盖/重置 |
| 工作分支状态 | in-progress；正式领取后启动 |
| 检查状态 | NOT_RUN；仅固定源码/技能/claim只读核验，尚无本feature行为检查 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；本feature未提交实现，未merge main |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/conversations/ConversationList.tsx, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/conversations.css, apps/web/src/conversations/messages.ts, apps/web/src/conversations/outbox.ts, apps/web/src/conversations/projection.ts, apps/web/src/plugin-integration/react.tsx, apps/web/src/plugin-integration/session.ts, apps/web/test/conversation-outbox.test.ts, apps/web/test/conversation-projection.test.ts, apps/web/test/conversation.browser.ts, apps/web/test/conversation.fixture.ts |
| Review | [review.md](review.md)，NOT_STARTED，target UNKNOWN |
| D04 claim | 08259c1d-3711-4f5f-bf21-ad355ffa4cf3 / v1 / active；committedAt2026-10-06T03:35:00.744Z，requestId wpf-chat01-conversations-20261006 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-CHAT01-01 | completed | workspace_panels_owner | [输入](../../docs/evidence/wpf-chat01/inputs.md)、正式receipt；公共输入Lead原样patch/hash已核通过 |
| WPF-CHAT01-02 | pending | workspace_panels_owner | 首批最小持续对话，真实模型尚未验证 |
| WPF-CHAT01-03 | pending | workspace_panels_owner | 首合同controls能力false，后继实际控件待合同 |
| WPF-CHAT01-04 | pending | workspace_panels_owner | typed轻引用/lazy详情拟接；无thinking/tool来源不伪造 |
| WPF-CHAT01-05 | pending | 后继由Lead派发 | queue/steer能力false，完整需求保留 |
| WPF-CHAT01-06 | pending | 后继由Lead派发 | 无语音/转写服务，不暗接 |
| WPF-CHAT01-07 | pending | workspace_panels_owner | 尚无固定实现或独立review |

## 当前边界与解阻

本文件是唯一手填事实源；管理准备目录将转stub。输入冲突由Lead提供精确compat patch解决：仅abort841保留合同与自有docs，三个before/after SHA256全部吻合后原样应用，输入commit a3b9cfa，未手改shared。当前实现无阻塞。中心模块/真实模型认证预算尚待主线安排，公共client的5HTTP测试不代表live对话。

## 预览与dashboard

新CHAT预览未启动，后续动态专用端口并标fixture/真实。旧M02 http://127.0.0.1:49922/ session17885 与I01 http://127.0.0.1:55049/ session79831继续保留；不暗换用户tab，不在旧树恢复已移交代码。新canonical路径已备，待管理者登记后实采聚合，claim不等于进度展示。
