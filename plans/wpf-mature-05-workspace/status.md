# WPF-MATURE-05 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 10:56 UTC |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-05](plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| 单一status owner / model | d01_owner / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management |
| Branch | codex/web-platform-management |
| 工作基线 / HEAD | 管理基线d444608ab6c796c731e44e51a892868bf39bec2a；当前HEAD/dirty由Git聚合 |
| 工作分支状态 | in-progress |
| 阶段 | M2 |
| 本片段交付阶段 | planning |
| 优先级 | 2 |
| 当前产出 | 已有split/merge与workspace-state基础；尚未完成一个顶层tab内A与B组合的完整验收。 |
| 下一可用交付 | WORKSPACEPERF01四scope已fresh领取，先测真实App关闭重开基线；组合pane完整实现仍开放 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | UNKNOWN |
| 实现范围 | plans/wpf-mature-05-workspace |
| 检查状态 | NOT_RUN；当前为整体计划，已有子片检查只沿各canonical，不继承为全体验收 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；计划登记/大task功能验收分别记录 |
| Review | [review.md](review.md)，NOT_STARTED；完整大task未验收 |
| 写权 | 管理632a7149 v3仅本计划目录；实现子task各自claim不由本表替代 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-05-01 | pending | Web co-lead | 顶层tab/group包含任意有界pane数组，不写死两栏；首验A与B，最大pane数在实现前明确。 |
| WPF-MATURE-05-02 | pending | Web co-lead | 同顶层tab显示A与B，独立焦点/滚动/未发草稿/上下文，不靠全局focused授权其他pane；真实ConversationList扩展用conversation/view上下文，不借旧task slot冒覆盖。 |
| WPF-MATURE-05-03 | pending | Web co-lead | 比例调整、交换、合回与恢复；关闭视图不cancel，split/merge只改布局不拼接history；组合pane菜单复用P01 registry并核sample贡献/禁用及跨连接身份。 |
| WPF-MATURE-05-04 | pending | Web co-lead | 模型可容chat/文件/产物；首个两栏旅程与3+后继分明，390键盘可达且不强迫外部内容同色。 |
| WPF-MATURE-05-05 | pending | Web co-lead | 实际App双会话及内容pane交互/刷新恢复/关闭重开证据，主题和比例/焦点测试；大量反复开关后DOM/缓存/订阅有界，区分visible/hidden/closed-clean/closed-protected，草稿/附件/unknown不可静默丢失，满额保护时拒新开，重开恢复且不cancel后台任务；实际0模型测DOM/effects读取/切换输入时延及未确认恢复，Activity不是内存上限；overview/feed观察与命令生命周期须分离，后台请求仅预算内观测，不从源码推算QPS/heap；关联MATURE06-04，没有实现的3+明确开放。 |

## 依赖与领取

CONTEXTI已main并释放，STEIRI01已main并释放，布局与插件入口后继仍须fresh精确交权，不能借旧free观察写入；复用workspace-state，先核持久布局接口与真实view身份，不改会话历史。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。 参考图实际有3pane；不把首期A与B验收等于数据模型仅支持2。

root10:44–10:45已实际核本大task身份/co-lead与相关子片领取，见[真实页面专项](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)；此项通过不代表本大task完整功能验收完成。

实际插件入口覆盖见[root固定main80ba只读研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)，沿REQ22–23/WPF-001-05；未browser复现或实施，不扩大STEIRI写权。

WORKSPACEPERF01：panels，base c450，c815bc00 v1四scope，[receipt](../../docs/evidence/web-platform/workspaceperf01-take-receipt.json)。90s含清理/8MiB，仅HTTPfixture真实App累计8/16/32会话观察，生产无改；原TODO05仍pending，首canonical待实际提交。

GO/root固定c450的Overview/feed发现已落[原研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)与TODO05；WORKSPACEPERF只在原预算未冻结时补请求分类，否则后继，不扩90s/8MiB、不改生产。
