# U11 执行配置前端消费：只读候选

w01_owner实际固定只读研究，输入main `dd1b9dafc77fb56a580d3d41dc7ddec3b1996ef8`。本记录由管理者归档，不是新canonical实现plan，不代表已领取/已改disabled控件。研究0项目写入/模型/工程套件；本地find-skills选用既有codebase-design、clean-code及assistant-ui方法，无安装。下面路径行号全部属于固定dd1。

## 公开能力与限制

`packages/contracts/src/execution-profiles.ts:6–18,27–37`：reference为id/runnerId/configDigest；claude与adapterVersion claude-sdk-0.3.290-v2。configuration含model标识、thinking disabled、permissionMode dontAsk、access none/configured-readonly、requireReadApproval、opaque materialScopeDigest与限制maxTurns1–4/maxBudgetUsd≤1/timeoutMs≤90000。controls为select-configured-profile/fixed-disabled/effort unsupported/configured-policy/queue false/steer false，不能组合任意model×effort×access。

`apps/server/src/execution-profiles/store.ts:9–34`：名称来自runner配置，source runner-configured、availability not-probed、resolvedModel null/providerCapabilities unknown。目录只过滤revoked，不验证在线/heartbeat/provider授权，不标“可用/已连接/已解析”。每runner一个不可变profile，改配置409 profile_immutable，需新runner；没有profile revision，不借conversation.revision充当配置版本。`apps/runner/src/execution-profiles.ts:10–17`的materialScopeDigest仅路径集合摘要，不是内容版本/可浏览文件列表。

`packages/client/src/index.ts:81–87`有executionProfiles({after,limit},signal)；Web只GET，不能用owner身份调用runner publish。`execution-profiles/index.ts:18–26`默认page20/max100、nextCursor profile UUID；同model不同runner/access/limits不能按model名去重。

## 创建时pin与后续turn

`contracts/conversations.ts:13–24`与`server/conversations/commands.ts:11–24`：executionProfile仅create可选，CREATE即pin，revision0也已固定。无更新配置endpoint。未发送draft可选；之后换模型/策略须显式新conversation，不迁旧session。

commands:13–17仅接受requested.model runner-default或所选model，thinking只disabled（宽schema存在其他值不证明中心支持）；tools none仅profile.access none可用。兼容校验可能放行profile none配configured-readonly，UI应主动发送与profile相同的model/access，不能由宽兼容组合推能力。旧无pin流程仍runner-default/disabled/configured-readonly，不自动补pin。

commands:26–44、profiles/store:38–52、runners:45–55：每turn继承并核pin未revoke、runnerId/digest，claim限定runner；resume同runner。前轮须succeeded/failed/cancelled且known native session、未占用；active/uncertain busy。turn只有expectedRevision/text/mode，无per-turn profile/model/thinking/access。当前其他能力仍false。revoke从目录移除，并拒绝新create/旧conversation新turn；已受理queued task不自动转runner。离线可能一直queued，目录不是liveness证据，不静默fallback。

## 四层证据

conversation.requested是用户请求；selected profile是runner配置声明；turn.effective.runnerRequested是adapter请求证据；effective model/tools/permissionMode/thinking/source才是报告值。`contracts/assistant.ts:5–8`、`conversations.ts:58–66`及`server/conversations/replies.ts:87–92`保留effective thinking unknown，model/tools/permissionMode可null；tools=[]是真0，与unknown不同。目录alias/default不可填effective。现ConversationThread:31–33是分层展示接缝，header71尚硬编码runner default，仅未来适配候选。

## 候选最小旅程

新draft“执行配置”读取当前连接分页目录，显示model标识、access、读审批；下钻看runner/profile ID、adapterVersion、digest、limits，明确未探测。thinking固定关闭/effort不支持与queue/steer解释保留。加载/空/权限/未部署/断线明确且可重试；不硬编码provider列表。

首Send冻结reference与requested(model/configuration.model,thinking disabled,tools/configuration.access)，进入既有outbox不可变creation、同createKey/turnKey。CREATE后锁配置；unknown期间不能用后来selection漂移重试payload，新正文草稿独立。旧conversation目录消失仍保留pin身份，提示不可用于新turn而不fallback；旧无pin兼容若保留须写清未绑定。409 profile unavailable/unsupported与revision/busy区别处理，不换配置/key重发。设置报告随turn/task更新，不只看conversation.revision。

## 未来范围与验收

拟现有ConversationThread.tsx/projection.ts/outbox.ts，新增conversations/execution-profiles.ts与ExecutionProfilePicker.tsx；如需App当前连接store由唯一App owner另领。专用conversation-profiles.test.ts/.browser.ts；无shared/client/官方Thread/依赖变更。该范围未take，不挤占X03实际挂载。

当前projection.send201–208硬编码creation；assertSummary36–40未验证executionProfile，ACK223–225仅比title/harness/requested。未来接入须验证完整pin，wrong runner/digest ACK不可accept。outbox46–52目前只freeze requested，未来reference也需deep-freeze；这是新增能力要求，不宣称当前未接UI有暴露漏洞。

必要局部验收：多页同名不丢、empty/error/abort/换中心旧response隔离；A→B只发送B、原selection mutation不改receipt；create/turn ACK丢失原key重试pin不漂移、新draft不丢；wrong-reference ACK不确认；revision0锁/无pin不迁移；revoke409不fallback/不改旧task；false能力0非法请求；requested/effective/null/[]/unknown/alias准确；双主题390键盘与选择不自动send。均HTTP fixture明确0模型。未验证部署目录数量、真实provider可用性、effort/权限成功，不由源码推算；旧owner文档待main字样不覆盖dd1入口实际已挂事实。


## 04:42 实际App消费准备（readonly，未领取）

workspace_panels_owner固定ae47模块Interface与已审CHAT/X03源核对后给候选WPF-PROFILEI01：App.tsx（当前X03I01 a104v1）；conversations/ConversationThread.tsx、projection.ts、outbox.ts、test/conversation-outbox.test.ts与conversation-projection.test.ts（当前CHAT082v2）；新test/execution-profile-integration.fixture.ts与execution-profile-integration.browser.ts；plans/wpf-profile-integration、docs/evidence/wpf-profile-integration。共10 literal scopes，无officialThread/TaskThread/CSS/plugin-integration/execution-profiles模块/shared改动。04:41管理live核claim身份版本一致，未amend/take、未建新树。

App bound executionProfiles reader每连接一个catalog，picker首次需要时refresh，dispose旧连接；窄snapshot/actions只给Thread不进PluginContext。按稳定View.key缓存draft选择，tab/split/受理路由替换保留，换中心清寿命；已建会话只读自身creation不从目录补pin。composerHeader实际消费模块，仍整profile而非任意model×thinking×access。

首Send同步选择资格→freezeConversationCreation→outbox.begin，原双key机制保留。现outbox.parse会克隆，故接线必须深冻克隆后的executionProfile，不能只靠模块入参已冻结；未知CREATE立即锁receipt-pending，CREATE成功即使首turn拒绝也锁created。仅明确CREATE被拒且无ID才解锁，后续草稿独立不被receipt覆盖。

创建ACK在bind/首turn前由冻结outbox.creation核title/harness/requested及pin完整三元组和有无；wrong/missing/unexpected pin按unknown处理，不换key/选择，不发首turn。GET/turn ACK同样不能随较高revision改变已绑定creation。旧无pin保持legacy-default，不从后来的catalog迁移。

catalog stale/401阻止新configured创建/选择，不阻断已发outbox原key/pin恢复；目录首次refresh/新部分页里缺少选择并不证明已删除，仍由中心准入核pin。候选验收含同model不同runner、refresh不改选择、receipt重试与stale分离、create丢ACK/turn丢ACK两阶段、wrongpin零turn、新draft和首ACK焦点、旧无pin、同ID跨center迟到清理、390双主题键盘。仅未来HTTPfixture，无模型/DB。模块APPROVED+精确含X03和模块的main+正式scope移交后才能实施；queue迁移会交叉Thread/projection，须明确串行顺序。


## 04:49 新正式合同02683：目录可见性与普通聊天选择分离

MainLead提供正式合同 `02683be019ae75591b21c1ada64e01669678f068`，管理实际git show核 execution-profiles.ts：access新增goal-tools，且此模式要求requireReadApproval=false与空材料摘要 `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`。普通chat不能选此模式。旧a28/base4e独立APPROVED仍是历史有效结论，不能据此声称新schema通过；本轮在现17093v1九scope继续适配，未另开agent/未改shared。

新设计：目录读取成为DirectoryProfile（只读access字符串声明，其余DTO/identity/model/controls/limits/cursor严格核验）与可提交ProfileSelection分离。goal-tools/未知access条目保留并明确“不可用于普通聊天”、disabled，不让同页合法none/configured-readonly失败；不能把未知模式渲染成readonly。已知goal-tools跨字段约束仍核验，非mode格式错误继续整页原子拒绝，不能为可读性放宽身份/其他字段。configuredSelection与freezeConversationCreation自行显式allowlist仅none/configured-readonly，不依赖将来可能变宽的公共schema当权限门。

验证新增：混合合法+goal-tools+unknown仍可分页/显示；disabled不可键盘或函数强选；直接helper拒绝目标模式且零发送；known goal-tools错误材料/审批、非mode畸形仍拒绝；已选合法项不被目录刷新替换。消费端不能继续假设每个目录项都是可提交ExecutionProfile，新的interface固定后再接线。PROFILE App接线仍待模块新target独审与准确main/新claim，不抢QUEUE00路径。

root04:49:30.853Z一次看板曾见a28 final98671的status写APPROVED，但解析review.state=unknown/target=null；已交唯一owner沿可解析Review target commit/状态模板在后继最终metadata修正。不能仅issues=[]宣布review聚合正确；最后须实际state+target+proof，旧批准历史保留且不扩到新合同。
