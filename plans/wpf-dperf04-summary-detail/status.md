# WPF-DPERF04 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-07 09:25:00 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / gpt-6-astra / ultra |
| 所属大task | [D01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-dashboard/plans/d01-execution-dashboard/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-summary-detail |
| Branch | codex/dashboard-summary-detail |
| 工作基线 / HEAD | c837b5dccaea429b0112d1c7e0c752c41334204a / 98baf552d961ed0fa88ce2cf8bad006002d5986a（当前后继测试准备；metadata另核） |
| 工作树dirty状态 | 16固定输入仍98baf；本次只实际证据/metadata，提交后核clean |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | 当前Node10/10、summary9、关联6、Timing5已限定审；ACCESS5/5+2PNG actual PASS待独审，时间正文/窄light视觉补证未运行；旧40551段CLOSED，新7045/37955 |
| 已集成main状态 / HEAD | NOT_INTEGRATED |
| 实现目标 | 98baf552d961ed0fa88ce2cf8bad006002d5986a |
| 实现范围 | apps/execution-dashboard/src/read-model.mjs, apps/execution-dashboard/src/aggregate.mjs, apps/execution-dashboard/src/server.mjs, apps/execution-dashboard/public/app.js, apps/execution-dashboard/test/summary-detail.test.mjs, apps/execution-dashboard/test/summary-detail.browser.mjs, apps/execution-dashboard/test/task-links.browser.mjs, apps/execution-dashboard/test/task-timing.browser.mjs, apps/execution-dashboard/test/local-access.browser.mjs, apps/execution-dashboard/src/status.mjs, apps/execution-dashboard/src/local-access.mjs, apps/execution-dashboard/public/local-access.js, apps/execution-dashboard/public/local-access.css, apps/execution-dashboard/public/index.html, apps/execution-dashboard/test/local-access.test.mjs, apps/execution-dashboard/test/status-timestamps.test.mjs |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | ACCESS原5组实际PASS，公共helper retained-only三口径complete/unknown[]；本段继续两个必要视觉入口 |
| 下一可用交付 | 完成Timing/ACCESS及窄屏light补证后交主线接收；已有summary/关联实际证据不迁移到待验项 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，UNKNOWN：98baf准备已限定独审；ACCESS实际待独审，时间正文/首页窄light补证仍OPEN |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| DPERF04-01 | completed | w01_owner | [interface](../../docs/evidence/wpf-dperf04/interface.md)、[当前限定源码复审](review.md) |
| DPERF04-02 | in-progress | w01_owner | [当前组合Node10PASS](../../docs/evidence/wpf-dperf04/reentry-20261007/node-composed/acceptance.json)，旧8PASS及首失败保留；summary9+关联6实际已审，Timing5组与ACCESS5组实际PASS，ACCESS待独审 |
| DPERF04-03 | pending | w01_owner | 整体验收/main/实际部署未完成 |
| DPERF04-04 | pending | w01_owner | [窄屏light截图补证](../../docs/evidence/wpf-dperf04/reentry-20261007/narrow-light-evidence-gap.json)：原图保留，原因未证，不影响9+6功能事实 |

## 来源与架构影响

本人live核b554ddb6 v1 active/九scope/固定c837，原样[receipt](../../docs/evidence/wpf-dperf04/claim-receipt.json)。首canonical后源码直接实施，不等待登记。新增summary/detail/assignment只读边界；架构固定快照后继由原owner统一维护，本片保护架构文件。旧全snapshot与D04原子写入口不改。

## 历史 2026-10-06 检查边界

当时两次Node累计3950ms，第二次7叶项+父项全部通过；不采4320/PG，不安装依赖。GO单次慢响应与静态20ms由管理来源记录，非本worker采样或性能基准。Node/browser预算分别后置；RELEASE真资源窗口到达时安全停点优先切回。

## 2026-10-06 16:24:08 UTC 固定源码安全点

七源码固定4facd052c25e63ea300f72ea46c03c51fb983980，[manifest](../../docs/evidence/wpf-dperf04/source-manifest.json)、[检查入口](../../docs/evidence/wpf-dperf04/validation-entrance.json)。旧snapshot保结构/current/proof，summary仅声明并截短过长记录（完整原文仍详情可达）；全体关系仍复用原human/task-links。ledger延后导入，只选中task+main核验，不新建跨轮缓存。UI独立summary/assignment/detail/document代际，未登记claim用相同facts展示精确scope/next/stale占用。

当前仅源码与静态Git范围/hash检查，0产品import/Node检查/浏览器/PG/4320。Node候选只有内置依赖，1个专用临时根内的2个Git repository/2任务/明确注入ledger；等待fresh30秒准入，不能把已写断言当通过。新旧browser共享60秒账本/15秒清理，门槛未到、不运行。源码可独立审查，不将未经运行的UI接口当已验证。

## 2026-10-06 16:33:40 UTC 源审修复安全点

4fac独立源码审查为CHANGES_REQUESTED，原报告归档于[review](review.md)。后继实现固定 `6c18b81a11eece9c07dd047d28da099a0b6bbb24`，仅app/browser两文件差异；5个其余实现/测试源与15保护路径未改。领取事实用原文字节；背景同步保留详情/文档DOM、焦点、选区、阅读锚点，旧核验明确标旧，来源变化后仅显式刷新替换；专测等待准确旧响应投递及正文结算。新增同来源/来源变化自动同步回归与原scope特殊字符断言。

所有运行仍NOT_RUN，不把修复声明当已关闭finding。Node拟30秒外部父runner监督，真实临时loopback HTTP、0外网/PG，1临时根内2 repo；原25秒test timeout不是资源监督。browser后置独立门槛，timer已扣启动前耗时；未执行任何Node/browser/类型检查或空间采样。RELEASE A/B仍冻结。

## 2026-10-06 16:38:55 UTC 未登记领取读态修复

root固定6c18源复核认可scope原文/绝对deadline修正，发现未登记claim列表仍全量重建的同类P2。本轮固定 `b0e937d53a664b3398d36a080cef1a2d4225b6f3`，仅app/browser两源后继差异。按claimId保原DOM与展开/焦点/选区，显示指纹不成为账本；新version/content到达不替换正在阅读的范围，明确旧观察并提供显式更新。unknown或从当前列表消失也不伪称released；关闭并离开旧详情后可丢弃其阅读节点。加入100 scope完整选择、自动同步、版本变化/显式更新/unknown/消失回归。

仍0产品import/测试/浏览器/PG/free；原Node30秒预算全未用。6c18及4fac来源manifest保留，当前七源见唯一manifest，独审待新delta复核。

## 2026-10-06 16:42:53 UTC 日期专测维护

root发现原future-clock替换写死2026-10-06。固定后继 `1441d86baa40e98f4cb81b82dcc551202973209b` 只改直接test：从同一fixture更新时间定义now，旧/未来分别±48小时；写入后明确断言Updated字段与原文不同，再传同一now给readSummary。b0e获审中的app/browser逐字未动，其他源亦零差。静态diffcheck0，0运行/free，manifest重新绑定，首次Node准入尚待。

## 2026-10-06 16:45:52 UTC 唯一Node窗口

固定1441 / 实际HEAD36d687fc682809ce73a90910d86ad34c6349d9dc，通过manager一次freshgate与已审父监督器执行。总1632ms，剩28368ms；7子项中前6通过，第7在Host断言期望403实际200失败，父项因子失败一起记FAIL，TAP总6PASS/2FAIL。未执行到该子项后续文档安全/完整snapshot断言；不能称整套通过。原样[result](../../docs/evidence/wpf-dperf04/node-first/result.json)/[TAP](../../docs/evidence/wpf-dperf04/node-first/node.log)，失败因果尚待源码核对，不先归为产品漏洞或环境问题。

监督器cleanup fulfilled/errors[]，own PGID absent、scratch absent；实际自身loopbackHTTP、0PG/Chrome/外网。未重试，源未改。RELEASE新的A→B准入优先，本片修复暂顺延；browser保持NOT_RUN，未使用其预算。

## 2026-10-06 16:57:00 UTC Host用例源码修复

固定 `abd2aff768f97350762b2eaddbe7ae6843902f48` 仅原direct test：用node:http.request直接连自有loopback服务器并设置Host example.invalid，服务端request监听器同时记录实际入站headers.host；先断言精确入站值，再保403预期。响应流消费完再结算、2秒socket超时destroy、error/aborted拒绝，finally移除监听器，agent:false不保连接池。无改server/保护规则或原断言目标。

首轮未捕获入站Host，不能从200结果断言生产防护失效或断言fetch改写已证实。原六子项通过/Host失败/未到达的后续document与snapshot断言保持，[原始日志](../../docs/evidence/wpf-dperf04/node-first/node.log)不改；[源码/hash审计](../../docs/evidence/wpf-dperf04/host-request-fix-source.json)。新修复仅文本/范围检查、NOT_RUN，Node已用1632/余28368ms；新fresh gate/父runner需重绑target后才可检查，0自动重试/Chrome/PG/free。

## 2026-10-06 16:59:01 UTC 第二次唯一Node窗口

管理fresh准入后本人live核b554v1原9/实际HEAD823071 clean，通过指定父runner单次执行。固定abd2的7叶项+1父项全部通过，无skip，退出0；Host服务器入站值example.invalid与响应403明确核验，document越界/symlink拒绝和旧snapshot结构后续断言均已到达。原1441首失败原样保留；未对旧fetch实际入站值补造结论。

[原样结果](../../docs/evidence/wpf-dperf04/node-second/result.json)、[TAP](../../docs/evidence/wpf-dperf04/node-second/node.log)、[执行binding](../../docs/evidence/wpf-dperf04/node-second/binding.json)。16:58:59.491470Z→16:59:01.809441Z，监督elapsed2318ms，TAP2187.708416ms；累计1632+2318=3950ms，余26050ms。自有PGID76663/group与scratch均已不存在，cleanup fulfilled/errors[]；2临时Git库/2任务/实际loopback HTTP/注入ledger，0PG/Chrome/真实registry/外网。共享free样本不归因本任务。

本次只证明直接行为，不证明浏览器焦点/选区、实际PG领取或生产4320延迟。当前源码不变，仅封存metadata；不得把Node通过当最终独审/主线已集成，无自动重复检查。

## 2026-10-06 17:10:34 UTC 独审记录安全纠正

当前review入口对齐abd2，顶层UNKNOWN仅因全片浏览器待验；b0e/1441/abd2限定source review已完成且0blocking，root第二Node原raw核验已归档。4fac CHANGES_REQUESTED和6c18阶段保为明确历史，不再把旧target当当前审查入口。纯metadata不变七源，不重跑Node/Chrome/PG/space；浏览器准备仅自有/tmp并待结构许可。

## 2026-10-06 17:31:00 UTC 浏览器监督源码安全点

固定 `b17bb05c797cfccc8dbeb4c3de26e57143600bec` 仅修改原browser生命周期，summaryFixture、summaryChecks和整个task-links脚本逐字不变；[source audit](../../docs/evidence/wpf-dperf04/browser-wrapper-source/audit.json)与[小接口](../../docs/evidence/wpf-dperf04/browser-wrapper-source/interface.md)。父监督唯一累计时钟/预算写者，Chrome继承worker组，child只处理自身Chrome PID；固定绝对只读Playwright输入、scratch/profile与retained证据预算分开。

仅源码和静态字节/范围/diff检查，0新Node/import/types/browser/PG/space；browser仍0/60000ms。新wrapper与更新的私有supervisor字段需固定独审及未来fresh gate，本次无binding/运行许可；既有abd2 Node8PASS不改绑新入口。metadata提交前记录；normal push与双端clean由交付回执实核。

## 2026-10-06 19:47:04 UTC 浏览器资源补充审查修复

已只读核管理19:40:09 fresh原9scope/本人writer/无冲突的[窄回执](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/fresh-scope-observation.json)。原b17的root+manager源码与populated-binding限定批准实际已做，[原件与当前接口](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/interface.md)已归档；不再将它们写成尚待首次审查。root后续[资源addendum](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/root-addendum.json)为CHANGES_REQUESTED，TAIL与SOFT-STOP两个P2仅涉及准备入口。

固定实现 `45f8a185ad0d43543a3c9eca7a29da97ebb31ba9` 只改共享browser wrapper/import生命周期；6其余源、summaryFixture/summaryChecks/main与整个task-links字节不变。新/tmp父监督器资源扫描非ENOENT错误上抛，双组reap后删除前与结果/预算写后补采样，记录实际末尾monotonic观察；SIGTERM/INT走同清理且记失败，finally恢复handler，不声称SIGKILL可保证。native Chrome独立组保持原生sandbox，Node仍custom sandbox；Chrome失去外层OS写/egress约束必须单独Lead接受，目前null/无gate，Settings批准不能代替。

该19:47历史安全点source-only修复当时待固定独立复审；0新Node/import/parser/Chrome/PG/HTTP/free/安装。Node仍abd2原8PASS/3950ms，browser仍0/60000ms含15000cleanup，fullfeatureUNKNOWN/mainNOT_INTEGRATED。normalpush/双端clean由提交后回执核验，不把提交前metadata dirty冒称提交后事实。

## 2026-10-06 19:53:57 UTC 限定源码复审归档

[root正式原件](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/root-45f8-source-review.json)绑定45f8/实际metadata3a51，结论APPROVED_SCOPED_LIFECYCLE_SOURCE_AND_PREPARATION_NOT_RUN，0blocking；TAIL/SOFT-STOP仅SOURCE_ADDRESSED。本人核[管理fresh原9范围观察](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/approval-metadata-scope-observation.json)后只做metadata归档。

完整feature仍UNKNOWN，browser0/60000ms（含15000ms清理），原abd2 Node8/3950ms不迁移；main/部署未完成。nativeChromeBoundaryApproval仍null，19:46机会NOT_RUN已归还，没有新gate/运行窗口。本段不改七源码、候选或binding，不运行parser/产品检查或采空间；提交前metadata dirty，提交后normalpush及双端clean另核。全部原9范围在本次seal后停写，claim保留待后续明确派工。

## 2026-10-06 21:08:38 UTC late-stop 准备补修安全点

本人核管理fresh原9 claim/唯一owner以及12ac7db8 clean，见[窄观察](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/scope-observation.json)。root新[addendum](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/root-addendum.json)仅重新打开父监督终态写期间soft-stop的P2，45f8七项目源码/worker/断言未改。仅own/tmp parent新增handler立即FAILED、persist/actualexit显式not stopping/noerrors、最多两次FAILED补写及终态stdout；outerfinally仍恢复handlers。[最小差异](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/late-stop.diff)与[完整旧候选](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/before-late-stop/preserved-files.json)保留，当前仅SOURCE_ADDRESSED_PENDING_REVIEW。

[GO真实边界接受](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/previous-exact-native-boundary-acceptance.json)已在20:01记录，过去null是当时历史；本次父hash变化待root依既有授权精确重绑，不需再问GO。准备态PREPARED/no gate，browser仍0/60000含15000cleanup，Node3950不变。无产品检查/import/语法/信号试验/Chrome/PG/HTTP/free。本次仅自身metadata归档，提交前dirty与提交后双端clean分开回执；待审后保持停写。

## 2026-10-06 21:11:54 UTC 544c 限定复审与边界归档

[root源码准备复审](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/root-544c-source-review.json)为APPROVED_SCOPED_LATE_STOP_SOURCE_PREPARATION_NOT_RUN，0blocking，关闭DPERF04-LATE-STOP-FINAL-WRITE；[root新精确边界](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/root-544c-native-boundary-rebind.json)依据原GO授权接受同544c父与077a worker。本段本人核[fresh原9范围](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/approval-scope-observation.json)，仅归档当前结论，旧49859批准/addendum/原候选均保留。

七源码45f8未改，browser0/60000（15000cleanup）、abd2 Node8/3950ms不变；完整feature UNKNOWN/main未接，等待实际资源/调度准入。正常commit/push后只在own/tmp准备artifact中将HEAD对齐最终metadata及真实新boundary pointer，保持PREPARED/no gate；最终TMP binding/manifest哈希由交付回执供管理核，不为准备artifact变化递归提交项目。不运行检查/语法/import/Chrome/PG/HTTP/free。

## 2026-10-07 08:09:54 UTC ACCESS交接后恢复实现

本人fresh观察08:09:13.163Z确认b554ddb6 v3原7scope/唯一owner/无overlap；08:09:31.783Z原子amend已COMMITTED为v4，新增server.mjs、public/app.js、task-timing.browser.mjs、local-access.browser.mjs，总11 literal。[请求/回执](../../docs/evidence/wpf-dperf04/reentry-20261007/amend-receipt.json)和[管理交接](../../docs/evidence/wpf-dperf04/reentry-20261007/manager-reentry.json)原样归档。WT/branch仍原dashboard-summary-detail/codex同名，起点929b706a3bffcc94e31aba32467f88038bd6ea18 clean；不重建/reset。

输入固定main9f314e89b9d4b1b944cca96df0a9fea5a26a51d0；观察当时main已到c5dbdb712e4fae078ddd4bbdbc51c653d77a3192，两者dashboard范围无diff，因此不追movingmain。保handleLocalAccess顺序/私密provider、TIMING字段、summary声明与按需proof分离、旧snapshot兼容、已开DOM/焦点/选区；缺失保护模块先给exact供给清单，不越scope补写。当前仅源码，0PG/Chrome/真实registry/性能采样；旧Node3950与browser0/60000原件不迁移为新组合通过。后续交接是固定新source+直接消费者检查方案给root独审。

## 2026-10-07 08:18:11 UTC 固定组合源码

当前实现 `cfd5a53323438709843828d74cab67502801060c`，输入 main `9f314e89b9d4b1b944cca96df0a9fea5a26a51d0`；[manifest](../../docs/evidence/wpf-dperf04/reentry-20261007/source-manifest.json)列9个own source/test与7个原样供给输入。供给独立commit `aa9cb2d5ba053dd264645d98819cb1cb60e89b2f`，[root原样核验](../../docs/evidence/wpf-dperf04/reentry-20261007/root-source-supply-review.json)。7输入只物化，不授后续内容编辑权。v4总11领取范围见[原子receipt](../../docs/evidence/wpf-dperf04/reentry-20261007/amend-receipt.json)。

[一次相关Node方案](../../docs/evidence/wpf-dperf04/reentry-20261007/validation-proposal.json)：1文件9叶项+父项，2临时Git仓库/2任务，仅自有动态loopback，0PG/Chrome/真实registry；本段尚NOT_RUN。旧3950ms/Node8不迁移到当前源。浏览器仍0/60000ms，无性能根因结论。源码保原snapshot/current proof、ACCESS私有授权顺序及TIMING来源语义；刷新保阅读DOM和选择，等待原文按需读取。

root在运行dashboard的资料入口读到当时own status原字节：[观察](../../docs/evidence/wpf-dperf04/reentry-20261007/root-status-document-observation.json)，仅此入口，不声称wholeUI或重新fresh claim。下次交接：root固定源审与有界直接检查，浏览器资源由co-lead协调；未合main、未部署。

## 2026-10-07 08:24:22 UTC 当前组合唯一直接检查与local归还

限定源审[root原件](../../docs/evidence/wpf-dperf04/reentry-20261007/root-cfd-composition-review.json)接受固定 `cfd5a53323438709843828d74cab67502801060c`；本次实际metadata HEAD为 `b1c6c24f66e3c23afc3a50e0ad8c67f6ebcba679`。fresh v4/11及29pins后，2026-10-07T08:22:30.872061Z→08:22:33.737598Z执行唯一单文件：9叶项+父项10/10，fail/cancel/skip/todo=0；实际outer exit0、唯一PASS终态与result哈希相等、EOF完整且drop0。原件[index](../../docs/evidence/wpf-dperf04/reentry-20261007/node-composed/index.json)、[TAP](../../docs/evidence/wpf-dperf04/reentry-20261007/node-composed/node.log)、[actualexit](../../docs/evidence/wpf-dperf04/reentry-20261007/node-composed/actual-exit.json)。

outer55631及Node PGID55755实际signal0均ABSENT，scratch无、cleanup errors[]；HTTP由fixture after-hook关闭与owned group收尾支持，无额外socket探测。原result较早2786ms/终态2787ms不改，最大outer2865.5355向上取整计2866ms，新phase30s余27134ms；历史3950ms分列，全部Node历史+新6816ms，绝不把旧PASS迁移。临时峰61,137B，raw/metadata均在原上限内。已立即把本组local交回root供panels使用；无重跑、PG、Chrome、provider、真实registry/个人服务。浏览器仍0/60000，实际main/部署未发生。

当前root源码审已完成，实际结果独审另记；[quality](../../docs/evidence/wpf-dperf04/reentry-20261007/quality.md)记录应用方法与非继承边界。剩余时间只是账本，不是后台续跑或自动浏览器授权。

## 2026-10-07 组合浏览器首轮与同步窄修

原cfd5/actualacf8真实summary 6组通过后，在Escape后立即检查精确焦点时失败，0截图。outer exit1，8257.084ms向上计8258，剩51742/总60000含15秒清理；parent8187和late8189原值原封。三owned groups ESRCH、完整EOF/drop0、context/server/fixture/scratch清理均完成，0PG/真实registry/个人端口。原件见[首轮](../../docs/evidence/wpf-dperf04/reentry-20261007/browser-summary-first/index.json)。

只改同test的被动close事件观察：等待产品原生close listener结算，记录实际焦点目标，保原精确activeElement断言。不改产品、不用sleep、延长timeout或降低期望；未先归为产品错误。摘要优先，关联/Timing/ACCESS仍待按真实余量执行，任何未执行项不继承旧Node结果。

clean-code：同一个scanner精确剪枝owned scratch，避免两遍非原子相减；cap/lifecycle/权限保持。复用已装find-skills/clean-code/codebase-design/webapp-testing，方法与hash在私有准备记录，未安装依赖。Node实际root报告已原样归档；当前claim b554 v4/11范围未变。

## 组合summary第二轮实际

固定1c190 / actual6963627，原生close被动事件结算后原精确T02headline焦点通过；9组/双390截图、outer0/唯一PASS终态/完整EOF/drop0与所有owned清理完成。[原件](../../docs/evidence/wpf-dperf04/reentry-20261007/browser-summary-second/index.json)。实际9084.5586ms计9085，累计17343/余42657；首轮所有raw保留。task-links同类原生close已作同样有界事件等待，保五次Escape、两精确return焦点断言，未运行不称通过。

## 2026-10-07 关联实际与消费者接缝准备

固定c989/actuala0e555，六组关联检查/五PNG、outer0/唯一PASS终态。7120.3628ms向上计7121，累计24464/余35536，总60000含15秒清理，首红不可回增。[关联原件](../../docs/evidence/wpf-dperf04/reentry-20261007/browser-task-links/index.json)。08:48:21.257631Z实际结束，三个own groups ESRCH、HTTP/context/fixture/scratch关闭、完整EOF/drop0，立即归还浏览器。首次作者只读观察不足以接受全部图；随后root发现窄屏light底部第二页首带，原图保留且该视觉证据OPEN。其他四关联图与两summary图获限定目视接受，不冒全部视图或a11y。

后继source-only适配只改原三test：runBrowserCheck复用同监督/cleanup，Timing factory只建其既有HTTP fixture不造额外Git库；ACCESS明确noDefaults:true及唯一freshowneddefaultcontext，调用既有函数并核其关闭回执。父监督需精确local-access入口允许消费者正常close该Chrome后继续收worker结果，仍要求5项+HTTP/context清理；源码/生命周期差量交一次针对性审查后才能运行。summary与task-links行为主体不改，四生产模块逐字cfd5，权限和caps不扩大。

clean-code复核：把真实fixture/context差异作为小调用参数，保一个预算/清理owner，未复制测试算法或引入第二authority；未跑Node/Chrome/PG，也未重跑已通过Node10。完整feature、main及部署仍未完成。

## 2026-10-07 08:58:13 UTC 实际独审归档与视觉补证待办

[root实际报告](../../docs/evidence/wpf-dperf04/reentry-20261007/root-summary-links-actual-review.json)核57份raw、三次16source、outer终态与完整owned清理，接受summary9+关联6功能；7PNG中6图限定视觉接受，home-narrow-light底部重复页首的原因未证，须补一张独立命名的真实图。DPERF04-04保原图/hash，只在后续合法窗口记录同一390light页面的header数量/边界、viewport/scroll及有界帧观察，保持原几何断言；不延时盲试、不改图、不先改产品。

[消费者生命周期限定源码审](../../docs/evidence/wpf-dperf04/reentry-20261007/root-consumers-lifecycle-review.json)接受08e9/ee11父/54cf worker：Timing原5组和ACCESS原5组仍NOT_RUN；默认context的正常关闭不等于遗漏worker/EOF/HTTP检查。实际先后为Timing→ACCESS，剩余预算允许才窄light补证；总spent24464/remaining35536含15秒清理。当前LAZY PG段与本浏览器串行，未占窗口/未采新free/无gate。

本段只归档和校准当前文字；四生产模块及16固定输入不变，原首红/所有raw不改。clean-code复核区分功能与视觉证据，复用现cleanup owner；未重跑Node、Chrome或PG。

## Timing首轮失败与同段同步窄修

[原件索引](../../docs/evidence/wpf-dperf04/reentry-20261007/browser-timing-first/index.json)：actual50a51/source08e9，09:00:52.185750Z至09:01:01.338856Z，outer exit1/FAILED，9152.92075ms保守计9153。累计33617/余26383含15秒清理；parent较早33547原封。报告checks0/截图refs0；实际lightPNG已保留，不虚构组数。错误在第二theme重新开详情等待region，三个groups/PID均ESRCH，HTTP/context/scratch清理完成、全部EOF/drop0。

固定 52cdfbbb177ec9c89651ebde9b82e3a5538f45f0 只在Timing测试两处Escape复用同型被动close事件等待；旧close listener在app483会使新请求失效，测试须先结算close再重新focus/open。只是静态合理窄修，不把根因先定为产品缺陷；保原五组、全部断言/timeout、双390截图。后继fresh可用原有限余量复验，不重跑Node；ACCESS及窄light补证不能因余额不足冒通过。

## 原生close延迟送达的产品保护

Root指出app原close listener无条件invalidate；HTML真实close事件异步送达时，同一任务close后立即重新打开的新selection/load可能被旧事件撤销。固定 52cdfbbb177ec9c89651ebde9b82e3a5538f45f0：dialog仍open时忽略旧close；其余close清理/焦点返回不变。Timing新增真实dialog.close()与同任务精确按钮click重开，等真实close已送达再核新详情/3小时/open；不手动dispatch伪close。普通串行Escape仍被动等close，原五组/两图/错误断言不删。当前是source修复，尚未复验，首轮失败不能据此回改根因。

## Timing第二轮真实结果与余额安全点

固定52cdf/actual1341，09:04:53.320539Z→09:05:00.253888Z：outer exit0/唯一PASS终态，原5组/双390PNG，真实native.close→同任务按钮重开→旧close实际送达后新3小时详情保持已通过。[完整原件](../../docs/evidence/wpf-dperf04/reentry-20261007/browser-timing-second/index.json)。6933.063875ms向上计6934，累计40551/剩19449（必须含15秒清理）；首Timing red和首summary red均保留。

outer49738/worker54431/Chrome50453各PID和PGID均ESRCH，scratch不存在；context/server/fixture真实关闭、三streams完整EOF/drop0/errors[]。两图只目视接受可见详情顶部/Close焦点/双主题/横向包含；时间区在折叠下方，UTC/等待正文由DOM断言覆盖，不能宣称图中已目视。

剩工作4449ms低于最近两次约5秒启动阶段，故主动完成/交回本段，不启动可预见deadline失败；ACCESS保持NOT_RUN，DPERF04-04浅色首页补图OPEN。没有追加预算、重跑Node、PG或访问真实服务。下一必须明确剩余额度是否足以有效检查；整体审查/main/部署仍分层未完成。

[root Timing实际/源码独审](../../docs/evidence/wpf-dperf04/reentry-20261007/root-timing-actual-review.json)接受52cdf旧close保护及真实事件回归+5组，未反推首失败唯一因果；33raw/32sourcepins与两attempt完整清理核验。旧60s段以spent40551/unspent19449 CLOSED，未用额保历史不做后继credit。后继仅SOURCE_ONLY准备OPS-METER公开helper接入与ACCESS5组、首页窄light及真实时间正文双图；新建议45秒含15秒清理需独立资源交接，当前未运行。

## 后继45秒有限段 SOURCE_ONLY准备

固定 98baf552d961ed0fa88ce2cf8bad006002d5986a 仅3个既有test：明确独立phase45000时钟（旧40551/19449 CLOSED不作credit）、可选Timing正文视口双主题与关联首页单浅色补证；原全9/6/5检查主体保留，不无关重跑。[prepared接口](../../docs/evidence/wpf-dperf04/reentry-20261007/remaining-consumers-preparation.md)与[精确pins](../../docs/evidence/wpf-dperf04/reentry-20261007/remaining-consumers-preparation.json)。新TMP父只剩local-access5组/2图、timingvisual1组/2图、linksvisual1组/1图；当前0/45000、no gate/native新hash待审，不占Chrome/PG。

OPS-METER固定main1e12eaf13 measure.py原字节，只迁移所有retained路径（BASE精确排除scratch+evidence）；root设备/inode pin、unknown失败并保partial/ownedgroup清理后KEEP，禁pycache。scratch原独立64MiB regular logical/allocated测量未改，显式PARTIAL_RETAINED_ADOPTION；特殊Unix socket是源码兼容可能，未实际采样，不放宽公共helper。必要caller实际验证在后继范围执行，未运行helperpytest/Node或采新空间。

## 2026-10-07 09:23 UTC 后继ACCESS实际

[原件](../../docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-access/index.json)：98baf/actual6e92，09:23:49.185251Z→09:23:56.230020Z，outer0/唯一PASS，原5组/双390PNG；图片待root目视，不以数量冒视觉通过。outer7044.198833ms向上计7045，新45s余37955含15s清理；旧40551/未用19449 CLOSED不挪用。parent6948/late6955原样。outer32707/worker37717/Chrome33199各PID及PGIDfresh均ABSENT，三EOF/drop0、context/http与scratch清理完成。PARTIAL_RETAINED_ADOPTION：公共helper三retained口径实际complete/unknown[]，scratch原scanner与64MiB上限未变；不是两个完整caller迁移通过。下一只Timing正文与首页浅色补图，0PG/真实registry/个人服务。
