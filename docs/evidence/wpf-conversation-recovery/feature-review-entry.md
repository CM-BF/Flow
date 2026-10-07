# 固定代码审查入口：WPF-RECOVERY01

当前组合target `a80339a463c4a1a1a5a679d9a89ea79b1650340e`，见[晚开路由修复checkpoint](stale-route-checkpoint.json)。App current committed callbacks源修+same-document/exact durable outbox回归与direct barrier已固定，[root dce限定source接受](stale-route-fix-root-review.json)；新增direct1与Web noEmit已实际通过，首前置红保留；本轮same-document+durable原turn/Steer完整恢复已actual selected2 PASS，见[证据](stale-route-first-validation.md)及[root actual独审](stale-route-first-root-review.json)，限定selected2与owned清理已接受。第二Steer真实FAIL/有效观察/清理原件保留，静态缺陷修复后原真实链已通过，旧两FAIL与观察原样保留。新route-fix90s是独立有限段，旧90/150/60 closed不挪余额；完整feature IN_PROGRESS，第二中心/真实runner应用仍开放。

## 55b已审基线与原证据（历史固定）

**Review target `55b4917e732d11d5e5f660f9c22a1022d7094015`；base `84005a260dfcb668cd38b09c21564d0754a0f513`；完整feature review `IN_PROGRESS`（55b两P2修复与局部实证已独审接受；chooser实际2/2及owned清理已独立限定接受）。** 本文件准备实际独立代码审查，不是作者自评通过。WT/branch：web-conversation-recovery / codex/web-conversation-recovery。当前19源码与target逐字一致，后置改动仅owner记录；源已冻结。

[精确19文件/每文件SHA与Git blob/统计](feature-review-manifest.json)：16个产品源+3个专测/fixture，共3205新增/133删除；范围仅原claim21中的19literal和两own目录，target相对base无范围外路径。源包含App实际消费者、ConnectionSession、唯一Journal/P01 binding及原Outbox/Queue/Steer authority，不是孤立框架。无server/shared contract/依赖/lock写入。证据目录/plan记录随metadata提交；原raw不能被编辑或当代码。

## 已实现Interface及原authority

- Cookie connection只消费已固定public client/session4字段；持久center URL保API base path且拒凭据/query，principal/center namespace与短期权限generation分离；logout同步撤业务授权但不删journal/中心cancel。
- 同步localreceipt先交接，再strict IDB事务complete/CAS→HTTP；CREATE保两key/两body及bind checkpoint；无法落盘0HTTP，unknown不得被newkey覆盖，显式retry保原body/key。
- 原view owner管理完整draft、下一稿、材料metadata/顺序与restore lease；App真实挂P01sidebar.footer、保inactive原namespace/client；恢复无自动POST。未验证材料不能静默退化纯文。

## 早期P1/P2→修复/验证来源（仍供独审复核）

| 原问题 | 当前收敛与来源 | 验证限度 |
| --- | --- | --- |
| 82早期draft transient-empty/prepare失败、缺真实CAS、迟到namespace、写前阻塞原key、logout授权 | [quality](quality.md)保原8项来源；最终[50](direct-fourth-validation.md)含strict commit abort、版本CAS、原key重试/迟到prepare、旧namespace与logout case | 受控IDB/fetch；全UI边界不能仅靠50推断 |
| 82 peer终态restore/Steer checkpoint、knowledge unverified、255/512附件名 | [f13 peer](f13-peer-source-review.txt)保修复及后继反例；50保终态对账、exact材料/知识resolve cases | 文件与knowledge恢复source/controlled；本次browser实际验证双文件 |
| F13-1旧pending在reauth后自动续发；F13-2未存稿auth/center切换被卸载 | [原root](f13-root-source-review.json)、[2b01源审](2b01-restore-edit-root-approval.json)、50代际/原owner保护；本full7page-only abort→authloss→同页reconnect0POST | 二中心/换principal实际UI仍未覆盖 |
| F13 failed/blocked-open缓存与晚success orphan | [原open审](f13-open-source-review.json)，50explicit retry/late close | 受控opening事件；不是全浏览器quota矩阵 |
| R4-1 commit时namespace=null漏version；terminal reconcile后blocked残留 | [原4ba审](4ba-root-source-review.json)，50含commit-held/publicnull/reauth与只清原terminal blocker | actual App本轮保稿链已过，跨tab终态完整矩阵仍有限 |
| M1静默少材料/M2分批验证乱序 | [1b8 root](1b8-material-root-review.json)，50send/queue完整性/先B后A/held隔离，本full7双真实chip/原refs/顺序/同body重试 | Queue enqueue实际现见continuous-sixth-validation；不冒promotion/Steer或全部材料组合 |
| REC667默认checkpoint不激活/observer缺库造空v1悬挂 | [7cc审](7cc-root-source-review.json)，旧38新增生命周期/observer与当前50继承；本full7默认编辑/真实IDB恢复已过 | malformed/blocked各支仍受控证据 |
| Restore等待中编辑丢失/同view双restore | [2b01 root](2b01-restore-edit-root-approval.json)+[peer](2b01-restore-edit-peer/report.md)，50使用真实App-used helper及deferred projection | 不冒mountedWorkspace全部材料prepare与并发编辑全浏览器覆盖 |
| 同route多稿locator/对话框回焦 | [8ed审](8ed-identity-focus-root-approval.json)，本full7精确draftId+Enter/Escape+双390图 | 可读性后继已登记，不抹精确identity |
| __name callback、picker关闭回焦时序、过期fixture非法时间对 | [serialization](serialization-check/root-web-local-segment-20261007-review.json)、[1bc审](1bc-focus-precondition-root-review.json)、[0141审](0141-expiry-root-review.json)；本full7实际走完原断言 | 全部五次历史FAIL保留；不是追溯改绿或唯一flaky根因证明 |
| Parent期限/未知CREATE、bodyloss证据、PG零连接/late-stop/tail资源 | 原review.md各固定源审+本次[实际root审](continuous-first-root-review.json)及原DB/fixture/group/EOF原件 | 采样非OS硬quota；当前exactcleanup有效，不代表任意进程树强隔离 |

## 检查归因

- [50实际direct](direct-fourth-validation.md)：执行994ce、实现2b01，controlledIDB/mockfetch/actualApp-used helper，非nativeIDB或完整mountedApp。与本target的具体差异见manifest（不能把50冒当前19源同刻全验）。
- [最近Web noEmit/119纯选择回调](journey-selection-local/index.json)：固定dd664，最终types0/119PASS；之前source第一轮111与日志分别保留。0141仅query字符串/预算常量改变，按授权未重复types/旧绿检查。
- [本次原full7](continuous-first-validation.md)：执行765ab/source0141，actualexit0、完整7组与真实IDB/cookie/HTTP、两390图、markedDB/Chrome收尾；root限定接受。新段保守charge13134/rem136866，旧90k actual64134.08675与五FAIL独立封存。

## 残留验收/风险

CREATE两故障点及Queue enqueue现各有真实选组通过；Queue promotion/nativeSteer应用、二中心与变principal仍未验；profile/project/knowledge/双文件完整草稿和Steer草稿各有独立实际证据；任务详情SSE本次已见实际delivery，conversation/assistant流与全部重连仍未验；旧uploadjournal跨tabCAS/历史metadata隔离不在本片修复声明。三中心语义caller-Origin/迟到ClearCookie/repeatedConnect槽位由共享owner处理，本片不伪造auth保证。IDBstrict是UA耐久hint，不称断电/删库永久保证。主线/真实个人部署未集成验证。

GO新可用性验收归原03/05：恢复目录主层改用获准轻metadata标题/摘要/本地Intl时间，UUID/精确UTC留details，不预取正文；空text不判重复/自动删稿，保unknown/key/材料语义。仅后继记录，不阻当前固定代码审查或把这轮图片改成新产品FAIL。

独立review应以此固定19源/base读取实际代码，核修复证据与未验边界后给结论；作者不提前标APPROVED，0141正式review为CHANGES_REQUESTED，当前两个修复供独立增量复审。

## 正式两P2修复与新增验证

[0141 root完整源审](0141-feature-root-review.json)与[peer复核](0141-feature-peer-review/report.md)均确认两项P2。当前固定修复只改App、Steer control与原browser/direct两文件，其他15源同0141。

- SELECTING：显式选择意图独立于背景ready；成功的用户Connect/Check existing才结束当前选择，迟到操作受本地revision与effect清理保护。新增独立`connection-choice`旅程复用真实App/public cookie读，验证输入保留、显式返回与0业务POST；**browser connection-choice 实际2/2 PASS，见[原件](continuous-second-validation.md)，本次已获root限定实际证据接受**。原full7原顺序/断言保持。
- STEERING-TIMEOUT：同generation在写前屏障deadline进入原键unknown/locallyBlocked，0HTTP且可显式重试；已解码ACK且accepted checkpoint提交后不因deadline降级，旧generation仍不发布并可显式Restore对账。
- [新增定向局部检查](final-p2-local-index.json)：ecce548四个受控case PASS，旧50 NOT_SELECTED。初noEmit两处mock签名宽化红原样保留；55b只补3处SteeringPort类型泛型，noEmit exit0，运行行为无改。仅受控IDB/端口，不冒mountedApp或真Steer HTTP。
- 新普通local段累计实际13221.340917ms，保守charge13222/30000，0PG/Chrome/HTTP。browser新150s段累计24589/150000，剩125411；没有未消费gate，有限段已授权但每次须实际交接与fresh输入。

[55b正式限定复审](55b-p2-fix-root-review.json)已接受两P2源码修复及定向local证据，0新增finding；全文的0141 CHANGES_REQUESTED与待复审描述保原历史来源。完整feature仍IN_PROGRESS，不自评APPROVED。

[connection-choice实际回归](continuous-second-validation.md)绑定55b/执行0a661，2/2 selected PASS；原full7绑定0141不重跑，当前新增结果已获root限定实际证据接受。

[root choice实际审](continuous-second-root-review.json)关闭SELECTING的定向实际验收；STEERING-TIMEOUT保4受控case限度，整体review仍IN_PROGRESS，无真实Steer HTTP/主线集成声明。

## first-create实际限定补证

执行beb6/source67f8，[2/2与原件](continuous-third-validation.md)及[root限定审](continuous-third-root-review.json)。只CREATE ACK丢失分支；已绑定后丢turn与Queue尚未实际运行，不替其他验收；预算新段36096/150000、余113904。

## Queue实际与剩余接口

[第六次有限段实际](continuous-sixth-validation.md)绑定344f/fafc，root独立限定接受selected2/2；本source未变化。段累计70158/余79842，历史计费/失败保真。下一最小[只读提案](remaining-validation-after-queue.md)以公开取消事件验证真实SSE到App，不把握手或轮询当交付。
