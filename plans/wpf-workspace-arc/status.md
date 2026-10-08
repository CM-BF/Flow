# WPF-WORKSPACEARC01 状态

| 字段 | 记录 |
| --- | --- |
| 所属大task | [WPF-MATURE-05](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-05-workspace/plan.md) |
| co-lead | Web/root；执行管理d01_owner |
| 最近更新 / 最近main同步核验 | 2026-10-08T00:00:11.140034+00:00；本次不新核main |
| Plan | [plan.md](plan.md) |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 前期只读研究首时刻未单独记录，不用ledger/commit猜；本源码实施实际开始2026-10-07T17:58:48.865Z见[provision](../../docs/evidence/wpf-workspace-arc/provision.json)，本片尚未完成 |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition |
| Branch | codex/web-workspace-composition |
| 工作基线 / HEAD | base f8853d4731eb6229337279079c24617c97d4f56b / source b3f5bed1a17019d1de01117f3a510314d5ecd412；本次metadata待seal |
| 工作树dirty状态 | 全部18scope源码/checksSTOP；仅own metadata尾待seal，0PG/HTTP/Chrome |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 检查状态 | PASSED b3f5bed1a17019d1de01117f3a510314d5ecd412；仅实际fixture新旧DTO公共codec两例/645ms；noEmit未跑（无新类型接口）。新browser NOT_RUN；原e6212/4FAIL保留 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；本片新实现仅分支固定，尚未main集成 |
| 实现目标 | b3f5bed1a17019d1de01117f3a510314d5ecd412 |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/conversation-stream/host.ts, apps/web/src/conversations/ConversationList.tsx, apps/web/src/plugin-integration/layout.ts, apps/web/src/plugin-integration/session.ts, apps/web/src/plugins/host.ts, apps/web/src/plugins/sample.tsx, apps/web/src/plugins/types.ts, apps/web/src/plugins/validation.ts, apps/web/src/workspace-layout/WorkspaceTabs.tsx, apps/web/src/workspace-layout/layout.css, apps/web/src/workspace-state.ts, apps/web/test/conversation-stream-integration.test.ts, apps/web/test/plugin-host.test.ts, apps/web/test/plugin-integration.test.ts, apps/web/test/workspace-layout.browser.ts, apps/web/test/workspace-layout.fixture.ts, apps/web/test/workspace-layout.test.ts |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 顶部空白的样式命名冲突已修；材料设置目录改为合法展示标识，原公共codec检查通过。实际四组仍待新浏览器验证 |
| 下一可用交付 | 可分拆、调序和调整比例的真实会话工作区，并验证材料准备中草稿不丢失、三个pane都能持续读取 |
| 当前阻塞 | ACTIVE: 修后CSS与材料场景尚未browser验收，未获新运行授权；旧2/4失败与视觉P2保留待复验。 |
| 需用户决定 | NONE |
| Review | APPROVED b3f5bed1a17019d1de01117f3a510314d5ecd412；root4467限定4源/2codec/新候选，0blocking。视觉实际/材料与完整四组仍待新run；非main批准。 |
| Claim | c34d95d1-af01-4325-bcd5-77ba9dd28379 v2 ACTIVE exact18；2026-10-07T22:47:29.074Z原子移出App.tsx与plugin-integration/session.ts，二者固定字节只读供给不改 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-WORKSPACEARC01-01 | in-progress | workspace_panels_owner | 固定设计/供给和原子take已完成；布局实现中 |
| WPF-WORKSPACEARC01-02 | in-progress | workspace_panels_owner | 共同稳定父级源码已接入；本轮layout-navigation/three-pane-reads通过，含六显式正文读取；真实prepare-await/长正文阅读锚点未完成 |
| WPF-WORKSPACEARC01-03 | in-progress | workspace_panels_owner | typed context/invocation lease源码已接入，5私有AppPort+2Host纯回归已通过，真实消费者待browser |
| WPF-WORKSPACEARC01-04 | in-progress | workspace_panels_owner | 第三独立HTTP同轮FIFO/hidden queued-dispose2PASS；旧两FAIL保留。本轮three-pane-reads通过；整体2/4，材料与refresh-theme未完成 |
| WPF-WORKSPACEARC01-05 | in-progress | workspace_panels_owner | 原13纯例/types与第三HTTP同轮2PASS保留；四次browser分别0/4、1/4、1/4、2/4 FAIL完整归还；本次50986ms CLOSED，早图1/最终0，全部失败不抹 |
| WPF-WORKSPACEARC01-06 | pending | workspace_panels_owner | NOT_INTEGRATED |

## 等待记录

| ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| ARC-WAIT-CLASSIFIER-READY | 2026-10-07T23:39:15.523446Z | 2026-10-07T23:49:07.270Z | 资源 | 已固定候选等待唯一Chrome；经理正式grant解除 | 本owner delivery与经理ArcClassifierGrant，见本轮preflight |
| ARC-WAIT-CLASSIFIER-FAIL | 2026-10-07T23:51:01.826066Z | OPEN | 验证失败 | 材料设置前置失败及早图CSS P2；待合法源码修复和新验证 | 本轮outer actual-exit/root9605；不造task历史start |

前期K01测量曾暂停静态供给；首暂停实际收到时点未单独记录，不造等待时长。经理明确解除后已正常物化/取权；本次普通local已闭合18020ms；后继HTTP/browser仅proposal，无窗口预约。

## 风险与架构

布局引用不复制View/C/Symbol/pending。两stream lease与六显式body reads分别计；32resident逻辑body缓存上界66MiB不冒JS heap。新布局模型/公平调度/插件context改变架构，固定source交付后由manager协调dashboard架构target更新。当前source登记[请求](../../docs/evidence/wpf-workspace-arc/source-switch-intake.json)由经理维护D05；本记录不另建事实源。

2026-10-07T19:01:45.523Z：S01性能窗口期间曾安全STOP，0child且不写source；经理明确18:58:01.926解除后恢复原源码段，fresh ledger核原c34d v1 exact20 ACTIVE。局部/浏览器预算未授，不使用旧额度。

2026-10-07T19:48:23.249Z：原普通local18020/60000已CLOSED，首红、13PASS/34未选、types2→0和精确清理见[review入口](../../docs/evidence/wpf-workspace-arc/review-entry.md)。18source STOP，0runtime；后继真实HTTP/Chrome未授权，原未用41980不作credit。

2026-10-07T20:15:52.827442Z：20min准备段19:59:55启动，新增总16MiB界内。root afb5559限定source/local APPROVED已归档；7097仅browser增加原组内reduced-motion观察与显式cleanup收据。新types段4683/20000 CLOSED，原local18020/60000 CLOSED均不转余量。已形成HTTP2/30s和browser4/90s候选，0HTTP/PG/Chrome/预约/gate；[准备入口](../../docs/evidence/wpf-workspace-arc/runtime-preparation-20261007/entry.json)。个人诊断HOLD不以此包绕开，actual仍须经理唯一资源交接。

2026-10-07T20:37:09.295547Z：唯一HTTP实际START2026-10-07T20:36:11.197384Z，PID/PGID37390；child与外层exit1，3408/30000 CLOSED/未用26592不转。2026-10-07T20:36:27.433733Z exact PID/PGID ESRCH、scratchabsent、regular logs关闭；fixture afterEach无hook错误，未另做portprobe、不称双EOF。只有两selected：backlog PASS、隐藏waiter在test50前置reads.length预期2实际6失败；11未选。0PG/Chrome/provider，无第二run授权。原件/private/tmp/arc-runtime-preparation-0xrqtd0l/http。

2026-10-07T20:42:30.368488Z：新20min source/meta段固定fe7f，仅test补真实两HTTP响应barrier和排队hide/dispose，产品不改。changed noEmit3096/20000 CLOSED，原HTTP3408/30000 CLOSED，未用均不转。新独立HTTP30候选[入口](../../docs/evidence/wpf-workspace-arc/http-waiter-fix-20261007/entry.json)待集中差量审/经理新窗口；本段未HTTP/Chrome。

2026-10-07T20:49:20.590644Z：第二独立HTTP START2026-10-07T20:48:14.529496Z，PID/PGID7418，child/outerexit1，2652/30000 CLOSED/未用27348不转。20:48:31.490133Z exact PID/PGID ESRCH、scratchabsent，regularlogs、无独立portprobe。修后hidden/queued-dispose PASS；backlog在test65 peer second-before-third谓词FAIL，11未选。0PG/Chrome/provider，0新运行授权；旧首轮3408账与原件不改。

2026-10-07T20:50:23.889173Z：第二原件已[归档](../../docs/evidence/wpf-workspace-arc/http-second-20261007/manifest.json)，当前全20scope STOP保claim；root7b962源批准保留。两轮HTTP均整体FAIL，旧3408与新2652均单独CLOSED。不存在第三NEXT或browsergrant。

2026-10-07T20:54:44.938055Z：原10min/4MiB source段固定7e911，只改test39+/20-。不是已证productbug修复；明确修正全peer锁步谓词为真实waiting FIFO优先，增加≤48公共请求trace。新changed types3362/20000 CLOSED/未用16638不转，PID/PGID82919与scratch精确归还。新独立HTTP30候选[入口](../../docs/evidence/wpf-workspace-arc/http-fifo-boundary-20261007/entry.json)，无第三actualgrant/browsergrant。

2026-10-07T21:06:54.437128+00:00：正常fresh c34d v1 exact20/overlap[]、0e2f clean后刷新browser候选；207源仅原HTTP test一pin更新、43external/33resolver复用、三caller逐字不变。新包见[entry](../../docs/evidence/wpf-workspace-arc/browser-refresh-20261007/entry.json)，90=60work30cleanup、0PG/2HTTP/1Chrome、256MiBscratch/8MiBraw、原四组/双图均未运行。root11e317源码准备批准已归档，Q01持有PG且本段不占NEXT。

2026-10-07T21:20:31.866175+00:00：第三独立HTTP START2026-10-07T21:19:49.284032Z，PID/PGID32681；child/tool exit0、两selected PASS/11未选、2912/30000 CLOSED/未用27088不转。exact PID/PGID ESRCH、scratchabsent；fixture afterEach无hook错误，无独立portprobe，regularlogs不冒双EOF。旧3408和2652两FAIL不改，0新NEXT/0browsergrant。

2026-10-07T21:22:36.031590+00:00：[第三actual归档](../../docs/evidence/wpf-workspace-arc/http-third-20261007/manifest.json)。请求trace因JSON reporter未留存，不能独立重建本轮具体请求序列；声明只据实际测试断言，不补造。browser数据a4e5批准已归档，不作运行授权。

2026-10-07T21:23:22.849273+00:00：root[e524限定actual独审](../../docs/evidence/wpf-workspace-arc/http-third-20261007/root-arc-http-third-result-review-20261007.json)已原样归档、0blocking；trace NOT_RETAINED等限制保留，browser4/双图NOT_RUN、原两FAIL不改。全20 STOP保claim，无后续runtime。

2026-10-07T21:37:17.153577+00:00：新15min/4MiB清理窄修段，截止21:50:55.652Z；仅本次新临时样本，最多3串20s/累计40s含清理，不触旧KEEP，不跑产品HTTP/types/browser。旧第三HTTP2PASS与全部失败不改。

2026-10-07T21:43:20.807362+00:00：仅调用器修复，产品source仍7e911；[新入口](../../docs/evidence/wpf-workspace-arc/browser-cleanup-20261007/entry.json)。首6FS PASS与最终7FS PASS原件分别保留，真实函数AST提取；child/toolexit0、exactPID/group及自有scratch归还。保守toolwall计315+249=564ms/40s CLOSED，余不转；regularlogs非双EOF、无独立outerwall。旧Arc browser身份P2见[root原审](../../docs/evidence/wpf-workspace-arc/browser-cleanup-20261007/root-arc-timing-cleanup-review-20261007.json)，修后caller待审不冒browserPASS。

2026-10-07T21:45:12.092738+00:00：[root 2b2f](../../docs/evidence/wpf-workspace-arc/browser-cleanup-20261007/root-arc-owned-root-cleanup-final-review-20261007.json)限定接受最终e744 parent/7FS，P2 CLOSED/0blocking；207source/worker/capture不变。实际browser仍NOT_RUN、等待经理独立窗口；本段code/checks停止，仅正常seal与≤64KiB归档尾。

2026-10-07T21:48:54.715720+00:00：ARC-COMPOSITION-BROWSER-20261007-ONCE actual START21:48:33.219292Z，run arc-browser-20261007-214832；outer47834/parent48789/worker48882，source7e911/execution16d579，单次90s=60work30cleanup，0PG/2HTTP/1Chrome。RUNNING，无PASS推断。准入free18,282,971,136>=15,953,690,624，原件/private/tmp/arc-browser-owned-cleanup-tp1sri1w/admission.json；本status更新晚于parentclean与固定pins通过。

2026-10-07T21:50:13.121907+00:00：首browser实际21:48:33.219292Z START→21:48:46.026235Z outerterminal→21:49:26.737154Z精确FULLRETURN；0/4/0PNG。原5s连接前置Owner token定位失败，无失败DOM，不宣唯一产品根因。charge12808/90000 CLOSED、余77192不转；parent/outer1、两层stdout/stderr EOF、drop0，raw scenario context/httpclosed=true；worker result null/父场景闭合未知原文保留。exact4PID+2已知PGID/scratch/cachelinksabsent，无独立portprobe。原件[本轮入口](../../docs/evidence/wpf-workspace-arc/browser-first-20261007/manifest.json)，0重试。

2026-10-07T21:53:43.506270+00:00：[固定诊断](../../docs/evidence/wpf-workspace-arc/browser-first-20261007/diagnosis.json)确认源码入口不一致：fixture true+无recovery query选择自动Bearer FixtureWorkspace，原case却找Cookie Connection；固定base同类I01公开query惯例已核。source876731f仅URL?recovery=1+Connect to Flow可见前置，四组/默认5s/产品权限/fixture不变，0新types/纯例/HTTP/browser。无失败DOM不冒实际UI截图；[后继90s候选](../../docs/evidence/wpf-workspace-arc/browser-first-20261007/retry-proposal.json)仅proposal，原12808/90k CLOSED。

2026-10-07T21:57:00.120352+00:00：[root77c593](../../docs/evidence/wpf-workspace-arc/browser-first-20261007/root-arc-first-browser-and-cookie-entry-review-20261007.json)限定APPROVED/0blocking：首0/4FAIL和12808ms闭账、20原件、876入口修正已独立核验。修后actual NOT_RUN，无新types/HTTP/browser；本普通段源码/checks STOP，仅normal seal与≤64KiB审查尾。全20保claim，下一运行需经理独立新grant。

2026-10-07T22:20:48.337197+00:00：经理新12min/4MiB普通段于22:19:49.646Z开始，截止22:31:49.646Z。fresh f6ec clean/c34dv1 exact20/overlap[]；仅补两browser wiring验收，模型已有强例不重跑。原876候选冻结，原0/4FAIL/12808ms闭账不改；0工程child/HTTP/PG/Chrome。

2026-10-07T22:24:05.904925+00:00：固定source `d034f13da989c8f175c2664cb903a7273baf84eb`，仅browser16+/2-，两原组内加强接线判别力；[入口](../../docs/evidence/wpf-workspace-arc/browser-wiring-20261007/entry.json)。chat7为原fixture已有临时tab，max3后真实Delete并恢复原1/2/3三chat；chat4仍仅材料组首次打开。四组/两图/默认超时/207其余源与三caller不变；无新类型接口，syntax/types/HTTP/browser均NOT_RUN。原876包冻结、首12808ms CLOSED不转。

2026-10-07T22:25:50.434795+00:00：root[7379限定独审](../../docs/evidence/wpf-workspace-arc/browser-wiring-20261007/root-arc-pane-wiring-source-review-20261007.json)APPROVED/0blocking，新source d034与候选仅两wiring加强。源码/checks STOP，后续仅原≤64KiB审查归档尾；无新syntax/types/纯例/HTTP/browser。原首FAIL、旧876未消费候选及全部历史阶段不变，新90s仍NOT_GRANTED。

2026-10-07T22:28:57.982405+00:00：ARC-PANE-WIRING-BROWSER-20261007-ONCE actualSTART22:28:37.937413Z，run arc-pane-wiring-20261007-222837，outer21254/parent22024；source d034/execution1205，freshfree18049761280>=17729978368。新90=60work30cleanup，0PG/2ownedHTTP/1Chrome，无自动重试；parent raw/start已生成后才写本status，不改执行pins。原件/private/tmp/arc-browser-pane-wiring-sekaruhl。

2026-10-07T22:30:35.932058+00:00：run arc-pane-wiring-20261007-222837实际FAILED1/4/0PNG；layout-navigation含新多tab max3/恢复三chat已过，three-pane-reads:91 bodyPeak预期6实际1超时，材料Merge/两图未达。actual outer/tool1，parent/outer stdout/stderr双EOF/drop0，charge50944/90000 CLOSED/未用39056不转。22:29:52.181216Z四ownedPID/两已知PGID freshESRCH、scratch/cachelinksabsent、raw scenario context/httpclosed=true/cleanupErrors[]；worker.result=null/父scenario closureUNKNOWN及Chrome stdout/stderr EOF=false原样保留，不能宣Chrome日志完整。0PG/无独立portprobe，无新run。

2026-10-07T22:32:55.729968+00:00：只读诊断仍未定修法；响应hold必须先核同源HTTP/1连接容量与常驻SSE/patch，否则等六请求可死锁。现raw无时戳/连接世代，不能推唯一原因；root安排独立只读约束核，本owner只封原失败，源码/runtime全STOP。

2026-10-07T22:45:07.561259+00:00：经理新20min/8MiB test-only段START22:42:37.518682Z，代码/check截止23:02:37.518682Z；fresh e611clean/c34dv1 exact20/overlap[]。仅原browser+fixture及ownrecords，0HTTP/PG/Chrome；可选affected local累计20s/最多2串各15s含5cleanup尚未启动。原两browser90s均CLOSED不转。

2026-10-07T22:55:33.351554+00:00：原20min/8MiB段截止23:02:37.518682Z不延。source `c1db812ca9377117af73eb692b75fd263d9ae2c3` 仅browser/fixture133+/22-及正文一行更正；六真实UI动作、精确GET身份/六loading、逐个release、status200/fullbody/hidden零新增保留，物理serverpeak≤6与逻辑pending6分开。首fa06 noEmit3494ms PASS/精确PIDPGID31214与scratch归还；原早CLOSED原件不改，root新正文finding后经理允许第二相关复验，但fresh完整线不足而0child/0计费拒绝，不自动重试。[本段入口](../../docs/evidence/wpf-workspace-arc/body-flight-measurement-20261007/entry.json)。首run旧floor来源差异原件保真，仅事后核free高于当时完整线；未来每次直接读取经理current逐term求和。当前all18源码STOP，正常metadata尾。

2026-10-07T22:57:05.544888+00:00：root c839限定APPROVED/0blocking，正文P2 CLOSED；fa06 noEmit/第二容量0child层级不改。原source/code/checksSTOP，全18保claim；审查小件已归档，仅normal seal/push/clean与非执行HEAD数据绑定，无新runtime。

2026-10-07T23:21:42.522877+00:00：本次唯一ARC-BODY-FLIGHT-BROWSER-20261007-ONCE实际START23:19:59.320169Z，outer39624/parent40460/worker40566/Chrome41691；紧前ebcd实际remoteequalclean、claimv2 exact18/nooverlap、207/43/33固定inputs全核，free17,953,030,144>=冻结11,983,781,888。23:20:08.464216Z outer/tool1，原raw passed=[layout-navigation]故准确1/4（首口头0/4更正），0PNG；worker.result=null/父checks[]及scenarioUNKNOWN原样保留，raw context/httpClosed=true。23:20:56.284820Z四PID+两PGID ESRCH/scratch和cachelinksabsent、所有已报EOFtrue/drop0/cleanupErrors[]，无独立portprobe。ceilmax9145/90000 CLOSED/余80855不转，0新runtime；只自然封存，不改产品或测试。

2026-10-07T23:23:56.250269+00:00：root b189限定失败结果保真独审APPROVED/0blocking原样归档。21 original/archive pairs359712B与1/4、0PNG、9145CLOSED、FULLRETURN核同；产品验收仍OPEN/FAILED。本自然metadata封存后全18 STOP，后继classifier窄修等待经理新ordinary段，无重复检查或新runtime。

2026-10-07T23:37:07.258160+00:00：新10min/4MiB普通段于23:31:23.413456Z开始、23:41:23.413456Z截止；fresh c34dv2 exact18/overlap[]、972a双端clean。固定source `e621e7838d50048fcb57f5837a03e9fc474a3799`，仅两test19+/4-；真实API classifier同时用于browser/fixture，保意外/重复/非GET正文拒绝。实际12纯例PASS/noEmit0，307（toolwall向上取整；原supervisor243保留）+3408=3715/20000 CLOSED，unused16285不转；两PIDPGID/ownscratchfreshabsent、regularlog非dualEOF。早桌面图为512KiB独立observations，不计组PASS；原四group/最终390两图与总raw8MiB不变。[本次入口](../../docs/evidence/wpf-workspace-arc/body-classifier-fix-20261007/entry.json)。code/checks已STOP，只有原封套metadata尾；0新browsergrant。

2026-10-07T23:38:54.044949+00:00：root[f1f8限定独审](../../docs/evidence/wpf-workspace-arc/body-classifier-fix-20261007/root-arc-classifier-source-review-20261007.json)APPROVED/0blocking。12pure/affectedtypes0与新候选仅准备批准，新browser NOT_RUN无grant；三旧FAIL原件/预算不变。fresh Git index2,286,387B一次atomic copy+source/meta/TMP+64KiB审尾保守2,722,909B<4MiB，64KiB不是commit全峰值。all18STOP，正常seal后候选交经理，不自动运行。

2026-10-07T23:50:38.307228+00:00：ARC-CLASSIFIER-BROWSER-20261007-ONCE actual START23:50:10.841065Z，outer22231/parent22799/worker22887，sourcee621/executiona322，freshfree17912885248>=冻结11977490432。207/43/33/claimv2exact18实际remoteclean及新namespace通过，parent已启动worker后才更新status。90=60work30cleanup，0PG/2HTTP/1Chrome；RUNNING不推通过，原件/private/tmp/arc-browser-classifier-4s522h4u。

2026-10-07T23:52:49.288843+00:00：本次23:50:10.841065Z START→23:51:01.826066Z terminal1→23:51:28.680683Z exactFULLRETURN。真实passed=[layout-navigation,three-pane-reads]，prepare-await-stable在arc-A radio5s超时，refresh-theme未达。独立桌面图75641B、最终390图0，root9605实际视觉P2：Arc顶栏大空白；runtimecomputedstyle未取样。outer/parentEOFtrue/drop0、Chromeexit0，rawcontext/httpClosed/errors[]；worker.resultnull/父scenarioUNKNOWN保留。4PID/2PGID/scratch/cachelinksabsent，无独立portprobe。ceilmax50986/90000 CLOSED/余39014不转。[原件入口](../../docs/evidence/wpf-workspace-arc/classifier-browser-actual-20261007/failure-review-input.json)。只自然封存，无产品/test修复，无重试。

2026-10-07T23:58:36.144826+00:00：新15min/8MiB普通段START23:53:58.039959Z→截止2026-10-08T00:08:58.039959Z。fresh c34dv2exact18/overlap[]；固定 `b3f5bed1a17019d1de01117f3a510314d5ecd412` 四源29+/8-。Arc outer与六descendant selector独立命名，未改右侧WorkspacePanels或sharedschema、未加高度硬盖；原layout组加入右侧开/Terminal/关后自然行高/top不变检查。fixture displayName空格为已确证公共codec拒绝，改合法arc-A；AST真实DTO旧拒/新过2PASS，Node62844/组/scratch归还、645/20k CLOSED，未用不转；无新类型接口故noEmitNOT_RUN。实际Chrome两EOFfalse、parent/outerEOFtrue及parentUNKNOWN/rawclosed分别保留，root282c失败保真审归档。[当前入口](../../docs/evidence/wpf-workspace-arc/css-material-fix-20261007/entry.json)。code/checksSTOP，新90仅proposal，无grant。

2026-10-08T00:00:11.140034+00:00：root[4467限定源码/局部/准备审](../../docs/evidence/wpf-workspace-arc/css-material-fix-20261007/root-arc-css-material-source-review-20261007.json)APPROVED/0blocking；207源4变203同、43/33与3caller不变。新视觉实际/原完整四组/390双图仍NOT_RUN，无自动窗口/不借旧余额；Arc导航独立plugin slot后继未实现，不能冒全MATURE05完成。all18STOP，正常seal/pushclean后交经理READY。
