# Arc 固定实现与必要验证入口

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
