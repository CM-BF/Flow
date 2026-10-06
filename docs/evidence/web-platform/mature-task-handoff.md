# 成熟聊天大task来源与登记队列

## 用户原话（GO经root逐字转交，2026-10-06）

> 我看现在的UI距离成熟的codex like chat bot还差得远。美学（圆弧，阴影，毛玻璃）和功能性（模型选择，Claude和Codex都要有，thinking level，fast mode，file attach (drag, @ file), context length, split window, arc like 2 tabs in one tab (A tab | B tab), etc)都不够。这些都属于大task，你必须有时间去找到这些overall的许多问题，他们也必须有时间去领任务执行。这些都立马写进plan里。

用户追加原话：

> 我截了个图，让你更加理解arc的设计美学

root已用view_image实际查看本地Arc参考，画面包含个人账号/网页。**不提交原图、文件副本或个人内容**；本证据仅保存抽象设计准则。中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。 参考为3pane；首验两pane，组模型采用任意有界数组，3+后继不冒称已实现。

## 严格两层唯一映射

GO定义以下六个大task；WPF-001与FLOW/REQ只是来源/协调索引，不成为第三执行层。前一08:55 WPF-001临时父映射已被本指派覆盖，保留历史但当前字段必须用下列ID。

| 大task | co-lead / priority | 唯一canonical / 当前依赖 |
| --- | --- | --- |
| WPF-MATURE-01 成熟聊天视觉与材质 | Web /root / P1 | [plan](../../../plans/wpf-mature-01-visual/plan.md)；[status](../../../plans/wpf-mature-01-visual/status.md) |
| WPF-MATURE-02 真实Claude与Codex能力 | Mika / P1，Web消费UI | [Mika唯一plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)；本队不复制。真实provider可发现/选择/执行，model/thinking/fast/access由center能力和runner落实，requested/actual/unavailable分开；不硬编码映射或以低effort冒fast。Codex真实harness/auth，账号状态不泄凭据，复用Lead R05 host，Pi研究不挡目标。 |
| WPF-MATURE-03 附件与文件上下文真实发送 | Web /root / P1 | [plan](../../../plans/wpf-mature-03-attachments/plan.md)；CONTEXTI01直接归本任务 |
| WPF-MATURE-04 context窗口与压缩可见 | Mika / P2，Web消费UI | [Mika唯一plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/plans/wpf-mature-04-context-transparency/plan.md)；本队不复制。model窗口/已用剩余/材料占用/压缩摘要结果可见；provider报告/估算/unknown分开，usage不简单累加冒当前context；切model/附件更新、超限行为和压缩前后引用可追溯，不强制新压缩plugin。 |
| WPF-MATURE-05 Arc式组合标签与独立pane | Web /root / P2 | [plan](../../../plans/wpf-mature-05-workspace/plan.md)；[status](../../../plans/wpf-mature-05-workspace/status.md) |
| WPF-MATURE-06 完整可靠聊天与执行控制 | Web /root / P1 | [plan](../../../plans/wpf-mature-06-chat/plan.md)；[status](../../../plans/wpf-mature-06-chat/status.md) |

## 原子写权与当前实际执行

管理claim 632a7149-e812-4ddb-b342-99572c554cc5从v2经fresh无冲突检查原子amend v3，08:56:20.186Z COMMITTED，新增仅四Web大task计划目录，原始[receipt](mature-plans-amend-receipt.json)。每个产品子task仍独立worktree/claim；管理计划领取不构成产品范围占用。CONTEXTI01 55fe v1归03，STEER01 2bae v1归06，已向两owner提供准确字段/链接，安全更新点应用。DPERF02批准方案尚未take/未建树，按新P1目标排队；D05FIT01已main9d6，最终0e52826正常push/clean，四scope停写后[5dc v2 release](d05fit01-main-release-receipt.json)08:59:36.337Z；无产品重测。

## Dashboard解除条件与原owner队列

root唯一08:53:11.559Z实际GET观察为101来源、15activewriter、0overlap；CONTEXTI与STEER只有claim区可见、在unregisteredAssignments，没有进度卡。管理不重复API。固定main b1c2 status.mjs/public app.js未解析所属大task/co-lead。以下由ExecutionLead/现dashboard owner协调既有claim处理，本队不抢registry/app/status范围：

1. registry登记四个Web大task（源都在web-platform-management、分支codex/web-platform-management，planDir见上表；evidenceDir docs/evidence/web-platform），两Mika task用其正式路径，不猜。
2. 登记CONTEXTI现worktree web-context-integration / planDir plans/wpf-context-i01-integration / evidenceDir docs/evidence/wpf-context-i01；STEER web-steering-control / plans/wpf-steering-control / docs/evidence/wpf-steering-control。登记字段需真实owner来源，不能只显示claim视为任务卡。
3. 解析两个标准字段并以稳定父ID关联，展示大task/可领取subtask/owner/依赖；缺失显示未知，不建立第二手填聚合进度。完成后实际页面核父关联与领取可见，不能仅source文本通过就宣称整体完成。
4. D05FIT01 registry evidenceDir误为docs/evidence/d05fit01，应为docs/evidence/d05-first-fit；源码图renderer不改。

ExecutionLead是GO子agent，app直投实际被平台拒绝、collaboration亦不可达（root已核，管理不重复尝试）。以上可由已注册WPF管理来源读取，不经GO转普通消息，不作为整个产品大taskblocked。Mika可直达，已一次协调02/04唯一路径与Web公共输入，收到后补链接。

## 本轮计划落盘验收边界

本轮是六项计划落盘与实际dashboard可见的集中管理请求。四Web三件套/稳定TODO落盘、Mika两唯一链接、当前两worker正确父关联、原子scope和真实看板显示均需核齐，才能由root向GO一次报告本轮计划请求Done；这不表示六个feature已完成。现在UI关联及登记尚待原owner，不能提前Done。后续每个完整大task只独立blocker+Done(1)。

## 固定源码研究与当前服务（来源root/ExecutionLead）

root固定main b1c2e39837c2208e6fc2c59a80e16797f26448b5只读：workspace-state.ts的ChatGroup={id,tabs,activeId}，splitChat限制groups.length>=2，App现两套tablist；没有一个顶层tab包含pane组合、ratio/swap/布局持久。复用views稳定key与close不cancel，但MATURE05未完成。styles.css现rail48px/sidebar236px/旧chat行34px、方整满铺pane与边线；themes.ts已有semantic token接缝，MATURE01改材质/圆角/层级而非重装Thread。

root实际读官方[assistant-ui索引](https://www.assistant-ui.com/llms.txt)，styled Thread可定制source元素及attachment/Composer/mention文档入口不构成本项目0.15.23升级理由。[W3C window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)给可聚焦separator的name/valuenow/min/max/controls和方向键，APG注明示例仍完善，不能称认证合规。[MDN prefers-reduced-transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-transparency)兼容性有限，不透明fallback需保守默认/明确选项，不能仅此media query；motion独立处理。以上是root已浏览来源，管理没有重复联网或安装。

ExecutionLead已确认会读取本队集中登记清单并正常批接registry/管理快照，不等不可达私信。SVC03正式回执：个人61228已改固定static，backend b1c2e398，artifact 461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90，accepting v12，用户原tab未reload。以后main不再HMR进个人入口，新UI需受控产物发布；main不等当前页面。此为Lead来源，root/本管理未服务复测，无新query许可；CHATUI01为Mika唯一owner。之前32c/v9和main-Vite仅历史时点。

主线D05FIT接收仅owner只读Git两源码hash/祖先实核；Lead实际GET4320 architecture.js hash同c98efa，管理未重复API或浏览器。个人static仍b1c2固定，main9d6不是个人升级。

## 2026-10-06 09:00 UTC 管理元数据核验

四Web大task三件套与管理源actual parseStatus全部errors=[]/human.complete=true，plan/status稳定TODO逐项同序（管理34，四大task分别5/6/5/6）；13个新增/集中Markdown的31本地链接全部可达，所有修改均在632a v3六literal内，diffcheck0。仅metadata检查，未跑产品测试/API/服务操作。实际只读两worker当前status已分别写03/06的准确绝对父链接与co-lead，字段写入不等dashboard已解析。按本地clean-code检查单一来源/命名/错误及权限边界，没有新增进度账或把未知产品验收勾完。

## 09:09 UTC 集中安全点：实际写权、接收与依赖

VISUAL01已独立web-visual-shell/codex/web-visual-shell，固定9d6bd45abdf5149bc44f1e9dc534454e7403f7d7；35e5 v1原7scope于09:08:43.096Z无冲突amend v2共9scope（样式、themes、builtin manifest/host、两专测、plan/evidence）。首canonical f92fd143f73f7a517004a154d3f6f2f2c7794180，唯一源plans/wpf-visual01-shell/status.md，证据docs/evidence/wpf-visual01，直接归MATURE01。当前实施，未固定/独审；领取可见不当实际登记。

STEER01独立APPROVED模块由owner正常push至5d02e8d31c62904155587b32fbc47d2baa341d06，impl b2cbbca5f823e122ec4e234e16fb7ef45a063af9，claim2bae v1保留修复权，产品停写待main。权威证据仍其docs/evidence/wpf-steering-control；本管理不重复检查/浏览器。仅模块，App/P01/跨reload恢复仍pending，MATURE06不勾整体完成。CONTEXTI仍由w01唯一owner独审接收过程中，普通进度以其status为准。

ExecutionLead请求Web小片显式解析展示所属大task/co-lead；候选D08先由panels只读核既有ID/父dashboard权威ID/精确status.mjs与public/app.js及直接tests，fresh take后才写，registry仍Lead队唯一owner。本队不提前声称六大task已关联展示，也不为此造新大task。

09:12 UTC实际只读main77c420 registry与两Mika status核到02/04唯一路径（上表），co-lead均mika；不复制其实现进展。Lead正式09:09:25采样111source/current/issues[]，六MATURE与CONTEXTI/STEER/VISUAL登记；此为Lead来源，本管理0重复API。D08父字段UI仍待实现/部署，计划请求未Done。CONTEXTI固定d0e05c26df6f331e0b1f15e7b738e4fe53208125/final009e67fd34b3bbef34a369d22acd67f08421620d已owner正常push/clean、root独审通过，20scope冻结等main；以其canonical为准，不重复产品检查。

MATURE06语音研究（root已读官方dictation/MDN与installed core0.3.22）：当前adapters.dictation已有入口，现Thread Dictate/StopDictation可复用；实际send先cancel+cleanup，并非等待final转写。成功路径必须显式Stop→final可编辑→Send/Queue，adapter wrapper掌握离开/撤权cancel与pane/view/connection/draft代际。WebSpeechAdapter不提供processLocally且浏览器默认false/experimental，不宣称默认本地/离线；fixture只验lifecycle，0mic/付费。来源https://www.assistant-ui.com/docs/guides/dictation 与MDN SpeechRecognition stop/abort/processLocally；后继仍原VOICE TODO。

09:13 UTC D08已root技术批准，唯一panels owner / dashboard-task-links / codex/dashboard-task-links / fixed77c420cf9ee5de0291ea93014b6ea11aead6fab5，fresh available无冲突后[49510580 v1 COMMITTED take](d08-take-receipt.json)，仅九scope，父D01原工程dashboard结果、FLOW003只追溯；首canonical待owner落盘，registry仍Lead单写。STEER owner仅main metadata已push01842a87f768bd28ce7370681ff02d7b834765f7，八scope停写后[2bae v2 release](steer01-main-release-receipt.json)09:12:22.611Z；不再修改旧树，不重测。

09:16安全点：D08首canonical f772a1e0d89a92f18dfaedd8f2070ce6f3eff4f9已owner提交clean，唯一dashboard-task-links/plans/d08-task-links，evidence docs/evidence/d08，父D01/co-lead Web/root。请Lead正常登记，claims不是进度卡。root实读Mika02/04仍self-parent，本管理已一次直接Mika要求合法owner改显式大task身份，无需修改TODO；D08继续严格拒self-parent，不能hardcode豁免。

## 管理收敛安全点

当前status已压缩为当前事实、稳定TODO、依赖与入口；此前全文原样移同目录status-history.md，明确仅历史。不清洗失败/JSON/hash、不重跑产品或dashboard。Mika02/04合法owner已改显式大task身份（D08作者只读确认）；本组没有改他人计划，最终实际关联仍待D08独审/部署。

MATURE01主题扩展后继（root固定be50只读）：descendant!important的thread宽度/composer圆角仍阻根token覆盖；validation仅颜色名单，builtin四主题成功不证明完整材质插件。后继沿原主题TODO考虑一个typed token catalogue产生允许名称/数值域/映射/default，组件消费var回退、禁用清旧token；CSS.supports自定义变量不是值域校验，@property不能替代普通fallback。另initialTheme仅builtin会覆盖已保存pluginID，现reload测试仅builtin；待授权插件声明齐后恢复保存ID/scheme，缺失/禁用/换连接显式fallback，不首屏盲apply外部CSS。需真实外部theme材质/禁用与三reload状态验收。来源为root已读MDN@property/CSS.supports与CSS Variables规范，不是当前browser复现的插件缺陷。

## 当前集中接收队列（2026-10-06 09:31:08 UTC）

| Task / action | 固定实现 / 最终正常push、clean | 唯一canonical / 边界 |
| --- | --- | --- |
| WPF-VISUAL01 → MATURE01，受控main接收 | a8b2b22a29bc3fb6ebd5252754d1e1cdbc975231 / f708de549685099b370f4436fda2486e1e5671f2；root APPROVED，35e5 v2保留 | web-visual-shell / plans/wpf-visual01-shell / docs/evidence/wpf-visual01；九scope、七源码，实际App四builtin材质与390split；readonly source-binding/checks已对齐；无个人产物发布或整体MATURE01完成声明 |
| D08 → D01，受控main接收及4320新UI部署 | eca59a5edab0820f724a9bd5bc854e22f48d9ea9 /ce038f0b064d1348d4aa77f1e91f223d7bc5ea31；root APPROVED，49510580 v1保留 | dashboard-task-links / plans/d08-task-links / docs/evidence/d08；九scope、七执行文件，registry仍Lead单写；45direct/5browser按作者/root归因，不重测 |
| WPF-STEIRI01 → MATURE06，登记新source | 首82d2c98e407684b945467e1ce6b992dba6b4603c，base df29fb511df029a0922ace0f4973f3fe3736e502；bc0ded75 v1 /13scope | web-steering-integration / plans/wpf-steer-i01-integration / docs/evidence/wpf-steer-i01；w01唯一owner已正式实施，父字段明确，不等登记 |
| WPF-CONTEXTI01，main收口 | main df29含d0e/009e十八source相同；owner fe2b9215d1b230424d9470b8d187eed3d7e77231 pushed/clean | 原20scope停写后[55fe v2 released](contexti01-main-release-receipt.json)09:27:04.696Z，旧树不续写；新STEIRI只经[fresh take](steiri01-take-receipt.json)受权 |
| D01，合法owner显式父身份metadata | 2f3f33bf29177b930c524263115a5745ab67c66e 已push/clean，产品未改 | execution-dashboard原唯一plans/d01-execution-dashboard，只补大task/co-lead；D08读取原canonical，不复制状态 |

这些是正式当前队列；此前09:09/09:16待审描述仅历史。新功能仍由ExecutionLead独占main受控集成；无需GO转普通ready。D08部署后root一次实际检查六大task父关联/take展示才报告计划请求Done，不将局部片段当整体完成。

2026-10-06 09:32:24 UTC D01仅父身份metadata完成，正常push2f3f33b/clean、原产品零改；全部窄scope停写后[5fa8 v2 release](d01-parent-release-receipt.json)09:31:36.475Z，旧D01不继续修改。D08管理核七hash/范围正确，interface语法例子断链已owner仅metadata ce038修正push；[最终范围/链接/hash审计](visual-d08-delivery-audit.json)通过，不改变root产品批准。

2026-10-06 09:33:54 UTC 新并行P1子片WPF-ACTIVITYREAD01由root批准，独立web-activity-readability/codex/web-activity-readability，固定3418fe682944145494463dca9e09f89c8b9c2295；fresh[6f427ac5 v1 take](activityread01-take-receipt.json)五literal无冲突COMMITTED09:33:19.306Z，panels唯一owner，直接归MATURE06。只改native活动两显示组件+原browser脚本的本片输出/断言、自己的plan/evidence，不碰STEIRI的App/Thread/host、shared或projection。首canonical待owner落盘再登记，不把take当进度卡。
