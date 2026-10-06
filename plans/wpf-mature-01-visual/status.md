# WPF-MATURE-01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 09:43:01 UTC |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-01](plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| 单一status owner / model | d01_owner / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management |
| Branch | codex/web-platform-management |
| 工作基线 / HEAD | 管理基线d444608ab6c796c731e44e51a892868bf39bec2a；当前HEAD/dirty由Git聚合 |
| 工作分支状态 | in-progress |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 1 |
| 当前产出 | VISUAL01四builtin材质/实际App片已root独审并main4391接收，九scope已释放；plugin材质/reload与完整视觉验收仍开放 |
| 下一可用交付 | SVC04受控发布已审片；后继统一插件材质合同与reload生命周期等待精确新scope |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | UNKNOWN |
| 实现范围 | plans/wpf-mature-01-visual |
| 检查状态 | NOT_RUN；当前为整体计划，已有子片检查只沿各canonical，不继承为全体验收 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；计划登记/大task功能验收分别记录 |
| Review | [review.md](review.md)，NOT_STARTED；完整大task未验收 |
| 写权 | 管理632a7149 v3仅本计划目录；实现子task各自claim不由本表替代 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-01-01 | in-progress | Web co-lead | builtin材质片已审；单一typed catalogue/有限值域/映射/default仍开放，见[固定研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。 |
| WPF-MATURE-01-02 | in-progress | Web co-lead | 外部theme实际消费者、局部硬值移除、禁用清理及三种plugin reload未验，不用四builtin替代。 |
| WPF-MATURE-01-03 | in-progress | Web co-lead | 实际空态、长正文、代码/表格、streaming、tool/thinking展开、错误截图；不遮行动错误或unknown。 |
| WPF-MATURE-01-04 | in-progress | Web co-lead | 390px与桌面、键盘焦点/IME、reduced-motion、不支持/禁用backdrop-filter时不透明可读fallback。 |
| WPF-MATURE-01-05 | pending | Web co-lead | 实际App前后图与交互证据，源码绑定固定target，局部审查后受控main集成。 |

## 依赖与领取

复用现有主题/官方Thread/布局接缝；与STEIRI当前App/Thread写权错峰。VISUAL01已main4391并由owner558895d收口、35e5 v3 released，源见[唯一status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-visual-shell/plans/wpf-visual01-shell/status.md)；未占App/Thread/validation。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。

登记/父关联待执行dashboard原owner处理，见[唯一管理登记队列](../../docs/evidence/web-platform/mature-task-handoff.md)。不得把新增字段等同已在页面显示；局部登记不阻断独立已授权实现。

既有01/02 TODO已有[18literal只读提案](../../docs/evidence/web-platform/theme-extension-proposal.json)，不构成take或新产品事实。附件P1优先；后继需固定base、全范围fresh查重、独立树，不能沿VISUAL旧释放范围写入。
