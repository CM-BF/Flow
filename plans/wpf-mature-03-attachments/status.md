# WPF-MATURE-03 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 12:10 UTC |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-03](plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| 单一status owner / model | d01_owner / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management |
| Branch | codex/web-platform-management |
| 工作基线 / HEAD | 管理基线d444608ab6c796c731e44e51a892868bf39bec2a；当前HEAD/dirty由Git聚合 |
| 工作分支状态 | in-progress |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 1 |
| 当前产出 | 知识引用可发送；中心文本资源与独立输入模块已main，生产App/SendQueue附件绑定首12实施 |
| 下一可用交付 | 先完成材料冻结/Outbox/Queue/P01消费者，再fresh amend余12实际App范围；完整验收仍开放 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | UNKNOWN |
| 实现范围 | plans/wpf-mature-03-attachments |
| 检查状态 | NOT_RUN；当前为整体计划，已有子片检查只沿各canonical，不继承为全体验收 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；计划登记/大task功能验收分别记录 |
| Review | [review.md](review.md)，NOT_STARTED；完整大task未验收 |
| 写权 | 管理632a7149 v3仅本计划目录；实现子task各自claim不由本表替代 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-03-01 | completed | Web co-lead | CONTEXTI01从已授权project创建、cap确认后选引用；Send/Queue ordered tuple到真实HTTP并校ACK；不宣称本地上传完成。 |
| WPF-MATURE-03-02 | in-progress | Web co-lead | 区分本地上传、已有知识、runner文件的来源/版本/权限/大小类型，绑定当前project/view/connection；timeline只轻引用。 |
| WPF-MATURE-03-03 | in-progress | Web co-lead | 三个入口可发现；键盘替代drag；搜索有界且可取消，预览正文按需，删除只影响当前草稿。 |
| WPF-MATURE-03-04 | pending | Web co-lead | 同一次Send/Queue深冻材料版本/顺序；unknown保原key/payload，预算拒绝保留receipt，ACK不得清新稿/新refs；异步prepare须绑定点击意图/材料与submission代际，仅真实receipt接管后consume；材料真实进入model context。 |
| WPF-MATURE-03-05 | pending | Web co-lead | 双split草稿独立、换连接/close/隐藏/撤权迟到隔离；旧center缺cap阻附件，plain省略attachments字段；旧页读v2只显示正文。类型/大小/授权失败可行动，兼容矩阵待实际fixture；journal异常隔离保raw/unknown和纯文本，cap/namespace按绑定失效，生产宿主未验。 |
| WPF-MATURE-03-06 | pending | Web co-lead | 真实App fixture覆盖入口到执行请求、引用审计与按需详情；provider执行验收另经明确预算，不能拿fixture证明模型收到。 |

## 依赖与领取

CONTEXTI01已main并释放；ATTACH01 runtime/fixture与公共六client/sharedv2/factory已正式main fd1322，23源逐字相同，Lead有限组合6项/8自动启动无fallback/4DB清零。owner c698正常pushclean后18scope全停写，ef617 v3已release；[正式证据](../../docs/evidence/web-platform/attachment-main-fd1322-observation.json)。ATTACHI01 fixed4c4d/final4a9、9源码仍已审待main，不在这23源内，94b84 v1保留。ATTACHI02完整24literal结构已批准但未take，公共依赖已满足，待模块准确组合base及CACHE六路径短窗口交权。真实App/SendQueue仍开放。

当前子任务来源：[ATTACH01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/attachment-resources/plans/wpf-attach01-resources/status.md)；[CONTEXTI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-integration/plans/wpf-context-i01-integration/status.md)。该子任务直接归本大task，WPF管理只做来源追溯。

root10:44–10:45已实际核本大task身份/co-lead与相关子片领取，见[真实页面专项](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)；此项通过不代表本大task完整功能验收完成。

原owner待定观察已由本轮GO正式责任裁决解除；[历史观察](../../docs/evidence/web-platform/mature03-owner-observation.json)不代表当前阻塞。02adapter只消费/04复用metadata；首类型片段不等于完整附件Done。旧scope不续写，不上传用户文件、不调用provider。

[两份只读候选与共享依赖](../../docs/evidence/web-platform/attachment-shared-dependencies.json)已收：原后端15/Web23是整体候选；phase1固定合同已审；runtime现18literal精准领取；F01共享出口/contract ownership、精确迁移编号与Web receipt调用点窗口须统一。现官方Thread已有能力门控附件按钮/dropzone/list，gap是持久引用和实际发送接线，不是控件缺失；本地固定SDK保持不升级。

附件v2由唯一shared decoder配套；Webrecovery替代重复receipt matcher，查找/恢复/retention与11scope首片已root授权并fresh take；不依赖不存在公共方法。[具体回复置于集中队列顶部](../../docs/evidence/web-platform/mature-task-handoff.md)。

正式factory组合已接收，上述当前事实替代11:29前“factory增量待审/main未接”观察；原历史证据保留在[F01固定输入时点](../../docs/evidence/web-platform/attachment-public-bridge-observation-1129.json)。现[两方案](../../docs/evidence/web-platform/workspace-cache-attachment-binding-proposals.json)明确六交集包含两专测；pending submission/capture即使items移除仍保护，不能将发送中的身份作为缓存回收对象。

12:07正式执行：模块4c已main1c496九源同，owner2b0a33e pushclean后94b84 v2释放。生产绑定WPF-ATTACHI02以准确1c496新独立web-attachment-production，首12 fresh0b7fc000 v1 COMMITTED；真实Outbox/Queue/PluginHost消费者先行，App等余12后amend，矩阵未执行/大task未完成。详[当前队列](../../docs/evidence/web-platform/mature-task-handoff.md)。
