# WPF-RECOVERY01 独立审查

状态：NOT_STARTED。

Review target commit：UNKNOWN。Base：84005a260dfcb668cd38b09c21564d0754a0f513。当前scope为[receipt](../../docs/evidence/wpf-conversation-recovery/take-receipt.json)的21literal；完整实现必须含真实App/P01消费者和四类原controller，不以独立journal通过代替交付。

可复制只读审查任务：先核本worktree/branch/HEAD/dirty、AGENTS与plan/status；固定实现后完整读scope，检查cookie连接与namespace、同步receipt→strict事务complete/CAS→HTTP、CREATE两阶段、完整草稿和材料、跨tab冲突/unknown原key、P01私有授权、资源/字节预算。按已授权隔离检查，明确作者与独立证据、未验中心/个人服务。所有finding回owner，不写实现。

当前作者局部检查：固定1b8的27 direct PASS；真实browser/当前types NOT_RUN。Blocking findings：完整feature未评估。独立结论：完整feature未审查。当前不表示通过。

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
