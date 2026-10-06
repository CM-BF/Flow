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
