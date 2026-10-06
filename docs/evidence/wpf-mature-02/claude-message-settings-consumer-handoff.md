# Claude逐消息设置：共享consumer交接

2026-10-06 15:50:43 UTC；parent WPF-MATURE-02 / TODO-11，co-lead mika。此页是既有owner间的接线请求与验收约束，不是源码领取、实施通过或新运行许可。父status仍为唯一父进度；child状态不复制到本页。

## 固定输入与当前缺口

首契约leaf已main22d5；新的core contracts checkpoint `29bbf52589611a936068fa44991c67991b67f4c2` 只固定了接线源码，**尚未验证、未独审，不能单独称产品交付**。权威[core下一片请求](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/next-slice-handoff.md)负责实际profile→中心→队列→adapter合同与范围。

consumer按完整`messageSettings`快照工作：protocol、profile三元`id/runnerId/configDigest`、完整requested组合。受信configured choices以完整组合授权，不把SDK枚举当账号可用；不跨组合拼model/effort/speed，不回填defaults，不热改旧profile。`not-requested` effort仅未请求，不承诺SDK重置；unknown/unsupported保持显式。新reader沿精确单header `X-Flow-Execution-Profile: flow.claude-turn-settings.v1`，旧codec与旧profile字节兼容必须保留。

## 现有owner路由

以下权属来自architecture_read对main `a89f42ab57acb53657af6a2d1b745dabd4d50aa5` 的独立只读地图及2026-10-06 15:47:14 UTC账本观察。它们是协调输入，不授予本父owner或core前端写权；实际改动前由Lead与现owner核最新claim，沿原范围实施或明确停写后原子交接。

- F01 v40：client reader header/codec、send/enqueue完整冻结body与ACK matcher、contracts index。复用既有HTTP transport/idempotency/signal，不复制请求层。
- Web RECOVERY01：workspace_panels_owner，claim6ff988 v4，现持App/ConversationThread、outbox/projection/queuecommands/recoverybinding；Web/d01须协调该owner后落实同合同，不重复派writer。
- TUI01F：assignment_review，claim9fe77a v1，现持interaction types/commands/controller与TUI main/screen；在既有Intent/mutate/recover/private journal上消费，不造第二FSM。

## 精确候选路径与直接检查

这是source-only读闭包/现owner协调清单，不是一次领取整表。条件项仅出现实际类型/展示需要时由owner确定；所有路径仓库相对，独立WT固定提交后交审。

| 接缝 | 实际路径 |
| --- | --- |
| F01合同/请求/ACK | `packages/client/src/index.ts`；`packages/client/src/conversation-acknowledgement.ts`；`packages/contracts/src/index.ts` |
| F01直接tests | `packages/client/src/conversation-acknowledgement.test.ts`；`packages/client/src/execution-profiles.test.ts`；`packages/client/src/conversation-queue.test.ts`；`packages/client/src/conversations.test.ts` |
| Web草稿/提交/恢复 | `apps/web/src/App.tsx`；`apps/web/src/conversations/ConversationThread.tsx`；`apps/web/src/conversations/outbox.ts`；`apps/web/src/conversations/projection.ts`；`apps/web/src/conversations/queue/commands.ts`；`apps/web/src/conversations/queue/projection.ts`；`apps/web/src/recovery/binding.tsx` |
| Web目录/队列展示 | `apps/web/src/execution-profiles/catalog.ts`；`apps/web/src/execution-profiles/selection.ts`；`apps/web/src/conversations/queue/ConversationQueue.tsx` |
| Web直接tests | `apps/web/test/conversation-outbox.test.ts`；`apps/web/test/conversation-projection.test.ts`；`apps/web/test/conversation-queue.test.ts`；`apps/web/test/execution-profiles.test.ts`；recovery owner树的 `apps/web/test/conversation-recovery.test.ts`、`apps/web/test/conversation-recovery.fixture.ts`、`apps/web/test/conversation-recovery.browser.ts` |
| TUI/interaction状态与展示 | `packages/interaction/src/types.ts`；`packages/interaction/src/commands.ts`；`packages/interaction/src/controller.ts`；`packages/interaction/src/projection.ts`；`packages/interaction/src/queue-control/index.ts`；`apps/tui/src/screen.tsx`；`apps/tui/src/main.tsx`仅reader option/queue port注入需要时 |
| TUI直接tests | `packages/interaction/src/controller.test.ts`；`packages/interaction/src/queue-control/controller.test.ts`；`apps/tui/src/recovery.test.ts`；`apps/tui/src/journey.test.ts`；`apps/tui/src/queue-controls/journey.test.ts` |

F01源与前三tests由v40持有；`packages/client/src/conversations.test.ts`只是候选，需fresh查账。Web固定观察recovery树`f29751812090f85d5d01a4c67a4bdca09566ec85`、TUI树`d65886faf82c7df3c74c5b19fc27f02643b4d9f9`均当时clean；上述清单不保证全部路径已由同claim覆盖。`ExecutionProfilePicker.tsx`仅创建选择展示确需新codec时、`apps/web/src/TaskThread.tsx`仅现Map<string,DraftState>可选字段类型接缝确需时才另核精确路径/范围，不另造draft map。

F01 send已用公共ACK decoder，enqueue现仅request，需要共用有限snapshot matcher。`packages/interaction/src/acknowledgement.ts`已委托client decoder，优先原样复用。`apps/web/src/conversation-context/receipts.ts`只深冻materials，其余浅冻，新增settings须在outbox/command边界递归freeze；不为此改通用helper。`apps/web/src/recovery/journal.ts`、TUI的`apps/tui/src/intent-store.ts`→`apps/tui/src/private-journal.ts`、共用controller的`apps/tui/src/headless.ts`先作直接只读输入，不先改generic journal或造新持久化层。

## Web：捕获A，保留后改草稿B

沿现`CompleteDraft`与`viewKey`，发送/入队开始时捕获文本、材料选择和完整设置；**在任何材料await之前递归复制并冻结新snapshot**。pending capture、幂等key与最终请求body绑定同一份A；后续UI修改只形成新draft B，不能改A的对象或请求。view切换/刷新后的`readRecoveryDraft`须完整保存与恢复这份设置，不因只恢复文本丢失请求身份；generic journal格式与生命周期机制不另建一套。

成功回执只有与A的profile三元及完整设置匹配才可确认A。清draft须比较完整captured draft/view身份，不能只比正文：同文本但设置已改的B也必须保留。错/缺设置的HTTP200、abort和结果不明均保留A的key+body，恢复只重放同一冻结intent；不自动换key或用当前B重新拼A。旧legacy缺字段仍走原行为，不替它补disabled/standard。

## TUI：同Intent覆盖发送与恢复

沿已有Intent、`mutate`、`recover`和私有journal保存完整body/设置，ACK matcher复用同一个已审leaf接口。重启后的显式恢复保持原key和冻结body；新草稿与旧pending intent分开。当前TUI没有enqueue；若本产品片纳入enqueue，把它加到同一Intent分支和恢复路径，不另造queue mutation FSM。操作是否纳入本片由Lead/consumer owner固定，不能因UI尚未实现而降低完整02队列验收。

## 展示与直接codec消费者

- draft显示下一条请求的完整model/thinking或effort/speed选择及可用性；不将configured等同已生效。
- 历史turn与持久队列显示自身冻结requested，不跟随当前draft变化。
- init observed独立展示：实际model别名、effort缺/null、fast off/cooldown/on与禁用原因保持事实；requested fast不冒称actual，未知不填成功。
- 新queue blocked值`message-settings-unsupported`必须由interaction与Web投影一起接收并呈现，不得因新合法枚举拒绝整页；精确路径在下方共享清单。

## 最小直接验证（待owner实施，不是已运行证据）

1. 先捕获A、材料await期间编辑B，A发送的key/body/settings不变；A回执不能清B。再单独覆盖正文相同、只改settings的B。
2. HTTP200缺snapshot、非法snapshot或不同profile/组合均转unknown ACK，保留A；不错误清intent或建立新key。abort、刷新恢复和TUI重启仍保原A的key/body/设置。
3. 旧codec与legacy缺字段路径逐字兼容；profile任一三元过期/不匹配明确拒绝，不用新profile替换旧pending请求。
4. Web/TUI使用同DTO与matcher；队列新blocked reason可读，历史/队列requested与init observed不被draft覆盖。仅模块和直接消费者检查，实际PG/SDK/provider不由本交接授权。

## Lead当前精确补充

Lead正在provision33 source及只读闭包；032已正式分配core。另只补 `apps/server/src/reconciliation.ts` 到core source-only闭包：固定main a89f42ab的`retryReconciled`经`recoverySubmission`后直接INSERT task，需在插入前验证新完整设置与可信profile；不能仅依send/enqueue路径。core将fresh amend加入该literal与正式032，未确认receipt前不写；本父不扩scope、不再泛索其他目录。

## 方法与范围

沿本地find-skills/clean-code固定sickn33@bdacd76，复用既有深接口/单一状态所有者，核对快照身份、错误传播与无重复FSM。本次仅只读固定源码与管理文档；0工程检查、PG、目标、安装或新诊断。旧Node/OpenSSL与sealed证据不动。
