# WPF-RECOVERY01 连接、草稿和未决发送恢复

状态：in-progress。创建：2026-10-06 13:49 UTC；更新：2026-10-06 21:15:21 UTC。直接父任务 [WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md)，沿原06-04，不建立第三执行层。唯一owner workspace_panels_owner / gpt-6-astra ultra；co-lead Web /root。

目标：真实App在有效会话刷新后恢复同一中心的草稿和原未决命令身份；重新认证不自动发送，退出不取消中心任务。遵循[模块规则](../../AGENTS.md#modular-design)。

已批准设计：ConnectionSession只消费固定公开cookie client，ConversationJournal负责namespace/IDB事务/CAS/预算；Outbox、QueueCommands、Steering controller仍为原命令authority。P01 sidebar.footer私有binding提供实际恢复入口，App保持view唯一权威。完整草稿含正文、intent、profile/project、knowledge、附件metadata及steering草稿，恢复原顺序与refs，不自动上传/读正文。库异常可继续内存编辑，不能绕过prepare/CAS发送纯文。

同步localreceipt接管→strict IDB事务complete→dispatching CAS complete→HTTP。CREATE两key/两body先冻结，绑定checkpoint完成后才turn。未知不自动重投、不换key、不靠同文GET猜受理；其他tab不能覆盖unknown。原稿交接严格draft version CAS，composer空通知或迟到ACK不得删除下一稿。普通close/switch/auth失效保journal，eligible dismiss另明确操作。

候选容量：command初始record+slot/index128KiB，增长32KiB全额预收；draft128KiB，最多32draft/128logicalcommands，global4MiB含namespace/manifest。每个状态精确UTF8 JSON计费，unknown不可淘汰。合法完整envelope超限需提高单条cap/接受更少条，不截身份或材料；现116451B设计样本不冒完整证明。上传旧journal的跨tabCAS/历史namespace展示不纳本片解决。

固定base 84005a260dfcb668cd38b09c21564d0754a0f513。共享client/domain/factory已正式main；不改shared/server/认证DTO，不复制HTTP。callerOrigin、迟到Clear-Cookie、重复Connect32slot三语义仍由中心owner协调，最终真实browser/approval前核准。

## TODO

- [ ] WPF-RECOVERY01-01：固定输入、合法scope和唯一canonical；实现有界ConnectionSession/Journal。
- [ ] WPF-RECOVERY01-02：四类原controller同步接管和durable barrier，CREATE两阶段及错误/CAS恢复。
- [ ] WPF-RECOVERY01-03：实际App/P01入口、完整草稿/材料和namespace隔离恢复。
- [ ] WPF-RECOVERY01-04：定向storage/controller直接行为验证与来源hash。
- [ ] WPF-RECOVERY01-05：资源允许后真实cookie/HTTP/SSE/App旅程，累计≤90s含≥15s清理、≤8MiB、1PG+1Chrome、0provider/个人服务。
- [ ] WPF-RECOVERY01-06：独立固定审查、修复、push和明确main接收。

## 验证与资源

当前仅轻量source/metadata；禁止安装/build/PG/browser。SVC06整套准备要求fresh空间≥2.5GiB；单Web/小验证按实际physical增量和约1GiB收尾余量另核，不以旧统一门槛误挡。这不新增install/build/PG/browser许可。基础direct tests另记，不冒browser/IDB真实运行。浏览器失败保raw并评估剩余预算，不无限重跑。个人61227/61228/4320不采不改。

## 范围与证据

精确21literal以[take回执](../../docs/evidence/wpf-conversation-recovery/take-receipt.json)为准；新增path须先amend。[Interface](../../docs/evidence/wpf-conversation-recovery/interface.md)、[质量](../../docs/evidence/wpf-conversation-recovery/quality.md)、[状态](status.md)、[审查](review.md)。

### 未来浏览器入口的运行前门禁（RB1–RB4）

父进程在启动前拥有worker和Chrome进程组，独立监督累计90s并保留至少15s清理；数据库CREATE尝试/确认/marker持久记录，只有精确marker且零连接可删，unknown与非空remaining均阻止通过/重跑。唯一scratch目录与递归evidence/日志预算、实时free监测须先于业务import/CREATE。材料稿及无reload认证失效纳入显式coverage矩阵；未实际运行保持NOT_RUN，不能沿text-only旅程宣称完整恢复。

### 7244 用例窄修

现范围内修恢复附件重新验证后同步到真实composer；binding订阅生命周期保持稳定，held submission不得被状态重渲染清理。浏览器在材料用例完成前核实际chip，再保原首POST attachment ref断言。不重新Use/重新选取或remount。SSE只核握手的当前断言准确标注；键盘用真实打开/关闭焦点断言。本段仅源码，0运行许可。

### 02d 材料完整性 / 原序修复

Send/Queue均先从现绑定检查本稿完整Input选择与composer同序、同ID交接，零chip不等于无选择；未验证、部分同步或不同顺序须在原receipt/HTTP前保稿报错。先B后A的目录验证只更新ready事实，同步不得跳过未ready前项；不改Input或receipt排序。held/inTransit旧交接与已consume材料不混入下一稿；显式remove才缩小本稿选择。必要验证包括受控binding的两个intent、分批metadata/延迟add、原refs有序handoff、显式remove和held/consumed/inTransit隔离，以及未来实际App双文件首POST。此段均源码准备，未增加运行预算。

本段独立来源复核：固定1b8的M1/M2仅源码addressed，见[review](review.md)所归档原报告；不勾选TODO、不将历史20case扩大到当前27case。完整target UNKNOWN / feature review NOT_STARTED；当前direct、types、browser均未运行。五源码继续冻结，后续检查须另有fresh门槛。

### 2026-10-06 16:23 UTC — 当前定向检查事实

固定1b8的27个受控IDB/mock-fetch直接用例已单次通过，execution HEAD0eef，runner2.034s、清理fulfilled，累计4.574/30s。[原始结果](../../docs/evidence/wpf-conversation-recovery/direct-second.json)。完整实现仍需真实App/cookie/CSRF/SSE/刷新旅程及固定独审；TODO不因局部检查全数关闭。当前types/browser未运行，剩余预算不自动授权新运行。

### 2026-10-06 17:09 UTC 验证入口修正

RECOVERY01-05真实浏览器入口先修原fixture代理传输：public Host/Origin/Sec-Fetch-Site按浏览器请求送达私有center；多个Set-Cookie分别转发，SSE保持流式取消/清理。只改既有fixture及own记录，当前source-only；历史1b8 direct27不覆盖该修正，browser与三项中心语义仍未验。

### 2026-10-06 17:28 UTC 验证前提窄修

RECOVERY01-05保留真实body-loss：完整中心ACK先验证并记录，再送真实headers/full字节Content-Length与严格正文prefix，优雅关闭连接；既有lost-turn须观测同一Request的headers→requestfailed和exact1 preRetry/exact2 postRetry、原key/body/refs。CREATE/Queue仅支持故障helper，不冒实际用例通过。ownedDB清理在marker前后均短时观察零连接，受同一parent硬截止；持续连接/查询错为失败，不FORCE、不终止其他连接。此段source-only，无新运行门槛。

### 2026-10-06T17:43:28.863916+00:00 — 768语义断言修复

Root/peer唯一P2按公共decoder修复，固定 `667889058d3decc0abc9f635a37fd0f05f2c090c`。要求ACK真实task身份为 `turn.task.id`；不再比较不存在的两个taskId。原请求通过现有conversationTurnSchema，公共decoder消费attachments/knowledge与原conversation，禁止另造codec；导入只worker。无新journey或预算。另明确DB1s为观察policy，非连接获取硬上限；原parent绝对清理截止不变。源码修复不是运行通过。

### 2026-10-06T17:45:10.279831+00:00 — 限定源码审批

固定667 ACK identity及768 harness源审由root批准，0blocking；[review](review.md)保原文。此结论不完成RECOVERY01-05真实旅程或RECOVERY01-06完整独审/main。原27受控检查与新browser未运行保持分开，源码继续冻结。

### 2026-10-06 18:01 UTC — 首真实子集失败

RECOVERY01-05首一次真实浏览器cookieRead通过，随后草稿存储旅程出现对象仓库缺失/超时，后续材料与重试均未完成；[原始证据](../../docs/evidence/wpf-conversation-recovery/browser-first-validation.md)绑定667/0fe939。清理确认、原raw保留；累计14.846267375/90s，余量不自动授权重跑。根因待定位，TODO不关闭，完整feature仍未审；首same-origin子集与中心三语义/完整覆盖分别记录。

### 18:08 UTC 首次失败修复边界

原RECOVERY01-03/04/05落实已授权配置的默认插件生命周期，撤权/namespace/generation/disabled仍守门；缺库observer只能pending并abort升级，已有malformed明确失败，不修库。复用同一纯observer于browser与受控case，五源限定。0运行，新检查NOT_RUN；首轮失败不是两静态问题唯一动态因果证明。

### 2026-10-06 18:39:00 UTC — 定向检查安全点

RECOVERY01-04新增生命周期/observer共38受控case已单次通过，源7cc、执行bf14，[原报告](../../docs/evidence/wpf-conversation-recovery/direct-third-validation.md)。direct累计6.868/30s；剩余额度不授权重试。RECOVERY01-05真实browser首失败仍保留，修复后未重跑；RECOVERY01-06完整独审/main未完成，不因局部通过勾完TODO。

### 2026-10-06 19:21:36 UTC — 同一browser父监督尾部修正

仅ESRCH证明owned process group不存在；未知/活跃保留scratch并失败。确认组消失后、删除前独立检查scratch/evidence/free，无work-phase门槛；计量错误入raw，安全清理继续。报告/budget后再有界观察真实占用/耗时，失败不绿。显式MAC_CHROMIUM_TMPDIR归own scratch，仅记录白名单临时目录/实际argv，复用既有PID退出记录，不复制第二collector。原计时在准入/历史budget核验后开始；新尾部计量覆盖报告写入，不冒包含全部preflight/物理硬配额。无新运行预算。

2026-10-06 19:32:54 UTC：沿原-05准备项补自有scratch/crashpad的BREAKPAD_DUMP_LOCATION及白名单记录。此为配置source-only，不增加任务/范围/运行预算，不声明完整Chrome OS隔离。

## 2026-10-06 19:51:04 UTC — RECOVERY-RESTORE-EDIT

当前P1 CHANGES_REQUESTED_SOURCE_SCOPED：[固定源审](../../docs/evidence/wpf-conversation-recovery/restore-edit-root-review.json)。修复等待期间text/intent/profile/project/knowledge/附件/steering完整编辑保护、同view并发Restore及冲突后checkpoint；补App共用owner seam的deferred refresh回归源码，禁止只mock host.restore自证。当前0运行，不沿用38通过声称新修复已验；完整feature NOT_STARTED。

### 2026-10-06 20:02:41 UTC — Restore冲突语义冻结

RECOVERY01-03/04修复target `2b01eb6ff345175f7073c4e57125f5eecfd52cac`，见[接口/源码回归边界](../../docs/evidence/wpf-conversation-recovery/restore-edit-source.md)。当前50仅静态计数/未运行。Root澄清不新建slot或双存draft：Restore冲突不得删/套用旧record，当前新稿按原owner/slot与CAS正常保存，成功会更新同slot。已建conversation项目在应用前核中心身份，新chat项目选择受编辑租约保护。原38与所有预算/完整验收开放状态不变。

### 2026-10-06 20:11:48 UTC — 同一恢复编辑修复源码验收

RECOVERY01-03/04的2b01修复已获root和peer限定源码通过，见[review](review.md)；50项受控检查待新单次准入，原TODO不因源码批准勾完。完整App材料prepare、mounted Thread和真实IDB/cookie旅程继续开放；本段仅metadata归档与tmp候选准备，不改变容量、事务、原identity或运行预算。

### 2026-10-06 20:23:14 UTC — 原恢复编辑定向回归实证

RECOVERY01-04本轮2b01共50受控case已单次通过，见[验证边界](../../docs/evidence/wpf-conversation-recovery/direct-fourth-validation.md)。完整App/真实IDB材料恢复未验；-05首browser失败和-06完整独审/main不关闭。direct晚终态保守累计9969ms/余20031ms，后继需新准入。

## 2026-10-06 20:35:20 UTC — browser parent晚停止P2 source-only修复

[Root原报告](../../docs/evidence/wpf-conversation-recovery/browser-late-stop-root-review.json)RECOVERY-BROWSER-LATE-STOP：cleanup把stopped置true后，SIGTERM/SIGINT的原stop(reason)可漏终态失败。此为父监督分类源码缺陷，未复现泄漏或产品失败。按20:34:02.072Z[原21fresh观察](../../docs/evidence/wpf-conversation-recovery/browser-late-stop-claim.json)只改原browser parent，独立记录停止/外部interrupt事实与cleanup生命周期，保清理/硬截止/原worker断言。当前NOT_RUN，50实证与2b01产品批准不撤；旧14.846267375s、余75.153732625s含15清理不变，无运行许可。

### 2026-10-06 20:36:49 UTC — 原RECOVERY01-05父监督窄修固定

固定 `4d3303d7e107b400ebe8ecae62b8d843c0d1d4cb`，仅修晚停止分类，未增加实际journey/运行预算。终态stdout/exit和各阶段报告必须共同判断，较早passed不能覆盖较晚interrupt。独立复审和新gate尚待，完整TODO保持开放。

## 2026-10-06 20:41:28 UTC — 4d330 parent晚停止独立源码批准

Root实际时点2026-10-06T20:39:13.481403+00:00，固定 `4d3303d7e107b400ebe8ecae62b8d843c0d1d4cb` / metadata c059c278；[原始报告](../../docs/evidence/wpf-conversation-recovery/browser-late-stop-root-approval.json) SHA256 `2a3826caf708b570aa4e9fe226a2d2bb31711e943cfdfdd10a9daabd61ec4315`，**APPROVED_SCOPED_LATE_STOP_PARENT_SOURCE_NOT_RUN / 0 blocking**。旧CHANGES_REQUESTED及作者待审段是历史，RECOVERY-BROWSER-LATE-STOP当前SOURCE_ADDRESSED。止停事实与cleanup状态分开、重复信号去重、最终stdout/actualexit晚到失败判定均获源码认可。

没有signal注入或新运行；不声称SIGKILL/进程崩溃/移除listener后的信号均被捕获。另18源和worker/旧10raw不改；2b01/direct50仅保原范围，完整feature NOT_STARTED/targetUNKNOWN。下一browser只读准备必须绑定最终实际HEAD和19源，旧7ca准备不可运行；原75.153732625s剩余包含15s清理，需manager新window/gate和受控admin输入。

## 2026-10-06 20:52:18 UTC — 原子集第二次运行证据

[第二次browser验证](../../docs/evidence/wpf-conversation-recovery/browser-second-validation.md)执行d3d45/固定4d330，FAILED/actualexit1；cookieRead PASS，textIntentDraft的Restore定位匹配2行，后续未完成。作者只记录原始事实，尚未作产品或harness根因裁决。清理完整，晚终态累计25520.435ms，未来整数carry25521/剩64479且含15s清理；没有重试许可。19源、首轮10raw、50受控实证各保原范围。完整feature独审NOT_STARTED/targetUNKNOWN，当前运行等待独立证据复核，不自行APPROVED。

## 2026-10-06 21:01:31 UTC — RECOVERY-SAVED-RECORD-IDENTITY P2源码修复派工

Root[限定设计](../../docs/evidence/wpf-conversation-recovery/saved-record-identity-design-review.json)确认record按namespace/viewKey区分而现UI/两定位退化为route，合法同route多稿不可辨；真实生成路径仍未唯一证实。按[原21fresh](../../docs/evidence/wpf-conversation-recovery/saved-record-identity-claim.json)只改binding呈现及browser两exact row入口，保原restore/journal/App authority和所有材料/noPOST/CAS断言。0tests/types/运行/free；原两次browser失败、50受控与25520.435ms累计保持。

### 2026-10-06 21:10:21 UTC — 同route多稿呈现与普通关闭回焦

限定两源 `8ed2741327779e57d717653d10c2180e1897c26a`：本地已载入草稿提供有界plain-text摘要、保存UTC时间/intent/材料条数及可展开完整record ID。两处browser精确使用原draftId、count1及原kind/route/preview，保材料原序/noPOST/CAS与全部历史raw。外部P01普通button的invoker由现Radix open/close autofocus回调保存/恢复，同namespace/权限代际和可见性不符则不回焦；不扩公开slot/authority、不去重删稿。见[固定接口](../../docs/evidence/wpf-conversation-recovery/saved-record-identity-source.md)。仅源码修复待独审，0runtime，TODO03/05/06仍开放。

### 2026-10-06 21:15:21 UTC — 8ed源码复审闭合，真实旅程仍开放

两项P2获[root限定源码批准](../../docs/evidence/wpf-conversation-recovery/8ed-identity-focus-root-approval.json)，完整TODO仍开放。下一准备沿原入口、same-origin既有subset和原90s累计预算，最多64479ms含15000ms清理；只重绑最终metadata/19源/依赖/旧25raw，不创建新wrapper/gate或提前读取admin。0运行，真实browser失败不回填通过。

### 2026-10-07 02:17:40 UTC — -05第三次真实子集仍未闭合

仅原授权run rec8ed，局部cookie/材料恢复/跨tabCAS/原key重试通过，pageOnlyAuthLoss发生page.evaluate异常，后续CSRF/offline/视觉未运行。[原证据](../../docs/evidence/wpf-conversation-recovery/browser-third-validation.md)完整保留；下一步先核失败再独立准入，非自动重试。原完整TODO不勾选，原90秒累计晚终态38364.050667ms，剩51635.949333ms含清理；不改源码或验收要求。

## 2026-10-07 02:20:08 UTC — -05原注入脚本窄修

保持所有原旅程，修page.evaluate序列化闭包外helper接缝；不通过全局helper/删除断言避错。仅原browser与own记录，局部检查和下一浏览器许可分开。

## 2026-10-07 04:45:38 UTC — 原-03/-05/-06只读依赖更新

[固定C02消费接缝](../../docs/evidence/wpf-conversation-recovery/c02-stream-consumer-seams.md)记录未来patch-v2输入、三处App client与host/shared gate一致性、公开reasoning独立呈现和精确后继路径。仍是原计划依赖研究，不新增task/实现/claim；现21之外的host.ts/messages.ts和既有stream专测须后继明确交权，C02共享源码由其owner闭合并独审。当前Recovery验收/预算不缩减或重置。任务首次实际开工缺可靠历史事件，status为UNKNOWN；未完成，不从领取/commit推算。

## 2026-10-07 05:06:19 UTC — 原-05第四实际子集未闭合

[第四次记录](../../docs/evidence/wpf-conversation-recovery/browser-fourth-validation.md)固定4c0852/9835，cookieRead通过、saved.txt tooltip超时、后续未跑。保存前三失败和原35,116ms下一整数余量（含15s清理），不重置90s；完整TODO保持开放。下一只读定位真实UI/两个hover断言及最低所缺证据，不删断言或盲重跑。
