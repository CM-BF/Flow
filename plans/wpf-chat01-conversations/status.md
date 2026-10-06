# WPF-CHAT01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 04:05 UTC / main与origin为8f1481df880cf5077e1ddb9a8f302fe700a7ece8，本feature未集成 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 唯一source与正式claim建立；冻结contract/public client已受控消费；最小持续对话首批固定84242ca1d214f9a9ff369b07c13657918862f226；33 direct / dev11 / production11+最终局部1 PASS；官方Thread、独立草稿收据、typed来源、双主题已交可审 |
| 下一可用交付 | 固定候选独立review与Lead真实中心两次query；fixture63743持续可看 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations |
| Branch | codex/web-conversations |
| 工作基线 / HEAD | I01最终b5844442699733558a152c12392ea78f26c393a4 / 合同cherry-pick bac6a6efe6fa4866bac4d777ee61b703a0e2c7e3；Lead精确compat输入a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0；typed输入746364ea2581b8c563a09b07560de5e0b63bcab8；实现84242ca1d214f9a9ff369b07c13657918862f226含0d4e outbox；metadata HEAD由Git聚合 |
| 工作树dirty状态 | 共享冲突按Lead指令解除，输入已独立提交；实现已固定提交并冻结；实现范围clean；本次仅自有metadata/证据更新，实际dirty由Git聚合核验；未覆盖/重置/手改共享 |
| 工作分支状态 | ready-for-review（首批最小持续对话）；后继capability需求仍pending |
| 检查状态 | PASSED 84242ca1d214f9a9ff369b07c13657918862f226; 33 direct、dev11、production11、最终局部production1、typecheck/build；检查范围与时间关系见validation；真实模型未跑 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；固定首批84242ca，完整含0d4e；未merge main |
| 实现目标 | 84242ca1d214f9a9ff369b07c13657918862f226 |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/conversations/ConversationList.tsx, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/conversations.css, apps/web/src/conversations/messages.ts, apps/web/src/conversations/outbox.ts, apps/web/src/conversations/projection.ts, apps/web/src/plugin-integration/react.tsx, apps/web/src/plugin-integration/session.ts, apps/web/test/conversation-outbox.test.ts, apps/web/test/conversation-projection.test.ts, apps/web/test/conversation.browser.ts, apps/web/test/conversation.fixture.ts |
| Review | [review.md](review.md)，NOT_STARTED，target 84242ca1d214f9a9ff369b07c13657918862f226 |
| D04 claim | 08259c1d-3711-4f5f-bf21-ad355ffa4cf3 / v1 / active；committedAt2026-10-06T03:35:00.744Z，requestId wpf-chat01-conversations-20261006 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-CHAT01-01 | completed | workspace_panels_owner | [输入](../../docs/evidence/wpf-chat01/inputs.md)、正式receipt；公共输入Lead原样patch/hash已核通过 |
| WPF-CHAT01-02 | in-progress | workspace_panels_owner | 首批实现与作者检查完成待review；[验证](../../docs/evidence/wpf-chat01/validation.md)，真实模型由Lead验证 |
| WPF-CHAT01-03 | pending | workspace_panels_owner | 首合同controls能力false，后继实际控件待合同 |
| WPF-CHAT01-04 | pending | workspace_panels_owner | 首批typed reply lazy已接且0→1→cache通过；真实tool/thinking后继仍pending |
| WPF-CHAT01-05 | pending | 后继由Lead派发 | queue/steer能力false，完整需求保留 |
| WPF-CHAT01-06 | pending | 后继由Lead派发 | 无语音/转写服务，不暗接 |
| WPF-CHAT01-07 | pending | workspace_panels_owner | 固定84242ca1d214f9a9ff369b07c13657918862f226待独立review，作者证据与[启动交接](../../docs/evidence/wpf-chat01/README.md)已准备 |

## 当前边界与解阻

本文件是唯一手填事实源；管理准备目录已转stub。输入冲突由Lead提供精确compat patch解决：仅abort841保留合同与自有docs，三个before/after SHA256全部吻合后原样应用，输入commit a3b9cfa，未手改shared。当前实现无阻塞。中心CHAT01 2d3bb61已独审APPROVED（主线14真PG HTTP+tsc证据），typed中心d0f4f5已独审APPROVED；实际两次模型query由Lead在三端审定后统一验证，我方不新增模型调用。

## 预览与dashboard

新CHAT预览 http://127.0.0.1:63743/，session14932，owner本agent，HTTP fixture模拟无模型，movingtree开发候选；启动 `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation.fixture.ts --preview` 动态端口。旧M02 http://127.0.0.1:49922/ session17885 与I01 http://127.0.0.1:55049/ session79831继续保留；不暗换用户tab，不在旧树恢复已移交代码。04:04:44 UTC实采4320 42sources：本卡current=true/human.complete=true/issues=[]，checks passed与review not_started都绑定842，implementationProof unchanged，claim v1 active matchesSource=true；main8f not-contained。采样时metadata dirty，证据见[摘录](../../docs/evidence/wpf-chat01/dashboard-observation.json)。
