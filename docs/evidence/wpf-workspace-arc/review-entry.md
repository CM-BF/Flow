# Arc 固定实现与必要验证入口

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
