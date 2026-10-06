# WPF-CHAT01 状态

当前模拟预览 `http://127.0.0.1:63743/` 已于 2026-10-06 21:54 UTC 按 Lead/GO 新授权退役；历史 URL 和启动方法保留作追溯，不表示仍在运行。[退役原件与边界](../../docs/evidence/wpf-chat01/preview-retirement/README.md)。

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 21:59:07 UTC / 最近main核验仍为2026-10-06T06:45:27Z，固定a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8；当时target祖先及保留生产范围零diff |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 持续会话首批功能已交付；旧模拟预览已退役，历史验证与源码保留 |
| 下一可用交付 | 本片段已交付；后继需求按独立任务继续 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations |
| Branch | codex/web-conversations |
| 工作基线 / HEAD | I01最终b5844442699733558a152c12392ea78f26c393a4 / 合同cherry-pick bac6a6efe6fa4866bac4d777ee61b703a0e2c7e3；Lead精确compat输入a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0；typed输入746364ea2581b8c563a09b07560de5e0b63bcab8；首实现84242ca1d214f9a9ff369b07c13657918862f226 / 最终7cbabb737f26b108275e80f1b6cd0425699f3c18，含0d4e outbox；metadata HEAD由Git聚合 |
| 工作树dirty状态 | 原实现继续冻结；本轮仅三个metadata范围，基线eb2fc99f6fa0652d98045a9bd84ffe32c978ac8f clean；最终HEAD/dirty由Git聚合，未覆盖/重置/手改共享 |
| 本片段交付阶段 | delivered |
| 工作分支状态 | COMPLETED；本片段已独审并历史集成main，后继未完成TODO保留 |
| 检查状态 | PASSED 7cbabb737f26b108275e80f1b6cd0425699f3c18; 本修复projection16+outbox9/typecheck PASS；先前842的33direct/dev11/production11+局部1证据分别保留，未冒充全重跑；真实模型未跑 |
| 已集成main状态 / HEAD | INTEGRATED a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8；target为祖先，当前claim保留的5个生产/测试paths零diff；历史完整scope含已转交后继变更，不冒称全scope仍相同 |
| 实现目标 | 7cbabb737f26b108275e80f1b6cd0425699f3c18 |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/conversations/ConversationList.tsx, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/conversations.css, apps/web/src/conversations/messages.ts, apps/web/src/conversations/outbox.ts, apps/web/src/conversations/projection.ts, apps/web/src/plugin-integration/react.tsx, apps/web/src/plugin-integration/session.ts, apps/web/test/conversation-outbox.test.ts, apps/web/test/conversation-projection.test.ts, apps/web/test/conversation.browser.ts, apps/web/test/conversation.fixture.ts |
| Review | [review.md](review.md)，APPROVED，target 7cbabb737f26b108275e80f1b6cd0425699f3c18；842原R1/R2已CLOSED |
| D04历史claim（非当前写权） | 08259c1d-3711-4f5f-bf21-ad355ffa4cf3 / v6 / active（2026-10-06T06:44:34.089Z实核）；本metadata提交后全部当前scope停写，随后release回执由管理保存 |
| D04当前metadata claim | da159c3d-c518-41d7-a94b-6919e9180fcf / v1 active；21:56:34.593Z新take，owner本人live核；仅status/README/preview-retirement。正常提交推送clean后全三scope停写，由管理fresh release |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-CHAT01-01 | completed | workspace_panels_owner | [输入](../../docs/evidence/wpf-chat01/inputs.md)、正式receipt；公共输入Lead原样patch/hash已核通过 |
| WPF-CHAT01-02 | in-progress | workspace_panels_owner | 首批实现与作者检查/独立review完成；[验证](../../docs/evidence/wpf-chat01/validation.md)，真实模型由Lead验证 |
| WPF-CHAT01-03 | pending | workspace_panels_owner | 首合同controls能力false，后继实际控件待合同 |
| WPF-CHAT01-04 | pending | workspace_panels_owner | 首批typed reply lazy已接且0→1→cache通过；真实tool/thinking后继仍pending |
| WPF-CHAT01-05 | pending | 后继由Lead派发 | queue/steer能力false，完整需求保留 |
| WPF-CHAT01-06 | pending | 后继由Lead派发 | 无语音/转写服务，不暗接 |
| WPF-CHAT01-07 | in-progress | workspace_panels_owner | 固定7cb独立APPROVED且main dd1b9集成已核；[启动交接](../../docs/evidence/wpf-chat01/README.md)已交，真实两query待Lead证据 |

## 历史边界与解阻

以下截至 06:45 UTC 的预览、启动、保留指令和检查均为历史；仅63743默认保留已由本次明确退役授权覆盖。49922/55049及全部其他KEEP服务未操作，原TODO与产品审核范围不变。

本文件是唯一手填事实源；管理准备目录已转stub。输入冲突由Lead提供精确compat patch解决：仅abort841保留合同与自有docs，三个before/after SHA256全部吻合后原样应用，输入commit a3b9cfa，未手改shared。截至首实现提交输入无阻塞；当前独立review R1/R2已在7cb复审关闭；首批无blocking。真实模型验收仍交Lead；main集成事实见下文，不扩大结论。中心CHAT01 2d3bb61已独审APPROVED（主线14真PG HTTP+tsc证据），typed中心d0f4f5已独审APPROVED；实际两次模型query由Lead在三端审定后统一验证，我方不新增模型调用。

## 历史预览与dashboard

新CHAT预览 http://127.0.0.1:63743/，session14932，owner本agent，HTTP fixture模拟无模型，movingtree开发候选；启动 `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation.fixture.ts --preview` 动态端口。旧M02 http://127.0.0.1:49922/ session17885 与I01 http://127.0.0.1:55049/ session79831继续保留；不暗换用户tab，不在旧树恢复已移交代码。04:04:44 UTC实采4320 42sources：本卡current=true/human.complete=true/issues=[]，checks passed与review not_started都绑定842，implementationProof unchanged，claim v1 active matchesSource=true；main8f not-contained。采样时metadata dirty，证据见[摘录](../../docs/evidence/wpf-chat01/dashboard-observation.json)。

## 最终独立review与交付

2026-10-06 04:09 UTC：root整体APPROVED `7cbabb737f26b108275e80f1b6cd0425699f3c18` / base b584，CHAT-R1/R2 CLOSED。w01固定16projection tests与3公开探针独立PASS；root核App/Thread/bridge/修复diff与既有CUA/截图，原842的33checks明确复用未称新target重跑。详见[正式review](review.md)、[启动交接](../../docs/evidence/wpf-chat01/README.md)。作者0模型；不执行main合并。实现停写，claim保留待Lead后继转交；只维护自己的计划/证据与受派review修复。

## main集成只读核验

2026-10-06 04:20 UTC：live D04 claim仍为08259c1d-3711-4f5f-bf21-ad355ffa4cf3 / v1 / active，当前仅维护本canonical文档。实核origin/main `dd1b9dafc77fb56a580d3d41dc7ddec3b1996ef8` 包含最终交付metadata `3319122ea2d225e96f587a86a0f5ff97a3191b0b`；本表14个实现/测试路径与main零diff。[机器摘录](../../docs/evidence/wpf-chat01/main-integration-observation.json)。本owner未执行merge、产品测试或模型调用，尚未观察MainLead真实两query证据。产品实现继续冻结，X03另待精确范围移交，不因main集成恢复本树实现写入。

## 历史保留范围收口

2026-10-06T06:45:27Z：按GO/管理授权，核固定main `a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8` 包含原实现 `7cbabb737f26b108275e80f1b6cd0425699f3c18`，当前claim保留5个生产/测试paths全部零diff；[逐路径与唯一77源样本](../../docs/evidence/wpf-chat01/retained-scope-main-closeout.json)。历史全实现范围已被后继任务改变，未复用旧批准覆盖新代码。无仍需本claim写入的实现；先前scope转交保持，不恢复旧路径。未完成的完整产品TODO继续pending，由Lead另行派工，不能为了释放领取而勾选。

本次仅metadata，未跑产品测试、未重取dashboard、未调用模型或修改服务。提交clean后当前claim全部scope停写并按fresh version release；原始release receipt交管理者持久化，释放后不再追写本树。本记录中的active是release前观察，最终state以协调账本为准。

## 2026-10-06 预览退役收口

2026-10-06T21:54:41.744356Z 仅向重新确证的 Node PID60286 发 SIGTERM；session14932 实际 exit143。PGID60270、父链及其esbuild子进程和63742/63743监听随后均未见残留；exit143不能证明每个异步关闭handler完成。固定eb2fc99源与工作树均前后不变、clean。Root对当前冻结输入未发现声明依赖冲突，见[有界consumer核验](../../docs/evidence/wpf-chat01/preview-retirement/root-two-preview-known-consumer-check.json)。未改用户tab或任何KEEP服务，未删除cache/deps，未新跑产品检查、parser、HTTP/PG/模型。Dashboard由管理读本status，未在本轮复采。
