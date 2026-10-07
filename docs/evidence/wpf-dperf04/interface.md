# WPF-DPERF04：固定 c837 摘要/详情/领取观察 Interface 收敛

只读研究，2026-10-06。唯一候选沿管理 `dperf04-summary-detail-proposal.json`，直接父 D01 / co-lead Web /root；没有新计划或实施 claim。固定源码 c837b5dccaea429b0112d1c7e0c752c41334204a，已 provision WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-summary-detail`，本次 HEAD 等固定值、clean。14 个所读文件 current=fixed，逐文件 SHA256 在 `sources.json`。没有 import 产品、运行测试/服务/浏览器/PG、采样 4320 或项目写入。

## 结论

管理现有九 literal 足够。保留 `/api/snapshot` 的原完整结构与旧 current/proof 语义；另给首页明确的 summary DTO、注册任务单项 detail 和独立 assignment 观察。首屏不等待全量 Git/proof/listDocuments/PG；不新增缓存框架或跨轮 proof cache。不应只把完整任务对象删几个大字段后冒充摘要，也不把作者声明装进现有绿色核验 badge。

最小四个产品落点：read-model 负责同源 status 读取/声明投影；aggregate 继续负责现场 Git/proof；server 负责只读路由和进行中请求合并；app 负责三种响应的独立接受代际与展示。human/task-links/ledger/proof 原规则保持。

## 固定源码事实与必须保持的语义

- `src/aggregate.mjs:27–39`：status 先读登记 worktree；不可读才 `git show` 冻结旧版，否则 missing。`41–56` 把 parse 错误、Git 不可用、现场/声明 branch 冲突及 stale/future 时间都放 issues。`69` 的旧 `current = live && issues.empty` **包括 Git/branch 观察，但不等于实现 proof 已通过**。不能改其含义。
- `aggregate:42,47,57–80`：现首页的前置工作含三文档发现、review 文件、实现/审查比较、所有任务 main 集成核验。`74–88` 还等待 PG，之后才解析关系、overview。DPERF01 同 target 的 proof 复用 `60–62` 保留；DPERF03 每次 context 内 Git 并发4/mainChanges复用保持，不宣称当前完全没有调度。
- `human.mjs:3–10,37–60`：显式阶段优先；legacy completed 只作者完成，不能推审查/main；有效 active 父仅在已知直接关系时占一份 headline/delivery；子 blockers/decisions 独立；unknown 与 history 分类、priority/id 排序、phaseSourceId 不变。不得用已完成 TODO 百分比合成父状态。
- `task-links.mjs:42–93`：唯一登记 ID **及** canonical plan 路径相等才建立导航；自引用/循环/第三层/失效父为 unknown；unknown 可以已有 targetId（`74–84`），只允许“登记资料”下钻，不归组。解析依赖 all-task source 状态，不能对单个 detail 的 singleton 调 resolver 后声称全局关系。
- `status.mjs:11–63,66–83`：checks 的 passed 需要完整 target；`reviewRecord` 是 status 原记录，而批准与 target 的正式解析来自 review.md。summary 不读 review.md 时只能显示“作者审查记录”，不自行从正文猜 target 或复用 reviewState 变已核批准。TODO parse 错误时计数 null；保留原文入口。
- `documents.mjs:8–24,27–48`：实际路径 realpath 约束、2MiB/文件、相对路径白名单和计划/状态/review 引用发现限制继续复用。新 detail 接受 task ID，不接受 worktree/path 自选参数；原 `/api/document` 路由不得绕过 readDocument。
- `server.mjs:17–43,46–60`：pendingSnapshot 只复用进行中请求，完成即清；loopback Host、仅GET、no-store/CSP、CLI --json 与 document/static 行为必须保留。默认 ledger 顶层 import (`aggregate:2` → `ledger:1` 的 pg) 应移动到实际 observer 边界，否则 Node-only summary 测试仍被迫装 pg。
- `ledger.mjs:88–96`：assignment 观察 available/unknown 及原 observedAt；missing env/PG异常不是无占用。`55–85` 才是真实 PG 原子 take/CAS，scope 本片不改。页面从来不成为写权依据。
- `public/app.js:20–25,77–82` 的旧 badge 依赖完整 task.current/review/main，不可直接接 summary。`124–133,212–213` 现timer/manual没有共同 in-flight guard。`192–204` document 只在部分 await 后查 task ID，same-task 换文档/同ID关闭重开/旧error可串入新内容；新接口接线应同片补完整 generation check，不以 AbortController 单独保证时序。

## 一条可实现的 Interface（候选命名，不新增协议权威）

### 1. GET /api/summary — status 源声明，不是完整 Task

响应 `kind:'summary', version:1, readId, registryFingerprint, startedAt, completedAt, staleAfterHours, tasks, overview, milestones`。每项必须含：

- identity：id/title/role 与登记 sourceKey（绑定 id/worktree/branch/planDir/evidenceDir；可 hash，不让客户端传任意路径）。
- source：mode live/frozen/missing、status 字节 digest、modifiedAt、readAt、declaredUpdatedAt、stale/ageHours、sourceIssues；frozen 的准确 frozenCommit 和失败原因。`sourceCurrent` 仅 live、parse有效、非stale且已声明 branch不冲突；现场 Git 是否匹配 **未知**。
- declarations：owner、branch/branchState、declaredHead/dirty、checks(state/target/record)、reviewRecord、mainRecord、human（显式阶段/legacy标记、phase/priority/output/next/blocker/decision/missing/complete）。首次摘要保留这些声明，不因为未取 proof 而把作者下一步也藏掉。详情再取完整 implementation.scopes、长技术段/TODO证据和 docs。
- progress completed/total（原 parse 错误规则）；source错误不能强行填0/0。不存在可靠独立 `reviewTarget` 就不造一个。
- resolved links 基于上述全体声明源，明确 `basis:'status-source'`。read-model **内部**可以给原 resolver/humanOverview 传 `current:sourceCurrent` 的短期 projection；内部对象不从 API 导出为旧 Task。所有 overview/links 明示 basis，不称现场已核关系。task-links/human 文件不用改。
- 初始现场 proof 为 `not_loaded`，Git/main observation 不生成伪值；initial assignment 为 pending/unknown，绝不 `[]` 冒无领取。没有跨轮完成 proof cache。本片可不保存旧 proof；如 UI 内保留，单独列“上次核验”及旧 readId/head/time，不能盖上新 completedAt。

status 读取与异常/stale算法抽到新 read-model 供原 aggregate 复用，避免两份规则漂移；full aggregate 仍额外加原 live Git/branch issues，再按旧式计算 current。读取每任务受现2MiB/文件上限，任务集合受注册表限定；小固定并发读取即可，无大队列框架。live status 正常路径 **0 Git/proof/文档枚举**。missing 情形可以保留明确的 frozen `git show` fallback（不是全 worktree observe）；不能为零Git计数偷偷删兼容fallback。若只冻结Git也不可用则 missing+unknown，不使全页失败。

`overview` 仍包含所有 active/otherActive/delivery/blocker/decision/unknown/history IDs，summary.tasks 不是 top3截断。milestone 的显式 TODO轻字段可来自 phase固定源已有parsed status；保留 `basis:'status-source'`，不借后代汇总。全部长记录/全部TODO仍通过选中详情可达。

### 2. GET /api/task?task=<registered ID> — 只核指定 task + main

aggregate 导出窄 `readTaskDetail(registry,id,now,context)`，复用 `aggregateTask`、`observeGit` 与 `integrationProof`。只观察指定worktree/main（相同目录去重）、读取该task文档和proof；不要内部调用全 `aggregate(registry)` 再筛选，也不要重查其他任务 Git。没有 PG 依赖，assignment 由第3接口覆盖。

响应 envelope：`kind:'task-detail',version:1,taskId,sourceKey,startedAt,completedAt,statusDigestBefore,statusDigestAfter,consistency,task,mainObservation`。task 保留原 status/source/git/review/implementationProof/documents/progress/issues/current 和 main proof。`consistency:'matched'` **只说明两次 status字节未变**，不宣称文件系统/Git原子快照。前后读取出错/不同为 changed/unknown，保留原始proof事实但 UI 标“观察期间来源变化，需刷新”，不借当前首屏时间变fresh。client 与当前summary.sourceKey/digest不符也不得把detail当当前核验。

关系与直属children仍来自当前完整summary的status-source解析，保留“声明关系”限定；单项detail不能提升整个父/兄弟关系为现场核验。给旧snapshot使用原全任务 resolver，旧结果不改。detail原文包含声明关系字段，仍可查证。

registryFingerprint 可由实际 registry identity字段+frozen/stale/phase配置序列化摘要产生，不是GitHEAD。新summary已更换登记来源时，旧detail/assignment matchesSource不可沿用。

### 3. GET /api/assignments — 真实只读PG独立观察

独立响应 `kind:'assignments',version:1,registryFingerprint,readId,startedAt,completedAt,assignments,unregisteredAssignments,byTask`；assignmentSnapshot返回的 observedAt原样保存，表示其读取调用观察时点，不宣称事务提交时间。本接口 default observer 动态 import 原ledger再调用；import缺pg也捕获为unknown，而不是空available。Node tests允许注入 `observeAssignments(now)` 的只读观察，仅用于渲染/故障测试，不声称PG授权。

匹配规则原样：非released，taskId对应，matchesSource 为登记branch/worktree相等；needsVerification保持“仍占用”；handoff_pending的 next/role/scope 全字段详情可达。unregistered active claims不能只因没有task卡而消失。首片允许此响应完整ledger数据，不必新分页权威；衡量字节必须另计后续assignment响应，不声称所有流量只剩summary。

available且真正无claims才显示“尚无领取登记”；pending/failure均“领取状态未知”。后续失败可保旧claims作“上次观察”并给时间，但最新状态仍unknown，不能继续以旧available/current匹配当写权。取fresh任务仍原CLI原子入口，不新增可写HTTP。

## server/client时序和所有信息可达

- 服务器分别合并 pendingSummary、pendingAssignments、按registered ID的pendingDetail；只保存进行中Promise，finally清除，失败也清。一个HTTP客户端断开不可取消被另一客户端共享的任务；响应前核socket状态即可。不能把Promise在完成后常驻变无失效proof缓存。每次detail仍有新Git context，不能跨轮复用mainChanges脏树结果。
- 首页先显示summary，再独立补assignment；刷新按钮与20s可见timer共用single-flight，不让慢PG阻塞summary显示。隐藏页不发定时刷新；已有请求返回是否显示由同代际规则决定，不能偷偷重开timer任务。
- 三类请求各有 epoch；选中task/来源identity/关闭dialog令相应旧结果失效。摘要刷新使已有proof标旧，不重建正在阅读的详情/文档；来源未变的在途结果仅可成为旧观察，来源变化时终止旧在途读取并保留已读内容，显式刷新详情才换表面。summary A迟到不能回滚B；失败保原summary和原completedAt，同时显式失败时间，不更新“已同步”戳。assignment失败不能替换summary为错误页，assignment成功也不能刷新proof时间。
- detail受 `selectedTaskId + selectionEpoch + sourceKey + summaryDigest` 联合门禁，A→B→A也拒第一次A；摘要刷新导致digest变化时旧详情标旧/要求刷新，不把它写回summary。详情与文档必须在每个await后门禁成功及失败路径。
- document另有generation（包含task、doc path、selected epoch）。旧同task plan响应/旧image load/旧error不能覆盖新review；关dialog abort+递增epoch。所有文件仍从注册document端点读取。
- 复用原Modal、parent/child Enter和Escape焦点恢复。收起区域可以延迟构DOM，但summary仍含全部分类/数量；未知关系即使targetId存在也只“登记资料”下钻。子blocker/decision不折进父，长owner/claim scopes在详情，保短“领取状态未知”入口。
- 现场核验未加载时，用明确中性文字；只有匹配当前选择和来源的detail实际proof才可沿旧绿色badge语义。branch阶段也标“作者记录”，不要用绿完成样式暗示已核。无结构新CSS依赖，已有样式/详情容量足够；若实施确需额外path先amend。

## 精确九 literal 与保护

1. apps/execution-dashboard/src/read-model.mjs（新）
2. apps/execution-dashboard/src/aggregate.mjs
3. apps/execution-dashboard/src/server.mjs
4. apps/execution-dashboard/public/app.js
5. apps/execution-dashboard/test/summary-detail.test.mjs（新）
6. apps/execution-dashboard/test/summary-detail.browser.mjs（新）
7. apps/execution-dashboard/test/task-links.browser.mjs
8. plans/wpf-dperf04-summary-detail
9. docs/evidence/wpf-dperf04

第7项必要：旧 `task-links.browser:35–39` 仅拦 `/api/snapshot` 填claim，新首页不再请求它，须把原claim/未知/长identity断言移至真实新接口，不删除。`8,13,142–146` 原输出wpf-dashboard-summary/旧四source manifest必须改为本任务目录/实际新source，旧D08/DASHSUM原raw保持。不能直接跑该原90s套件再额外跑新60s，各脚本应共享本轮实际累计预算；后置browser总60s含15cleanup限制优先，不继承老脚本90s为第二份额度。

保护human/task-links/status/registry/proof/git-snapshot/documents/ledger/fixture/index/styles/rootmanifest-lock/架构文件。现test/fixture创建三个小Git目录，不会自动装依赖；仅用它时还要注意它的server默认assignmentobserver可能去真实配置。新专测应显式注入只读observer、使用合成registry，不靠真实env空缺碰运气。fixture.mjs无需改；新专测可在自有scope建两个小临时Git根和≤6个任务共用根，避免越出已批2repos预算；主线与任务repo分开以覆盖integration语义。

## 必要验证候选（本次全部未运行）

Node24内置direct，批准候选总≤30s含5s清理、临时≤8MiB、raw≤2MiB、0PG/install/provider/真实registry。四组实质行为：

1. 真实新summary reader +注入计数端口：live路径0observeGit/compare/integration/listDocuments/assignment等待；frozen只显式fallback；作者APPROVED/main记录存在仍现场not_loaded；parse/branch声明冲突、future/stale、父缺失与unknown-targetId保守行为，与旧算法的小fixture预期一致。status2MiB限制不被绕过。
2. 实际server routes与选中detail：unknown task/path越界拒绝；只指定task+main产生Git/proof；原snapshot/document在同合成fixture保形/安全；同target不重复compare、不同target仍独立，跨下一detail的dirty/untracked/main变化必须重新观察。
3. 独立assignmentavailable/unknown/迟到：summary不等PG，unregistered/handoff/needsVerification/source mismatch全保留；PG观察注入不改变take权限。registry identity变更时不能把旧matchesSource粘回。
4. 客户端实际DOM/事件仍留后置browser：A→B→A旧响应、same-task换文档、刷新失败原时间、旧assignment不覆盖新；首屏只summary，点详情才proof，父子/unknown/claim scope全可达，keyboard与light/dark390。Node不能替它冒验。

Browser资源门槛未批准：单合成server+1Chrome/无PG、累计60s含15cleanup、raw≤8MiB；先manifest固定、资源准入再跑，不跑旧browser-check默认真实registry。小fixture可记录summary与full响应字节及调用计数，必须包含后续assignment字节；不从源码或单样本推生产延迟、p95、CPU或部署4320已优化。

## 已应用方法与未实施边界

沿本地find-skills优先已有版本，实际读codebase-design/clean-code，路径与hash在sources.json；不安装。Interface收敛为三个读模型入口，状态读取共享、proof沿原Module、唯一PG权威不复制；明确失败和观察时间，避免用通用缓存掩盖成本。此为原九scope候选的实施消歧，非独审通过、非take或运行许可。RELEASE03优先级仍高，资源恢复时须安全停点转回正式派发。

## 4fac审查后的阅读与专测修复

领取scope/身份使用原始textContent，不经过Markdown清洗。自动摘要同步不关闭文档，不恢复同名但新建的节点：原正文、选区、焦点与阅读位置保留，旧详情/领取记录有明确观察时间和旧记录提示，显式刷新详情才更新。当前登记消失时保旧阅读并禁止刷新，关闭仍可用。文档旧入口不能跨sourceKey/digest/mode读取新来源。

迟到专测只在对应route.fulfill成功、实际fetch响应与消费正文已结算后断言；不消费错误正文的assignment路径另排空该错误响应，失败即非覆盖，不吞为成功。20秒生产callback由fixture显式触发以验证自动同步，不等待墙钟20秒。此为测试刺激，无生产隐藏hook。所有新行为仍NOT_RUN。

未登记claim读取表面按claimId保持；指纹只代表已显示文字，不授予写权、不替代独立assignment观察。字段不变保持展开、焦点和选区；新内容保旧读态并提示显式更新，unknown/已不在列表只保已标旧的观察，不据缺失推断已释放。未阅读的旧行可随当前观察移除。
