# WPF-MATURE-05 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-07T22:08:11.964Z；第三次真实HTTP两项同轮通过，首浏览器在连接前置失败，公开Cookie入口已窄修并获审，新四组尚未运行。 |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 本大task历史首次开工缺独立证据，不以研究/领取时间回填；完整Arc验收尚未完成。 |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-05](plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| 单一status owner / model | d01_owner / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management |
| Branch | codex/web-platform-management |
| 工作基线 / HEAD | 管理基线d444608ab6c796c731e44e51a892868bf39bec2a；当前HEAD/dirty由Git聚合 |
| 工作分支状态 | in-progress |
| 阶段 | M2 |
| 本片段交付阶段 | implementation |
| 优先级 | 2 |
| 当前产出 | 最多三窗格的拆分组合、草稿保护与流读取实现已通过局部回归及源码审查；第三轮真实HTTP两项同轮通过。首浏览器0/4、0图，修后四组尚待新独立验证。 |
| 下一可用交付 | 验证修后真实连接入口，再验三窗格布局、刷新恢复、双主题与减少动画偏好；保草稿身份和两条流读取上限，个人恢复优先。 |
| 当前阻塞 | ACTIVE: 第三轮HTTP两项已通过；首浏览器在Owner token前置超时，未进入四组。公开?recovery=1入口与Connect heading已修并获审，既有模型边界已通过；d034补齐三pane上限与Merge中间可见态两处browser wiring断言并获独审，1205干净停写，新90s候选待实际结果。 |
| 需用户决定 | NONE |
| 实现目标 | UNKNOWN |
| 实现范围 | plans/wpf-mature-05-workspace |
| 检查状态 | NOT_RUN；当前为整体计划，已有子片检查只沿各canonical，不继承为全体验收 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；计划登记/大task功能验收分别记录 |
| Review | [review.md](review.md)，NOT_STARTED；完整大task未验收 |
| 写权 | 管理632a7149 v3仅本计划目录；实现子task各自claim不由本表替代 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-05-01 | in-progress | Web co-lead | 顶层tab/group包含任意有界pane数组，不写死两栏；首验A与B，最大pane数在实现前明确。 追加[Arc×MSG03六约束/八验收](plan.md#arc-msg03)，仅设计未运行。 |
| WPF-MATURE-05-02 | in-progress | Web co-lead | 同顶层tab显示A与B，独立焦点/滚动/未发草稿/上下文，不靠全局focused授权其他pane；真实ConversationList扩展用conversation/view上下文，不借旧task slot冒覆盖。 追加[Arc×MSG03六约束/八验收](plan.md#arc-msg03)，仅设计未运行。 |
| WPF-MATURE-05-03 | in-progress | Web co-lead | 比例调整、交换、合回与恢复；关闭视图不cancel，split/merge只改布局不拼接history；组合pane菜单复用P01 registry并核sample贡献/禁用及跨连接身份。比例键盘与窄屏焦点实际验证；有显著按需加载延迟的tab使用方向键移动focus、Enter/Space手动激活，关闭后焦点落相邻tab或New Chat。Retained chats工作区入口后继复用现有P01 slot的builtin command/button贡献；App私有callback仍唯一控制dialog/views，不新slot/通用总线或公开views；验证disabled/unload/连接旧callback及键盘focus。当前缓存片限定批准不等插件完整覆盖，不立即领取App。 追加[Arc×MSG03六约束/八验收](plan.md#arc-msg03)，仅设计未运行。 |
| WPF-MATURE-05-04 | pending | Web co-lead | 模型可容chat/文件/产物；首个两栏旅程与3+后继分明，390键盘可达且不强迫外部内容同色。 |
| WPF-MATURE-05-05 | in-progress | Web co-lead | 实际App双会话及内容pane交互/刷新恢复/关闭重开证据，主题和比例/焦点测试；大量反复开关后DOM/缓存/订阅有界，区分visible/hidden/closed-clean/closed-protected，草稿/附件/unknown不可静默丢失，满额保护时拒新开，重开恢复且不cancel后台任务；实际0模型测DOM/effects读取/切换输入时延及未确认恢复，Activity不是内存上限；overview/feed观察与命令生命周期须分离，后台请求仅预算内观测，不从源码推算QPS/heap；关联MATURE06-04，没有实现的3+明确开放。新增[累计活动缓存覆盖输入](../../docs/evidence/web-platform/activity-cache-total-bound/report.md)仅文档限定批准/产品未实施未测量。 追加[Arc×MSG03六约束/八验收](plan.md#arc-msg03)，仅设计未运行。 |
| WPF-MATURE-05-06 | pending | Web co-lead | [导航后继验收](plan.md#日用会话导航后继)与[11源研究](../../docs/evidence/web-platform/quick-b3-return-navigation-20261007/navigation-root-research.json)：近期语义/tie-break、全授权标题搜索、legacy cursor兼容、query隔离和>50真实验收；仅候选未take/未实现，恢复与设置优先。 |

## 依赖与领取

CONTEXTI已main并释放，STEIRI01已main并释放，布局与插件入口后继仍须fresh精确交权，不能借旧free观察写入；复用workspace-state，先核持久布局接口与真实view身份，不改会话历史。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。 参考图实际有3pane；不把首期A与B验收等于数据模型仅支持2。

root10:44–10:45已实际核本大task身份/co-lead与相关子片领取，见[真实页面专项](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)；此项通过不代表本大task完整功能验收完成。

实际插件入口覆盖见[root固定main80ba只读研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)，沿REQ22–23/WPF-001-05；未browser复现或实施，不扩大STEIRI写权。

WORKSPACEPERF01：panels，base c450，c815bc00 v2已释放四scope，[receipt](../../docs/evidence/web-platform/workspaceperf01-take-receipt.json)。90s含清理/8MiB，仅HTTPfixture真实App累计8/16/32会话观察，生产无改；固定1711已限定partial独审并main362af3两源一致，owner12e4正常push双端clean且全停写后已fresh release c815 v2，原TODO05仍in-progress。

GO/root固定c450的Overview/feed发现已落[原研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)与TODO05；WORKSPACEPERF只在原预算未冻结时补请求分类，否则后继，不扩90s/8MiB、不改生产。

WORKSPACEPERF01 [限定审查来源](../../docs/evidence/web-platform/workspaceperf01-partial-review-observation.json)：8完成/1末尾locator失败，checks保FAILED/partial；累计79.322s含清理低于90s，没第三轮。root严格定向types0、2源/180依赖核，不重跑browser。没有完整性能/heap/真实优化结论，05仍in-progress。

最新排程覆盖先前Arc先行：05最小回收先行，protected draft/附件/unknown保护、关闭DOM/读flight/JS引用分开；容量满额/late detail+history/重开原身份直接验收。该排程已落实为CACHE独立16scope；ATTACHI六交叉路径有序交权，原四scope只基线。

11:11管理fresh检查：固定main2e71、App/Thread/outbox/session/workspace-state当前无writer；projection的ACK已release，client归F01。仅时点，不是预占；panels正式只读最小cache Interface，ATTACHI未来App窗口仍需有序协调，[scope依据](../../docs/evidence/web-platform/workspace-cache-scope-observation.json)。

CACHE已root结构批准并fresh领取883321bc v1十六scope，fixed fd1322新独立web-workspace-cache/codex同名；[receipt](../../docs/evidence/web-platform/workspacecache01-take-receipt.json)。固定4ec291c2381faa0fc212cf598b8126b9feecae71/final55b48b7daa6928839268c542080e2884a651a1f0已root限定批准并normalpush双端clean，唯一[source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-cache/plans/wpf-workspace-cache/status.md)。32含initial/open/protected，closed-clean0；reply2/2MiB、queue4/64KiB只正文UTF8。未提交profile/project选择、pending composer capture（即使items移除）、未dismiss receipts均保护。与ATTACHI02六条交集含两专测，短窗口后停写交权再amend；本片局部实现已审，已正式main017adc、owner10ca8双端clean后883321 v2 released，六交集全停写；后继仍fresh take；不冒heap/全workspace上限，原基线仍partial。root独立133/14hash/206deps、作者7分次browser68.689s边界见[管理审计](../../docs/evidence/web-platform/workspacecache01-candidate-management-audit.json)，不把早期不同App源码报告当最终完整矩阵。

GO最新排程：原MATURE06-04连接/刷新/未决发送恢复完整旅程先于Arc/装饰。Arc18候选仅只读，既有05验收不删除，不预领ATTACHI共享App范围；[完整要求](../../docs/evidence/web-platform/connection-recovery-priority.md)。


当前Arc实施继续沿原20scope与稳定composer父级。新增[可访问性检查点](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/arc-accessibility-followup.json)仅收敛原tab/close/resize与隐藏生命周期验收，不增加框架、依赖或未规划collapse功能；实验性示例不当上线模板。首次最多三个pane、两条stream lease按完整有限batch FIFO轮转与六个显式正文flight边界不变。

当前验收分层：前两次HTTP分别1PASS/1FAIL原件保留，不拼绿；第三次同轮2PASS/11未选（2912ms CLOSED、trace NOT_RETAINED）；首browser0/4、0PNG/12808ms CLOSED且完整资源归还；source876731f公开入口窄修已独审；d034/1205两项browser wiring增强已获root7379批准，旧876候选不改，新browser四组NOT_RUN。来源为Arc唯一status和root第三HTTP/首browser审查，不替子task合成整体PASS。
