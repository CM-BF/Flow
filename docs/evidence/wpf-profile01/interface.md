# PROFILE01 Interface — 目录声明与普通聊天选择

固定模块 target `4f1985769564eafad9218570411d5ce1114b4ec0`；源码基线 `4e0289f29ffa48c6c49003837d4520f57c22b6b0`；后继输入只读核 `02683be019ae75591b21c1ada64e01669678f068:packages/contracts/src/execution-profiles.ts`。未修改/合并共享合同。实际 App 接入另行领取。

## selection.ts

- `DirectoryProfile`：目录声明，configuration.access为标识字符串；不是可提交Selection。
- `readDirectoryProfile(input:unknown)`：clone、严格验证公共ref、除access外全部known configuration字段、model/source/availability/controls/limits/时间后深冻。goal-tools额外验证requireReadApproval=false且materialScopeDigest为SHA256空数组。未知access只保留声明、不猜语义。
- `isChatAccess(access)`：显式仅允许none/configured-readonly。它不依赖公共publication schema未来保持狭窄。
- `ChatProfile`：上述allowlist的缩窄DTO；`ProfileSelection`为legacy-default或configured+ChatProfile。
- `configuredSelection(profile:DirectoryProfile)`：重新验证并执行chat allowlist，失败抛Error。消费方不能直接把目录项强转为选择。
- `legacyDefaultSelection()`：显式旧兼容，无pin，runner-default/disabled/configured-readonly。不是服务在线证明。
- `freezeConversationCreation(title,selection)`：schema校验且深冻完整ConversationCreation（requested与ref）；configured选择再次执行allowlist，拒绝伪造对象。requested精确取config.model/disabled/config.access。无HTTP、key或发送。
- `assertCreationReceiptMatches(expectedCreation,receivedSummary)`：核title/harness/requested与pin有无及完整id/runnerId/digest；错误抛Error。必须对照outbox固定payload，不从后来的选择重建。

## catalog.ts

`createExecutionProfileCatalog(port:Pick<FlowClient,"executionProfiles">)` → getSnapshot/subscribe/refresh/loadMore/dispose。每connection一个实例，切中心/断开dispose。snapshot为不可变 profiles（DirectoryProfile[]）/nextCursor/loading/error/loaded/stale/canLoadMore。

首次请求仅显式refresh触发；Picker无mount请求。refresh取消旧request并generation屏蔽迟到，成功原子替换第一页；在途/失败保留旧页并标陈旧。loadMore失败保留页面/游标可原页重试。401也保留只读旧声明并标陈旧；无新配置选择。refresh失败canLoadMore=false，须先重试refresh；append失败canLoadMore=true可重试；dispose清缓存/订阅且不复活。

混合页保留goal-tools和未知access条目及服务端cursor，不因不可选而筛掉它们；已知goal-tools策略无效或其他DTO/排序/cursor畸形仍原子拒绝整页，保留旧已确认数据（若有）。刷新只加载第一页，所选项不在loaded页只能称“尚未在已加载页确认”，不能推全目录删除。

## ExecutionProfilePicker.tsx

受控props：catalog snapshot、selection、onSelect、onRefresh、onLoadMore，可选 `locked={creation:ConversationCreation,reason:'created'|'receipt-pending'}`。选择刷新不自动改变；Dialog/Button+原生radio与显式Load more，无全球model搜索假象。goal-tools/未知项显示原access声明及Cannot be used for ordinary chat，radio禁选；合法同页仍可选。配置不是effective或online证明。

locked完全读取冻结creation；未知ACK没有summary也必须锁定，不依赖目录可用。CREATE即pin，而非首turn之后；任何已知CREATE成功后的首turn失败仍锁created。无effort/thinking热切换。

## App消费责任（独立后续claim）

新configured CREATE前同步核loaded&&!stale、完整ref已在当前页确认，然后调用configuredSelection；unknown CREATE ACK的同key/body重试绕过目录门禁，始终原pin/requested。旧无pin会话保持无pin。catalog refresh不会自动改选择。

outbox再schema.parse会clone成新对象，接入owner必须重新深冻ref/requested，不以本helper输出曾冻结推parse后仍冻结。ACK在bind/首turn前核完整pin；不匹配保留unknown。App继续拥有key/retry/draft/connection lifetime，不向模块泄漏token或扩大到模型调用。原有新草稿不得被迟到ACK覆盖。

旧a28/4e批准仅是历史；后继混合目录取代原“未知access整页错误”策略，target4f待新的独审。未知未来profile目的仅能只读，不自动激活。
