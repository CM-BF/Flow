# WPF-RECOVERY01 独立审查

状态：NOT_STARTED。

Review target commit：UNKNOWN。Base：84005a260dfcb668cd38b09c21564d0754a0f513。当前scope为[receipt](../../docs/evidence/wpf-conversation-recovery/take-receipt.json)的21literal；完整实现必须含真实App/P01消费者和四类原controller，不以独立journal通过代替交付。

可复制只读审查任务：先核本worktree/branch/HEAD/dirty、AGENTS与plan/status；固定实现后完整读scope，检查cookie连接与namespace、同步receipt→strict事务complete/CAS→HTTP、CREATE两阶段、完整草稿和材料、跨tab冲突/unknown原key、P01私有授权、资源/字节预算。按已授权隔离检查，明确作者与独立证据、未验中心/个人服务。所有finding回owner，不写实现。

检查：NOT_RUN。Blocking findings：未评估。独立结论：未审查。当前不表示通过。

## 阶段源码预检（不是最终feature审查）

2498 binding源码由root限定认可，新增22case尚待资源。未来browser harness另有[RB1–RB4](../../docs/evidence/wpf-conversation-recovery/2498-browser-preflight-review.json)运行前finding：RB1–3已在本段源码修正、待独立核；RB4最高风险材料/无reload场景已备，实际运行覆盖仍为零，其余覆盖差距显式保留。当前总review仍NOT_STARTED，不把4ba20/20或类型通过扩大为App/PG/浏览器通过。

7244 peer worker预检：[固定报告](../../docs/evidence/wpf-conversation-recovery/7244-worker-report.md)。P2：ready Input与实际composer恢复同步/断言缺口，源码修复中、未验；SSE握手和键盘焦点范围需准确限定。不是实际运行失败或整体APPROVED。

15:34 source-only修正：Thread独立状态触发+原附件binding sync方法，准备watcher生命周期不变；按lease/identity/held/current/inTransit防重复或旧材料追加。现2个新直接case与browser实际chip断言未运行。SSE覆盖限握手，Enter/Escape范围准确。待新固定源审查，未把P2标行为CLOSED。

材料同步局部待审固定source：`02d5a49aa2f17261d7dfcc9590f433c84b10defe`（2生产+2专测，对7244）。本次只有diffcheck0，未运行类型/行为；完整feature审查仍NOT_STARTED。

02d局部审查CHANGES_REQUESTED：[原报告](../../docs/evidence/wpf-conversation-recovery/02d-material-review.json)。P1选中但未进入composer的材料可被静默遗漏，P2分批验证可改变原序。当前源码修复中，未标行为CLOSED；正式feature target仍UNKNOWN。

15:46 source-only后继固定 `1b8a335ecf26ece7539ad19e634508ac12ca3729`（5源，对02d）：M1/M2已按源码修正，27case和更新browser均NOT_RUN；[固定manifest](../../docs/evidence/wpf-conversation-recovery/material-integrity-checkpoint.json)。原controller/官方runtime不改，完整feature审查仍NOT_STARTED，等待独立窄审。
