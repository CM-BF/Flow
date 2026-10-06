# WPF-MATURE-03 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 09:20 UTC |
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
| 当前产出 | 知识选择与receipt模块已入主线，实际知识App接线CONTEXTI01已root独审通过待main；本地附件/拖放/@file尚未完成。 |
| 下一可用交付 | 主线接收已审知识聊天旅程；本地附件生命周期待唯一后端owner和固定合同 |
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
| WPF-MATURE-03-01 | in-progress | Web co-lead | CONTEXTI01从已授权project创建、cap确认后选引用；Send/Queue ordered tuple到真实HTTP并校ACK；不宣称本地上传完成。 |
| WPF-MATURE-03-02 | pending | Web co-lead | 区分本地上传、已有知识、runner文件的来源/版本/权限/大小类型，绑定当前project/view/connection；timeline只轻引用。 |
| WPF-MATURE-03-03 | pending | Web co-lead | 三个入口可发现；键盘替代drag；搜索有界且可取消，预览正文按需，删除只影响当前草稿。 |
| WPF-MATURE-03-04 | pending | Web co-lead | 同一次Send/Queue深冻材料版本/顺序；unknown保原key/payload，预算拒绝保留receipt，ACK不得清新稿/新refs；材料真实进入model context。 |
| WPF-MATURE-03-05 | pending | Web co-lead | 双split草稿独立、换连接/close/隐藏/撤权迟到隔离；不支持中心明确plaintext路径；类型/大小/授权失败可行动。 |
| WPF-MATURE-03-06 | pending | Web co-lead | 真实App fixture覆盖入口到执行请求、引用审计与按需详情；provider执行验收另经明确预算，不能拿fixture证明模型收到。 |

## 依赖与领取

CONTEXTI01独占20scope；本地上传/runner文件与授权/版本合同由相应后端owner提供，接口缺口明确后协调，不自造prompt或目录权限。

当前子任务唯一来源：[CONTEXTI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-integration/plans/wpf-context-i01-integration/status.md)。该子任务直接归本大task，WPF管理只做来源追溯。

登记/父关联待执行dashboard原owner处理，见[唯一管理登记队列](../../docs/evidence/web-platform/mature-task-handoff.md)。不得把新增字段等同已在页面显示；局部登记不阻断独立已授权实现。
