# 固定设计：安装式产物 verifier

基线 main `6fd214eb62f269167f6af4a8390850561dc0d01c`；设计工作段 2026-10-07T14:29:36.000Z–14:44:36.000Z。此文件描述候选实现，不是现存 API 或已运行结果。

## 1. 完整且有限的用户旅程

1. 沿现公开 register/fetch/install 安装 operator 明确信任的 verifier 包 A。manifest kind=verifier，与已有注册 capability `verifier` 一致；安装仍只产生静态 receipt。中心 operator 另以**精确包 SHA256+treeDigest+host API+algorithmId/version**建立有限可信映射。仅注册 capability、包自报算法、receipt 或任意环境字符串均不能自授权。
2. owner 对当前 revision 显式授 verifier grant、配置并 enable 到已授权可读名称的 runner/store。新 runner 明确声明 verifier 能力且从实际受信 store/算法实现派生；旧 v3 资格没有 verifier，不扩大其默认含义。候选可读名称沿现 host-candidates 扩展有限 kind/reason，不把 online/loaded/callable 由 unknown 变为 true。
3. owner 选择源 task/attempt/artifactId/version，提交 stable key、verifier registration/expectedRevision 和有限规则。中心从已存 artifact 取正文，建立新的独立 verification task、单个冻结 execution binding 与不可变 verification source ref。用户不能提交替代正文或指定宿主路径。
4. 该任务通过已有 claim/runtime/phase/outbox 链执行真实 verifier 模块；包返回有限结果。中心 reportEvents 在原事务里重读精确原文并独立重算，检查同 attempt/runner/owner 的 load+invoke 关联及完整冻结身份。伪造 passed 不能通过。
5. 用户读取此验证任务的 typed result 与源引用。源任务/产物/过去通过均不改。更换规则为 v2 或包 B 必须新任务/新绑定/新 inputDigest；可并列看到同一原文 v1 通过、v2 失败。

## 2. 小接口与唯一状态所有者

| Module | 输入 → 输出；状态所有者 | 复用/依赖与生命周期 |
| --- | --- | --- |
| 有限 JSON rule | 原始 UTF8 正文+strict rule → passed/reason/missingKeys | 纯函数，无 I/O/插件 import/缓存；center 是结果判定权威 |
| verification admission | owner 凭据+stable key+source tuple+verifier revision/rule → 新 task/binding/ref receipt | 复用 commandInTransaction/acceptTask/CAS，DB 是不可变 pin/来源权威 |
| 安装/可信算法映射 | 真实 installed receipt+operator exact digest map → 可用 kind/算法集合 | package-store 只认证材料；映射由可信私有启动配置拥有，不接收任务自报信任 |
| claim + journal | 完整显式协议/资格/request key → 相同 tuple 的 assigned/empty/missing | 原 runner 行锁、capacity/session fence、durable journal，不新增 loop |
| runner execution | 冻结 binding/ref/input+AttemptControl+authorize → 固定 result artifact/typed verification | 复用 executePluginTool 的共享宿主职责，工具/验证器各自结果 codec；不能在多层散布新字符串特例 |
| reportEvents | 同 owner 的完整 terminal bundle → 原 ACK | 现同 TX 验证、detail/timeline、event digest 与 sequence；center 重算后才保存 |
| 公开读取 | 新验证任务 detail → 来源/规则版本/精确材料/理由 | 沿 task detail，不给 runner 任意读取原任务详情权限；Web/TUI 展示由现 owner 后继接入 |

算法输入：`{schemaVersion:1,algorithmId:'flow.json-object.required-keys',algorithmVersion:1,requiredKeys:string[]}`。0..32 个唯一字段，每个 1..64 UTF8 bytes 且 ≤64 code units，无 NUL/孤立 surrogate；规范化按 codepoint 排序，不依 locale。用 `Object.hasOwn`，不按原型链判断；`__proto__` 若是 JSON 自有字段只是数据，不执行 setter。JSON.parse 标准语义（重复 key 后者生效，原文字节 digest 仍不同）；成功后必须非 null、非数组的 object。额外字段、null 字段值可接受；不验证嵌套类型。有限 reason=`passed|invalid-json|not-object|missing-required-keys`，missingKeys 只来自已冻结规则，最多32项；结果不回显原文/配置。

**规则换版例**：R1 requiredKeys=[id]；R2=[email,id]。两者 algorithmVersion 都为1，但 canonical rule digest不同。{\"id\":1} 对R1通过、R2失败。algorithmVersion2首片不支持，显式拒绝而不是套旧算法。将来新增算法必须同时有中心纯实现、精确材料信任映射、runner明确能力和直接反例，不靠动态 registry 发现或导入 npm 使中心信任包输出。

## 3. Admission、冻结身份与数据库

拟 owner `POST /api/plugins/:id/verification-tasks`，请求含 expectedRevision、sourceTaskId/sourceAttemptId/artifactId/version、rule、reason；stable key 沿现命令头/receipt，不发明第二幂等存储。source tuple 精确指向该 attempt 已保存 artifact，version 必须等正文 UTF8 SHA256。源 project 不在 TaskRecord 上猜取：从 `flow.project_task_bindings(task_id→project_id)` 及适用的 `flow.conversation_turns(task_id→conversation_id)→flow.conversations.project_id` 核对当前权威关系，再由 `flow.projects.workspace_id` 解析 workspace。首片只接受至少一条明确的非空项目关系；两条都存在须一致，conversation 存在但其 project 未绑定也不按普通 task 兜底。关系缺失、冲突、dangling 或无法证明同 workspace 一律拒绝（409 source_scope_unresolved / 403 source_scope_mismatch），不猜 personal/default，也不信 caller 传 project。project scoped verifier 必须同 project，workspace scoped 必须在同一已有 owner 授权 workspace。把本次解析的 project/workspace 和关联依据随 immutable source ref 冻结；后续换绑不能把旧结果套到新项目。它是原文来源授权前置，不是另建项目/会话状态权威。

中心先在原 TX 核当前权限/runner/current trusted policy/精确安装关联及 CAS；随后读取精确来源并构建输入，再 acceptTask 与 binding/ref 原子写入。沿现 runner→registration 锁序；新增来源/ref只读在这些锁后，事件接收不得反向取得 runner/registration 锁。固定 SQL/锁顺序必须在后继 review 与真实 PG 证明，不从本设计宣称无死锁。source行消失/内容digest漂移/不完整来源均拒绝，不能拿 latest 顶替。

**存储候选**：复用034的 task单binding/attempt phase关联，不改034历史。新增一张不可变 verification-ref 扩展表，以 bindingId唯一，包含 exact source tuple/contentDigest、canonical rule/digest、algorithmId/version、verifier材料身份关联；在同TX与binding创建。**kind 必须是独立于 verification-ref 存在性的正向持久身份**：安装时保存的 immutable manifest.kind 经材料校验后，写入 binding 的 immutable execution-kind tag，且与真实 receipt/material identity 一致。新 verifier binding 必须在同 TX 有 verifier tag+完整 ref；任何缺 tag、缺 ref、kind/receipt 不一致都 fail closed，禁止按 ref 缺席推 tool。历史 tool 兼容只能基于既有 immutable installed manifest 明确 kind=tool 的逐项证据，由新增迁移/受控读适配形成可信 tool 身份；未知历史材料不默认 tool。后继迁移须明确持久 tag、ref 必需性约束及旧 writer 并存策略；不能给所有新插入默认 tool 来掩盖漏写。v1/v2/v3 的排除条件读正向 kind 身份及完整性，而不只 LEFT JOIN ref IS NULL。新增 migration 必须给来源 artifact 现有 unique/FK/不可变约束做实核后分配编号，尚未领取或预定编号；这是实施前置，不是已经成立的 schema。

公共 verifier binding 使用新 `flow.plugin-verification.v1` 显式 projection，复用既有完整材料/配置/target/attempt规则，新增kind=verifier及source/rule/algorithm引用。**不向旧 strict flow.plugin-runtime.v1 对象偷偷添字段，也不改历史receipt正文。** 已有 runtime enable 将安装kind转到对应 grant/算法校验；tool-task入口必须明确拒绝verifier材料，verification-task入口明确拒绝tool材料。共享合法校验在一个领域函数，不复制installedMaterial/授权FSM。

`inputDigest = SHA256(canonical({domain:'flow.plugin-verification.input.v1',source完整tuple,sourceContentDigest,rule完整规范化快照,algorithmId,algorithmVersion,verifier的registration/revision/version/material/artifactSHA/treeDigest/config,targetRunner/store/API}))`。另外保留现 binding.inputDigest=SHA256(实际task输入)的身份语义：task输入是上述冻结 envelope+原文的确定序列化；领域验证digest置于 envelope/ref，不能把现字段悄改为不同算法。包/配置/规则/source任一变化都会改变实际输入及两个digest。禁止按“latest”索引替换旧ref。

## 4. 资格与恢复：明确新协议，不扩大 v3

拟 `flow.runner-claim.v4`：保留 runnerId/requestId，并显式有限 `pluginVerifierExecution{bindingProtocol:'flow.plugin-verification.v1',storeId,hostApiMajor:1,algorithms:[{id,version}]}`；若该runner仍支持tool，另外明确旧tool能力，不能由verifier推断。完整request在首次await前 strict parse/detach，protocol/key/全cap进入现journal和receipt持久身份。v1/v2/v3在SQL ORDER/LIMIT之前依据正向持久 kind 排除 verifier 和身份/ref不完整的binding；不能由ref缺席默许tool。v4也先筛kind/algorithm/store/target/current verifier grant与完整ref，再锁后复核。普通任务和旧session owner fence原样。

只有真正clean的旧v1 journal可按显式启动能力选择v4；已有v2/v3 request/assignment/unknown不自动升级，也不能换工作目录或key掩盖未决状态。相同runner/key跨协议或改资格冲突；empty保原key，status missing才原request claim；任意ACK未知不降级、不换key。assignment+nextkey先 durable 后执行。v4新增是实质兼容面，codec/journal/server/client/runtime必须在同纵向片完成，不能把独立schema通过称生产领取已接入。

phase仍为load/invoke且每binding/invocation只一对，沿当前attempt/owner/runner/grant/lease重核。现tool授权route语义保持；新显式verifier授权入口薄委托共享phase领域校验，由冻结kind选择grant，不能以请求kind自授权。不复制锁/receipt逻辑。旧attempt或换owner不得重授旧phase；replayed授权ACK不许可再次执行。

包可能已有副作用：取消/timeout/abort不证明宿主已退出。phase ACK丢失或结果尚未durable时保原assignment+UNKNOWN，不能自动新invocation。已有 terminal batch 先 file.sync→rename→dir.sync 后HTTP，validated completed ACK→journal.complete→outbox删除；重启仅重放原字节。disable仅挡新binding，旧pin原样；撤 verifier grant或runner revoke在下一load/invoke挡新动作，不把历史授权当现存权限。reportEvents的精确旧event replay保持幂等，不因后续撤权重新执行；新迟到事件仍受attempt/owner fence。

## 5. 独立重算、完成与错误

verifier输出是strict有限结果JSON，不接受任意passed/任意verifierId。runtime拥有completed产生权，插件无权生成event ID/sequence/owner。产生了可报告 verdict 时，用现terminal bundle一次持久 result artifact+新typed verification+completed；未产生 verdict 的已知失败/确认取消按下表沿现 completed-only 路径，不能伪造结果包。新verification事件带 frozen reference身份、领域inputDigest、算法/规则digest、verdict；center依ref取原文重算并比较完整有限结果。若报错/假passed/错身份，原reportEvents事务回滚artifact/detail/timeline/runner_event/ACK前缀；不留下部分通过。普通flow.text/engineering走原路径。

新结果artifact只属于verification任务，正文可为canonical有限verdict，不冒充source原文；新增verification分支验证其自身artifact与冻结foreign source两者，不放宽现`verifyArtifact`对legacy当前task/attempt的限制。中心先从正向 kind 与冻结 ref 确认这是 verifier 任务，再按 outcome 与已知执行结算状态应用下列矩阵；不是对所有 completed 一律要求 verdict。任何已提交 verdict 都必须经过同一来源/phase/独立重算校验，不能以 failed/cancelled 绕过对已报结果的校验。

| 执行结算与请求 outcome | 中心接收条件 / verification 状态 | runner / 恢复责任 |
| --- | --- | --- |
| succeeded | 必须有本attempt完整且中心重算一致的 passed、结果artifact和两phase关联；省略或换成flow.text均拒绝 | 固定terminal bundle；原ACK→journal.complete→outbox删除 |
| 得到 failed verdict，报告 failed | 必须有中心重算一致的真实failed及完整结果身份；不能用普通执行error捏造missing-required-keys | 同一终态持久包，失败结果可读；源任务与源产物不变 |
| 未得到verdict，但已知失败（例如load前明确授权拒绝）→ failed | 可沿既有completed-only接收，verification保持未验证，不制造failed verifier结果；原owner/lease/event fence仍必需 | 必须是现runtime可确认settled的失败，不把unknown异常归类于此；不需凭空补load/invoke记录 |
| 未得到verdict，确认执行/资源已闭合的取消 → cancelled | 可沿既有completed-only接收，verification保持未验证；源task/产物不改 | 取消请求或signal本身不证明闭合。沿既有可信runtime/host结算事实，未完成资源不能走本行 |
| 执行、资源、授权ACK或报告ACK任一未知 | 不产生新的completed，也不补造verdict；若原终态已持久，仅允许原字节重放恢复ACK | 保留journal/原身份；禁止重invoke、新key或用failed/cancelled强行清理 |

若verdict已产生但完成前取消，已报verdict仍必须重算一致；task取消不把passed结果变成task succeeded。后继必须在现 `events.ts` completed消费者实现这张矩阵，并保留 `runtime.ts:308–323` settled失败/确认取消的合法路径。center验证结果不等于独立验证宿主已退出；资源结算由现可信宿主/PROCESS证据承担，未具备该证据时只能UNKNOWN。

错误：输入/rule格式400；源不存在404（不泄漏未授权身份）；超界413；revision/source/pin/replay冲突409；当前无权限403；传输/ACK解码/已确认phase但结果未知保持UNKNOWN，不用普通failed掩盖。用户只读source/ref不能被当作新执行/删材料授权。

## 6. 性能、字节、资源与取消

- 首片源正文上限8192 UTF8 bytes，规则≤32key；数据库先按精确索引查octet_length与身份，只在≤上限时取正文，超限不先把全量复制到runner。最后构造整个JSON输入再要求≤16384 UTF8 bytes且≤16000 code units，转义膨胀超限413，不截断/分段假通过。
- 纯算法只JSON.parse一次+≤32次hasOwn，不递归遍历输入；无编译缓存/全局结果缓存/批扫历史。输入仍受序列化上限，不声称内存硬隔离或任意JSON的固定CPU上界。
- 结果预计≤8KiB，但以新增strict codec最终实际compact序列化及现50event/batch总限制复核；不从单字段上限推完整response硬界。读取复用现FlowClient64KiB成功/4KiB错误bounded reader、signal取消；无自动分页/新poller。
- PG验收另固定实际case/连接/端口/DB/TMP/raw/worker预算，复用现标记专库/监督/正常DROP方法，不能消费历史窗口余额。本设计0工程child/0业务PG/0provider。
- PROCESS后继受信独立worker可提供实际terminate/EOF/释放证据，但不是sandbox。首个纵向实现需明确选当前已main in-process的UNKNOWN边界或已批准PROCESS输入，不能把尚待T7当已部署事实。

## 7. 已读源码所证实的缺口

固定Git paths/hash见baseline.json。`034-plugin-runtime.sql` task_id UNIQUE与phase PK/FK已存在；`runtime.ts`插件分支代替普通adapter；`package-store.ts`receipt和manifest目前tool-only；`store.ts:installedMaterial`/`commands.ts:requireToolPermission`/`claim.ts`目前只tool grant；`plugin-runner-claim.ts`v3没有kind；`runner.ts`verification仅三个既有verifier；`evidence.ts:verifyArtifact`要求同task/attempt，且flow.text已由中心重算；`engineering/verification.ts`只是工程声明关联不能冒独立重算。新增verification不能只改kind literal或复用普通text通过作证明。
