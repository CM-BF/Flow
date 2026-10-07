# DPERF04 summary/detail 恢复提案（只读、未领取后继）

结论：沿既有 WPF-DPERF04 恢复；在固定新版 main 上合成 ACCESS + TIMING + 原 summary/detail，不能复制45f8的server/app覆盖。当前 main/origin 只读固定为 `c0e0263dc01b9527293318a644f964bd048e2a86`；旧WT HEAD `929b706a3bffcc94e31aba32467f88038bd6ea18`、codex/dashboard-summary-detail、clean，旧实现45f8a185ad0d43543a3c9eca7a29da97ebb31ba9。本段无claim/项目写/Node/import/test/HTTP GET/PG/Chrome/容量或进程观察；Quick包未触碰。

输入root snapshot研究SHA7d87700…73003：两个5秒请求超时与既有一次长响应仅是客户端观察，现日志无phase duration，不能归因Git/PG/文档或声称宕机。这里说明代码路径与接回条件，不证明加速效果。

## 可复用行为与必须接回的三个Interface

**摘要为何不读全部证据。** 45f8 `read-model.mjs:17–31,55–108` 对每个登记task仅通过原安全readWithinWorktree读唯一status（8路有界并发），parseStatus后复用humanOverview/resolveTaskLinks；正常live路径不observeGit、不review文件、不listDocuments、不compareImplementation/integrationProof、不等ledger。status不可读才有原冻结Git fallback，明确frozen/missing/stale。仍会读全体status，并非零I/O或保证5秒以内；无新增TTL/跨轮proof缓存。`/api/assignments`独立开始，pending/unknown不冒无claim；D04原子入口是唯一写权权威。

**按需详情。** `aggregate.mjs:66–85`只观察选中task+main，文档清单及现场proof留此处，前/实际/后status digest避免读取期间ABA；详情返回sourceKey/registryFingerprint/taskId/时段/consistency。旧`/api/snapshot`完整结构/规则仍保留，显式消费仍会做原全聚合，不能让首页偷偷依赖它。普通摘要的sourceCurrent只说status源自洽，不与旧full.current（含Git观察）互换；overview/links明确basis=status-source，作者checks/review/main声明不显示为现场批准。

**刷新读态。** 45f8 app:215–238/258–285/350–422已有summary、assignment、selection、detail、document独立代际；sourceKey/digest/registry fingerprint与选中身份核对，迟到成功/失败不得覆盖后一次。自动同步保留已开详情/文档DOM、选区、焦点、滚动；仅提示旧观察/禁用过期动作，显式“刷新所选详情”才替换。未登记claim open details原节点也保留（57–118），版本变更/消失/unknown明确旧事实，不能据此推released。这些源码已审但browser未实际跑。

## 新main接缝与精确处理

1. **ACCESS server（main server:8/11/18–30/58–59）**：保createLocalAccessHandler/localInstallationFromOptions、local-access.js/css静态映射、CLI显式安装入口。createDashboardServer options应组合`{localAccess, assignmentObserver=observeAssignments, gitContext}`。handleLocalAccess必须仍在通用GET-only/Host路径之前执行；否则主动owner-token POST被405拦住。新增summary/assignments/task路由在原通用只读检查之后，保未登记404/document安全/CSP/no-store。不要把ACCESS私有provider/token/config放DTO、日志或读模型，不改local-access模块/配置。保原localAccess handler自己的异常脱敏、singleflight与权限判断。

2. **TIMING DTO（main status:39–63/107；旧read-model:68–108）**：当前摘要白名单没有timing，且返回startedAt/completedAt而无generatedAt、source无path、client无full.current。仅在现read-model加入summary所需timing声明（started/completed/source/issues），保原严格parser，不重复日期算法；summary明确generatedAt=已有请求startedAt供同一快照含等待历时，completedAt仅响应读完时间；source.path由登记的唯一status路径得出。`timing.issues`不得混入status.errors或sourceCurrent，不影响旧TODO/check/review事实。首屏只带必要时间声明；完整waiting原文留按需detail，避免每卡把大等待表重复传入摘要。完整详情仍原parseStatus结果，rawUTC/来源/等待记录完整可达。若详情在proof前需显示时间，先显示摘要声明；waiting显示“详情读取后可见”，不得当无等待。

3. **TIMING UI（main app:27–82/119/179–216 vs旧app）**：保summaryTiming/timingDetails/elapsedText与NOT_COMPLETED≠正在运行/分支交付≠完成规则；给时间视图显式传观察时点与source-current语义，不能硬把summary.sourceCurrent写作full.current。详情保存自己的观察context（generatedAt/来源/所读task），不要在syncSelectedSource更新selectedTask时让旧detail时间静默跟新summary走。summary刷新/失败只更新cards与旧detail历时未知/历史标签，不能replace已展开timing/source/wait节点或夺focus。详情异步返回只填独立proof/wait占位；自动刷新不重建读态。时间按已有固定快照计算，不加now tick、第三存储或新轮询。等待仅原文，本片不并入另行研究的易读等待表/localzone需求。

静态比对：main aggregate/human/task-links/documents/proof均仍等旧base相应字节；server/app/status/index新增ACCESS/TIMING。read-model和summary测试尚未在main。可复用差异局部但须在current main组合源码审，不能把“main无该文件”当授权整树覆盖。

## 最窄候选literal与所有权

**建议共11 literal**，不是新feature；都需manager fresh核并明确派工后才能写：

1. apps/execution-dashboard/src/read-model.mjs
2. apps/execution-dashboard/src/aggregate.mjs
3. apps/execution-dashboard/src/server.mjs
4. apps/execution-dashboard/public/app.js
5. apps/execution-dashboard/test/summary-detail.test.mjs
6. apps/execution-dashboard/test/summary-detail.browser.mjs
7. apps/execution-dashboard/test/task-links.browser.mjs
8. apps/execution-dashboard/test/task-timing.browser.mjs
9. apps/execution-dashboard/test/local-access.browser.mjs
10. plans/wpf-dperf04-summary-detail
11. docs/evidence/wpf-dperf04

旧claim最后明确原件为b554ddb6 v3/7scope（02:54:43Z），仅第1/2/5/6/7/10/11；server于v2移出、app于v3移出，两文件明确停写。ownstatus仍写v1/9是旧记录，不是新权限。恢复至少需fresh协调/amend **server.mjs、app.js、task-timing.browser.mjs、local-access.browser.mjs** 这四literal；TIMING历史已释放不代表当前无人领，ACCESS当前权属也不得猜，manager核最新ledger。可能并行Timing易读后继会争app/Timing browser，应串行窗口。此任务不查freshDB、不take。

为什么两额外browser路径必要：main task-timing.browser:44–51只提供/api/snapshot，新UI请求summary将404；须fixture适配summary/assignments/detail、保原5行为（含同snapshot、unknown、refresh读态、390），不改断言期望。main local-access.browser:35/43只给localAccess provider并拦snapshot；summary恢复后会走新真实summary/assignments，默认observer可能触PG。必须给fixture注入明确synthetic assignment observer/匹配摘要，并保全部ACCESS安全与focus断言，不能以旧snapshot route仍在当已隔离。其public local-access.js/css与index保持main，不回拷旧UI或禁用入口。

不需写status.mjs（81已有parser）、human/task-links/proof/ledger/registry、ACCESS product/测试原算法、CSS/index、根依赖/锁。若未来真实改动证明还需路径，先精确amend。WT是否由原Lead安全接收currentmain组合或另provision由manager决定；本提案不授权reset/rebase/merge/config。

## 最少新验证与可沿用边界（本次均未跑）

- 沿用为历史：abd2单文件7叶+父8PASS/累计3950ms/原Host失败与修复；45f8/544c仅source/lifecycle批准；browser0/60000、main未接。TIMING原81parser+5browser及ACCESS原结果只证明原固定源，不能盖到新组合。
- 一次定向Node段：现summary-detail.test原7叶全保，加入新timing投影与generatedAt、完整detail waiting/source、timing单项bad不污染progress；fake localAccess provider证明背景summary/assignments/detail不会读取token，主动合规POST仍走原handler。可复用原local-access.test.mjs（Node内置/private synthetic config）验证routing组合；不跑coordination PG/真实registry。命令候选`node --test apps/execution-dashboard/test/summary-detail.test.mjs apps/execution-dashboard/test/local-access.test.mjs`，实际预算/依赖/选中数须新固定后审定，不继承旧准入。
- 一次隔离browser组合：原summary异步/late-response/claim100scope/文档selection/focus场景 + 新TIMING五组入口 + ACCESS原入口。明确断言首屏不发snapshot/task/document，ledger慢不挡summary；打开单任务才取proof；保刷新时timing/文档/claim展开节点身份及键盘；两主题390无溢出。测试入口重绑后可共用已验证caller生命周期，不另建框架。原60s/15cleanup账仍0，但组合能否装入原预算需要实际精确packet审定；禁止暗加预算或未授权运行旧默认registry脚本。
- 单独真实服务性能观测后置：主线接收/部署后一次约定的summary vs full响应样本及phase时点才讨论真实收益。现在既没有全185聚合也没有GET，不猜5秒根因，不能将结构优化宣称已解决生产延迟。

## 技能/质量与输出边界

本地find-skills方法复用已安装clean-code/codebase-design（paths/hash见sources.json），未安装或联外查技能。应用：三条小Interface复用原parser/proof/ledger权威；不重复状态算法、不制造跨轮缓存；错误/未知与旧证据保真；显式把异步详情和阅读DOM寿命分开。只读Git固定blob与少量原receipt，产品零写。source pins见sources.json；没有新审批、测试结果或完成声明。
