# WPF-MATURE-06 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 13:05 UTC |
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
| 当前产出 | 聊天补充指令与活动简化已进入主线；完整聊天和真实服务验收仍开放 |
| 下一可用交付 | 附件与获审dashboard安全点后，优先06-04连接/刷新/未决发送恢复完整旅程；Arc/装饰后排 |
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
| WPF-MATURE-06-03 | in-progress | Web co-lead | 成功回复默认入口收敛，error/unknown/decision常显；390须区分侧栏开/关场景，自然状态/Details按需绑定普通hi、stream/tool、queue等待、断线unknown四旅程；ACTIVITYREAD仅展开活动区，queue/stream/react与全组合仍开放；正文规则不冒工程Verified，产物版本/source未绑定须限定或unknown，关联ENG-001后继；[细目](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。 |
| WPF-MATURE-06-04 | pending | Web co-lead | 下一完整旅程优先：有效期刷新/重开同中心会话、草稿及未决原identity；离线/认证过期/拒绝可行动提示，重认证不自动重投，logout≠cancel；真实HTTP+流、多tab/中心/撤销/重启/lostACK，auth与发送恢复独立Module。中心native_center_owner已指派/未收COMMITTED；panels Web/Recovery pending legal scope；个人服务不动/0provider，完整验收见plan。 |
| WPF-MATURE-06-05 | pending | Web co-lead | 后台更新不抢用户历史滚动；voice能力显式，不可用/失败可回文本并保草稿，无自动模型调用。 |
| WPF-MATURE-06-06 | pending | Web co-lead | 实际App fixture覆盖失败/恢复/双pane；明确预算后单次真实provider观察，至少两次正文增长才称增量，没有partial如实记录不补query。 |

## 依赖与领取

STEER模块已main，STEIRI01十三scope已main f181并释放；CONTEXTI已释放；CHAT10 admission/公共client已固定，个人steering仍off。真实provider观察预算须单独明确；voice公开输入依赖待核。

已有[ACK01共享回执消费](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-shared-ack-consumer/plans/wpf-ack01-shared-consumer/status.md)已正式main e4c82且原a267 v2释放；不沿旧七scope授权新恢复实现。既有子任务各自唯一来源：[STEIRI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-integration/plans/wpf-steer-i01-integration/status.md)、[ACTIVITYREAD01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-readability/plans/wpf-activity-readability/status.md)；已收模块历史见[STEER01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-control/plans/wpf-steering-control/status.md)。功能通过不等用户个人runtime已启用；源码main与服务owner最新固定产物回执分开，旧32c/v9仅历史。

root10:44–10:45已实际核本大task身份/co-lead与相关子片领取，见[真实页面专项](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)；此项通过不代表本大task完整功能验收完成。

调度以[GO经root原指令](../../docs/evidence/web-platform/connection-recovery-priority.md)为准；panels暂先只读方案，ATTACHI02 v3当前App/session等范围保留待main，Arc18候选未领取。两已有Connect页不用于推断断线原因，T3后续root已核9bd1/MIT，方法audit已归档；未采用实现或声称恢复完成。

恢复方案已获root方向批准，仅Interface/合法owner协调；中心writer已由Lead指定native_center_owner，028已预留，尚未收到COMMITTED；六项consumer接口待固定。Web consumer/Recovery拟workspace_panels_owner **pending legal scope，尚未take**。ATTACHI02 main/release后再取App交集；4MiB/32/128仍候选非定案，完整checkpoint身份/下一草稿及跨账号隔离必验。[具体dispatch输入](../../docs/evidence/web-platform/connection-recovery-readonly-proposal.json)。

Recovery设计已补同步receipt接管→durable barrier→HTTP及crash边界；本地写失败保原材料/下一稿、本次0HTTP，首次未落盘文字不保证崩溃恢复。此为候选接口，无新claim/实现/实验。
