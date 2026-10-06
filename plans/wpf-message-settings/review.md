# WPF-MESSAGESETTINGS01 独立审查

**状态：APPROVED — 限受控Picker源码与fixture浏览器证据，固定main已接收。**

Review target commit：270cfdfa2bcbd04ef62a6ad3ecbc22358db32d67。新目标仅browser的named group/count/visible窄修，已获[Root限定源码复审](../../docs/evidence/wpf-message-settings/root-270c-locator-source-review.json) **APPROVED_SCOPED_LOCATOR_SOURCE_NOT_RUN**，0blocking、P2 SOURCE_ADDRESSED；本次b5已复验通过且获[Root限定证据批准](../../docs/evidence/wpf-message-settings/root-browser-b5-runtime-review.json)，0blocking。原1cd的b2初始化失败和b4真实fixture首定位器失败原样保留；root已接受b4失败与清理并确认P2已source addressed；当前leaf范围APPROVED，真实App接线/成熟快速选择及MATURE02整体不在该批准内。Base：8d84d529a0756116bd0fc8bad969d61a6c26248e。
历史f3限定源码结论：**APPROVED_SOURCE_SCOPED_NOT_RUN**，不自动批准上述新目标。Root 于 2026-10-06T18:25:38.301159Z 完成 f3a6 复审，源码无 blocking。该结论为18:25源码审查时点；后续 strict noEmit/direct37 的限定证据已独立接受，后续浏览器入口首次执行在CDP前失败、0界面断言，不构成完整功能或 main/deployment approval。

## 已执行的源码审查与历史

Root 对初版 `ed769f929a7efe01a279ddd85c2e1e88b46839e6` 只读源码检查指出 P2：当前草稿区的连续长 requested.model 没有 min-width/overflow-wrap 保护，390px Dialog 可能横向溢出。此为源码发现，未执行浏览器，不伪称实跑红。

Owner 在 `f3a6a7ec89d5b3f789c49b0d8662401b23032ab2` 仅给既有 section 添加 minWidth:0 / overflowWrap:anywhere，并将 disabled thinking 明确显示“关闭思考”、effort 映射中文。browser 只同步“力度高”文本，原180字符 model、390几何/焦点/A-B-C验收全部保留。Root 已独立核对修复，P2 为 ADDRESSED_IN_SOURCE；该审查时点真实390运行尚为NOT_RUN，现b5实际结果在末节单独绑定。

Root 转述 peer 对 catalog/selection/direct 源码未发现 blocking；此不是产品测试通过或完整 leaf approval。原件已逐字归档：[root](../../docs/evidence/wpf-message-settings/root-f3-source-review.json)、[peer](../../docs/evidence/wpf-message-settings/peer-ed769-source-review.md)、[peer audit](../../docs/evidence/wpf-message-settings/peer-ed769-source-audit.json)。

## 审查入口

[计划](plan.md)、[状态](status.md)、[当前六源绑定](../../docs/evidence/wpf-message-settings/source-manifest.json)、[初版绑定](../../docs/evidence/wpf-message-settings/source-manifest-initial.json)、[Interface](../../docs/evidence/wpf-message-settings/interface.md)。核公共 tuple/capability、旧目录兼容、取消代际、受控选择和 details 关闭焦点回调。当前目标仅named group/count/visible窄修已限定批准，原f3类型/direct检查已完成；b2准备/历史b4失败各自保留；最新b5实际4/4与两390截图已获Root独立证据批准。真实App/Send/Queue/Recovery后继。

## 已执行的运行证据独立核验

[首次 raw](../../docs/evidence/wpf-message-settings/checks-first-observation.json)绑定 f3a6/85aba：strict noEmit exit0，两 direct37/37。监督器 expected20 漏计17个参数化用例，原父 FAIL、binding/gate/raw 保留。[Root限定证据审查](../../docs/evidence/wpf-message-settings/root-direct-evidence-review.json)已核实际21+16项、六源码及原raw，接受类型/direct PASS与独立父计数错误分类；并未重跑产品。无 pending计数判断或本地重试。

## 浏览器首次准备限定审查（历史）

Root 于18:48:17 UTC给出[APPROVED_BROWSER_PREPARATION_SOURCE_SCOPED_NOT_RUN](../../docs/evidence/wpf-message-settings/root-browser-preparation-review.json)，peer给出[APPROVED_WORKER_SOURCE_SCOPED_NOT_RUN](../../docs/evidence/wpf-message-settings/peer-browser-worker-review.md)。最终 supervisor 删除scratch前采样且结果写后复核；[初稿 P2](../../docs/evidence/wpf-message-settings/root-browser-supervisor-initial-review.json)与[窄修差异](../../docs/evidence/wpf-message-settings/browser-preparation/final-resource-sample.diff)分别保留。完整源/依赖/准备脚本 pins 见[归档索引](../../docs/evidence/wpf-message-settings/browser-preparation-archive.json)。

以上为运行前SOURCE_SCOPED批准。随后首次入口已按独立gate执行，实际结果见下节，不能把准备批准当运行通过。完整 feature 顶层 UNKNOWN 保持，main NOT_INTEGRATED。已冻结 A/B 样本只属本地 capture，不代表实际 Send/Queue/Recovery。

## 首次浏览器入口运行（已限定独立证据审）

[原始记录](../../docs/evidence/wpf-message-settings/browser-first-observation.json)绑定 f3/f800，5197ms、父FAILED，0行为断言/截图。Chrome在CDP readiness前退出；原日志含ProcessSingleton目录失败及Crashpad写入拒绝，Vite另报自动扫描非fixture图依赖未解析。尚无产品UI行为红/绿结论。ownPGID/Chrome/fixture/scratch清理均确认、无错误，窗口已归还，未重试或扩大权限。完整feature仍UNKNOWN；strict noEmit/direct37证据及父计数FAIL各自保留。

## b2窄修限定审查及其后运行

目标 `1cd5cd41e47c8c101d9bb1acfdca1e870769c014` 只将Vite optimizeDeps.entries指定为已有实际fixture。新 `/private/tmp/msgset-b2` 保留原first预算与raw，只修Mac临时目录/owned socket范围和Chrome退出证据；[源码准备](../../docs/evidence/wpf-message-settings/browser-repair-preparation/report.md)与[完整归档](../../docs/evidence/wpf-message-settings/browser-repair-preparation-archive.json)供独审。此段为19:10准备时点，当时没有新gate/运行；原f3批准、37direct和5197ms失败分别绑定原目标，后续第二次准入结果见下段。[Root首次证据审](../../docs/evidence/wpf-message-settings/root-first-browser-evidence-review.json)原样保留，不能将父worker code推作Chrome code。

2026-10-06 19:19:59 UTC：已原样归档[Root b2准备限定批准](../../docs/evidence/wpf-message-settings/root-browser-b2-preparation-review.json)，不冒行为批准。第二次实际[raw与观察](../../docs/evidence/wpf-message-settings/browser-second-observation.json)绑定1cd/b41c，8551ms、累计13748、Chrome实际SIGTRAP且CDP初始化未完成，0界面断言；完整清理已确认。该b2运行后已获[Root限定证据核验](../../docs/evidence/wpf-message-settings/root-browser-b2-runtime-review.json)，只接受失败尝试与清理事实，不将source approval/noEmit/direct37升级完整功能批准；首次失败和原budget均保留。

## 2026-10-06 20:09:02 UTC b4真实fixture首定位器失败（已限定证据核验）

[原件/哈希索引](../../docs/evidence/wpf-message-settings/browser-third-observation.json)绑定同1cd/18ede。本次native边界已有精确接受，成功CDP连接/展示picker；browser.ts:81的group locator匹配4处而strict失败，checks=[]，未改断言/自动重试。父6861ms、累计20609/余39391，两个独立owned PGID与scratch清理完整。仅报告原事实，不自批整体；本轮不重跑types/direct37，完整feature UNKNOWN/main NOT_INTEGRATED。

## 2026-10-06 20:11:18 UTC locator修复复审入口（历史提交时点）

只读 `270cfdfa2bcbd04ef62a6ad3ecbc22358db32d67` 相对1cd的browser单点delta及[来源审计](../../docs/evidence/wpf-message-settings/browser-locator-fix-source.json)：named fieldset group恰1且visible，Adapter否定断言与其余行为原样，其他五源/19原件不变。[Root b4证据审](../../docs/evidence/wpf-message-settings/root-browser-b4-runtime-review.json)是实际失败与清理接受，不是本新delta批准。请勿运行旧consumedgate；预算20609/39391保持，新源码未运行。

## 2026-10-06 20:19:12 UTC 限定源码复审结论（历史）

Root于20:12:51.320495 UTC独立核固定270c的三行locator差异、六源hash与原b4十份证据子集，结论[APPROVED_SCOPED_LOCATOR_SOURCE_NOT_RUN](../../docs/evidence/wpf-message-settings/root-270c-locator-source-review.json)、0blocking。原b4 strict4失败、19份owner归档、历史37/types及父计数FAIL保持；未运行新源码或继承行为通过。完整feature顶层UNKNOWN，browser复验/main接收/实际App接线仍待。

## 2026-10-06 20:38:50 UTC b5准备审查及接受范围（历史）

270c locator源码已审；[b5软停止修复](../../docs/evidence/wpf-message-settings/root-browser-b5-repaired-review.json)已于20:34:01 UTC由root限定批准，0blocking，状态APPROVED_SCOPED_PREPARATION_NOT_RUN。handler记Cooperative stop/FAILED、终态与exit排stopping、outer finally恢复handlers并封存晚到stop；此前[补审P2](../../docs/evidence/wpf-message-settings/root-browser-b5-soft-stop-addendum.json)关闭为SOURCE_ADDRESSED。初批与旧边界接受原件仍保留，不将旧审批移绑新字节。

[当前精确boundary](../../docs/evidence/wpf-message-settings/browser-b5-repaired-native-boundary-acceptance.json)由root依既有GO授权记录，parent ea3c / worker71a643；[当前候选与pins](../../docs/evidence/wpf-message-settings/browser-b5-preparation-archive.json)仅准备归档，PREPARED/no gate。Root的AST/源pins核验按其报告归因，owner未运行新parser/产品。实际第三次b4仍FAIL/0完成checks，累计20609、余39391；新b5未运行，完整feature顶层UNKNOWN、主线与实际host接线未完成。

## 2026-10-06 20:47:23 UTC b5实际证据复核入口（历史交审时点）

只读[原件/索引](../../docs/evidence/wpf-message-settings/browser-fourth-observation.json)：impl270c/实际0925，parent8267ms/PASS/实际exit0，worker4/4checks、两张390浅深截图、pageErrors[]，双owned组与scratch清理完成。累计28876/余31124，旧三次失败与noEmit/direct37/父countFAIL各自保留。完整native精确边界接受与gate在原件中，绝不由通过结果补造许可。

作者只封存事实、未自批；本次controlled组件+synthetic HTTP目录不覆盖生产App/Send/Queue/Recovery/provider。源码准备批准与运行证据批准分开，当前独立运行证据审PENDING；本片完整review顶层UNKNOWN/main未集成。

## 2026-10-06 20:50:09 UTC 独立结论与严格范围（main接收前历史）

Root固定证据审[APPROVED_SCOPED_CONTROLLED_PICKER_BROWSER_EVIDENCE](../../docs/evidence/wpf-message-settings/root-browser-b5-runtime-review.json)，20:48:11.224265 UTC，0blocking；target270c、actual0925、ea3c/71a643绑定。6源/gate与consumed/取消gate隔离、4checks/两390截图、实际exit与双group/EOF0drop、28876累计均独立核验。Root仅复读原件与目视保存截图，未重跑browser/types/direct。

该结论支持受控组合选择leaf的行为/清理证据，不支持生产App发送、排队、Recovery或真实provider，也不代表成熟快速模型/力度/速度选择、大目录体验、全MATURE02或主线/个人预览已经完成。旧初始化与strict定位器失败、父20vs37countFAIL和原raw保持原判，不用新成功改写历史。当前唯一待接收步骤为本leaf主线集成，后继UI/host范围另行管理。

## 2026-10-06 21:25:59 UTC 当前主线接收结论

[Root独立原件](../../docs/evidence/wpf-message-settings/root-main-integration-review.json)为APPROVED_SCOPED_MAIN_INTEGRATION_WITH_NONBLOCKING_RECEIPT_REFERENCE_NOTE，固定main `c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05`；六源等获审270c，15直接消费者输入未变。本人[来源核验](../../docs/evidence/wpf-message-settings/main-close-observation.json)确认六源/main/current及原回执hash；不扩大原37/direct与4/browser的证据范围、不重跑。

[Lead原回执](../../docs/evidence/wpf-message-settings/main-component-receipt.json)三个相对审查路径由Root解析到main包含的同hash原件；非blocking导航问题留原Execution Lead处理，owner不修改I02。当前受控组件review与main接收完成，完整App/P01/Send/Queue/Recovery、成熟快速选择及父MATURE02仍开放。提交并确认clean后八范围全停写，manager release后不追加metadata。
