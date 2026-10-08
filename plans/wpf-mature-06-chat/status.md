# WPF-MATURE-06 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-08T01:44:57.267Z |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 本父任务历史实际开工无独立证据，不从claim/commit倒推；整体目标仍未完成，各子片实际时间只沿唯一owner原件。 |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-06](plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| 单一status owner / model | d01_owner / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management |
| Branch | codex/web-platform-management |
| 工作基线 / HEAD | 管理基线d444608ab6c796c731e44e51a892868bf39bec2a；当前HEAD/dirty由Git聚合 |
| 工作分支状态 | in-progress |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 1 |
| 当前产出 | 登录cc4生产组件synthetic props六组与两390图已限定独审通过，三轮25016CLOSED/两失败保留；真实认证、完整App和main仍未验。 |
| 下一可用交付 | 沿唯一main-intake受控合并App窄提取与登录组件；真实认证/完整App另验，不以纯props替代。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | UNKNOWN |
| 实现范围 | plans/wpf-mature-06-chat |
| 检查状态 | NOT_RUN；当前为整体计划，已有子片检查只沿各canonical，不继承为全体验收 |
| 已集成main状态 / HEAD | 局部STEIRI01与ACTIVITYREAD01已INTEGRATED f181d84b5fb3652d62e2a181acff442d42b3e066；整个大task尚未验收，个人产物未据此更新 |
| Review | [review.md](review.md)，NOT_STARTED；完整大task未验收 |
| 写权 | 管理632a7149 v3仅本计划目录；实现子task各自claim不由本表替代 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-06-01 | in-progress | Web co-lead | 逐条引用stream/activity/queue/readability固定证据与限制，模块/fixture/真实provider分开，不重复勾整体Done。 |
| WPF-MATURE-06-02 | in-progress | Web co-lead | admission仅快照非许可，POST重验、原key unknown、receiptRevision更新、received不冒模型遵从；模块和App接线分别验收。 |
| WPF-MATURE-06-03 | in-progress | Web co-lead | 成功回复默认入口收敛，error/unknown/decision常显；390须区分侧栏开/关场景，自然状态/Details按需绑定普通hi、stream/tool、queue等待、断线unknown四旅程；ACTIVITYREAD仅展开活动区，queue/stream/react与全组合仍开放；正文规则不冒工程Verified，产物版本/source未绑定须限定或unknown，关联ENG-001后继；[细目](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。新增[累计活动缓存覆盖输入](../../docs/evidence/web-platform/activity-cache-total-bound/report.md)仅文档限定批准/产品未实施未测量。  U18恢复列表可读性按[既有计划](plan.md)待后继；不改原full7范围。 |
| WPF-MATURE-06-04 | in-progress | Web co-lead | 下一完整旅程优先：有效期刷新/重开同中心会话、草稿及未决原identity；离线/认证过期/拒绝可行动提示，重认证不自动重投，logout≠cancel；真实HTTP+流、多tab/中心/撤销/重启/lostACK，auth与发送恢复独立Module。原中心与Recovery的历史取权见原件；Recovery原01–06工程已[main完成并释放](../../docs/evidence/web-platform/release-c3-actual-admission-20261007/recovery-final-release-receipt.json)，实际能力与边界沿[唯一owner status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery/plans/wpf-conversation-recovery/status.md)，不据此宣称整个大task通过。 新增[真实依赖/精确选择要求](../../docs/evidence/web-platform/quick-b3-admission-20261007/recovery-validation-dependencies.json)，局部通过不代替完整E2E；该准备时点尚未第五跑为历史，后续实际以owner唯一status为准。  原 TUI001-06/08 的 queue resume ACK 共享语义按[既有计划](plan.md#queue-resume-ack-共享语义后继)排后继：两消费者身份一致，矛盾保持原 key/body UNKNOWN；未实施/未复现。 |
| WPF-MATURE-06-05 | pending | Web co-lead | 后台更新不抢用户历史滚动；voice能力显式，不可用/失败可回文本并保草稿；[GO官方adapter候选](../../docs/evidence/web-platform/voice-official-adapter-go-research.json)与[root stop/cancel研究](../../docs/evidence/web-platform/voice-stop-cancel-core0322-root.json)仅只读后继，明确停止等待final/取消丢弃/Flow lease；无mic/自动模型调用。 |
| WPF-MATURE-06-06 | pending | Web co-lead | 实际App fixture覆盖失败/恢复/双pane；明确预算后单次真实provider观察，至少两次正文增长才称增量，没有partial如实记录不补query。 |

## 依赖与领取

STEER模块已main，STEIRI01十三scope已main f181并释放；CONTEXTI已释放；CHAT10 admission/公共client已固定，个人steering仍off。真实provider观察预算须单独明确；voice公开输入依赖待核。

已有[ACK01共享回执消费](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-shared-ack-consumer/plans/wpf-ack01-shared-consumer/status.md)已正式main e4c82且原a267 v2释放；不沿旧七scope授权新恢复实现。既有子任务各自唯一来源：[STEIRI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-integration/plans/wpf-steer-i01-integration/status.md)、[ACTIVITYREAD01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-readability/plans/wpf-activity-readability/status.md)；已收模块历史见[STEER01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-control/plans/wpf-steering-control/status.md)。功能通过不等用户个人runtime已启用；源码main与服务owner最新固定产物回执分开，旧32c/v9仅历史。

root10:44–10:45已实际核本大task身份/co-lead与相关子片领取，见[真实页面专项](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)；此项通过不代表本大task完整功能验收完成。

调度以[GO经root原指令](../../docs/evidence/web-platform/connection-recovery-priority.md)为准。ATTACHI02已main cde并旧scope释放；该恢复准备历史从正式组合84005独立新树开始；当时 Arc18 尚未领取。当前 Arc 已沿独立工作区组合任务精确领取20项，实际以其唯一 status 为准。T3固定9bd1/MIT只借鉴职责与epoch方法，不引入外部实现。

## Recovery 历史实施入口（仅保来源，不用于当前派工）

RECOVERY01直接子task由workspace_panels_owner唯一实施；新树 `web-conversation-recovery / codex/web-conversation-recovery`，**6ff988b2-c8cc-4c05-ae12-b3d7af87f2ab v1** fresh21 scope COMMITTED13:46:08.213Z，[回执](../../docs/evidence/web-platform/recovery01-take-receipt.json) / [来源资源及派工审计](../../docs/evidence/web-platform/recovery01-dispatch-audit.json)。首canonical dcaf6356已到，实际parser0/6TODO/人类完整，[SOURCE_READY](../../docs/evidence/web-platform/recovery01-source-ready.json)为历史首入口；后续d679/Lead14:51:18正式登记已闭合。该首take与后来v4/21均历史；当前领取已v6 RELEASED，完成内容以owner287947唯一status与上述释放回执为准。

F01 clientd6d与production9406独审已闭合，domain582f及13源正式main84005且hash一致；本批Lead实际组合selected1pass/2unselected和root/Webtypes0，不是13tests、未重跑领域全量。factory会话仍显式opt-in，Node jar/loopback不替代本片浏览器cookie→read→SSE→reload；个人入口未变。

原21[批准Interface](../../docs/evidence/web-platform/recovery01-fixed-cde-proposal.json)保持：同步原authority receipt接管后durable prepare/dispatching事务complete/CAS才HTTP，CREATE两步、完整draft与有序材料、P01真入口和权限绑定；存储失败可继续编辑但0mutation，unknown不降级不自动重投。完整envelope128KiB+32KiBreserve/4MiB候选已获结构批准，仍待实际serializer/IDB准入验证，不保证数量满载。

仅轻量代码/metadata先开工；13:46实际建后available1,416,241,152B事实不改。按[13:49最新政策](../../docs/evidence/web-platform/resource-policy-1349.json)，仅SVC06需2.5GiB，其他Web新产物/依赖复制先估峰值并留约1GiB；当前仍无build许可。真实App/HTTP仍累计90秒含15秒清理/8MiB/1PG+1Chrome，开始前复核资源；center三语义并行，是最终验收gate而非第一行代码blocker。上传journal跨tabCAS仍独立未解，未因本片设计冒称修复。

最新两轮依赖/类型诊断及原始红日志见[窗口记录](../../docs/evidence/web-platform/recovery01-dependency-window.json)；全部依赖写停后v4恢复原21scope。第二types0只属于82d78阶段源码；[八项独立早期finding及来源](../../docs/evidence/web-platform/recovery01-foundation-review-intake.json)待原owner修复，未形成feature终审。当前资源决定见[分时记录](../../docs/evidence/web-platform/resource-admission-1405.json)，不重复采样或将整体目标标阻塞。


历史固定源码安全点4ba、后继2498当时类型累计52.814/60s（余7.186）与原f13部分复核历史见[集中handoff](../../docs/evidence/web-platform/mature-task-handoff.md)。20direct受控基线已20/20，R4-1未覆盖、真实IDB/browser未验，正式review仍NOT_STARTED；d679已登记，Lead14:51:18实际161来源，两项live/parser0/人读完整，非管理页面复采。

历史17:18 [ec91 fixture固定接收](../../docs/evidence/web-platform/recovery01-ec91-intake.json)与[root独立源审](../../docs/evidence/web-platform/recovery01-ec91-native-proxy-root-review.json)只确认Host/SSE/清理接缝源码修复，未运行新fixture；原1b8受控27保原目标。丢ACK注入的浏览器透明retry前提和三中心语义仍须真实验收，full review仍NOT_STARTED。

本安全点：7cc两项源码修复已获限定独审，单次[38项受控检查通过](../../docs/evidence/web-platform/recovery01-38-check-intake.json)并获[root限定实证接收](../../docs/evidence/web-platform/recovery01-38-root-evidence-review.json)，owner3896已封存。它们归原06-04，不改变[首轮真实浏览器失败及清理](../../docs/evidence/web-platform/recovery01-browser-first-intake.json)，真实IDB/浏览器与完整旅程仍未复验。[accepted queue后继](../../docs/evidence/web-platform/accepted-queue-506-intake.json)归原06-03；整体大task检查仍未通过，不继承子片绿色结果。

本轮[实际失败与清理回执](../../docs/evidence/web-platform/recovery01-8ed-actual/window.json)保4项完成检查与失败阶段，不等完整feature批准；晚终态累计38364.050667ms/余51635.949333ms，未来整数上限51635ms仅算术。原owner随后固定单browser源码9835/metadata79fe，尚待独审和局部检查；该修正不改变本次8ed失败与实际预算，唯一子片status继续权威。

局部修复实际来源：[本队实际检查独审](../../docs/evidence/web-platform/current-product-checkpoint-20261007/local-results-review.json)已接受原9835转译反例及修复十断言；owner7440b59已封存，无重复运行。原rec8ed失败与晚累计38364.050667ms保留，未来浏览器整数余量≤51635ms含15000ms清理，非新运行许可；详[唯一Recovery状态](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery/plans/wpf-conversation-recovery/status.md)。

本次当前摘要按既有NONE/ACTIVE合同校准，[三份父status实际元数据解析](../../docs/evidence/web-platform/checkpoint-0400-20261007/parent-human-parser.json)均errors=[]、human.complete=true/missing=[]；不是产品检查或新页面采样。

2026-10-07T04:13:44.010Z：SVC06实际专库与服务组清理已归还，解除此前共享PG等待；本任务仍须自身fresh准入完成剩余真实浏览器验收，不继承D06窗口。来源见[中央实际回执](../../docs/evidence/web-platform/checkpoint-0413-20261007/incoming.json)。

共享惰性reasoning实现仅关联[MATURE06-LAZY01唯一source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/lazy-reasoning-reads/plans/mature06-lazy-reasoning/status.md)，Mika/status_read原11scope；本父不复制其TODO或运行进度，登记/加载由Execution Lead确认。

历史08:57完整草稿首轮及修正见[本次限定接收](../../docs/evidence/web-platform/browser-interface-checkpoint-20261007/current.json)：原cookieRead通过，profile header定位超时使整体失败且未进入CREATE/turn；bc3/ad4在首轮收口时clean；随后第二次已真实复验仍整体FAIL，恢复/B→A/knowledge部分断言通过，最后receipt accepted为undefined待定位。新run证据待原owner封存，150s累计114654/余35346，未冒完整group通过。此前已过旅程保持，完整子片仍IN_PROGRESS，不能用源码修正补PASS。

历史09:01接收的[第二次实际失败独审](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/recovery-complete-second-actual-review.json)确认测试将不同的command id与turnKey混用；新2e7203e按精确frozen.turnKey唯一匹配，保accepted及完整request/ACK检查，当时未运行复验。Owner7fb3947d为该时点clean、原21scope保留，150s累计114654/余35346。LAZY公共模块已main e2b，当前Recovery/App未消费；b2b产物构建归还不等个人安装或兼容通过。

随后原同源第三次[实际选定2/2通过](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/current.json)，outer09:10:12.377068结束、09:10:28.080735全部owned清理/env精确删除后已归还Mika；charge11793后150s累计126447/余23553。独立实际审已接受、完整大task不通过，原两FAIL和部分证据不改，owner已27f2515正常push/remote同clean；后续仅只读Steer/第二中心依赖比较，不自动用余量运行。

共享读取上界片仅关联[MATURE06-READBOUND01 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/client-read-bounds/plans/mature06-client-read-bounds/status.md)，Mika/db_transaction_owner原独立树；[原登记请求](../../docs/evidence/web-platform/svc06-return-steer-handoff-20261007/readbound-registration-request.json)已由[正式main/194登记回执](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/readbound-main-intake.json)接收，不复制实现/TODO/运行进度，不冒MATURE06整体完成。

**历史Steer修复准备快照：** 原RECOVERY01两次Steer实际失败均清理归还，0SteerPOST/恢复验收未过；原60s段不再消费。原owner沿21scope[修复与新有限回归](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/recovery-route-fix-segment.json)，当前仅source，不增加第二业务status或越权占用App。

原 MATURE06-04 键盘验收新增[实际消费者 @file 边界](plan.md#file-快捷键的实际聊天消费者边界)，仅静态发现/未实现；优先发布与已排视觉片，不冒整个键盘矩阵已验。

MATURE06-03/04/05同一后继新增[官方Thread动作与草稿保护边界](plan.md#官方-thread-动作与草稿保护的后继边界)：Quote现未接入，仅固定源设计输入；未来须保持完整冻结/权限和unknown草稿语义。content-visibility/defer不冒有界DOM，实际优化仍需证据，当前无take/实现/运行。
