# Current Arc review

状态: PENDING — current bounded geometry continuation
Review target commit: 7b297a226e56b5e020f05b027a8e6fc27fcc4245

当前唯一组合：[geometry入口](narrow-geometry-20261008/entry.json)。新被动geometry/错误截图与实际8rem口径已fixed，受影响types0/3572ms；新browser最多3次/270k尚未开始。当前CSS与全部close/四组断言不变，旧失败/P2继续，最终同段一次独审。

## 历史固定目标与原件

状态: APPROVED — result fidelity only; visual acceptance BLOCKED
Review target commit: 6ac91bace38e39ade654e98e86d0d513af8255cf

当前唯一组合：[root一次独审](narrow-tab-visual-20261008/root-final-review.json)，**RESULT_FIDELITY_APPROVED_WITH_VISUAL_ACCEPTANCE_BLOCKED**。[固定结果输入](narrow-tab-visual-20261008/final-review-input.json)与68原/归档pairs逐hash核同。两次实际均3/4 FAILED，0finalPNG/各early1；closeviewport仍0.02，视觉P2 OPEN。48670ms browser/3573ms scopedtypes全部CLOSED，0runtime/无第三次。

第二geometry显示普通标题117px已完整、动作单行/无纵向clip，但关闭按钮完整可见失败；后置titleWidth>=128也有静态P2（root14px与8rem不支持固定128px），该断言未达，不能冒实际第三项失败。后继须采close/tab/strip真实rect与scrollLeft/font/clip祖先和失败390图再修，不改全局字体或盲猜scroll-padding。close为tabIndex=-1，当前验证只到More actions键盘焦点；不能宣称下一Tab可达close，既有Delete替代另保留。

当前限定审不表示新视觉通过或可完整交付。main/Context、真实中心安全/native/provider/个人部署仍未集成或未验证；历史f6四组PASS不覆盖本新P2。

## 历史固定目标与原件

状态: APPROVED — limited functional fixture acceptance; visual P2 OPEN
Review target commit: f6c17be503ab68262a789c96429a7cc44975c8bb

当前唯一 target `f6c17be503ab68262a789c96429a7cc44975c8bb`：**APPROVED_LIMITED_FUNCTIONAL_FIXTURE_ACCEPTANCE_WITH_OPEN_VISUAL_P2**（[root b514独审](material-tooltip-continuation-20261008/root-final-review.json)）。真实App受控HTTP末次四组同轮PASS，final390双图/earlydesktop1，affectedtypes0；[固定结果输入](material-tooltip-continuation-20261008/final-review-input.json)。本新段首FAIL3/4保留，browser40912/local3595全部CLOSED。产品源码未因本测试修复改变。main/真实中心安全/runner/provider/个人部署未集成或未验证；不外推父task全验收。

视觉P2 OPEN（root实际查看末次双图）：固定36px tab栏内标题缩为Co/Cc、More actions换行裁切；功能四组PASS保真，完整窄屏可用性尚未完成。后继仅原layout.css范围候选；本段不追加修复或第三次运行。

## 历史固定目标与原件

下文原“当前/NOT_RUN”等均仅属其记录时的历史目标，不覆盖上方唯一当前组合；原件内容不改。

当前限定独审：[root89fde](continuous-acceptance-20261008/root-final-review.json)，证据保真通过，产品仍2/4 FAILED。

当前唯一输入：[continuous final-review](continuous-acceptance-20261008/final-review-input.json)，source d7e0b6f，3次/59595ms CLOSED、均2/4，最终结果未通过。历史入口以下保留，不冒本轮通过。

当前连续段 `6ca0ed7ac01a0b4f3ad21d5c3536a56b857eb477`：两test修chat4队列前置/有帽诊断，产品未改。8c36实际8相关purePASS/654ms，最终诊断catch小差量未重复绿检查。browser NOT_RUN/等待经理lease，最终一次独审待actual；不复用旧2/4为当前通过。[入口](continuous-acceptance-20261008/entry.json)。

下文均为历史固定记录。

固定 `b3f5bed1a17019d1de01117f3a510314d5ecd412` / execution `fcca6ec4c926241365c7a2cc18b6a044604e44e7` 本次真实浏览器 **FAILED2/4**。布局与六正文读取通过；导航高度37.3828px，右panel开关前后不变，早图原450px空白消失。材料组通过设置目录后停在Send disabled5s，实际prepare-await未进入，refresh/theme与最终两图未达。早桌面1PNG/85127B只observation；20654/90000 CLOSED，四PID/两PGID及scratch/cache已精确归还，parent scenarioUNKNOWN与rawclosed分列。本次Chrome/parent/outer EOF均true；前次false不改。root4467只批准source/local/preparation，[root908b实际结果/视觉独审](css-material-browser-actual-20261008/root-arc-css-material-actual-review-20261008.json) APPROVED_LIMITED/0blocking；CSS视觉P2实证修复，整体仍FAIL；main未集成。 [唯一实际审入口](css-material-browser-actual-20261008/failure-review-input.json)。

以下为历史固定阶段，旧“当前/NOT_RUN”保留其当时含义。

Source `b3f5bed1a17019d1de01117f3a510314d5ecd412` APPROVED limited source/local/candidate (root4467). [CSS namespace/profile codec fix](css-material-fix-20261007/entry.json). Actual purecodec2PASS/645ms; newbrowserNOT_RUN/NOT_GRANTED. [Prior2/4 failure and visualP2](classifier-browser-actual-20261007/failure-review-input.json), root282c fidelity review archived separately.

# Current Arc actual review

[Fourth actual failure input](classifier-browser-actual-20261007/failure-review-input.json). Fixede621/executiona322: FAILED2/4, earlydesktop1PNG/final0. Root9605 actual visual P2 OPEN. No new runtime/source mutation. Main NOT_INTEGRATED.

# Current Arc review entry

Source `e621e7838d50048fcb57f5837a03e9fc474a3799` / APPROVED limited source/local/candidate preparation (root f1f8). [Classifier correction and local evidence](body-classifier-fix-20261007/entry.json). Pure12PASS/affectednoEmit0 only; browser NOT_RUN on this target. Previous c1db browser1/4FAIL preserved [here](body-flight-actual-20261007/failure-review-input.json). Original product/13pure/2HTTP acceptance retains its exact previous scope. Main NOT_INTEGRATED.

当前 actual：`c1db812ca9377117af73eb692b75fd263d9ae2c3` / execution`ebcd746e8e74881395e61f43ab444de48b62a51c`，**FAILED1/4、0PNG**。仅layout-navigation通过；body observer误分类Vite模块导致three-pane前置失败，后两组未达。9145/90000 CLOSED/余80855不转；精确FULLRETURN23:20:56.284820Z。[本轮failure-review-input](body-flight-actual-20261007/failure-review-input.json)，[b189结果保真审](body-flight-actual-20261007/root-arc-body-flight-failed-result-review-20261007.json)APPROVED仅失败证据/RETURN，产品验收仍FAILED。source/preparation c839批准和旧两browser失败各保原范围。

# Arc 固定实现与必要验证入口

当前组合 `c1db812ca9377117af73eb692b75fd263d9ae2c3`，限定source/preparation APPROVED，见[root c839](body-flight-measurement-20261007/root-arc-body-flight-source-preparation-review-20261007.json)；claim v2 exact18，App/session只读固定供给。新[测量差量入口](body-flight-measurement-20261007/entry.json)，207执行源仅两test变、205其余/43外部/33resolver/三caller不变；六逻辑pending+六loading与实际serverpeak分层，不从HTTP1容量推产品bug。新browser未运行，首fa06 noEmit0/3494，第二容量拒绝0child。完整来源审计见[resource-audit](body-flight-measurement-20261007/resource-audit.json)。以下“当前”皆历史固定目标。

最新实际 `d034` / execution1205：**FAILED1/4，0PNG**；layout-navigation通过，three-pane-reads在bodyPeak6实际1处失败，后两组未达。50944/90000 CLOSED，不转余量。见[本轮manifest](browser-pane-wiring-actual-20261007/manifest.json)与[只读首因诊断](browser-pane-wiring-actual-20261007/diagnosis.json)。原首0/4FAIL不覆盖，以下准备时“NOT_RUN”仅历史；无新运行授权。

当前固定组合 `d034f13da989c8f175c2664cb903a7273baf84eb`；base `f8853d4731eb6229337279079c24617c97d4f56b`，claim20（18产品/test+两metadata）。最新仅browser两wiring断言16+/2-，差量独审[root7379](browser-wiring-20261007/root-arc-pane-wiring-source-review-20261007.json)APPROVED/0blocking；[本次入口](browser-wiring-20261007/entry.json)含207运行源pin的单文件变更、43外部/33resolver和三个原caller复用证明。未新增产品权限或运行授权。

| 证据层 | 当前事实 |
| --- | --- |
| 原产品/局部 | 891f source/local已root afb555通过；13纯例/34未选、affected types，旧红保留 |
| FIFO HTTP | 第三同轮2PASS/11未选，root e524限定通过；旧两FAIL不能拼PASS，request trace未留存 |
| owned cleanup caller | e744/7FS、root2b2f批准；原6FS结果保留，不冒任意恶意并发原子安全 |
| 首真实browser | source7e911为0/4、0PNG、12808/90000 CLOSED、完整资源RETURN；worker result null/父资源UNKNOWN与raw清理成功分列 |
| 后续修正 | 876公开Cookie入口已root77c批准；本次d034补max3多tab与Merge中间态，四组/双图仍NOT_RUN |
| 集成 | main NOT_INTEGRATED；无真实PG中心安全/runner/provider/个人部署结论 |

下文均为原样保留的历史检查点，旧“当前/尚未review/NOT_RUN”仅描述其当时状态；本节为最新组合。

## 历史来源与检查点

目标 `891f478cb0823f2ff1d02c75abefd1485bb826b6`，base `f8853d4731eb6229337279079c24617c97d4f56b`；exact18源码/test见[source-manifest](source-manifest.json)。独立review尚未执行；原claim20只另含自身两metadata。

12产品路径：App唯一有界布局writer、稳定key共同composer父级；max3/第四拒绝、max8workspace/32open refs、namespace布局恢复；P01实际conversation/pane上下文、App私有live布局lease；2stream slots在完整batch后FIFO保留等待者，hasMore续读。6test路径包括新13纯例/2HTTP例/4browser组。

当前local [manifest](local-20261007/manifest.json)：累计18020/60000ms CLOSED，未用41980不转用。首direct8PASS但App5模块加载失败；首types exit2保留。固定base补6 readonly依赖29557B（多点文件名resolution遗漏）与2测试类型修正后，13PASS/34NOT_SELECTED；最后types-3 exit0/空log，17TS/TSX+staticimports，只受影响稀疏闭包，不冒wholeWeb。regular file logs不是dualEOF。5精确PID/PGID freshabsent，scratch absent。

Root静态P2 [original](root-arc-layout-confirmation-static-finding-20261007.json)：原关闭在显示确认前consume旧lease，真正确认只比view.key。现私有LayoutCloseAuthorization先prepare，确认同栈check原plugin signal/layout/auth并一次commit；原生close不需插件授权。App-port第5实际纯例经真实PluginHost/AppLayoutPort，确认请求返回后disable/re-enable、layout ABA、auth变化全部拒旧commit，fresh commit一次。浏览器只有有效公开modal确认/保稿与重开方案，未模拟绕modal后台操作，不冒失效确认mounted实证。

HTTP2与browser4全部NOT_RUN。[runtime proposal](runtime-proposal.json)不是grant。浏览器有真实long transcript消息锚点、他pane更新、resize、focus、真实adapter准备中move/merge/split、A冻结/B完整refs、6显式bodyflight和真实390双theme源码；没有实际截图。剩余风险：共享projection fairness、隐藏撤销/scroll测高、真实官方composer准备lifetime都需要actual。fixture是假Cookie/公共合成HTTP，不是PG/真实中心安全、runner/provider、个人发布。MATURE05-04/06不在此片完成。

旧I01/MSG/Recovery/ACCESS均released且没有写入。原源码供给f885不漂movingmain，无安装/共享Gitconfig修改。main NOT_INTEGRATED。

## 2026-10-07 runtime preparation checkpoint

Current source `7097c4d1cc429ee87e507a2210f2e9cceac99b56` (one browser file delta from891f; other17 exact). Root source/local approval afb5559 retained. New affected noEmit0,4683ms/20s CLOSED; no original13rerun. Prepared HTTP2 and originalbrowser4 are NOT_RUN/NOT_GRANTED. Reduced-motion observation belongs to refresh-theme only. [Entry](runtime-preparation-20261007/entry.json), [source/local review](root-arc-source-local-review-20261007.json).

2026-10-07T20:42:30.368488Z：当前固定source fe7f18d564baaea7ed3ec87bedf49bd805cbdf10，原source/caller审批与首HTTPFAIL保留。见[窄修入口](http-waiter-fix-20261007/entry.json)。唯一修改test，修后HTTP与browser未运行；source/actual层级不混写。

2026-10-07T20:50:23.889173Z：第二HTTP原件见[manifest](http-second-20261007/manifest.json)：修后hiddenPASS/backlogFAIL，2652CLOSED。source仍fe7，0额外runtime，当前整体FAILED/待根actual与归因。

2026-10-07T20:54:44.938055Z：当前source 7e911df40d8c0ff875ac96e0fab36a1a3a253940 与[batch-boundary入口](http-fifo-boundary-20261007/entry.json)待集中审；仅test改变，两个原FAIL不改写。修后type0不是HTTPPASS，第三候选无grant。

2026-10-07T21:06:54.437128+00:00：7e911 root11e317限定源码与local/caller准备批准归档于browser-refresh-20261007；原browser四组选定/双图/生命周期不变，本次新包仅source/test1pin/HEAD/路径/floor数据差量。HTTP两FAIL与browserNOT_RUN保持。

2026-10-07T21:22:36.031590+00:00：最新HTTP第三2PASS/11未选与精确RETURN见[http-third](http-third-20261007/manifest.json)；两旧FAIL完整保留。browser4/2PNG未运行，详细requesttrace NOT_RETAINED，root e524限定actual独审APPROVED。

2026-10-07T21:23:22.849273+00:00：固定[root第三actual审](http-third-20261007/root-arc-http-third-result-review-20261007.json)5523B/e52471b4已归档，raw保持；本自然批结束无运行预约。