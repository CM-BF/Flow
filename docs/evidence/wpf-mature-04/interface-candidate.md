# WPF-MATURE-04 最小公共 Interface 候选

状态：首片schema/纯投影已实现于879c989a594a8f4f266b9a78a885e311c52eca0d，并获Mika独立APPROVED；生产SDK采集、持久化、公开挂载及Web仍属proposal/未实现。对应[唯一计划](../../../plans/wpf-mature-04-context-transparency/plan.md)。当前已有4文件首片和后继2文件纯Adapter；生产采集/事件/持久化共享路径未领取。

## 统一语义

ContextSnapshot v1 是中心生成的有限 metadata 投影。runner/估算器提供证据，中心验证关联与口径，浏览器不凭聊天全文重新计量。现有 usage 账本不变。

| 字段组 | 候选字段 / 语义 |
| --- | --- |
| subject | attempt的taskId/attemptId/ownerVersion/nativeSessionId；draft的draftId/settingsRevision；queued的queueItemId/冻结settingsRevision；用discriminated union，不伪造尚不存在的task |
| model | requested identifier/profile reference；resolved identifier 或 null；两者各自来源，别名不是已解析模型 |
| input | executionInputDigest（有K02时）、materialRevisionDigest、historyEpoch/observationId；每个缺失值显式 unknown，不声称覆盖全部SDK输入 |
| measurements | modelCapacity、compactionWindow、used，以及两窗口分别计算的remaining：每项value（非负安全整数或null）、kind=provider/estimate/unknown、source及版本、measurementMethod（provider-report/sdk-summary-estimate/host-estimate/derived）、evidenceRef、observedAt、coverage与适用输入 |
| freshness | current/stale/unknown 及有界 reasonCode；切模型/profile/材料或压缩epoch后旧值不作为current |
| materials | 最多32项 metadata，每项稳定ref/digest、known byteLength、selected/authorized/included/observed-read、独立token measurement；truncated明确，完整列表走分页 |
| compression | latest引用与观测状态 observed/not-observed/unsupported；历史独立分页，列表不含摘要正文/原文 |
| overflow | 按model-hard-limit/compaction-window分别提供exceeded/within/unknown，附provider/estimate来源；只有可比窗口与完整当前used可推导，partial覆盖不能宣称within |

kind=provider指固定官方能力来源或provider明确报告的对应测量，不因服务器持久化而升级可信度；SDK来源和数值准确度独立，SDKContextUsage.total_tokens明确是estimate，即便源自官方SDK。estimate必须保留方法/版本/覆盖与输入；unknown的value必须null且有原因。能力目录来源也不能证明实际执行使用了该模型。第一片不内置模型容量表，不选择未经校验tokenizer，不采用bytes/4之类语言无关常数冒充准确值。

remaining候选按选定窗口分别表示同模型、同token口径、同epoch下`max(0, window-used)`；不是可安全追加输入预算。窗口/used缺失、不兼容、过期或仅部分覆盖时为unknown。两项均provider且语义可比才保留provider-derived证据，否则estimate；推导结果明确引用两个来源而不伪称provider直接报告。保留原始unclamped used和对应超限差值/状态，不用clamp隐藏超限。预留输出、系统/工具开销未知时绝不宣称“还可发送N token”；若未来提供可发送预算，须独立字段与口径。

固定Claude SDK的raw_max_tokens是resolved autocompact window，可能小于model hard limit；单独得到它只能填compactionWindow，modelCapacity若无其他明确证据保持unknown。categories保留kind=used/free/buffer/deferred，deferred在窗口数学之外；不解析英文name、不把free/buffer重复当used，也不将分类sum与provider总数无条件叠加。超限kind hard_limit/compaction_window不等于下一次API请求一定成功或失败，按原口径展示。测量摘要默认使用明确summary采样策略，禁止省略detail而触发默认full；采样调度/频率与query生命周期将在runner片段单独验证，不由浏览器每次轮询触发计数API。

Codex冻结ThreadTokenUsage的modelContextWindow是候选容量输入，total/last语义未核对，不映射为当前窗口used；threadId/turnId需映射到Flow实际subject。不能只看字段名猜覆盖范围或将累计输入+缓存+输出相加为驻留上下文。

材料byteLength是选中精确片段的字节数，可直接复用K02；它不是token。compiled输入已含材料时不能再次求和。authorized本机文件只有授权事实，Read成功只有读取事实，两者均不证明压缩后仍驻留。已有精确citation保留project/source/version/contentDigest/locator，不复制全文或本机路径。

## 压缩事实记录

CompressionObservation候选包含稳定id、task/attempt/ownerVersion/session、输入epoch、来源及版本、observedAt、trigger（明确报告时）、before/after计量、summaryRef、coveredSourceRefs、outcome与unknownReason。若summary正文或覆盖范围未被provider公开，保留未知/不可用，不从私有推理或结果token下降反推。摘要结果是可公开持久artifact/detail引用；原文只沿已有authorized ref读取，引用不存在/来源受限明确失败。记录不会执行压缩，也不会添加第二个compression owner。

生产持久化阶段候选：runner沿既有有序durable outbox提交新的窄context-observation事件（需共享runner schema/events owner协调）；同attempt+observationId同内容重报幂等，异内容409，ownerVersion/session/input不符拒绝。压缩事件和窗口快照在同一事务提交其相应revision，不跨远端调用持DB锁。owner只读候选GET `/api/tasks/:id/context` 与分页 `/api/tasks/:id/context/compressions`；server鉴权、client方法和迁移号尚未领取/确定。Endpoint名称不是本片发布承诺。

draft预估需要针对已有草稿提交权限、已加载profile和citation selection的精确版本；最小metadata preview命令不包含已存知识全文，新增用户文本仍沿正常输入路径，不为测量引入第二次全文传输。首片纯投影可接受host提供的已计算尺寸/估算，真正前端请求接线待协调，不绕过locked conversation模型门禁。

## 已实施第一片与精确 scope

在保留现有plan/evidence claim的前提下，mika已批准以下4个新文件，fresh ledger核对无冲突并原子amend v2成功后实施：

- `packages/contracts/src/context-transparency.ts`：版本化schema/types，明确测量来源、coverage、输入身份、unknown及引用上限。
- `packages/contracts/src/context-transparency.test.ts`：公开schema语义边界，避免让错误provider/unknown值组合进入消费者。
- `apps/server/src/context-transparency/projection.ts`：纯函数把已验证profile/K02 metadata和可选同输入观测投影为ContextSnapshot；无pool、网络、文本读取、tokenizer或provider调用。
- `apps/server/src/context-transparency/projection.test.ts`：通过该纯投影Interface验证用户可见语义，不测试私有函数。

该片由本owner独立完成，输入只使用固定existing contracts；未修改index exports、client、server/index、runner.ts/events/claude/R05、数据库迁移或Web。当前模块消费者使用显式相对路径，正式共享导出/生产接线另协调，不以未挂载模块宣称页面已支持。后继若移交共享schema则沿claim协调，不复制第二套合同。

第一片行为验收：

1. 仅profile和citation时，精确bytes可见，实际模型/完整窗口used与remaining为unknown。
2. 传入已有session usage不会产生current-window数值；合同不提供把UsageTotals自动转换的入口。
3. 同模型/输入/epoch的完整可比provider观测按模型硬容量/压缩策略窗口分别推导余量；SDK估算输入明确estimate；容量小于used呈超限而非负数/安全；used不夹紧。
4. 部分覆盖、未知容量、不同tokenizer、错session/profile或stale观测不能导出完整剩余/安全状态。
5. profile/model/material revision变化使旧窗口数据失效；materials复用exact refs、不含正文/path，不重复加compiled内容。
6. 压缩观测缺失只是not-observed；无summaryRef时明确不可追溯，不伪造压缩成功；deferred类别不占数学，buffer和策略窗口不冒充model硬容量。

第一片只证明投影语义，无持久化/实际SDK采集/Web交付。下一片预计需要 `apps/server/src/context-transparency`、新迁移与共享events/runner/client接线，但不提前占用笼统目录；迁移编号及literal清单按当时main/claims确定。

## 依赖协调

R05-A的descriptor只保留配置port，不能在其未获审target上附加上下文字段。可先使用当前profile/K02 metadata构建pure projection，观测Adapter待R05接收后由owner商定是否需要新port；没有port时unsupported/unknown。WPF-MATURE-02的能力合同候选位于`/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/docs/evidence/wpf-mature-02/interface.md`（由mika提供，未读取未完成稿）；本任务消费其固定来源和实际模型身份，不另造能力目录。Web由d01消费中心规范snapshot；本owner提供固定schema和验收样例，不直接修改App/CHATUI或另造计划。

## 当前实现片的固定选择

mika批准4文件并完成amend v2后实现了本候选的schema/纯投影片。实际Interface为`projectContextSnapshot({identity,asOf,materials,observation})`，合同源`packages/contracts/src/context-transparency.ts`，不导出到公共index、没有endpoint/DB或SDK采样。此片只消费现有harnessSchema，未来Codex身份必须由共享owner扩展固定合同后接入，不接受任意harness字符串自授权。

identity包含harness/requested/resolvedModel/profile reference/input digest/material digest/historyEpoch及上述subject。next-turn model/effort/fast变更推进draft.settingsRevision（即使model名不变）；queued用受理时冻结revision，attempt用自己的profile/input版本。函数无外部可变状态，返回解析后的独立metadata对象，不改任何旧queued/attempt。相同nativeSession也不能跨harness复用观测。02设置实现是依赖，本片只声明消费者失效语义。

输入须由中心可信caller固定实际identity与材料revision；投影不计算源码全文digest、不证明调用方提供的digest正确、不提供身份鉴权。相同identity才比较观测；resolved model/input digest/material digest/historyEpoch（attempt还需session）缺失时为unknown。观测时间未来或超过30秒为stale；这个30秒是本模块的保守展示界限，不是provider freshness保证或轮询承诺。

只支持K02已冻结的最多4引用、总8192 UTF-8 bytes，不把未来32项native材料候选提前实现。草稿role=selected，queued/attempt role=included仅表示冻结输入包含这些片段，不宣称模型已读或当前驻留；token分项保持unknown。categories最多32条，按kind保存，不参与总量再求和。响应序列化硬上限65536 bytes，无IO/连接/计时器/资源所有权。

已知测量保留source+version、measurementMethod、tokenBasis、full/partial coverage与持久evidenceRef。derived结果显式两operand的value/kind/引用，不能提升estimate；SDK context来源不能填modelCapacity，仅作为compactionWindow/used候选。此处provider-capability/provider-window仅是规范来源类别，不是已接入某个provider或通过schema就获得报告权限。

压缩本片仅保留observed/not-observed/unsupported及可选summaryRef/covered refs；缺摘要正文不能假造引用。真正有序持久记录、trigger、前后epoch/计量和授权可访问性仍属TODO -03/-04，不由此pure DTO验收。

## 第二片：固定SDK summary纯Adapter

仅新增`apps/runner/src/context-observations/claude-summary.ts`及`.test.ts`，使用claim v3，不修改第一片合同。当前P2修复target `PENDING_P2_TARGET`（旧e81f200 CHANGES_REQUESTED）；[Interface/来源/边界与行为证据](claude-summary.md)。输入是host已经取得的0.3.290 SDKControlGetContextUsageResponse camelCase响应，明确summary literal，输出既有ContextObservation。仅session-bound attempt可用；Query已消费窗口不覆盖pending输入，draft/queued拒绝并留后继独立host-estimator。host必须可靠绑定已消费input/history cut，纯Adapter不自行证明或采集。model identity来自host冻结配置；未知resolved保留unknown，精确不符拒绝。只映射estimated totalTokens与策略rawMaxTokens，hard capacity和压缩发生未知。按kind汇总的匿名分类不是工具/技能或材料身份，稳定ID且有界，不复制名称、路径或正文。零SDK调用、零生产挂载，采样生命周期仍待后继。

## 后继中心接线待协调（未实施）

mika转来的只读研究绑定main77c420cf9ee5de0291ea93014b6ea11aead6fab5：复用reportEvents/ownedAttempt既有runner→task→attempt锁、fence、连续sequence与event digest，在原事务内接一个窄context-observation事件；不另造上报端点或sequence。中心核task/attempt/ownerVersion/harness/nativeSession/profile；K02部分任务才有executionInputDigest。resolvedModel/historyEpoch需来源allowlist及adapter版本的受信host证据，不能让reporter同时传expected/current自证。

current判定需中心最小cut：既有event sequence与已覆盖steering revision，steering accepted立即使旧值失效；后续序号/attempt/input改变保守失效。材料revision须从按序精确citation refs版本化派生，不能把含正文的contextDigest改名顶替。事务owner存attempt+observationId；canonical内容相同重报不刷新时间，异内容409；receivedAt取DB时间、按sequence选最新、refs核归属。缺可信绑定可存历史sample，但公开current=unknown。上述依赖尚未实装，本pure projection不能替代中心鉴权/防自证。

共享runner.ts由R05B、共享index/client由Lead协调，migration编号与精确scope待当前ledger核定；本片不领取或修改它们。后继仍使用本plan/status为唯一进度源，不复制第二状态权威。
