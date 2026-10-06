# 下一片：冻结消息设置实际传到现有 Claude adapter

Owner status_read/gpt-6-astra，co-lead mika，parent WPF-MATURE-02；沿同一 core WT/branch。当前 claim c652bc61 v1 仍仅两 leaf 源与本 plan/evidence；下列现有源全部未获写权，先请求 Lead source-only 只读 closure 和精确 handoff/amend。0 新工程检查/PG/SDK/provider/build/install。

首 leaf source `4e7b7f968a2160a60989b3b6343506ae8fb5ef6a` 已随 metadata `b34280e8f4acb7fe31c5adb33cd0e62396ac9506` 接入 main `22d5ca67159b35bb794b2711cf6df0cb905b92e8`；owner 两源 Git 比对相同。正式接收 [receipt](/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/i02/claude-message-settings-intake.json)。不 merge/retest，不把首 leaf 的5/5或批准继承给本片。

## 已收敛方案

| 方案 | 实际影响 | 决定 |
| --- | --- | --- |
| 现 Claude v2 + optional `turnSettings` | 沿 activeSteering 的缺字段不补键机制；旧 canonical/digest 不变；新配置 digest 包含整 choices，沿旧发布/guard。仅协议化新增能力与请求，原执行身份/lifecycle不变 | 推荐，Mika 已采纳 |
| 新 adapter/profile v3 | 仍受每 runner immutable profile 限制，另要改 session/source policy/context adapter 白名单与兼容；本片没有相应生命周期变化收益 | 不采用，不新增白名单工作 |

新 opt-in profile 需新配置 digest/runner 身份；旧 profile/session 不热改，旧会话继续原读/续聊语义。首片 `turnSettings` 与 activeSteering/goalTools/goalGraphTools 互斥，manifest/profile/center/guard 一致拒绝。不是第二 host/catalog/recovery FSM。

## Public seam 草案

1. **可信配置**：`configuration.turnSettings?: { protocol: 'flow.claude-turn-settings.v1'; choices: CompleteChoice[] }`，复用已审 finite choices；没有 defaults、settingsRevision 或可变 next-setting。`profile.configDigest` 是能力配置版本。允许仅指 configured policy，availability 仍 not-probed，SDK枚举不等于模型/账户能力。
2. **完整请求**：send/enqueue/TaskSubmission 的 `messageSettings?: ClaudeTurnSettings`。新 opt-in profile 的每条消息必须有完整 v1 快照；旧 profile 不接受 override。中心与 runner guard 各验证 profile 三元及整 tuple；不拼不同 choice 的坐标。缺能力证据→unknown；可信不允许→unsupported；与 profile 不符单独拒绝。
3. **持久化/ACK**：send/enqueue 原 CAS+规范 body 幂等事务冻结；task 沿 submission JSONB，queue 新一个 nullable `message_settings` JSONB 列。turn 从 task 读，不增加 turn 列；不写 K02/context输入digest。mutation body 的 v1 决定其持久 ACK 内容，GET header 不影响同 key 回放。ACK 的 additive `messageSettings` 必须用既有 leaf matcher 与发送前完整body匹配；unknown不清intent，不换key重试。
4. **队列**：列表轻查询显式带小快照；firstWaiting 的冻结项进入自动 promotion 和 controls 显式 resume。prepareTurnAdmission 已知 resumeSessionId，若 effort not-requested 的跨session继承无法证明，受理前拒绝。入队时不能预断未来session时，保留原快照；promotion/read blocked 返回明确 message-settings-unsupported，手动/自动一致，不补当前默认、不跳项。queue gate须检查首项，不用空文本/当前profile替代first设置。
5. **一次 native 映射**：现 query 的 model/thinking/effort/settings.fastMode 从已验证快照映射；standard明确false，fast明确true，not-requested不传effort且不宣称复位。初次可表达not-requested；已知resume不可确定则center/guard双重阻止，不先启动Query再改控制。manual thinking仍不开放。permissions、env隔离、tools、limits、cancel/settlement、nativeSession恢复路径不改。
6. **requested/observed**：new final settings 用版本化 additive snapshot+observed，center把snapshot与task持久快照精确绑定，并保留现task/attempt/session/source fence。旧 requested 字段仅在真实可表达时存在；新thinking/effort/fast不能伪填disabled。legacy会话读投影可省略旧optional runnerRequested；effective.thinking仍unknown。init model/effort/fast state/reason只当observed，缺失/null/降级保留；alias不强等于resolved model，requested fast不等于已激活。上下文history的requestedModel必须取已持久task快照，旧无快照才沿旧profile配置。

## Reader 兼容

原无header、steering-v1、native-v1 profile读者都在SQL LIMIT前排除有turnSettings的新配置；不能剥掉字段再复用原digest。新selector沿既有 X-Flow-Execution-Profile 与同GET模块，精确单header版本选择新的可解码opt-in视图；sentinel/digest/排序/分页检查继续。

conversation旧literal false能力字段不直接改true。新能力是 additive、版本化 messageSettings 描述，仅新consumer读取；旧reader可忽略。新mutation ACK是否包含快照由body版本固定。旧创建requested保持真实历史创建值，不重写成新turn的请求；新历史逐turn使用自己的冻结snapshot。旧codec分支/旧bytes有精确回归。

## 精确 source-only closure / writer 候选

先由 Lead 添只读源到本 sparse WT；不是整目录写权。实现顺序按职责推进，但最终必须交一条center→queue→adapter真实注入纵向，不能再只交未消费helper。不存在文件在下表明确“新增”。

| 职责 | 仓库相对 literal 路径 |
| --- | --- |
| opt-in/消息/最终观察契约 | `packages/contracts/src/execution-profiles.ts`；`packages/contracts/src/conversations.ts`；`packages/contracts/src/conversation-queue.ts`；`packages/contracts/src/tasks.ts`；`packages/contracts/src/assistant.ts` |
| 契约直接检查 | `packages/contracts/src/execution-profiles.test.ts`；`packages/contracts/src/assistant.test.ts`；新增 `packages/contracts/src/claude-message-settings.test.ts` |
| 中心共用设置校验与migration | 新增 `apps/server/src/conversations/message-settings.ts`；新增 `apps/server/src/conversations/message-settings-migration.ts` |
| conversation受理/读回 | `apps/server/src/conversations/commands.ts`；`apps/server/src/conversations/admission.ts`；`apps/server/src/conversations/state.ts`；`apps/server/src/conversations/replies.ts`；`apps/server/src/conversations/queries.ts` |
| queue冻结与自动/手动消费 | `apps/server/src/conversation-queue/commands.ts`；`apps/server/src/conversation-queue/store.ts`；`apps/server/src/conversation-queue/queries.ts`；`apps/server/src/conversation-queue/gate.ts`；`apps/server/src/conversation-queue/promotion.ts`；`apps/server/src/conversation-queue/controls.ts` |
| profile发布视图/旧读者隔离 | `apps/server/src/execution-profiles/store.ts`；`apps/server/src/execution-profiles/index.ts`；`apps/server/src/execution-profiles/native-catalog.test.ts` |
| final可信绑定/直接context消费者 | `apps/server/src/assistant/store.ts`；`apps/server/src/context-transparency/store.ts` |
| 真实中心纵向检查 | 新增 `apps/server/src/conversations/message-settings.test.ts`；新增 `apps/server/src/conversations/message-settings-fixture.ts`（唯一专库fixture，含context requestedModel断言，不复制另一套fixture） |
| 现adapter实际映射 | `apps/runner/src/claude.ts`；`apps/runner/src/native-harness/claude.ts`；`apps/runner/src/execution-profiles.ts`；新增 `apps/runner/src/claude-message-settings.ts`；新增 `apps/runner/src/claude-message-settings.test.ts`（注入现createClaudeAdapter，不启动native Query） |

migration精确文件名须 Lead 分配后才入claim，拟 `packages/storage/migrations/NNN-claude-message-settings.sql` 仅为未分配占位，不能拿NNN/glob领取；031已由O15持有。DDL只加queue nullable列/size+形状检查与该列不可变保护，并保护task submission的新settings键不被改；无tasks新列/turn新列、不约束其他历史submission字段，不回填旧NULL。

仅只读直接消费者/闭包：`apps/runner/src/claude.test.ts`、`apps/runner/src/execution-profiles.test.ts`、`apps/runner/src/native-harness.test.ts`、`apps/server/src/conversations/conversations.test.ts`、`apps/server/src/conversation-queue/queue.test.ts`、`apps/server/src/context-transparency/store.test.ts`、`apps/server/src/execution-profiles/publication.ts`、`apps/server/src/native-harness-policy.ts`、`packages/contracts/src/runner.ts`、`apps/server/src/conversations/index.ts`、`apps/server/src/conversation-queue/index.ts`、旧007/009/010/011/018/025 migrations。现有默认tests不先编辑，若具体失败证明需修先精确amend。

## 共享 owner 协作

15:17 fresh账本F01 v40仍持 `packages/client/src/index.ts`、`packages/client/src/conversation-acknowledgement.ts`、其ACK/queue/profile tests、`packages/contracts/src/index.ts`、`apps/server/src/index.ts`。请求F01 own薄接线：export、复用ACK matcher、可选read selector、migration-before-admission/queue-worker及必要client1个直接旅程。不借core claim越权。

02 v5持execution-profile contract/test以及server index/catalog test；需明确停写该片→原子amend移除→core fresh amend成功后实现。R05现adapter/guard路径及context-store路径也必须fresh查权属后精确领取；不改runtime/harness宿主/NativeExecutionError生命周期。没有索取原诊断目录/私人配置/付费资格。

## 最少验证与解除条件

1. pure契约：旧configuration canonical逐字、显式opt-in互斥、整tuple/身份、缺值与not-requested语义、new final严格schema。
2. 注入SDK adapter：同一nativeSession两次完整请求不同model/effort/speed，每次Options精确；init别名/实际model、null/缺effort、cooldown分别观察；resume not-requested在query前拒绝，0native spawn。
3. 独占专库HTTP：send A/queue B后改变草稿C，task/queue/turn/ACK仍各冻结；同key回放/异body409、CAS回滚；自动和手动promotion一致；旧行升级不变、SQL-before-limit与sentinel；final不同snapshot拒绝及context requestedModel取task。
4. 保留既有直接消费者必要覆盖，不跑全库/容量；真实PG/HTTP须root资源/串行门禁，不因本设计获得运行许可。当前没有新PG/test/build/install；root 15:31:45 F01资源gate未过且0PG不涉及本片回归。

剩余解除条件只有明确共享handoff/精确amend与source-only closure、唯一migration编号，以及后续实际验证资源门禁；没有新的GO审批要求。
