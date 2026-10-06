# 下一片：冻结消息设置实际传到现有 Claude adapter

Owner status_read/gpt-6-astra，co-lead mika，parent WPF-MATURE-02；沿同一 core WT/branch。原四scope已于2026-10-06T15:44:19.351Z原子扩为claim c652bc61 v2，共37 literal，见[next-slice-amend-receipt.json](next-slice-amend-receipt.json)。已可从本树可见contracts实施，其余source待Lead source-only closure；尚未运行任何后继检查。当前只读基线 main `a89f42ab57acb53657af6a2d1b745dabd4d50aa5`；parent 已逐源确认与本树 base70cc相同，无须merge/rebase。0 新工程检查/PG/SDK/provider/build/install。

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

原无header、steering-v1、native-v1 profile读者都在SQL LIMIT前排除有turnSettings的新配置；不能剥掉字段再复用原digest。新selector精确为 `X-Flow-Execution-Profile: flow.claude-turn-settings.v1`，复用 `EXECUTION_PROFILE_HEADER` 与 leaf 的 `CLAUDE_TURN_SETTINGS_PROTOCOL`，不再创建短别名或第二header。现selector在index.ts按rawHeaders不区分header名大小写计数，只有恰好一次且value逐字相同才选新视图；重复/逗号合并/大小写变体值/未知值继续原legacy fallback。GET路径、after/limit、sentinel/digest/排序不变。新有限page的protocol同该v1常量，只列opt-in Claude；每entry给reference、完整configuration、configured choices、source runner-configured、availability not-probed和createdAt，nextCursor仍最后id/null；不把新profile强塞含fixed-disabled的旧controls DTO。

conversation旧literal false能力字段不直接改true。新能力是 additive、版本化 messageSettings 描述，仅新consumer读取；旧reader可忽略。新mutation ACK是否包含快照由body版本固定。旧创建requested保持真实历史创建值，不重写成新turn的请求；新历史逐turn使用自己的冻结snapshot。旧codec分支/旧bytes有精确回归。

## Final 与读回的严格有限结构

`assistantSettingsSchema` 保留旧 strictObject 分支逐字段/顺序不变；新增互斥opt-in分支，不把新枚举塞进旧 requested。建议精确结构如下（所有对象strict，observed内字段遵循SDK0.3.290声明）：

```ts
type MessageSettingsFinal = {
  snapshot: ClaudeTurnSettings;
  observed: null | {
    source: 'claude.sdk.system.init';
    model: string; // 非空、最多180 UTF-16字符，最多720 UTF8B
    effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null;
    fastModeState?: 'off' | 'cooldown' | 'on';
    fastModeDisabledReason?: 'free' | 'preference' | 'extra_usage_disabled'
      | 'network_error' | 'unknown' | 'not_first_party' | 'disabled_by_env'
      | 'model_not_allowed' | 'sdk_opt_in_required' | 'pending';
  };
};
type OptInAssistantSettings = {
  effective: LegacyAssistantSettings['effective']; // thinking恒unknown
  messageSettings: MessageSettingsFinal;
};
```

新分支不得有legacy `requested`；旧分支不得有`messageSettings`。因此legacy decoder不会把adaptive伪读为disabled，conversation新分支省略optional runnerRequested，并通过additive messageSettings读回。effective保留原有model/permissionMode/tools有界观察，thinking仍unknown。wrapper的规范JSON UTF8上限2048B（不含已有effective/tools容器）；snapshot仍独立1024B。Final事件身份/source保持原claude.sdk.result，仍经现settings JSONB保存；不新增表、observed列或第三套snapshot实体。

`observed:null`表示本次Query没有合法且匹配nativeSession的init，不是模型没有这些能力。合法init的model是SDK必填字段；有init但model缺失/越界/类型错为坏帧，拒绝该final，不能伪称未观察。effort缺失保留缺键（host未报告）；显式null保留null（init说明不会发送effort参数），五值仅表示init报告的下一请求配置。fast两个optional键缺失分别保留缺键，不补off/null/默认reason；未知枚举/非法null拒绝坏帧。只取同Query、匹配session的最新init，不把前一个session或上条消息的init补入；requested alias不强等同model。init观察不证明全turn实际推理/计费或fast始终生效，cooldown保留为cooldown；无SDK实际thinking证据。

center在现session/source/fence验证后，按task.submission.messageSettings分支：有snapshot必须有新settings且leaf matcher精确相等；无snapshot不得带新settings。profile三元还须与task/attempt runner一致，旧final走原分支。读回复用同一strict union，旧会话/旧行不补键，conversation投影不重复制造新持久snapshot。

固定SDK声明：本机已有0.3.290 sdk.d.ts SHA256 `193becad9d69bc4d2ccd22def53fb9bff9e2628e324f7657d9497da9476af541`，FastModeDisabledReason :773 / State :778，SDK init :5971–5977。这是已安装声明，不是账户/模型可用或付费实测。

## 所有任务入口与旧任务边界

TaskSubmission schema在messageSettings存在时要求harness=claude、明确executionProfile且三元逐字段相等，拒绝fixture/protocol/engineering同时出现；resume的not-requested不确定组合另拒绝。`assertTaskExecutionProfile`在既有execution-profiles/store.ts消费可信profile做整组合/互斥/请求存在校验；普通tasks.acceptTask、conversation prepareTurnAdmission以及claim均已有此调用，复用它覆盖直POST /tasks，不能仅conversation校验。新共用pure校验不得反向import store形成循环。

opt-in runner必须拒绝无profile或无完整snapshot的任务，query调用数为0；不让legacy unpinned任务隐式继承新model/thinking/fast。旧runner/profile对无snapshot维持原行为，对带snapshot拒绝；不会把新属性丢弃后当旧任务继续。新profile是新的immutable配置/runner身份，旧session不会热切到它；在同一个新opt-in session后续消息可选择可信整组合，并各自冻结。

## DDL 字节口径

1024B只在TS leaf按解析后固定顺序 `JSON.stringify` 的UTF8字节计算；写入、promotion与读回均走该schema。PostgreSQL `jsonb::text`会增加格式空白且改变键序，binary/pg_column_size又是另一口径，均不得沿用1024阈值。DDL采用nullable+对象/版本/固定形状约束，并可用单独粗限额 `octet_length(convert_to(message_settings::text,'UTF8')) <= 4096` 防止异常DB值；该值名义是PG文本表示上界，不是canonical/physical/wire长度。合法snapshot只含有限固定键、180字节ASCII model与固定UUID/hex/枚举，格式空白上界远小于额外3072B，因此不误拒leaf合法输入；精确canonical校验仍由leaf负责。SQL NULL只代表旧行；新opt-in缺值由中心拒绝；JSON null不当合法snapshot。task JSONB的新key同样作该窄约束与不可变保护，不改历史其他key，不写K02摘要。

## 精确 source-only closure / writer 候选

先由 Lead 添所需源到本 sparse WT；已领的只有37 literal，不是整目录写权。实现顺序按职责推进，但最终必须交一条center→queue→adapter真实注入纵向，不能再只交未消费helper。不存在文件在下表明确“新增”。

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

migration精确文件名须 Lead 分配后才入claim，拟 `packages/storage/migrations/NNN-claude-message-settings.sql` 仅为未分配占位，不能拿NNN/glob领取；031已由O15持有。DDL只加queue nullable列/有限形状检查与该列不可变保护，并保护task submission的新settings键不被改；无tasks新列/turn新列、不约束其他历史submission字段，不回填旧NULL。具体字节口径见下节；禁止把jsonb文本/二进制长度直接当leaf canonical 1024B。

仅只读直接消费者/闭包：`apps/runner/src/claude.test.ts`、`apps/runner/src/execution-profiles.test.ts`、`apps/runner/src/native-harness.test.ts`、`apps/server/src/conversations/conversations.test.ts`、`apps/server/src/conversation-queue/queue.test.ts`、`apps/server/src/context-transparency/store.test.ts`、`apps/server/src/execution-profiles/publication.ts`、`apps/server/src/native-harness-policy.ts`、`packages/contracts/src/runner.ts`、`apps/server/src/conversations/index.ts`、`apps/server/src/conversation-queue/index.ts`、旧007/009/010/011/018/025 migrations。现有默认tests不先编辑，若具体失败证明需修先精确amend。

## 共享 owner 协作

parent 15:40:52 fresh账本F01 v40仍持 `packages/client/src/index.ts`、`packages/client/src/conversation-acknowledgement.ts`、其ACK/queue/profile tests、`packages/contracts/src/index.ts`、`apps/server/src/index.ts`。请求F01 own薄接线：export、复用ACK matcher、可选read selector、migration-before-admission/queue-worker及必要client1个直接旅程。不借core claim越权。

02已完成四profile路径partial handback，parent v6只留三管理scope；receipt位于父tree docs/evidence/wpf-mature-02/claude-core-profile-handback-receipt.json。parent 15:40:52查R05现列三路径无active占用，但实施前仍fresh核。context-store原由SVC05H01 cd2d2e57 v1/assignment_review占用；parent15:42:54.623Z已核其v2只留管理scope，/tmp/flow-svc05h01-source-handoff-receipt.json确认交回。`apps/server/src/context-transparency/store.ts`已合法纳入core v2，`apps/server/src/context-transparency/attachment-history.test.ts`仅readonly。必须保留当前main/base已有templateVersion2材料unknown的三行修复，不引入旧362候选。不改runtime/harness宿主/NativeExecutionError生命周期。没有索取原诊断目录/私人配置/付费资格。

## 最少验证与解除条件

1. pure契约：旧configuration canonical逐字、显式opt-in互斥、整tuple/身份、缺值与not-requested语义、new final严格schema。
2. 注入SDK adapter：同一nativeSession两次完整请求不同model/effort/speed，每次Options精确；init别名/实际model、null/缺effort、cooldown分别观察；resume not-requested在query前拒绝，0native spawn。
3. 独占专库HTTP：send A/queue B后改变草稿C，task/queue/turn/ACK仍各冻结；同key回放/异body409、CAS回滚；自动和手动promotion一致；旧行升级不变、SQL-before-limit与sentinel；final不同snapshot拒绝及context requestedModel取task。
4. 保留既有直接消费者必要覆盖，不跑全库/容量；真实PG/HTTP须root资源/串行门禁，不因本设计获得运行许可。当前没有新PG/test/build/install；root 15:31:45 F01资源gate未过且0PG不涉及本片回归。

目前37 literal已合法领取；剩余条件是Lead source-only closure、F01独立薄合作、唯一migration编号，以及后续实际验证资源门禁；没有新的GO审批要求。

2026-10-06 15:44:19 UTC安全点：selector/final/bytes/task入口设计收紧；既有源25项逐Git与base70cc一致，context附件v2保护也两端存在。后继设计独审反馈与source实现批准分开，首leaf原manifest/raw不变。
