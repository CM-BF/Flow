# WPF-MATURE-01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 15:59 UTC |
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
| 当前产出 | 正式format2已备；fixed362实际A两history失败，原raw封存/DB与进程清理完成，B/Chrome NOT_RUN，无兼容绿回执 |
| 下一可用交付 | 2691源修已APPROVED；af51/artifact依赖核通过但A2单次空间不足，无gate/0运行/窗口归Lead；等新实质条件再原预算先A后B |
| 当前阻塞 | ACTIVE: 新组合尚无实际成功A/B；A2 free1,103,237,120B<1,107,296,256B，未执行并交回窗口；旧362两红保留，不等整个Recovery/SVC06 |
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
| WPF-MATURE-01-02 | in-progress | Web co-lead | 外部theme材质/reload仍开放；附件Files入口已走P01但Picker条目动作覆盖缺口沿REQ22–23后继，见plan与固定9eec审计。 |
| WPF-MATURE-01-03 | in-progress | Web co-lead | 实际空态、长正文、代码/表格、streaming、tool/thinking展开、错误截图；不遮行动错误或unknown。 |
| WPF-MATURE-01-04 | in-progress | Web co-lead | 390px与桌面、键盘焦点/IME、reduced-motion、不支持/禁用backdrop-filter时不透明可读fallback。 |
| WPF-MATURE-01-05 | pending | Web co-lead | 实际App前后图/交互与固定产物；RS13按唯一asset去重、初始依赖图/延后chat及parse/可输入/首次chat取舍；与SVC owner定义哈希asset cache/encoding和HTML/身份/API边界，有界冷暖/版本切换，未实施。 |

## 依赖与领取

复用现有主题/官方Thread/布局接缝；STEIRI已main/released，后继仍fresh核所有精确写权。VISUAL01已main4391并由owner558895d收口、35e5 v3 released，源见[唯一status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-visual-shell/plans/wpf-visual01-shell/status.md)；未占App/Thread/validation。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。

root10:44–10:45已实际核本大task身份/co-lead与相关子片领取，见[真实页面专项](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)；此项通过不代表本大task完整功能验收完成。

既有01/02 TODO已有[18literal只读提案](../../docs/evidence/web-platform/theme-extension-proposal.json)，不构成take或新产品事实。附件P1优先；后继需固定base、全范围fresh查重、独立树，不能沿VISUAL旧释放范围写入。

真实Web发布兼容由独立[WPF-RELEASE01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-release-compatibility/plans/wpf-release01-product-compatibility/status.md)实施，首canonical1eff6e6f7543c7fdf30e5d94cec3c43b148bb764，20a6529a v1四scope；真实新旧App构建/专用PG及fixture runner，0provider/个人发布操作，7805固定已root10:46:30 APPROVED，final db08e7b已正常push/clean，待Lead按同descriptor受控接收；仅真实旧/新App与固定b1c中心fixture兼容，个人发布仍Lead。

RELEASE01兼容输入已main c450且20a v2释放；后继根严格类型检查发现fixture构建矩阵的noUncheckedIndexedAccess两错，RELEASE02独立base2e71/03323bce v1三scope由w01窄修，runner_owner独立审。不是env/ENG失败，旧定向检查与原browser报告保其真实范围；不重跑旅程或个人发布。[当前接收队列](../../docs/evidence/web-platform/mature-task-handoff.md)。

实际发布新增[RELEASE03批准方案](../../docs/evidence/web-platform/release03-current-preview-proposal.json)：w01唯一验证owner、四范围已bfb209ae v1 COMMITTED，原SVCoperator发布。现成9eec hash核齐但无正式format2；14:25fresh准入后一次正式prepare成功，14:28两cache已释放；backend362有特定history v2缺口须最小差分/合法修复，不等整Recovery或全SVC06。0个人操作，当前产物保持8d8/caa1/v2，来源与解除条件见中央队列。
