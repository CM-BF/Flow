# Claude逐消息设置：父级交接与当前请求

2026-10-06 15:43:16 UTC；parent WPF-MATURE-02，co-lead mika。完整目标仍in-progress；本页只维护父级职责与跨owner交接，不复制child TODO/检查/精确源码表。父进度只在[status](../../../plans/wpf-mature-02-harness-capabilities/status.md)。

## 当前Lead输入

唯一下一片合同与精确source-only闭包：[core next-slice-handoff](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/next-slice-handoff.md)，本次实读固定`abbd8a9525fde44ecdfdbda99ab960d2a5df52c0`。owner status_read/gpt-6-astra、co-lead mika，继续独立WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core` / `codex/claude-message-settings-core`；不新开第三层任务。

请Lead提供只读源码闭包并协调现F01 v40的export/ACK matcher/版本化reader/migration挂载薄接线，分配唯一queue snapshot迁移号；031已O15，不猜编号。core先沿现Claude v2 optional turnSettings接中心冻结与既有adapter，后继Web/TUI consumer独立scope由Lead安排。旧profile canonical/digest与旧会话语义保留；draft只在客户端，完整设置用既有body幂等digest/CAS，不另建中心settingsRevision。

## 已交付与范围移交

首plain-contract leaf `4e7b7f968a2160a60989b3b6343506ae8fb5ef6a` 已main `22d5ca67159b35bb794b2711cf6df0cb905b92e8`，[正式接收收据](/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/i02/claude-message-settings-intake.json)；不等于中心/adapter/UI已接通，也不重复审测/派集成。child详细事实在[唯一status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/plans/wpf-mature-02-message-settings-core/status.md)。Lead报告15:38:16 UTC的4320实际快照为164来源、CORE live/issues=[]；后续9bdb仅registry，本owner未再次采卡。

本owner于2026-10-06 15:43:02.930814 UTC明确停止以下四路径新增写入，15:43:03.052 UTC完成原claim v5→v6原子amend：[停写记录](claude-core-profile-stopped-writing.json)、[请求](claude-core-profile-handback-request.json)、[COMMITTED receipt](claude-core-profile-handback-receipt.json)。

- `packages/contracts/src/execution-profiles.ts`
- `packages/contracts/src/execution-profiles.test.ts`
- `apps/server/src/execution-profiles/index.ts`
- `apps/server/src/execution-profiles/native-catalog.test.ts`

父claim只保留docs/evidence/wpf-mature-02、experiments/codex-app-server-conformance、plans/wpf-mature-02-harness-capabilities；core现已原子amend至c652bc61 v2（15:44:19.351 UTC），[接收receipt](/tmp/flow-core-next-scope-amend-receipt.json)包括四路径与context store；原owner不恢复已交回写权。store.ts此前已交回，不在本次四路径中。

context store已包含在core v2精确scope；保留main已有templateVersion2→unknown三行修复，不改变SVC旧362已审候选。context requestedModel直接消费者仍须在最终纵向验收完成。source-only闭包、F01共享接线与迁移编号仍待Lead。

新blocked值`message-settings-unsupported`的直接consumer `packages/interaction/src/queue-control/index.ts`和`apps/web/src/conversations/queue/projection.ts`及其直接tests交共享consumer/Web d01协调，core不越权；现codec会拒整页，不能遗漏该验收。新reader精确header值`flow.claude-turn-settings.v1`。

## 两层职责与验收边界

父TODO-10产品core负责可信组合、中心冻结快照及已有Claude query传递；父TODO-11共享consumer负责同合同client/interaction/Web/TUI下一草稿控件、intent与历史snapshot。子任务状态分别由唯一owner维护。

用户能力保持：运行A、持久队列B、后来草稿C互不改写；requested/observed/unsupported分开，旧会话可读可续。fixed SDK0.3.290声明不等账号可用，manual thinking首片unsupported，not-requested effort不承诺resume复位。后继真实中心与注入SDK验证不能由首leaf批准替代；资源与实际运行门禁仍有效，0付费/新安装。

## 方法与历史边界

本次15:42安全点复核本地find-skills/clean-code，固定sickn33@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；检查单一owner、当前/历史事实、有限接口与无重复状态源。0产品改动/工程测试/目标/PG/install/build。跨task App曾拒绝子agent输入，现沿canonical由Lead读取，不重试或经GO转普通ACK。

OpenSSL ca6a保持SOURCE_REVIEW/PENDING_VALIDATION、PENDING_RESOURCE/NOT_OPEN；旧封存诊断不改。Flow Node宿主、Node synthetic canary、固定Codex native binary分开验收，Node失败不证明Codex失败；完整Claude/Codex目标不减。
