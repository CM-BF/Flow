# WPF-MATURE-06 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 14:09 UTC |
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
| 当前产出 | 连接与持久草稿恢复正在接线，部分源码Web类型检查通过；原21实现范围继续，临时依赖写权已归还 |
| 下一可用交付 | 先实现原回执同步接管和持久检查点、完整材料恢复及真实插件入口，再按资源条件验证刷新与显式原key恢复 |
| 当前阻塞 | ACTIVE: 可用空间低于1GiB保留额，暂停新依赖和浏览器/PG/构建；小源码继续，最终旅程还需对齐callerOrigin、迟到注销Cookie及重复连接名额语义 |
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
| WPF-MATURE-06-03 | in-progress | Web co-lead | 成功回复默认入口收敛，error/unknown/decision常显；390须区分侧栏开/关场景，自然状态/Details按需绑定普通hi、stream/tool、queue等待、断线unknown四旅程；ACTIVITYREAD仅展开活动区，queue/stream/react与全组合仍开放；正文规则不冒工程Verified，产物版本/source未绑定须限定或unknown，关联ENG-001后继；[细目](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。 |
| WPF-MATURE-06-04 | in-progress | Web co-lead | 下一完整旅程优先：有效期刷新/重开同中心会话、草稿及未决原identity；离线/认证过期/拒绝可行动提示，重认证不自动重投，logout≠cancel；真实HTTP+流、多tab/中心/撤销/重启/lostACK，auth与发送恢复独立Module。中心native_center_owner035119fd v1九scope已COMMITTED；panels RECOVERY01已新21scope COMMITTED并正式派工；个人服务不动/0provider，完整验收见plan。 |
| WPF-MATURE-06-05 | pending | Web co-lead | 后台更新不抢用户历史滚动；voice能力显式，不可用/失败可回文本并保草稿，无自动模型调用。 |
| WPF-MATURE-06-06 | pending | Web co-lead | 实际App fixture覆盖失败/恢复/双pane；明确预算后单次真实provider观察，至少两次正文增长才称增量，没有partial如实记录不补query。 |

## 依赖与领取

STEER模块已main，STEIRI01十三scope已main f181并释放；CONTEXTI已释放；CHAT10 admission/公共client已固定，个人steering仍off。真实provider观察预算须单独明确；voice公开输入依赖待核。

已有[ACK01共享回执消费](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-shared-ack-consumer/plans/wpf-ack01-shared-consumer/status.md)已正式main e4c82且原a267 v2释放；不沿旧七scope授权新恢复实现。既有子任务各自唯一来源：[STEIRI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-integration/plans/wpf-steer-i01-integration/status.md)、[ACTIVITYREAD01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-readability/plans/wpf-activity-readability/status.md)；已收模块历史见[STEER01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-control/plans/wpf-steering-control/status.md)。功能通过不等用户个人runtime已启用；源码main与服务owner最新固定产物回执分开，旧32c/v9仅历史。

root10:44–10:45已实际核本大task身份/co-lead与相关子片领取，见[真实页面专项](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)；此项通过不代表本大task完整功能验收完成。

调度以[GO经root原指令](../../docs/evidence/web-platform/connection-recovery-priority.md)为准。ATTACHI02已main cde并旧scope释放；恢复实现从正式组合84005独立新树开始，Arc18候选未领取。T3固定9bd1/MIT只借鉴职责与epoch方法，不引入外部实现。

RECOVERY01直接子task由workspace_panels_owner唯一实施；新树 `web-conversation-recovery / codex/web-conversation-recovery`，**6ff988b2-c8cc-4c05-ae12-b3d7af87f2ab v1** fresh21 scope COMMITTED13:46:08.213Z，[回执](../../docs/evidence/web-platform/recovery01-take-receipt.json) / [来源资源及派工审计](../../docs/evidence/web-platform/recovery01-dispatch-audit.json)。首canonical dcaf6356已到，实际parser0/6TODO/人类完整，[SOURCE_READY](../../docs/evidence/web-platform/recovery01-source-ready.json)待Lead正常登记；当前源码dirty实施、未获审批，dashboard取权可从D04读取；没有另造手填子任务进度。

F01 clientd6d与production9406独审已闭合，domain582f及13源正式main84005且hash一致；本批Lead实际组合selected1pass/2unselected和root/Webtypes0，不是13tests、未重跑领域全量。factory会话仍显式opt-in，Node jar/loopback不替代本片浏览器cookie→read→SSE→reload；个人入口未变。

原21[批准Interface](../../docs/evidence/web-platform/recovery01-fixed-cde-proposal.json)保持：同步原authority receipt接管后durable prepare/dispatching事务complete/CAS才HTTP，CREATE两步、完整draft与有序材料、P01真入口和权限绑定；存储失败可继续编辑但0mutation，unknown不降级不自动重投。完整envelope128KiB+32KiBreserve/4MiB候选已获结构批准，仍待实际serializer/IDB准入验证，不保证数量满载。

仅轻量代码/metadata先开工；13:46实际建后available1,416,241,152B事实不改。按[13:49最新政策](../../docs/evidence/web-platform/resource-policy-1349.json)，仅SVC06需2.5GiB，其他Web新产物/依赖复制先估峰值并留约1GiB；当前仍无build许可。真实App/HTTP仍累计90秒含15秒清理/8MiB/1PG+1Chrome，开始前复核资源；center三语义并行，是最终验收gate而非第一行代码blocker。上传journal跨tabCAS仍独立未解，未因本片设计冒称修复。

最新两轮依赖/类型诊断及原始红日志见[窗口记录](../../docs/evidence/web-platform/recovery01-dependency-window.json)；全部依赖写停后v4恢复原21scope。第二types0只属于82d78阶段源码；[五项独立早期finding](../../docs/evidence/web-platform/recovery01-82d78-root-readonly-findings.json)待原owner修复，未形成feature终审。当前资源决定见[分时记录](../../docs/evidence/web-platform/resource-admission-1405.json)，不重复采样或将整体目标标阻塞。
