# WPF-RELEASE01 真实产品 Web 发布兼容验证

状态：in-progress（原REQ19新增用户可见Recovery网页后继；前片段工程验证与主线接收完成）；原7805交付保持历史完成。直接父WPF-MATURE-01与co-lead沿唯一status。新后继经合法交权在web-release-recovery固定7272落地两产品，现产品已交回、以exact4继续同任务，不创建第二发布系统。

## 历史：三保留App固定origin片段

复用原两harness及公共发布接口，三份immutable App→同一最终backend/context。实际App保持Bearer，独立Cookie/CSRF为补充来源；format1 artifact可用format2 compatibility report但不补releaseId。固定origin61228仅从受控Chrome真实页面访问，精确ownedproxy转自有动态center；Node/PW APIRequestContext不能访问61228。禁止rebuild/install/个人连接/旧tuplefallback。设计及精确输入见[报告](../../docs/evidence/wpf-release01/fixed-origin/report.md)，已审网络补充见[design-review](../../docs/evidence/wpf-release01/fixed-origin/design-review.json)。

- [x] RELEASE01-01 历史固定双版本构建与隔离center/runner。
- [x] RELEASE01-02 历史两App四类兼容证据。
- [x] RELEASE01-03 历史独审/main接收。
- [x] RELEASE01-04 实现显式最终输入、严格代理、真实浏览器请求、流式SSE/ACK故障和有界清理。
- [x] RELEASE01-05 完成必要源码/局部检查；最终tuple及合法资源段到达后真实三App四项compat与独立Cookie补证。
- [x] RELEASE01-06 后继独审与主线接收；个人发布由原operator独立交付。

模块职责：fixture唯一拥有输入校验、owned DB/center/proxy/静态bytes/公共runner；browser只真实UI旅程和独立page内session探针；既有web-release工具拥有最终报告codec/import/verify。缺供给与unknown清理显式失败，不维护第二权威。不导入未来未知runtime，也不借旧dist。

验证按局部影响：先固定源码与精确依赖/定向types或pure检查提案，实际运行另有界段；不全库、不继承旧结果。发布报告只有四raw真值、真实source/context/asset绑定与成功清理后可接收。

## 历史已交付计划（原件保留）

见[7805计划原件](../../docs/evidence/wpf-release01/fixed-origin/previous-plan.md)。其中build方法不再作为后继入口。

## 历史执行记录（保留当时事实；当前结论见唯一status）

历史首段2026-10-07：f3d限定源审0blocking；唯一strict检查发现adapterVersion声明过宽，9658仅type-only公共接口修正，NOT_RETESTED。首失败/1170ms/完整清理保留；暂停本四scope写入并保claim，管理顺序先DPERF收口，后独立10s必要复验。

历史类型安全点：9658源码delta已独立接受，必要strict复验exit0/904ms；原首红不改。RELEASE01-05的最终tuple/公开策略已核齐，caller源码准备已固定并通过c2集中独审，待实际资源准入；三App真实兼容仍NOT_RUN，不把类型检查当四check通过。四scope本批seal后停写，38b9v1保留，无运行预约。

历史调用准备：[资源、真实网络与清理合同](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/README.md)。重用既有fixture/report codec与DPERF自有双组生命周期；延迟Chrome握手仅为取得真实owned代理端口，不新增发布平台。标准Python语法和文本/pin核验是静态准备，非产品行为通过。

调用器c2准备已处理独立审查的目录ownership/P1与pg-boss连接声明/P2，真实helper三边界小额检查通过；详见[c2当前记录](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/README.md)。三App运行仍在RELEASE01-05未完成项，原c1及全部历史错误保留。

c2集中审与native固定边界已接受（0blocking），原件见[c2记录](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/README.md)。RELEASE01-05仍需真实三App/Cookie验收；不以source/helper通过提前完成。

首次c2实际已执行但sandbox启动前FAILED，未触三App/PG/Chrome。保410ms一次段、179590ms未用与完整清理，见[原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/README.md)。RELEASE01-05仍开放，须先处理这个具体caller语法缺陷；不放宽个人61228网络边界或以未知清理算通过。

c3仅修非法sandbox host，真实生成profile一次true语法检查通过/47ms/清理完整。见[c3记录](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/README.md)；集中delta/native审与真实compat仍待，RELEASE01-05不勾选。

c3准备source/native独审已接受，管理新独立一次180sNEXT，紧前fresh/gate后才实际；原三App TODO05仍开放，无旧信用转移。

c3唯一实际已完成三App各四项与独立Cookie检查，actual exit0/23495ms/完整清理。原失败保留，等待独立证据审及RELEASE01-06主线接收，不自动追加运行。

## 历史：前片段交付

[独立实际批准与主线接收](../../docs/evidence/wpf-release01/fixed-origin/main-close/README.md)已完成；188后继路径同c06fa。保失败、不重跑已绿检查，个人更新/后继后台不扩称。

## 历史准备：新版Cookie网页后继（2026-10-07；当前见末尾artifact安全点）

- [x] RELEASE01-07 在原fixture/browser加入首固定7272新版App入口（后继精确pair供给规则见请求），Cookie连接/刷新恢复/原key ACK与迟到logout真实HTTP链；保旧3App/Bearer及4check。
- [ ] RELEASE01-08 本组供给唯一新Web descriptor，与已到修正后台组成精确输入；有界兼容与集中独审后交原operator发布，不借旧tuple/PASS。
- [x] RELEASE01-09 在固定7272应用已审最小共享草稿两file并做直接旧consumer必要验证；不移植完整MSG/Plugin。

[已审只读设计](../../docs/evidence/wpf-release01/recovery-cookie/design-input.json)。旧3报告必须对新backend/context重新产生；新App不伪为Bearer。仅原4scope，0产品检查/PG/Chrome/build/install，缺产物失败关闭。

本后继首固定源码8964dc1185f62ed8934c15416e9798929359ab89；RELEASE01-07仅源码完成，必要strict已单次通过，root集中限定源码/局部实际审查已APPROVED，故RELEASE01-07完成。结构与数据输入见[本段入口](../../docs/evidence/wpf-release01/recovery-cookie/README.md)。

当前后继源/strict独审见[原件](../../docs/evidence/wpf-release01/recovery-cookie/root-source-local-review.json)。RELEASE01-08仍未完成；[明确供应字段](../../docs/evidence/wpf-release01/recovery-cookie/supply-request.json)由Original提供，后续实际再独立验收，不视为发布完成。

当前供给决策：04da/6c-base后台不可变descriptor与固定artifact结果已获Original限定批准，见[后台供给](../../docs/evidence/wpf-release01/recovery-cookie/backend-cd27-supply/README.md)。精确7272两file静态移植已获Root批准；只缺原唯一producer的新Web descriptor。RELEASE01-08仍pending：旧consumer实际/新pair兼容/发布未运行；不捆绑整个MSG03/Plugin，不在metadata批改8964 guard。

[两file旧base最小移植准备](../../docs/evidence/wpf-release01/recovery-cookie/held-transplant-preparation/report.md)只在TMP核固定patch/result；RELEASE01-08仍pending。生产两literal仍MSG持有，需原owner移交或Original受控集成，不由Release原4scope擅写。

## 历史执行交接

见[唯一source-switch](../../docs/evidence/wpf-release01/recovery-cookie/source-switch/README.md)。旧树与MSG范围已实际交回，新exact6不包括App/Thread或共享配置/依赖。只应用77bc两file，预计hash802e/728a；必要检查和artifact build仍待有界安排。此前关于Original生产接单与MSG持有范围的文字为历史准备条件，已由本次交权替代。

本次仅两file与旧consumer定向检查已完成，见[实际证据](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/README.md)。RELEASE01-08的独审/新artifact/兼容/发布继续开放；本地普通段6165ms关闭，未用余额不是新运行许可。

当前d736两产品及定向用例/局部实际已获[root集中APPROVED](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/root-source-local-review.json)，RELEASE01-09完成；两产品STOP并按账本partial amend交回。RELEASE01-08继续唯一producer的固定Web artifact准备，descriptor仍NULL；本地6165ms关闭，无build/PG/Chrome新许可。

## 当前artifact交付安全点

[新Web实际](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/README.md)已生成descriptor779a/sourcec231，两产品1cea与批准d736不变。RELEASE01-08保持pending：两descriptors已齐，结果独审已APPROVED，当前需要两harness最小pair guard适配后再真实兼容，不借本次构建或旧三App报告冒通过。资源已归还，无第二build/Chrome/PG预约；独立150s段按外层观察上界25241ms CLOSED。

新pair source2f679及受控caller已[固定准备](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27/README.md)，RELEASE01-08继续pending真实兼容/发布；当前只待集中源/边界审，不重复设计或产品绿检查。

## 当前新 pair 首实际安全点

[原件与诊断](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-first/README.md)：source2f679准备已审，首次actual FAILED/完整RETURN，180s CLOSED56504ms、未用123496ms不转。reports=null/0正式报告，RELEASE01-08保持未完成。harness在UNKNOWN原key恢复之前等待Cookie流，需窄修顺序；后台lateLogout NOT_REACHED，不能替后台定性。原三App断言与全部失败保持，不自动重试。

- [ ] RELEASE01-10 当前组合收口后，分离稳定compat executor与可信管理方固定版本输入；合法新pair不再改通用harness，仍校验hash/角色/来源/browser-session policy、同pair actual、错误tuple/旧报告拒绝。后继验收两个合法pair同executor及错pair拒绝，分别记录准备/审查/actual耗时；复用OPS-001-14/16，不造新平台。

[c2顺序修复](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-c2/README.md)已固定d032a53a62017cc41a3ddf19b316ad1047398fa6，仅修场景前置，RELEASE01-08仍pending/四正式报告未生成。首红不改，后继需一次新有目的的完整验收，不把历史partial导入正式报告。

## 当前c2实际与诊断边界

[第二actual](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-second/README.md)FAILED/完整RETURN，26554ms新180s CLOSED。RELEASE01-08仍未完成，reports=null/0正式报告。harness原顺序缺口已走通，新的会话GET HTTP-parser400原因未记录；只准备被动有界clientError观察+新Cookie链diagnosticOnly，不能importReports，不为诊断重跑旧3矩阵。正式4App协议保持，下一actual须独立窗口。无新增产品authority，无后台或App越权修改。

2026-10-07T16:37:19.057Z 现RELEASE01-08内准备独立Cookie诊断入口，固定cdd34c3aff2f12492d6f5a2a5debaf4f80c6cb05。仅public链与被动HTTP元数据，正式四App接受合同和错误断言不变；新90s/strict20s仍proposal，见[候选](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/README.md)。

## 当前诊断源码与必要局部检查已固定

2026-10-07T16:50:24.040Z：RELEASE01-08内的诊断source fc291已获[root集中源码批准](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/root-source-review.json)，native边界已精确绑定；保存字节帽与真实pretty JSON完全一致。必要[strict两actual](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/strict-actual/README.md)首alias红保留/复验绿，2775ms/20s CLOSED。源码未变，不重跑旧绿；原正式兼容失败不改，待独立诊断捕获HTTP错误，90s仍无实际许可。诊断完成不能完成RELEASE01-08或生成四正式报告。

## 当前首次被动诊断实际

[新Cookie诊断原件](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/actual-first/README.md)：17:02:28Z真实开始、outer0/DIAGNOSTIC_COMPLETE，17:03:55Z全部资源已归还。实际捕获HPE_CLOSED_CONNECTION而非零错误，但精确请求关联仍UNKNOWN；不代表四App兼容通过、不导入报告。RELEASE01-08保持未完成。新90s独立14881ms CLOSED/未用75119不转；旧红保持。下一步只基于独审原件决定窄修或更精确诊断，不自动第二次、不扩大发布scope。

首次诊断actual经[root独立接受](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/actual-first/root-actual-review.json)，1条错误与关联UNKNOWN保真，未给compatibility批准。保RELEASE01-08未完成；当前停写等既有只读原因研究，不新actual或重建。

## 连接策略候选与正式验收接续

2026-10-07T17:24:30.531Z：首parser诊断已完整捕获HPE_CLOSED_CONNECTION，但端口tuple多义不能证明具体请求/唯一因果。复用[既有HTTP转发接缝](../../docs/evidence/wpf-release01/recovery-cookie/connection-policy-candidate/README.md)，只显式one-request agent；不改globalAgent/产品或放宽400。固定779/cd27不重build。后继正式四App必须新完整actual和四报告/cleanup；不导入历史partial或把diagnosticComplete当兼容绿。原稳定executor后继仍在本轮完成之后。

## 2026-10-07T17:49:58.767Z c3准备限定批准

[Root源审](../../docs/evidence/wpf-release01/recovery-cookie/connection-policy-candidate/root-source-preparation-review.json)批准d882源码与复用准备。RELEASE01-08仍pending；c3无运行授权，旧formal失败/reports=null保持。等待d01新窗口与fresh准入，不重跑types/build。

## 2026-10-07T18:05:42.382Z 固定pair c3实际完成

[formal4实际与完整归还](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-third/README.md)通过；[主线接收输入](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-third/main-intake.json)已获限定实际独审，待Original接收。RELEASE01-08保持in-progress，用户发布未由本轮执行。整个180s已CLOSED，原失败不改。完成本自然封存后exact4 STOP、claim保留；稳定executor分责仍RELEASE01-10后继，不夹入本片。
