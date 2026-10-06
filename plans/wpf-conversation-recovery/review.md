# WPF-RECOVERY01 独立审查

状态：NOT_STARTED。

Review target commit：UNKNOWN。Base：84005a260dfcb668cd38b09c21564d0754a0f513。当前scope为[receipt](../../docs/evidence/wpf-conversation-recovery/take-receipt.json)的21literal；完整实现必须含真实App/P01消费者和四类原controller，不以独立journal通过代替交付。

可复制只读审查任务：先核本worktree/branch/HEAD/dirty、AGENTS与plan/status；固定实现后完整读scope，检查cookie连接与namespace、同步receipt→strict事务complete/CAS→HTTP、CREATE两阶段、完整草稿和材料、跨tab冲突/unknown原key、P01私有授权、资源/字节预算。按已授权隔离检查，明确作者与独立证据、未验中心/个人服务。所有finding回owner，不写实现。

当前作者局部检查：固定1b8的27 direct PASS；首667真实browser子集FAILED（cookieRead PASS、textIntentDraft FAILED），原始原因待核；当前types未新增。Blocking findings：完整feature未评估。独立结论：完整feature未审查。当前不表示通过。

## 阶段源码预检（不是最终feature审查）

2498 binding源码由root限定认可，新增22case尚待资源。未来browser harness另有[RB1–RB4](../../docs/evidence/wpf-conversation-recovery/2498-browser-preflight-review.json)运行前finding：RB1–3已在本段源码修正、待独立核；RB4最高风险材料/无reload场景已备，实际运行覆盖仍为零，其余覆盖差距显式保留。当前总review仍NOT_STARTED，不把4ba20/20或类型通过扩大为App/PG/浏览器通过。

7244 peer worker预检：[固定报告](../../docs/evidence/wpf-conversation-recovery/7244-worker-report.md)。P2：ready Input与实际composer恢复同步/断言缺口，源码修复中、未验；SSE握手和键盘焦点范围需准确限定。不是实际运行失败或整体APPROVED。

15:34 source-only修正：Thread独立状态触发+原附件binding sync方法，准备watcher生命周期不变；按lease/identity/held/current/inTransit防重复或旧材料追加。现2个新直接case与browser实际chip断言未运行。SSE覆盖限握手，Enter/Escape范围准确。待新固定源审查，未把P2标行为CLOSED。

材料同步局部待审固定source：`02d5a49aa2f17261d7dfcc9590f433c84b10defe`（2生产+2专测，对7244）。本次只有diffcheck0，未运行类型/行为；完整feature审查仍NOT_STARTED。

02d局部审查CHANGES_REQUESTED：[原报告](../../docs/evidence/wpf-conversation-recovery/02d-material-review.json)。P1选中但未进入composer的材料可被静默遗漏，P2分批验证可改变原序。当前源码修复中，未标行为CLOSED；正式feature target仍UNKNOWN。

15:46 source-only后继固定 `1b8a335ecf26ece7539ad19e634508ac12ca3729`（5源，对02d）：M1/M2已按源码修正，27case和更新browser均NOT_RUN；[固定manifest](../../docs/evidence/wpf-conversation-recovery/material-integrity-checkpoint.json)。原controller/官方runtime不改，完整feature审查仍NOT_STARTED，等待独立窄审。

## 2026-10-06 15:55 UTC — 1b8 独立源码窄复核（非feature审批）

固定checkpoint `1b8a335ecf26ece7539ad19e634508ac12ca3729`，对照 `02d5a49aa2f17261d7dfcc9590f433c84b10defe`。Root [原始结论](../../docs/evidence/wpf-conversation-recovery/1b8-material-root-review.json)的实际时点为2026-10-06T15:52:25.524058Z；W01 [原报告](../../docs/evidence/wpf-conversation-recovery/1b8-material-peer-review/report.md)及[sources](../../docs/evidence/wpf-conversation-recovery/1b8-material-peer-review/sources.json)原样保留。

- RECOVERY02D-M1/P1：源码ADDRESSED，所有Send/Queue在receipt/core send前验证完整Input选择、ready事实和composer有序一致，零chip不能降为纯文字。
- RECOVERY02D-M2/P2：源码ADDRESSED，分批先B后A只同步ready前缀，原序及每await后租期/身份检查保留；执行门禁另拒部分或乱序。
- 本局部无新增blocking。两reviewer均0运行；当前27 direct、types、实际browser NOT_RUN，不把controlled port源码断言当React/HTTP已通过。

完整feature结论仍NOT_STARTED、targetUNKNOWN；原4ba20/20、2498与7244限定源码记录各保原范围。作者本次仅归档与metadata更新，五固定源不改。

## 2026-10-06 16:23 UTC — 作者27 direct证据已到，完整审查未开始

[原始日志](../../docs/evidence/wpf-conversation-recovery/direct-second.log)27/27 PASS，来源execution HEAD0eef/固定implementation1b8/19hash，supervisor2.034s、清理fulfilled。此为作者受控IDB事件端口与public-client mock fetch运行，尚非root独立复跑或真实浏览器验证。M1/M2先前源码addressed结论保留；新增定向行为证据不扩大为完整feature APPROVED。当前types/browser NOT_RUN、targetUNKNOWN、reviewNOT_STARTED；所有旧原始证据保持。

Root于2026-10-06T16:23:29.859009Z独立核原始六文件/归档逐字、19固定blob和gate/run、配置与清理，并读新增材料实际case，结论 [DIRECT27_EVIDENCE_ACCEPTED_SCOPED](../../docs/evidence/wpf-conversation-recovery/direct-second-root-review.json)。该结论接受本次受控证据，未独立重跑、不推真实IDB/挂载Thread/HTTP/cookie/browser，完整feature review仍NOT_STARTED。

## 2026-10-06T17:14:15.495150+00:00 — fixture native HTTP源码修正待窄审

Source checkpoint `ec91d1113898e70f380f9bb503f3b5ceff9467b2`，相对1b8只有原fixture。Root认可旧代理Host不保留的readiness推断，未给本修正运行或APPROVED。当前[manifest](../../docs/evidence/wpf-conversation-recovery/native-proxy-checkpoint.json)明确19源码、18不变及待验清单；多Set-Cookie、SSE/abort/错误路径尚无实证。本片当前types/direct/browser均NOT_RUN，历史1b8 direct27接受范围保留；三项中心语义和完整feature审查仍开放。

## 2026-10-06T17:35:32.287102+00:00 — 两harness源码候选待窄审

固定 `7686139952becf530bcf57966425bd9d7b88b697`，原ec91→本段仅fixture/browser变化，17其他源不变。作者只静态diffcheck0；当前types/direct/browser均NOT_RUN，完整feature仍NOT_STARTED/targetUNKNOWN。两个实际PG连接观察时序按本树真实依赖源码修正，未归因TUI实测；body-loss从已审RELEASE方法适配但不移用其运行证据。[manifest](../../docs/evidence/wpf-conversation-recovery/bodyloss-checkpoint.json)与[限制](../../docs/evidence/wpf-conversation-recovery/bodyloss-source.md)供独立源码审查。

## 2026-10-06T17:43:28.863916+00:00 — 768 P2修正待独立复审

[Root原文](../../docs/evidence/wpf-conversation-recovery/768-root-source-review.json)及[peer原文](../../docs/evidence/wpf-conversation-recovery/768-peer-review/report.md)原样保留：768仅一项P2，turn.taskId不存在可使undefined等于undefined。作者固定 `667889058d3decc0abc9f635a37fd0f05f2c090c`，只browser改用公共schema/decoder及非空嵌套身份断言，[manifest](../../docs/evidence/wpf-conversation-recovery/ack-identity-checkpoint.json)核18源不变。作者标SOURCE_ADDRESSED待review；没有types/direct/browser运行，没有全feature批准。1s观察policy不冒pool acquire/hard settlement上限。

## 2026-10-06T17:45:10.279831+00:00 — Root限定源码APPROVED

独立reviewer root；时间 `2026-10-06T17:44:07.363712+00:00`；target `667889058d3decc0abc9f635a37fd0f05f2c090c`，observedmetadata0926。结论 **APPROVED_SOURCE_SCOPED / 0 blocking**，关闭RECOVERY-768-P2-TASK-IDENTITY。[逐字原报告](../../docs/evidence/wpf-conversation-recovery/667-root-ack-identity-review.json)核19hash，确认worker公共schema/decoder与非空turn/task身份、18源等768。批准仅768+667 harness源码；0types/import/tests/HTTP/PG/Chrome/free，不替代真实浏览器。旧1b8受控27PASS仍原绑定；完整feature review NOT_STARTED/targetUNKNOWN，主线未接。

## 2026-10-06 18:01 UTC — 作者首真实浏览器证据（未独审）

[原报/manifest](../../docs/evidence/wpf-conversation-recovery/browser-first-validation.md)绑定execution0fe939与667/768/1b8十九源；cookieRead通过，草稿旅程对象仓库缺失+predicate timeout，后续未运行。清理全确认，14.846s，未修改源码或重跑。Root此前APPROVED_SOURCE_SCOPED不升级为行为通过；此次失败待独立核与因果定位，不预判来源或删断言。完整feature NOT_STARTED/targetUNKNOWN保持。

## 2026-10-06 18:17:58 UTC — 首轮失败限定源审与作者修复

Root [原报告](../../docs/evidence/wpf-conversation-recovery/667-first-failure-root-review.json)针对667/2f32结论CHANGES_REQUESTED_SOURCE_SCOPED：REC667-P1-ACTIVATION/P1、REC667-P2-OBSERVER/P2。报告及peer因果报告原样归档。原667 ACK源批准仅原语义断言，不覆盖这两finding。

作者修复checkpoint `7cc7629b6603a6ccc7e2ab6143125dea8daae685`，5源/14其他源不变，[manifest](../../docs/evidence/wpf-conversation-recovery/idb-lifecycle-checkpoint.json)。默认启动通过原host仅registered+configured+authorized；更新actions和host转移共用sync，active后同namespace新generation可重放现有draft，旧namespace不转存；disabled/failed不自动启动。观察器缺库abort upgrade+pending，malformed/sync throw/blocked/timeout统一拒绝关闭，不修库。新增12用例源码未运行，首次真实失败原raw保留。

本修复独立结论PENDING；完整feature仍NOT_STARTED/targetUNKNOWN，剩余预算不代表运行许可。
