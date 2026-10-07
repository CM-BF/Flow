# WPF-MATURE-01 成熟聊天视觉与材质

| 字段 | 内容 |
| --- | --- |
| 大task ID | WPF-MATURE-01 |
| 状态 | in-progress；完整验收未完成 |
| co-lead | Web /root（执行管理 d01_owner） |
| 优先级 | P1 |
| 唯一来源 | 本目录plan/status/review，管理worktree合法claim v3；不另填聚合进度 |
| 用户来源 | [成熟度原话与六项分工](../../docs/evidence/web-platform/mature-task-handoff.md)；原WPF REQ仅追溯，不形成第三层 |
| 收益 | 让真实聊天界面在信息密度、层级与材质上接近成熟工作台，并在长内容和错误场景保持清晰。 |
| 边界 | 本计划定义完整用户结果；具体实现须独立worktree、fresh精确scope take和固定独审，计划目录领取不授产品写权 |
| 依赖 | 复用现有主题/官方Thread/布局接缝；与STEIRI当前App/Thread/types/validation写权错峰。没有新的产品文件claim前仅规划。 |

## 已有能力与gap

CHATREAD01已审527176c且main d7e，减少稳定配置常驻高度并修弹窗下钻焦点；它不代表成熟材质系统完成。P01、主题与官方Thread已有基础。

VISUAL01固定a8b/交付f708已独审并main4391接收，owner558895d收口且35e5 v3释放：实际App内建浅深材质与显式opaque、长文/代码表格/错误/活动/stream/390已有限验证，主线已接而个人产物发布归SVC04另计。尚缺外部插件统一材质token合同、组件完整消费与插件reload生命周期，以及整体状态矩阵验收；不能把builtin四主题当完整可扩展主题系统。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。

## 稳定TODO与完整验收

- [ ] **WPF-MATURE-01-01** 设计tokens和状态矩阵：圆角层级、轻阴影、透明度/blur、字体/间距/消息宽度写清；浅深同语义、正文可读。单一typed catalogue统一允许名称/有限值域/映射/default，颜色兼容；具体限制见[固定研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。
- [ ] **WPF-MATURE-01-02** 交付真实App shell与常用控件：导航、输入、选中pane、弹层、气泡实际接通扩展tokens，移除阻断根token的局部硬值；真实外部主题材质/禁用清理及已安装、禁用、缺失插件三种reload验收，不以builtin切换或静态mock代替。附件Picker条目动作的插件覆盖仍开放，沿REQ22–23与[固定审计](../../docs/evidence/web-platform/attachment-plugin-coverage-9eec.json)，Files入口有slot不等条目完整可扩展。
- [ ] **WPF-MATURE-01-03** 覆盖内容与异常场景：实际空态、长正文、代码/表格、streaming、tool/thinking展开、错误截图；不遮行动错误或unknown。
- [ ] **WPF-MATURE-01-04** 完成可访问性与降级：390px与桌面、键盘焦点/IME、reduced-motion、不支持/禁用backdrop-filter时不透明可读fallback。
- [ ] **WPF-MATURE-01-05** 固定交付及独审对照：实际App前后图与交互证据，源码绑定固定target，局部审查后受控main集成；RS13后继按唯一asset去重，验证连接页初始依赖图是否真正延后chat/assistant-ui chunk，联合资源字节、parse、可输入与首次开chat等待；静态host先明确同URL不可变/回滚，区分HTML与哈希asset/身份/API，再验冷暖cache/encoding与版本切换，不能全站cache或把解码字节当TTI；实际静态Radix/两Thread/fixtureMode与公共chunk依赖图须核，lazy失败保草稿可重试；先评估ETag+no-cache，编码按representation与Vary/HEAD/304/有界cache及raw-manifest身份验收，细节见[RS13](../../docs/evidence/web-platform/research.md)。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

## 固定研究输入

见[固定b1c2源码与官方接口研究](../../docs/evidence/web-platform/mature-task-handoff.md)：现有split硬限两个group，尚无组合pane模型；现theme tokens可复用。可聚焦splitter键盘/ARIA需实际验证，不透明fallback不可只靠支持有限的media query。研究未构成实现或产品验收。

现01/02的逐项源码、官方三来源、静态推断/未browser复现边界与后继验收集中见[主题与呈现研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。本轮只绑定已有TODO，不扩VISUAL已冻结九scope。

已收w01固定253/VISUALa8的[18literal主题扩展候选](../../docs/evidence/web-platform/theme-extension-proposal.json)，仅绑定本计划01/02 TODO，不新大task、未领取或实施。保留official Thread局部inline默认，用受控root alias接有限token；requested preference与effective fallback分开，明确选择/禁用持久化与session退出临时fallback不同，旧epoch不得覆盖新选择。完整外部Ocean材质/插件reload矩阵须后继实际验证。附件P1优先，STEIRI重叠路径释放后仍fresh全范围查重。

同TODO05/RS13新增固定观察：root只读f82候选HTML的5唯一asset共1,571,669原始字节，manifest匹配但assistant-ui仍预加载、两Thread/Radix静态依赖仍在。仅计数不等TTI/网络/部署/回归，不能把与旧caa1差额全部归附件；06关键路径后按完整初始图验收，见[原报告](../../docs/evidence/web-platform/attachi02-f82-initial-assets-research.json)。


## 已审前端实际预览发布优先级

2026-10-07 13:08 UTC 当前优先级：沿原REQ19/Release发布用户实际可见的新网页，不等待全Plugin/Codex资格或MSG03。原发布owner取[最小共同source7272候选](../../docs/evidence/web-platform/mounted-app-and-personal-maintenance-next-20261007/visible-web-release-peer.json)，提供新immutable Web/backend，按变化面补实际Cookie/恢复/迟到logout与retained绑定。当前个人维护不扩目标，首红归还不算Web功能失败；main合并、资产应用、backend宿主替换及个人能力目录分开验收。

2026-10-06 13:37 UTC GO明确要求：恢复主线继续同时，沿既有WPF-RELEASE/SVC独立Web发布机制推进已审稳定前端到实际预览，不能以SVC06大构建或整Recovery完成作前置；0provider、优先现成产物、真实产品兼容，不刷新用户tab/换会话/发送。沿原TODO05，root已批[RELEASE03四literal/180秒](../../docs/evidence/web-platform/release03-current-preview-proposal.json)，直接本大task、w01唯一验证owner，原operator发布；未take。

现9eec10文件hash齐不等SVC format2可发布；既有API实际需正式build，而资源低于2.5GiB且依赖physical增量未知，先保现版本并写解除条件。另actual backend362仍缺已审history v2三行修复，未来须exact362 attachment-only/mixed reportEvents差分；失败则交原backendowner最小已审修复，不把“等SVC06”当笼统阻塞。完整descriptor、兼容四类raw、retained/oldchunk/CAS均沿原工具，无第二发布框架或新的产品写权。

2026-10-06 15:32 发布安全点：固定362实际A两项history失败，完整raw/清理与余176.126秒见[唯一接收入口](../../docs/evidence/web-platform/release03-a-actual-intake.json)。Lead已接收，后继只等待原backend owner的immutable362+已审三行修复新HEAD/tree；先新A再B/全兼容后原受管发布，不重跑未变362或改旧期望，不覆盖原WT。DPERF04保持未take，当前个人版本不变。

2026-10-06 GO固定fixture图反馈归原01-03/CHATREAD：[完整验收](../../docs/evidence/web-platform/short-chat-visual-go-intake.json)。普通hi以正文和输入为主，工程状态/loaded计数进明确详情入口；空queue轻入口，waiting/paused/error/unknown外显。只用已有metadata、展开前0detail，不猜空或总数；profile requested/effective沿MATURE02真实能力。发布/DPERF之后在同固定短聊单窗与split对照、键盘及异常可达性验收；无当前App写权或新第三层task。

[固定83f535四源与两张历史截图研究](../../docs/evidence/web-platform/short-chat-visual-83f535/report.md)补充原01-03：单窗图是running/长回答，split图才是succeeded/短回复；不把历史图标为当前SHA。普通turn的工程信息可归单详情入口，但Queue仍conversation上下文。轻空态须当前成功页无cursor/paused/blocked/error/unknown等；所有异常和可行动取消/决定仍外显。展开前不新增activity list/body请求，不为判断空预取；保officialThread/P01/原receipt。具体slot接缝已收到独立peer及下列补充，不新增当前写权。


2026-10-06 原01-03/CHATREAD/REQ43补充验收（[逐字原文与六固定blob核验](../../docs/evidence/web-platform/short-chat-visual-supplements-intake.json)）：

- 可发现详情入口放真实user turn的MessageFooter；MessageActions/ActionBar会在running/autohide时隐藏，不能成为唯一异常入口。保原message/task membership和PluginView/ExtensionSlot/host权限，不新增controller/registry/raw client。
- generic PluginView目前没有经检查的通用urgency摘要合同；不能把所有贡献先卸载折叠，再宣称异常始终可见。已知owner的真实错误、unknown、retry、非最终/截短正文及行动提示继续外显，未知贡献后继需最小现有owner接缝，禁止DOM解析猜状态。
- Task output为flow.task-actions.output，经授权转flow.workspace.open(tab terminal)；Open task controls转flow.chat.open。视觉可收拢，但两种动作与目标、上下文、能力均保留，不能按英文标题去重或删除。
- 富活动/普通控件/分页详情采用disclosure语义；原真正command menu保其focus/键盘模型。以Enter/Space、expanded、关闭回焦点与有意义status验收，不将整个body/每行改alert。WAI三主源由root实查，Flow方案仍待真实browser/辅助技术验证，不冒AT合规。

以上仅原TODO验收细化；原root四源/历史截图报告与peer五源报告字节均保留。Task output独立第六blob补足peer未查声明，不改写其原报告，也不声称后端Terminal加载或页面导航已经实测。发布与DPERF后排期，当前无产品领取。

app1750新增用户结果验收仍归原01-03/04与CHATREAD/REQ43：[固定506+af51截图后继](../../docs/evidence/web-platform/app1750-product-acceptance-followup.json)。390导航展开覆盖聊天只证明当时状态；后继实际关闭导航后读完整消息、编辑发送和展开详情，验证desktop↔narrow草稿与可见焦点保留、导航开关键盘语义。此补充不否定已通过发布兼容、不冒完整移动/a11y验收，不重跑原green旅程。

同一app1750验收补[root固定506导航两源研究](../../docs/evidence/web-platform/app1750-narrow-navigation-root.md)：fresh窄屏与desktop resize须分别验；导航开关expanded与关闭/选会话后的焦点回交需真实键盘验证，保持main/draftMap和原plugin slots身份。源码推导不等运行bug，原native disclosure/modal取舍按实际交互核；不阻RELEASE或新建任务。

2026-10-06 安全点，原06-03/01-03 CHATREAD补[accepted queue六源研究](../../docs/evidence/web-platform/accepted-queue-506-research/report.md)：只将accepted enqueue收据作为最小紧凑候选；accepted cancel-item可能already-promoted、cancel-task仅请求接受，不能推无待办。unknown/rejected/sending、刷新失败/paused/blocked/current task确认、原key/context/动作和插件权限继续显著；展开前0详情预取。研究0运行、不新增任务或当前scope，后继仍真实用户验收。


本轮恢复列表可读性输入（U18，原TODO后继）：[GO实际观察及验收来源](../../docs/evidence/web-platform/quick-native1-recovery-review-20261007/incoming.json)指出UUID、工程收据及长UTC抢占主层。使用可读标题/摘要、Intl本地时间与紧凑层级，精确身份/UTC保留下钻；仅授权轻metadata或诚实fallback，不为title预取正文。No text不是重复/可删除证据，文件、知识、intent、unknown及原请求保持，不自动合并删除重发。沿既有web-design-guidelines/Arc方向，未take/未实施，不阻原full7限定结果。

## U19：真实host的快速设置弹层后继

GO实际截图观察经root准确转述，非用户逐字：[固定组件六组结果及体验来源](../../docs/evidence/web-platform/queue-full6-closeout-20261007/compact-settings-go-intake.json)。180字压力标签重复占高、Apply在首屏外；原组件6/6与双主题截图的限定通过保留，不等完整实际App视觉通过。沿01-02/04及原MATURE02 TODO11接线时采用紧凑model/thinking/speed主入口，完整目录与解释下钻；长名视觉限高但完整exact身份可查看、可区分，Apply/Cancel不因目录长度难找，复用已有圆角/阴影/材质tokens。正常真实标签和压力长名分别在390/双主题、键盘与焦点操作中验收；保exact授权tuple、显式Apply、opening/current ownership CAS和两pane草稿，不以自动fallback/提交换紧凑。

本后继尚未take/实施；组件主线接收、Recovery/App写权交接与真实backend028/032兼容须分别确认。个人仍af51/v18+d629/v3，原SVC06-05准备固定backend4fe33178与三保留artifact兼容；不是Web-only已可用或新发布系统。MATURE02父source不在本管理claim内，只经中央需求索引交其owner，不代写其状态。

U19具体[只读源研究](../../docs/evidence/web-platform/queue-full6-closeout-20261007/compact-host-source-research.json)固定7源与官方接口：窄屏sm:rounded-lg不能单独供应radius；可变目录将Apply推远。后继评估有界scroll body外的header/footer，长名可限高但键盘/触控可读完整且相似前缀可辨，复用Thread ComposerActions、现registry及host CAS。仅设计输入/未实施或运行，不撤组件6PASS。

U19真实host的[具体接线候选](../../docs/evidence/web-platform/access-sse-host-checkpoint-20261007/message-settings-real-host-design.md)复用Thread ComposerActions与P01现context panel、App唯一C/ownership；Picker仅扩受控presentation，不重新造选择器/slot。实际Send/Queue/Recovery全链与紧凑主操作、正常名/长名/同前缀身份可辨一并验收；当前NOT_TAKEN，原六组只是固定叶组件。

U19/原MATURE02 TODO11补[T3 Code固定参考](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/t3-compact-reference.json)：GO给定cfa4f765，原ComposerControl统一sm/xs、focus/disabled及coarse-pointer命中；ComposerSurface的连续表面/theme变量/backdrop fallback仅作为评估输入。复用Flow tokens与主要Apply/Cancel可达，不直接搬复杂clip或theme覆写；实际依赖与MIT归属使用前核，未采用/未新增stack或task。composerSubmission仅validation/dispatch，不能替代Flow持久ACK、Queue、冻结与恢复。正常真实名与压力长名的真实host截图验收保留，原六组通过不撤。

原REQ19/01-05 retained真实App兼容后继仍由[RELEASE01唯一owner](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-release-compatibility/plans/wpf-release01-product-compatibility/status.md)承担。新38b9v1于10:00:08.645Z合法领取原两harness与own plan/evidence四范围，旧20a released不复用；[已审设计与新take](../../docs/evidence/web-platform/steering-diagnostic-release-preparation-20261007/current.json)允许独立源码实现，不依赖finaltuple先到。最终backendtuple未定时不能实际运行/回落旧b2b/c2c；Chrome专属proxy不能误作Node APIRequestContext代理，禁止Node访问个人61228，旧三AppBearer与独立Cookie补证分开。历史7805通过不冒后继已验。


2026-10-07 MSG03修后真实App双390×844主题图已由[root限定目视](../../docs/evidence/web-platform/release-backend-route-20261007/settings-lifecycle-visual-root-review.json)：容器无横向溢出、Apply/Cancel可见、极长同前缀model的C后缀可辨。非阻断P3：滚动条thumb贴近Speed选择器右侧affordance，后续原02/04视觉优化核留白/触达；尚未证明交互失败，不为此重跑本已绿旅程，不把这两图当整个视觉大task完成。


GO 对本次两390图的[原MATURE01验收反馈](../../docs/evidence/web-platform/release-backend-route-20261007/mature01-visual-feedback.json)已接收：窄屏浮窗直角硬边、遮罩偏重，四筛选加完整列表显得表单化，省略/不附加设置请求等实现语义文案过多。下一视觉片结合共享浮层、主题和信息层级统一处理，与上述滚动条P3归原02/04；使用本地frontend-design及既有Arc参考，保语义、键盘/焦点、reduced-motion和性能，不在picker堆局部补丁。极长模型名是刻意fixture，完整验收另含正常目录/defaultcollapsed/桌面与窄屏全页。当前优先可用网页，不挡MSG功能收口/最小发布，不新抢App或新增任务。


原视觉后继已复用[固定共享浮层设计研究](../../docs/evidence/web-platform/release-backend-route-20261007/shared-overlay/report.md)（7源、4本地skill、3primary文档），建议统一Dialog/token层次与正常目录渐进筛选/面向用户文案；保合法组合、Apply/CAS和原焦点语义。overlay scrollbar不能靠stable gutter解决，后续需内侧间距及两种滚动条模式验收；现theme插件仅color白名单，radius/shadow/filter是待设计权限，不是已有能力。此仅原02/04只读输入，未实现，不新取scope或重跑已绿检查。

[共享浮层真实消费者清单](../../docs/evidence/web-platform/msg03-final-intake-access-20261007/shared-overlay-consumers/report.md)将既有设计落实到原02/04候选：固定main六消费文件十一处DialogContent，最少共享Dialog/assistant-ui.css与两既有browser tests四literal，实际Picker/HTTP fixture及App Recovery为代表。MSG内侧滚动留白是另一个CSS精确交权项，不靠外层圆角宣称解决；保插件、焦点和两种滚动条边界。本次只读/NOT_TAKEN/NOT_RUN，未来fresh查重并合法交权；不阻最小网页发布。

GO已明确原共享浮层片进入下一执行位，设计研究停止扩展：新网页发布第一，Plugin实际App继续；W01在产物交Original且Release安全STOP后，按现有VISUAL01/MATURE01独立树与fresh精确范围实施桌面/窄屏统一圆角、轻阴影、适度遮罩，以及正常目录层级/主操作可达。尽量与不重叠Plugin并行，不等其完整完成；必要Picker/CSS要明列范围而非只修外框冒信息层级完成。仅代表性局部验证，保语义/焦点/键盘/reduced-motion，不重跑全业务、不冒个人部署；完整Arc/双主题及扩展材质仍open。无新增agent/task/take，当前发布运行需要仍优先。见[本次执行队列](../../docs/evidence/web-platform/msg03-main-release-source-handoff-20261007/current.json)。

下一源码执行位已收敛为[原VISUAL01具体派工候选](../../docs/evidence/web-platform/pair-compatibility-i01-browser-queue-20261007/shared-overlay-execution-slot.json)：W01在新pair兼容包安全停点后，以含已main真实设置消费者的固定3c9345建立独立 `web-shared-overlays`；六产品/test literal与两原owner records须当时fresh take。外框、正常目录信息层级和内侧滚动留白同片明确，保焦点/主题/Apply语义；15:42:39候选无active交集是观察，不是领取。I01 App/session写权不交叉，当前不占资源窗、不增加agent。

沿原 MATURE01-03 接收[本次恢复弹窗选定结果](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/visual-recovery-actual-review.json)：cookieRead/themes390与双390图通过，fullJourney=false，Picker未运行。GO目视认可该限定结果；[草稿内容层级后继](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/recovery-content-hierarchy-followup.json)要求先看到草稿/会话/保存时间，Restore主、Refresh次，技术ID和精确时间留现有详情。仅在个人恢复后合法独立scope实施，不扩大现VISUAL exact8、不倒改本次PASS。
