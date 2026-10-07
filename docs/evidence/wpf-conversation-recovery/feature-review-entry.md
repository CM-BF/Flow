# WPF-RECOVERY01 固定代码与验收入口

当前唯一组合 target `2f8cc1f61d32f518998a64d0adeec582f85481f2`，base `84005a260dfcb668cd38b09c21564d0754a0f513`；16 个生产文件逐字等 `a80339a463c4a1a1a5a679d9a89ea79b1650340e`，本次只改两 harness 和原 direct test。完整 feature review 为 **IN_PROGRESS**，不是作者自签通过。WT `web-conversation-recovery` / branch `codex/web-conversation-recovery`，原 claim6ff v4/21；[当前19源/blob/SHA及base统计](two-center-checkpoint.json)为精确范围。后置 owner metadata 不替代历史运行 HEAD。

[root 集中源码与local审](two-center-source-local-root-review.json)接受当前三文件delta、2项新受控回归与Web noEmit；随后[双中心真实浏览器selected2实际通过](two-center-first-validation.md)，[root本次actual独审](two-center-first-root-review.json)限定接受。当前代码不混入恢复目录美化、C02 stream-v2或其他feature。main/真实安装接收尚未取得新的本片完整回执。

## 模块与authority

ConnectionSession 负责公开cookie身份及撤权代际；Journal 按API baseURL/center/principal namespace持久化原owner草稿和冻结命令；P01私有binding组织checkpoint/restore，不成为第二业务发送authority。App使用当前已提交routing callback创建晚来view，client teardown不因session更新重建。原Outbox/Queue/Steer负责各自key/body与终态，严格事务commit/CAS是HTTP之前的屏障；unknown只能显式原key重试。

完整稿包括text/intent/profile/project/knowledge/有序文件及Steer草稿。Restore核完整revision/lease，冲突保当前稿，成功新稿checkpoint可按原slot CAS替换旧record；不隐式fork、删稿或自动POST。材料恢复先unverified，显式metadata验证后才可发；新稿与已冻结材料分离。

## 当前实证矩阵（固定来源各自保留）

| 验收 | 固定来源/实际证据 | 结论与边界 |
| --- | --- | --- |
| strict存储、CAS、恢复编辑/生命周期、材料与原key | [50 direct](direct-fourth-validation.md)，source2b01；[119选择/序列化](journey-selection-local/index.json)，source dd664 | 受控IDB/transport与App-used helper；不是全mountedApp/nativeIDB |
| 原full7 | [source0141/exec765ab](continuous-first-validation.md) | 7/7实际PASS：cookie、text/intent/files、跨tabCAS、turn lostACK、page-only保稿auth-loss、CSRF/offline、双主题390/键盘；不是整个feature或SSE正文证据 |
| 显式中心选择不被后台read关闭 | [source55b/exec0a661](continuous-second-validation.md) | selected2/2实际PASS，候选输入/原稿与0业务POST |
| CREATE第一ACK丢失 | [source67f8/execbeb6](continuous-third-validation.md) | selected2/2实际PASS，同两key/body/同conversation再发原turn |
| CREATE已绑定后turn ACK丢失 | [source344f/exec7c7ee](continuous-fifth-validation.md) | selected2/2实际PASS，只retry原turn不再CREATE；[原parent失败](continuous-fourth-validation.md)保留 |
| Queue enqueue ACK丢失 | [source344f/execfafc](continuous-sixth-validation.md) | selected2/2实际PASS，同key/body/revision/item/sequence与两file顺序；不是promotion |
| 任务详情实时SSE交付 | [source d68/exec1357](continuous-seventh-validation.md) | selected2/2实际PASS，第二public消费者cancel后原stream给App新状态/timeline/cursor，无snapshot/events补读；不是assistant/conversation stream |
| profile/project/knowledge/双文件完整稿 | [source2e7203/exec7fb](continuous-tenth-validation.md) | selected2/2实际PASS，真实Prepare后保存、reload/reauth/显式Restore0新增POST/0正文prefetch、逆序验证保原refs、首turn匹配；前两红原样保留 |
| Steer草稿/unknown ACK/同页晚view | [sourcea803/execd06](stale-route-first-validation.md)、[root实际审](stale-route-first-root-review.json) | selected2/2实际PASS：同document/timeOrigin、原turn durable记录、public synthetic actor真实claim/session、两Steer同key/body/command回放及下一稿；不冒native消费或应用 |
| Steer慢存储跨deadline | [55b定向4case](final-p2-local-index.json) | 4受控PASS，旧50未选；晚accepted不降级，未发送屏障超时可重试 |
| 同baseURL/center只变principal；忽略abort迟到ready | [当前2f8 local](two-center-local/cleanup-receipt.json)、[root审](two-center-source-local-root-review.json) | 新2PASS/55未选，真实ConnectionSession/Journal/privateRecovery加受控transport；不冒公共principal rotation |
| 双真实center A→B→A→B | [设计](two-center-design-root-review.json)、[固定准备](two-center-preparation.json) | [2f8/exec2917 selected2实际PASS](two-center-first-validation.md)、[root限定接受](two-center-first-root-review.json)，actual lateGET=abortedWithoutDelivery；不冒deliveredRejected |

最新受影响Web noEmit为本次2f8，exit0；两新case+types保守charge7481/20000。原direct50/119/旧绿旅程没有重跑，不能称所有历史checks在同一target一次执行。16生产源与a803一致以Git blob证明；各后继harness检查分别绑定自己的target。

## 既有finding闭合映射

| 问题 | 修复/独立来源 | 当前证据限度 |
| --- | --- | --- |
| 默认checkpoint未激活；observer缺库造空v1/悬挂 | [7cc审](7cc-root-source-review.json)与direct38/50 | full7默认编辑/真实IDB链后续已过；malformed/blocked各支仍受控 |
| 恢复await覆盖新稿、并发restore | [2b01 root](2b01-restore-edit-root-approval.json)+peer及50 | 保完整draft revision/CAS，不冒所有挂载App并发交错 |
| 材料遗漏/反转、同route多稿与回焦 | [1b8审](1b8-material-root-review.json)、[8ed审](8ed-identity-focus-root-approval.json) | full7与completeDraft原refs/顺序/精确id/键盘已actual；目录可读性后继非本次阻断 |
| 背景read关闭选择表单；Steer屏障超时卡sending | [0141完整审](0141-feature-root-review.json)、[55b修复审](55b-p2-fix-root-review.json) | choice actual +4 controlled；保旧CHANGES_REQUESTED原件 |
| 长期hash监听捕获初始session、晚view绕过durable port | [原finding](stale-route-root-review.json)、[组合source/local审](stale-route-local-root-review.json) | current-committed callbacks，direct屏障及same-document实际Steer已通过；旧两SteerFAIL不回写 |
| harness callback helper/焦点前置/session过期时间/monitor退休 | [serialization](serialization-check/root-web-local-segment-20261007-review.json)、[1bc审](1bc-focus-precondition-root-review.json)、[0141审](0141-expiry-root-review.json)、[344审](monitor-retirement-root-review.json) | 历史FAIL与晚期/外层计费保真；后续对应actual通过不改旧红 |

更早P1/P2逐项来源保留于[quality](quality.md)与[历史review](../../../plans/wpf-conversation-recovery/review.md)，不再把55b/0141列为“当前target”。

## 完整验收剩余与边界

原TODO03按App/P01、完整稿与namespace定义已有分层实证，现completed；05仍需最终核对重连等未覆盖边界，actual lateGET只证明abort未交付，同center公开principal旋转无本片测试API、当前只受控证明。TODO06仍需完整feature独立结论与合法main接收。两DB新phase90s实际charge13020/余76980，旧90/150/Steer60/route90全部closed，不借余额；[当前phase](two-center-phase.json)与[连接配置](two-center-connections.json)列实际与配置区别。准备文件的NOT_RUN及SHA是执行前2917历史状态，不替代本轮actualmanifest。

真正runner/provider consumed/applied、Queue promotion、assistant流协议消费及其他owner公共认证合同保证是跨owner能力/未验依赖，不能临时新增为本Web渲染/触发/缓存片必须启动provider的前置；本片不宣称它们已证。IDB strict是UA耐久hint，不保证断电/用户清库永久保存。

GO恢复目录可读性后继继续归原MATURE01/06：轻metadata标题/内容摘要/本地Intl时间、精确identity/UTC留details，不预取正文；空text不推重复、不自动合并/删稿/重发。此后继不阻已有恢复行为限定交付，也未在本次源码混入。
