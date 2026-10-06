# CHAT01 现有能力与接口缺口只读调查

调查者：w01_owner（gpt-6-astra ultra）及root官方UI研究；记录者d01_owner，仅本管理范围落盘。观察2026-10-06 03:29 UTC。主仓固定source `3773db5d014a6d38d09553acd0a5fe8df900b7c4`，下列后端行号均指该版本，可用 `git show <SHA>:<path>`读取。Web对照已审P01树 `2910ebc8e11fbcb00d1c2773face229c84fe47cd`。没有新接口写入、模型/语音调用或49922服务变更。

## 可复用的权威执行链

| 固定源码定位 | 已有能力 | CHAT所需区别 |
| --- | --- | --- |
| apps/server/src/tasks.ts:23；runners.ts:45；sessions.ts:7；events.ts:37 | 事务幂等submit、持久wake；按created_at/id挑queued任务；resume限同runner/session空闲，条件UPDATE原子占用；session/attempt/runner归属与完成释放 | 允许每turn内部复用durable task/native resume；仍需公开持久conversation稳定ID、有序turn/context lineage、用户可观察queue/steer。更正初报：已有会话并发占用控制，不能说完全没有 |
| packages/contracts/src/tasks.ts:18 | 严格TaskSubmission只有title/prompt/harness/protocol/fixture/verification/resumeSessionId，额外字段拒绝 | 当前无conversationId/turnId/model/effort/access/files/context，不能Web自行附字段当支持 |
| packages/contracts/src/tasks.ts:52；71 | TimelineEntry仅text/reference；已有nativeSessionId、cursor/reset/decision/usage | 缺role/messageId/turnId/delta身份；公共事件应先由共享owner固定再复用现链 |
| packages/client/src/index.ts:26 | submit/list/workspace/project/index/show/detail/events/decide/cancel | 无append-turn、公开queue edit/reorder/remove、steer、model capability catalog、attachment上传；必须主线共享owner提供，不私建前端权威 |
| packages/contracts/src/harnesses.ts:3；apps/runner/src/configuration.ts:7 | fixture/claude/a2a；Claude需operator manifest，model/materialFiles/allowRead/审批/限制来自runner配置 | 没有codex harness不是不能做Codex式交互；首个真实Claude adapter可复用，模型/能力仍由中心catalog决定 |
| apps/runner/src/claude.ts:39；60 | native query/resume/persistSession及session一致性检查 | 持久conversation及turn映射需中心负责，不能浏览器拼接历史替代 |
| apps/runner/src/claude.ts:58；75；145；apps/server/src/events.ts:12；48 | SDK循环当前只消费init/result，最终result写artifact+verification；context.emit已接timeline持久、owner/lease fencing、顺序与去重 | assistant/stream事件当前没投影成对话；共享owner定义带message/turn身份事件后复用emit链，Web不能直连SDK |
| apps/runner/src/usage.ts:25；47；claude.ts:156 | session累计量与未知baseline处理 | resume累计量不能全算当前turn新用量，沿现usage语义 |

Claude现限制：claude.ts:45仅授权材料Read，禁写/网络/shell，thinking disabled；:85文件快照；:186最多4 SDK turns/$1/90秒。这些是观察到的既有限制，不因本计划授权扩展；Web不能显示任意full-access/effort/file picker已可用。

## 官方Thread适配与语义

固定P01树 TaskThread.tsx:82将单prompt加所有text当assistant；:118 isDisabled:Boolean(task)，:120 onNew总submit。完整官方Thread已经存在；真正持续composer应由中心conversation投影/消息身份与callback能力驱动，不能只解除disabled然后把缺少持久lineage的任务拼接当会话。未来Web拟独立conversations深模块；App/TaskThread必须从I01受控移交，具体literal scope尚未冻结，不据研究路径自动取得写权。

实装assistant-ui react0.15.23/core0.3.22的external-store-adapter.ts:108/169/215支持isSendDisabled/onNew/queue/attachments；external-thread-queue-adapter.ts:23的无anchor move到steer会cancel live run并dispatch，:41取消需暂停drain。因此内存queue不能当Flow持久queue，默认steer不可直接映射Flow cancel。真正steering须active turn/attempt ACK及生效语义，unsupported明确排队，不静默替代。

root另核官方[ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store)与[索引](https://www.assistant-ui.com/llms.txt)：可继续使用完整Thread，稳定message/turn ID，中心持久数据和callbacks作为权威，不需要另写UI壳。内存createMessageQueue不提供中心持久/顺序/取消保障。

## 语音边界

官方[DictationAdapter](https://www.assistant-ui.com/docs/guides/dictation)是按住说话转文字，区别于duplex voice/TTS；需区分interim/final与stop/cancel/error并保留输入。MDN [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)说明部分浏览器将音频送远端；不能宣传天然免费、纯本地或离线，也不能暗接服务。当前只有计划/unsupported处理，实际转写服务按既有授权来源与能力合同单独接入。

## 技能、结论与后续owner

w01_owner按本地find-skills方法读 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、assistant-ui/SKILL.md及architecture、codebase-design/SKILL.md，并核实装源码/官方索引；没有安装新技能。root只读官方UI研究合并在本证据，不另建权威计划。

共享合同/中心持久conversation、能力目录、runner消息事件/queue-steer由原Lead分配唯一writer。Web本队等待明确合同后独立claim消费，I01 owner交付后作为候选，不抢当前App。管理父U11/REQ41～45及[CHAT01准备](../../../plans/web-platform/conversation-core/plan.md)维护唯一追溯；本调查不是实现或APPROVED。


## 运行中发送、草稿与未知ACK专项（root只读实装core0.3.22）

external-store-thread-runtime-core.ts:669～714 queue分派使用 `message.steer ?? isRunning`，因此运行中未显式选择时默认steer；ComposerInput.tsx:237～248另有Cmd/Ctrl+Shift+Enter steer热键。不能只接中心queue adapter就称普通发送FIFO，必须显式映射用户Queue/Steer意图与unsupported。

base-composer-runtime-core.ts:302～474在异步onNew前清draft，普通Error不恢复，仅MessageNotSentError恢复；react/index.ts:155公开后者。它表示确定未发送，不能用来掩盖ACK超时未知。当前TaskThread只在空draft手动恢复，新多turn应按commandId保存pending/unknown/retry，与用户新draft并行。验收：ACK丢失用同幂等key核对；确定未发送可恢复；等待期间新输入不丢不被旧draft覆盖；Enter/按钮/steer热键语义一致。没有修改node_modules，也不把此研究当公共中心已提供queue/steer。

## ACK未知与两阶段受理研究（2026-10-06 03:53 UTC）

研究者w01_owner，管理者转录；只读固定版本，没有写CHAT/后端、没有读取moving projection、没有运行工程测试或模型。链为center `2d3bb61b35318f999c9f0f336bb3f443418bb5dc`、公共client `a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0`、Web outbox `0d4e050057b9204ea761541d7847b9932331a519`。新受控typed输入 `746364ea2581b8c563a09b07560de5e0b63bcab8`只改变assistant provenance/reply/effective settings类型，不改本段admission/HTTP语义；这不是“最新typed端到端通过”。

固定源码定位可用`git show SHA:path`：

| 固定输入 | 路径与行号 | 可复用事实 |
| --- | --- | --- |
| center2d3 | apps/server/src/tasks.ts:22–35 | operation+key事务锁、digest与已保存response；同digest ACK在CAS/busy前replay，重试不能自动改revision/正文/key |
| center2d3 | apps/server/src/conversations/commands.ts:10–19,21–41 | create独立事务；turn/task/wake/revision/receipt同事务。CAS25、busy30/33、resume32、原子写入36–39 |
| center2d3 | apps/server/src/database.ts:14–23 | COMMIT/ROLLBACK；COMMIT通信异常不能由客户端推定事务未完成 |
| center2d3 | apps/server/src/conversations/index.ts:19–26；apps/server/src/index.ts:49–65 | schema400/create201/turn202；known error/generic500/权限门 |
| center2d3 | apps/server/src/conversations/conversations.test.ts:158–185 | 已存在并发同key、CAS winner/replay和变正文冲突测试；本研究只读未重跑 |
| clienta3b9 | packages/client/src/index.ts:40–58,136–149 | create/turn key与signal；fetch/默认15秒timeout；2xx JSON直接类型cast而非运行时schema校验；错误code缺失回退http_error |
| outbox0d4e | apps/web/src/conversations/outbox.ts:38–55,57–73,76–89 | 冻结正文、create/turn双key；retry/bind/fail；matching ACK、unknown不可dismiss、dispose后忽略迟到回调。它是内存态，不宣称跨reload持久 |

中心固定2d3源码当时包含路由注册函数，主server入口尚未挂载，测试显式注册；其语义研究不能证明该commit单独已部署可用。后续主线融合/部署证据另记。GET历史/快照刷新失败不等于admission失败；当前没有按idempotency key查询command的公共接口，历史相同正文或revision增大均不能单独证明本receipt获受理。

### 调用方状态边界与验收

1. create落库而201 ACK丢失：用原create key恢复同conversation。create201已知后turn202丢失：保留conversationId，只重试原turn正文/expectedRevision/key，不能新建会话；新输入draft保持不变。
2. 同revision不同key竞争只能一个获受理；CAS loser展示拒绝并刷新，不能自动换revision/key重答。同key不同正文为idempotency_conflict，不等于中心什么都没做。
3. 单次新请求已识别的中心schema/权限/业务拒绝可说明这次尝试未受理；network/timeout/abort/500/502/504/非JSON或无法验证形状的2xx都不能证明未受理。client只有cast，Web调用方须核ACK结构/identity才accept；未知http_error不能按全部4xx一刀切。
4. **先前已有ACK unknown时，retry的401/403或transient busy只拒绝这次重试，不能擦掉前次不确定性。** 前一延迟请求可能尚未抵达/完成；不能据此解锁新begin、丢receipt或暗换key。固定outbox的retry把unknown→sending，fail(definitelyRejected)由caller分类且没有everUnknown；这是需实现/验证的调用方约束，未读moving caller，不先判其有bug。
5. 明确拒绝后，仅用户显式新动作才创建新key；关闭/换中心仍隔离旧ACK。真正未知记录不能冒充MessageNotSentError回填覆盖新draft。

管理者已将关键验收即时交CHAT唯一owner，必要修正由该owner在自身已领范围执行。root持续审typed消息与设置，不重复派第二同类研究。方法复用本地find-skills、assistant-ui、codebase-design、clean-code，无安装、无额外模型调用；独立行为验证等待固定Web实现。
