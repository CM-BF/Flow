# WPF-MATURE-06 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 10:47:46 UTC |
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
| 下一可用交付 | 受控发布已接收界面；语音、跨重启恢复及其余聊天自然呈现仍待完成 |
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
| WPF-MATURE-06-04 | pending | Web co-lead | 键盘/IME/下一草稿、断线重连、queue/steer/cancel、lostACK原身份恢复；当前跨reload未完成项明确开放；有效登录期刷新/重开恢复同中心，HTTP+SSE/invalid Bearer/端口隔离见plan。 |
| WPF-MATURE-06-05 | pending | Web co-lead | 后台更新不抢用户历史滚动；voice能力显式，不可用/失败可回文本并保草稿，无自动模型调用。 |
| WPF-MATURE-06-06 | pending | Web co-lead | 实际App fixture覆盖失败/恢复/双pane；明确预算后单次真实provider观察，至少两次正文增长才称增量，没有partial如实记录不补query。 |

## 依赖与领取

STEER模块已main，STEIRI01十三scope已main f181并释放；CONTEXTI已释放；CHAT10 admission/公共client已固定，个人steering仍off。真实provider观察预算须单独明确；voice公开输入依赖待核。

当前新增[ACK01共享回执消费](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-shared-ack-consumer/plans/wpf-ack01-shared-consumer/status.md)已fresh七scope；首source以owner落盘为准。既有子任务各自唯一来源：[STEIRI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-integration/plans/wpf-steer-i01-integration/status.md)、[ACTIVITYREAD01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-readability/plans/wpf-activity-readability/status.md)；已收模块历史见[STEER01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-control/plans/wpf-steering-control/status.md)。功能通过不等用户个人runtime已启用；源码main与服务owner最新固定产物回执分开，旧32c/v9仅历史。

root10:44–10:45已实际核本大task身份/co-lead与相关子片领取，见[真实页面专项](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)；此项通过不代表本大task完整功能验收完成。
