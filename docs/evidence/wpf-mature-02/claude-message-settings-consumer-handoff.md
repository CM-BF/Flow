# Claude逐消息设置：共享consumer可执行交接

2026-10-06 16:26 UTC；parent WPF-MATURE-02 / TODO-11，co-lead mika。本页维护接口与现owner派工请求；源码/检查进度仍由各owner的唯一status维护，不是新的任务层级或写权。

## Lead现在可派工

Lead已将F01公共路径交回并由native_center_owner在独立claude-message-settings-client树领取MATURE02C01 v1/11literal（F01 v43）；固定controlled8e9b3523沿本接口开工。Web/d01与TUI01F合法owner并行接各自consumer；**不等CORE的PG或整个UI验证完成**。若现owner不能接，先明确停止精确路径写入，再用当前version原子amend移除，由本组独立WT的新consumer owner fresh take/amend成功后开工。不能绕过F01公共入口、占用中的recovery/controller或复制HTTP/FSM。source先固定交审；工程检查按各自资源门禁，PG/SDK/provider当前不由此页开放。

CORE源码恢复已解阻：Mika本轮报告Lead已恢复并独核155缺源hash零错误；[CORE精确source closure](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/vertical-source-closure.json)：固定92f768采样227文件、155不可见/673771逻辑B、4KiB名义1,003,520B。恢复由Lead唯一operator执行，本owner未改sparse；17已安装依赖只复用第三方，@flow指向CORE本WT。Lead回执`/tmp/flow-claude-vertical-source-materialized.json`说明155source补齐；ba2→c33d并发仅9metadata，源ea未变。恢复不当验证通过。032已[正式分配](/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/f01/claude-message-settings-migration-assignment.json)，这里只证明号/领取，F01 actual factory挂载仍是单独接线。

## 固定合同与现场

公有输入固定为CORE `ea276572c3c99fb8400808a93efc69ce530d55a4`：`claude-turn-settings.ts`、`execution-profiles.ts`、`conversations.ts`、`conversation-queue.ts`、`assistant.ts`。首leaf已main22d5；后继source未因leaf批准自动通过。Mika核16:21:52 contracts-only三文件16/16、16:25:51合同focused strict exit0；16:26:31注入现Claude adapter单文件5/5 exit0。0真实query/native/PG/provider；related-closure focused strict也已exit0，合计21 distinct与两strict0；Mika已核manifest及输入252项零差异。后续一次PG在beforeAll因动态migration读闭包缺件失败，0case entered；详[固定失败包](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/pg-setup-failure-manifest.json)，原[专库槽位请求](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/vertical-pg-slot-request.md)。完整core合同/范围见[下一片handoff](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core/docs/evidence/wpf-mature-02-message-settings-core/next-slice-handoff.md)。

本owner16:24:10.888 UTC fresh账本：父0dd97484 v6只docs/实验/plan。F01 v40、TUI01F v1、RECOVERY01 v4仍ACTIVE。F01 `5f0fc08bfa84f35ec5728f0dfbee639619496027` clean，权威[status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/plans/f01-shared-domains/status.md)仍O14实施/资源等待；不能因另一个产品片已交付而抢公共源。architecture_read 16:21:56.939快照：Web `0eef4cda8813afe336df8dc88256da28e206c0d4` dirty仅6个direct-second evidence；TUI `26e21690c7d100b7115bef07aae7b55ab44529c6` dirty为fixture/journey/cancel_driver，虽slice delivered仍未release。其只读地图基线main65659028；改写前必须再次fresh核，不覆盖这些dirty。

## F01可立即实现的小接口

沿既有FlowClient实例、Bearer/cookie互斥、Signal、HTTP错误与无暗重试，不新增transport/连接配置或全局selector。冻结此方法名供Web/TUI/CLI共用：

```ts
claudeMessageSettingsProfiles(
  options: { after?: string; limit?: number } = {}, signal?: AbortSignal
): Promise<ClaudeMessageSettingsCatalogPage>

// 既有签名保持；input的公有类型在CORE增加optional messageSettings。
submitConversationTurn(id: string, input: ConversationTurnAdmission,
  key: string, signal?: AbortSignal): Promise<ConversationTurnAccepted>
enqueueConversationTurn(id: string, input: ConversationQueueEnqueue,
  key: string, signal?: AbortSignal): Promise<ConversationQueueAccepted>

// 增量decoder仍放既有acknowledgement模块，供所有consumer复用。
decodeConversationQueueAccepted(raw: unknown, conversationId: string,
  input: ConversationQueueEnqueue): ConversationQueueAccepted
```

新catalog每页固定单一 `X-Flow-Execution-Profile: flow.claude-turn-settings.v1`，GET仍`/api/execution-profiles`，after/limit沿URLSearchParams原样编码；使用`claudeMessageSettingsCatalogPageSchema.parse`，显式返回`profiles[].profile`的新版形状。旧200、native-v1/steering-v1 envelope、矛盾配置或错误protocol直接拒绝，不能fallback旧reader或吞错误成空列表；旧`executionProfiles`/`nativeExecutionProfiles`签名、默认header与codec保持。schema限制100项/页、tuple最多32、profile绑定与cursor已有公有校验，不拼四个维度的笛卡尔积。

`packages/contracts/src/index.ts`只补`export * from './claude-turn-settings.js'`；其余新增catalog/final类型已由现execution-profiles/assistant出口带出，不复制DTO。F01的`publishExecutionProfile`返回类型跟随公有`ExecutionProfilePublished`联合，不把新profile硬cast成旧controls；本片不创造自动publication或账号资格。

### 冻结请求与ACK

发送维持现有`body = JSON.stringify(input)`一次序列化、再由同body解析冻结的比较对象。入队在**请求携带messageSettings时**走同样冻结与`conversationAcknowledgement`错误边界，再调用新decoder；legacy无字段入队维持现行为，既有部分ACK transport测试不需要删除。不得让调用方在await之后的嵌套对象变更影响matcher；key/body不因重读catalog或草稿变化被替换。

send的现decoder保留conversation/turn/task/文本/revision/context全部检查，再对`turn.messageSettings`调用`assertClaudeTurnSettingsMatch(input.messageSettings, actual)`。仅在请求明确带设置时要求它存在；错、缺、非法、profile任一三元或组合不符，映射既有`UnknownConversationAcknowledgementError`，不得透传raw正文。新能力是optional `capabilities.messageSettings`，校验protocol、profile三元与`choices:'execution-profile'`并保留，不把旧`perTurnModel/perTurnThinking/perTurnTools=false`改true。creation锁只锁原profile，不授权绕过messageSettings资格。

新入队decoder用于opt-in分支：校验返回conversationId和item.conversationId等于请求id、UUID item.id、finite整数queueRevision为原expectedQueueRevision+1、item.sequence等于该receipt revision、`state:'waiting'`/`promoted:null`、时间/replayed与bounded preview形状，再精确匹配`item.messageSettings`。初始ACK与幂等重放都是不可变enqueue receipt；不能拿后续GET当前promoted状态替它判定。完整文本不在ACK内，preview必须等于原frozen text按CORE itemView规则所得的最长≤512 UTF-8字节完整Unicode code point前缀，truncated与实际截短一致（不是任意startsWith），不冒称全文receipt；正文身份仍由原冻结body/key及中心digest绑定。后续当前详情另走既有read方法，不新增“确认后自动重发”。

### requested / observed读回

`conversation`、`conversationTurns`、`conversationQueue/Item`沿旧endpoint/分页；HTTP层不strip新增字段。公共ACK和Web/TUI边界对存在的`turn.messageSettings`解析`claudeTurnSettingsSchema`，对存在的`effective.messageSettings`严格解析`claudeMessageSettingsFinalSchema`，wrapper.snapshot与该turn请求匹配，并核`effective.model === (observed?.model ?? null)`；坏observed不能因requested已匹配就穿过typed UI。snapshot是请求，observed只来自同task的SDK init：缺失、null、model alias、effort缺/null、fast off/cooldown/on与禁用原因原样保留；不得从requested回填。existing effective/source身份检查继续成立，不能为了新分支删旧校验。旧记录未带字段不补disabled/standard；无可信能力、stale三元或resume不支持的not-requested由中心拒绝，客户端保留草稿/intent。

### CLI最小兼容入口

F01固定源当前**没有conversation/catalog CLI命令**。不改现`submit`的task语义或给它偷加全局设置。新增同组的三个薄命令，沿现parseArgs、`--input/--key/--after/--limit/--json/--url`与signal，不需要新参数维度或第二JSON读取器：

| 命令 | 精确调用 |
| --- | --- |
| `flow conversation profiles --after UUID --limit N --json` | `claudeMessageSettingsProfiles({after,limit}, signal)`；只这一命令选择新protocol |
| `flow conversation send CONVERSATION_ID --input FILE --key KEY --json` | `conversationTurnSchema.parse(await readJsonInput(FILE, 131072))`；首入口限定mode follow-up；调用既有submitConversationTurn |
| `flow conversation enqueue CONVERSATION_ID --input FILE --key KEY --json` | `conversationQueueEnqueueSchema.parse(await readJsonInput(FILE, 131072))`；调用既有enqueueConversationTurn |

input包含完整请求（expectedRevision或expectedQueueRevision、text、原可选materials和messageSettings），不合并独立model/fast flags，不给effort补default。snapshot canonical上限1024字节继续由公有schema执行；131072只是输入文件上界，沿现工具的有限文件读取。send/enqueue必须显式稳定`--key`，缺key/非法JSON在发HTTP前失败；unknown ACK沿现错误出口非0，给同key/body的显式恢复提示，不自动生成新key或重发。输出原接受receipt含requested，不宣称已执行；历史observed由现客户端/跨端读回保真，本小片不另建CLI会话FSM。旧submit/list/watch/reconcile及各既有命令路径、选项、输出和退出码保持。

## 最小合法源码范围与切片

| 原16:24 owner地图（公共路径已C01接收） | 本片精确路径 / 直接检查 |
| --- | --- |
| F01 v40 | `packages/client/src/index.ts`、`packages/client/src/conversation-acknowledgement.ts`、`packages/contracts/src/index.ts`；同目录`execution-profiles.test.ts`、`conversation-acknowledgement.test.ts`、`conversation-queue.test.ts`已持有；`apps/cli/src/index.ts`、`apps/cli/src/cli.test.ts`、`apps/cli/README.md`在既有apps/cli目录scope。`json-input.ts`先只复用。无需新增client test路径或扩大整个目录。 |
| Web现owner或独立合法leaf | `apps/web/src/execution-profiles/catalog.ts`、`selection.ts`、`ExecutionProfilePicker.tsx`；`apps/web/src/App.tsx`、`TaskThread.tsx`；`apps/web/src/conversations/ConversationThread.tsx`、`outbox.ts`、`projection.ts`；`conversations/queue/commands.ts`、`projection.ts`、`ConversationQueue.tsx`；`apps/web/src/recovery/binding.tsx`。其中App/Thread/outbox/会话projection/queue.commands/recovery.binding被RECOVERY v4持有；其余当时free，仅fresh take后可先独立catalog/选择/视图leaf。 |
| TUI01F现owner或独立合法leaf | `packages/interaction/src/types.ts`、`commands.ts`、`controller.ts`、`projection.ts`、`queue-control/index.ts`；`apps/tui/src/main.tsx`、`screen.tsx`。前3与main/screen被TUI01F v1持有；projection/queue-control当时free，可fresh领取独立codec leaf。不能在同tree抢写已有controller。 |

F01可先固定client/CLI源与局部HTTP/codec检查（检查另遵资源门禁），无需等server factory mount或真实PG；F01负责后续032 `apps/server/src/index.ts`真实挂载，只有集成验证才能称纵向工作。Web/TUI free leaf可同时准备，新client入口若尚未可见先用精确typed port/测试注入，最终必须消费单一FlowClient；不可复制HTTP或构造第二draft状态。

## Web/TUI最小行为接线

Web沿现唯一DraftState map加optional snapshot；`CompleteDraft/readRecoveryDraft`、App保存/恢复/route切换同带。`ConversationThread.submit`在materials await/composer.send前parse、复制、递归freeze，pending、onNew、send/enqueue、outbox恢复只用captured A。draft身份包含viewKey/text/canonical snapshot与既有材料身份；App restore冲突与Thread ACK清稿必须包含设置，正文相同但设置改为B也不清/回填B。`profileReason`已有lockedProfile放行仅适用creation；新设置另核conversation.capabilities.messageSettings.profile、conversation.executionProfile与catalog三元相同及完整tuple获准。缺能力/stale目录保稿阻新设置，旧legacy路径仍可用。通用journal.ts、材料helper与draft map不新建第二套。

TUI沿同IntentStore.save→dispatch→ACK→clear/recover，draft存完整snapshot；新增显式`/settings`列/选configured完整tuple、`/enqueue <text>`使用已读queueRevision走同Intent，不busy时暗切queue。refresh保留messageSettings三元能力；controller只比text的清稿与screen命令清稿同时改为完整captured identity。Intent version1/key、旧journal读取保持；不改private-journal/headless实现或新增FSM。queue-control现z.object会strip snapshot且blocked缺`message-settings-unsupported`，与Web queue projection必须显式接收/展示。

两端分别显示draft下一条requested、历史turn与队列自身冻结requested、init observed。目录configured≠账号entitlement；explicit standard/fast不得暗换model或承诺价格/实际生效。运行A、已入队B与新draft C互不覆盖，旧会话可读可续；能力未知组合不伪装可用。

## 直接验收与交付边界

F01最小：新reader精确header/翻页/旧200拒绝，旧reader不变；send/enqueue异步嵌套变更后body和matcher仍A；200缺/非法/不同snapshot（含三元）→unknown且不retry；enqueue replay不可变ACK及多字节字符跨512字节边界反例；observed absent/null/alias保真；CLI新3命令路由、bounded输入、required key、409/abort/unknown出口，旧submit固定body保留。已有HTTP fixtures即可，不需要PG/模型才能开始源码。

Web直接tests：`apps/web/test/execution-profiles.test.ts`、`conversation-outbox.test.ts`、`conversation-projection.test.ts`、`conversation-queue.test.ts`、`conversation-recovery.test.ts`及既有recovery fixture/browser必要段。TUI：`packages/interaction/src/controller.test.ts`、`queue-control/controller.test.ts`、`apps/tui/src/recovery.test.ts`、`journey.test.ts`、`queue-controls/journey.test.ts`。测试路径也须合法owner/claim，不因列在本页自动授权。

共同反例：①完整tuple与legacy codec，nested mutation隔离；②材料pending中编辑B及同文不同设置B，A回执不能清B；③错ACK/断线/刷新/重启仍保A原key/body；④queue/history冻结、observed unknown不回填；⑤not-requested resume409保稿，stale profile任一三元不绕creation锁。实际SDK、PG、Web实跑与全产品验收仍独立记录；本页0运行，不冒称这些检查已通过。

方法：本地find-skills匹配TypeScript client/CLI与跨端状态边界，复用clean-code固定sickn33@bdacd76、codebase-design方法；16:24重新读本地技能，核命名、单一请求/状态owner、错误传播与无需第二hash/FSM。未安装技能/依赖。本轮只读固定Git/账本/owner状态并写父交接，0测试/PG/provider/新诊断；旧sealed证据不改。

## 固定C01补充校验反馈，交assignment正式reviewer

Mika/architecture_read只读固定source `563b1ea151d8d26a2100238d8faf26b697f38d71` 提出的补充P2；本parent复读同Git关键段，0测试/代码修改。作者packet HEAD `a23883fbc595564dcb66e0030b430674b896574e` clean（16:55读），[正式包](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-client/docs/evidence/mature02c01/README.md) / fixed-manifest SHA `23347f1107af75427b0dd1ca269e4bdc2e31b5744437df761057a4b036f2bca8`；作者86 distinct分轮/focused types0，本组不重复验证，也不签发本片APPROVED。assignment是唯一正式独审者；其16:55:18已APPROVED固定563b，当前metadata5739900142a0ec04f492ccea15ec54e5e6520841 clean（本parent17:05只读核status/review）。下面是后续补充P2，交指定reviewer判断并由原owner修复后收口，不能继续将原正式审查标为进行中。

**P2：新设置回执可接受互相矛盾的旧requested/effective字段。** `packages/client/src/conversation-acknowledgement.ts:118–126`仅在effective.messageSettings wrapper出现时排除runnerRequested；所以turn已含新snapshot但finalwrapper尚无时，仍可接受旧disabled-only runnerRequested。有newwrapper时，又允许effective.thinking='disabled'。固定CORE ea276的replies.ts90–92将新messageSettings与旧runnerRequested互斥；assistant.ts11–12/28规定新effective thinking为unknown。decoder应在snapshot存在时拒绝runnerRequested，并在newwrapper存在时要求thinking='unknown'。这属于外部回执矛盾校验缺口，不声称当前CORE真实会发错值；不能反向要求queued/pending ACK提前有finalwrapper。

请原owner补两直接反例：①合法新turn snapshot+无finalwrapper+旧runnerRequested应unknown；②合法newwrapper+thinking disabled应unknown。沿现UnknownConversationAcknowledgementError保留原intent/key/body，legacy无新snapshot路径不改；queued无finalwrapper仍可正常解析。**P3供正式reviewer判断**：capabilities.messageSettings.profile目前只shape校验，未与conversation.executionProfile三元绑定；需按可信会话/catalog契约评估，暂不将未验证影响升为blocking。本页只传递具体固定接缝，不替代正式review/status或新增共享helper。
