# 原 WPF-RECOVERY01-05：真实场景依赖与最小独立选择提案

固定 `1bc4f20b9257b294adcadd6b68b1b9e015e04e86`；本次仅实现最后Escape后picker关闭/Files自然回焦两行前置。下面的 selector/隔离方案仍未实现、未审、未运行；不是第五次packet或新许可。原七组完整E2E保留，历史四次FAIL不改。源码hash见sources.json。

## 现有实际依赖（browser.ts 与 fixture.ts）

browser:272–304 一个worker共用 fixture/browser、pageErrors、wire和 coverage；`run()`任一失败立即throw，外层只有一次catch/finally，所以后组NOT_RUN是现在真实语义，不能直接catch后继续。

| 现有组 | 真实输入/修改 | 与前组的依赖 |
|---|---|---|
| cookieRead（375–380） | 一个新context的空cookie/IDB，经实际Connect得到HttpOnly cookie、session read；page打开唯一conversation | 全部现后组复用该page/context和同一中心身份 |
| textIntentDraft（393–451） | 真实UI选择两附件→保存draftId→reload→原record Restore→先B再A验证→原有序chip；IDB与同view/route稿 | 使用已认证page、fixture两资源；产出draftId/原稿/两附件 |
| crossTabCas（452–458） | 同一context第二page，共cookie/IDB；恢复相同draftId/version，A改稿成功、B冲突；关闭B返回A | 必须接前组真实原record；最后A文本变Tab A protected draft |
| sameKeyTurn（460–486） | A完整两附件Send，中心产生turn/task/revision，afterheaders bodyloss后原key显式retry，保存下一稿；SSE仅握手 | 依赖前组原材料/当前A稿；fixture lost flag、wire计数及conversation revision不能复用脏失败状态 |
| pageOnlyAuthLoss（487–517） | 同page安装目标DB readwrite abort→编辑未落盘稿→expireSessions→公开read失权→恢复IDB方法→显式reconnect；timeOrigin不变且0command POST | 语义只需有效认证、真实editable draft/IDB和独占session namespace，不需要前组附件/已受理turn；当前代码却复用前组page/全局POST基线 |
| csrfOffline（519–525） | 有效cookie无CSRF POST应403；context离线/恢复，无新增命令；断言先前page-only原稿 | 认证与后半固定稿文本来自前组，且offline影响该context全部pages；应在独立入口显式准备并确认自己的稿 |
| themes390（526–534） | 当前page390、两theme、Saved drafts Enter/Escape自然回焦、overflow及两截图 | 只需有效认证/可用P01入口与明确保存的本场景稿，不依赖材料上传或lostACK；当前共享前面所有状态 |

fixture:338–359每次启动创建随机public/center端口与新center配置，再以公开client创建自有project/conversation/two resources。parent的RecoveryDatabaseLease（fixture:134–224）创建随机markedDB并负责零连接普通DROP。BrowserContext只隔离cookie/IDB，**不隔离这些服务端行**。

尤其fixture:240,280–286的单`lost`标记、整个`wire`数组/字节、同conversation revision，以及361–362无WHERE的expire/revoke会影响这个fixtureDB内全部session；因此不能仅newContext并同时跑多个场景来宣称服务端隔离。automaticQueueScan:false（342）/0provider保持。close（318–335）负责HTTP/SSE响应、ACK写入、center/pool；仍需要原parent worker/Chrome group与DB清理。

依赖图：

```text
fresh owned DB + fixture + BrowserContext + explicit cookie connect
  ├─ material Restore → same-record cross-tab CAS → lost-ACK original-ref retry
  ├─ page-only IDB-abort → session expiry → same-page reauth/noPOST
  ├─ own draft checkpoint → missing-CSRF 403 → offline/noPOST + draft retained
  └─ own draft checkpoint → 390 light/dark + P01 Enter/Escape focus
```

## 最小可审选择 Interface（候选，不实施）

只在既有 browser.ts 的 Gate/Init/worker/result 增一个有限枚举 `journey: full | recovery-chain | page-auth | csrf-offline | appearance`；单次gate只允许**一个**值，缺失/未知拒绝，不做任意grep/expression/多个并行selector。`full`继续原七组、原顺序、原文本/材料/全部断言，保fail-fast和完整E2E作为最终验收。

每次单选都复用**原完整启动**：新markedDB、新fixture的project/conversation/resources、新BrowserContext和显式cookie连接。让不同attempt的数据天然独立，先不新增同一次运行多数据reset/通用fixtures框架；也不额外并行Chrome/PG。选择recovery-chain时原四组完整相连，不伪造draftId/原key/refs或用IDB seed取代真实恢复链。

page-auth：从自己的认证page开始，确保正常编辑/初始checkpoint可用后用现目标DB abort注入；保原公开expiry/read/reconnect、timeOrigin和0POST断言，不依赖已发消息。csrf-offline：经实际App先填入并确认持久化自己的预期稿，保原403、离线notice、返回同稿及命令计数不增；403负例本身入wire，基线仍在它之后。appearance：实际编辑并确认至少一条本场景saved draft，再沿原Saved drafts键盘/390/两主题/overflow/回焦断言截图；不得用空恢复目录冒此前完整E2E截图内容。三个独立setup不标为材料恢复、lostACK或page-only通过。

复用同一份每组操作函数/现有小连接与checkpoint helper，完整路径与单选调用相同断言；只把必要输入（page/context/fixture及预期稿文本、draftId）显式传入，不复制测试业务或创建第二controller/IDB writer。各选组首次失败即该run FAIL并走共同finally，绝不吞失败后使用污染page继续其他组。

报告同时保存 selected、required groups、实际checks/每组coverage。非选择组明确NOT_SELECTED，不混NOT_RUN/失败；selected setup失败也必须FAIL，零选择/零实际case或required缺失不能PASS。parent只认selected范围通过，完整feature仍UNKNOWN/NOT_STARTED；最后仍需原full E2E。所有版本/源码/原始计时pins仍由原入口核，不启第二supervisor。

最小后继写面先仅原browser.ts（已有claim），fixture不必改：每attempt已拥有新DB及公开种子。若日后要求同一次attempt多组相互隔离，才另审fixture的明确createScenario/test-seed与限定session expiry，不把当前全局expire当可并行，也不在此先实现。

## 本次结束与启动条件

本提案来自真实源码依赖分析，并采用本地codebase-design的小Interface/唯一状态authority、clean-code的setup和断言职责分开、webapp-testing失败保真原则；没有执行任何产品/import/test/HTTP/PG/Chrome/容量采样。只新增两行关闭/焦点前置的source checkpoint可独审；selector仍待root选定，**第五次运行packet暂停，不生成gate/adminenv或占预约**。

已耗54883.199542/90000ms；原预算剩35116.800458ms，下一整数最多35116含15000cleanup。原gate最低30000ms（browser:51）也说明不能把剩额虚拆成多个重复完整startup或承诺补齐所有独立组；选择只能优先验证具体缺口，实际launch仍需新fixedsource/独审/精确剩额与真实PG+Chrome交接。50direct/serialization10不重测，不把选择提案或历史局部PASS当完整交付。
